const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {assertSafePath,validateState,contextMarkdown,updateProject}=require('./core.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const fault=(code,message)=>Object.assign(new Error(message),{code});

async function boundedRead(file,max) {
  const handle=await fs.open(file,'r');
  try {
    const stat=await handle.stat();
    if(!stat.isFile() || stat.size>max)throw fault('TOO_LARGE','Файл слишком большой для MCP.');
    const buffer=Buffer.alloc(Math.min(stat.size+1,max+1));
    const {bytesRead}=await handle.read(buffer,0,buffer.length,0);
    if(bytesRead>max)throw fault('TOO_LARGE','Файл слишком большой для MCP.');
    return buffer.subarray(0,bytesRead);
  } finally {await handle.close();}
}
async function snapshot(root) {
  const real=await fs.realpath(root);
  await assertSafePath(real,'project.godot');
  await fs.access(path.join(real,'project.godot'));
  await assertSafePath(real,'.opora/project.json');
  let state;
  try {state=validateState(JSON.parse((await boundedRead(path.join(real,'.opora/project.json'),2*1024*1024)).toString('utf8')));} catch(error) {
    if(error.code==='ENOENT')throw fault('NOT_CONFIGURED','Откройте эту игру в Опоре и сохраните её настройки.');
    if(error instanceof SyntaxError)throw fault('INVALID_STATE','Не удалось прочитать настройки Опоры.');
    throw error;
  }
  const canonical=process.platform==='win32'?real.toLowerCase():real;
  return {root:real,state,project_id:hash(canonical).slice(0,32),revision:hash(JSON.stringify(state)),brand_revision:hash(JSON.stringify({brand:state.brand,references:state.references}))};
}
function guard(current,projectId,revision) {
  if(current.project_id!==projectId)throw fault('WRONG_PROJECT','Это другой проект. Сначала вызовите opora_get_project у нужного сервера.');
  if(revision!==undefined && current.revision!==revision)throw fault('STALE_CONTEXT','Контекст изменился. Перечитайте opora_get_context и используйте новую revision.');
}
function identity(s) {return {project_id:s.project_id,revision:s.revision,brand_revision:s.brand_revision};}
async function listReports(root,limit=30) {
  const current=await snapshot(root);
  const directory='.opora/agent-reports';
  await assertSafePath(current.root,directory);
  let entries;
  try {entries=await fs.readdir(path.join(current.root,directory),{withFileTypes:true});} catch(error) {if(error.code==='ENOENT')return {reports:[],unreadable:0};throw error;}
  let unreadable=0;
  const reports=[];
  for(const entry of entries) {
    if(!/^[a-f0-9]{64}\.json$/.test(entry.name) || !entry.isFile())continue;
    try {
      const item=JSON.parse((await boundedRead(path.join(current.root,directory,entry.name),512*1024)).toString('utf8'));
      if(item.version!==1 || typeof item.project_id!=='string' || typeof item.revision!=='string' || typeof item.summary!=='string' || !['in_progress','blocked','ready_for_review'].includes(item.phase) || !['claude','codex','other'].includes(item.agent) || typeof item.recordedAt!=='string' || !Array.isArray(item.checks) || item.checks.some(c=>!c || typeof c.name!=='string' || !['passed','failed','not_run'].includes(c.result))) {unreadable++;continue;}
      reports.push({...item,stale:item.revision!==current.revision,fromDifferentPath:item.project_id!==current.project_id});
    } catch {unreadable++;}
  }
  reports.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt));
  return {reports:reports.slice(0,Math.min(limit,100)),unreadable};
}
async function reportProgress(root,input) {
  const current=await snapshot(root);
  guard(current,input.project_id,input.revision);
  if(input.task_id && !current.state.tasks.some(t=>t.id===input.task_id))throw fault('UNKNOWN_TASK','Задача не найдена. Перечитайте opora_list_tasks.');
  const payload={project_id:input.project_id,revision:input.revision,agent:input.agent,request_id:input.request_id,task_id:input.task_id||null,phase:input.phase,summary:input.summary,checks:input.checks||[]};
  const fingerprint=hash(JSON.stringify(payload));
  const id=hash(current.project_id+'\n'+input.agent+'\n'+input.request_id);
  const relative=`.opora/agent-reports/${id}.json`;
  await assertSafePath(current.root,relative);
  await fs.mkdir(path.join(current.root,'.opora/agent-reports'),{recursive:true});
  const report={version:1,id,...payload,fingerprint,brand_revision:current.brand_revision,recordedAt:new Date().toISOString(),selfReported:true};
  try {await fs.writeFile(path.join(current.root,relative),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});} catch(error) {
    if(error.code!=='EEXIST')throw error;
    const existing=JSON.parse((await boundedRead(path.join(current.root,relative),512*1024)).toString('utf8'));
    if(existing.fingerprint!==fingerprint)throw fault('DUPLICATE_REQUEST','Этот request_id уже использован для другого отчёта. Используйте новый.');
    return {report_id:id,duplicate:true,task_status_unchanged:true};
  }
  return {report_id:id,duplicate:false,task_status_unchanged:true};
}
async function getReference(root,input) {
  const current=await snapshot(root);guard(current,input.project_id,input.revision);
  const ref=current.state.references.find(r=>r.id===input.reference_id);
  if(!ref)throw fault('UNKNOWN_REFERENCE','Образец не найден. Перечитайте opora_get_brandbook.');
  await assertSafePath(current.root,ref.file);
  const data=await boundedRead(path.join(current.root,ref.file),8*1024*1024);
  const ext=path.extname(ref.file).slice(1);
  return {reference:ref,data:data.toString('base64'),mimeType:'image/'+(['jpg','jpeg'].includes(ext)?'jpeg':ext),...identity(current)};
}
function projectView(current) {return {...identity(current),name:current.state.name,root:current.root,selected_task_id:current.state.activeTaskId||null,brand_status:current.state.brand.status};}
async function contextView(root,projectId) {
  const current=await snapshot(root);guard(current,projectId);
  const markdown=contextMarkdown(current.state);
  if(Buffer.byteLength(markdown)>256*1024)throw fault('TOO_LARGE','Контекст больше 256 КБ. Сократите его в Опоре или читайте брендбук и задачи отдельными инструментами.');
  return {...projectView(current),markdown};
}
function contextReader(root) {
  const history=new Map();
  return async(projectId,knownRevision)=>{
    const current=await snapshot(root);guard(current,projectId);
    const previous=history.get(knownRevision);
    const remember=()=>{history.set(current.revision,structuredClone(current.state));while(history.size>8)history.delete(history.keys().next().value);};
    if(knownRevision===current.revision && previous){remember();return {...projectView(current),mode:'unchanged',unchanged:true};}
    if(previous){
      const changes={};const removed=[];
      for(const key of new Set([...Object.keys(previous),...Object.keys(current.state)])){
        if(JSON.stringify(previous[key])===JSON.stringify(current.state[key]))continue;
        if(Object.hasOwn(current.state,key))changes[key]=current.state[key];else removed.push(key);
      }
      // Selecting a different task also changes its readable acceptance criteria.
      if(Object.hasOwn(changes,'activeTaskId'))changes.tasks=current.state.tasks;
      // Arrays are replacements, including all task/reference records; no truncation.
      const result={...projectView(current),mode:'delta',base_revision:knownRevision,revision:current.revision,changes,removed,apply:'These fields override the corresponding sections of your retained context; remove keys in removed. Arrays contain the complete current list. Other fields remain unchanged. Omit known_revision to reread full context anytime.'};
      if(Buffer.byteLength(JSON.stringify(result))<=256*1024){remember();return result;}
    }
    const markdown=contextMarkdown(current.state);
    if(Buffer.byteLength(markdown)>256*1024)throw fault('TOO_LARGE','Контекст больше 256 КБ. Читайте брендбук и задачи отдельными инструментами.');
    const full={...projectView(current),markdown};
    remember();return {...full,mode:'full',reason:knownRevision?'Previous version unavailable or delta too large; full context returned.':'Initial context.'};
  };
}

async function updateBrandbook(root,input) {
  const keys=['direction','palette','fonts','avoid'];
  if(!/^[a-f0-9]{32}$/.test(input.project_id) || !/^[a-f0-9]{64}$/.test(input.revision) || !input.fields || !Object.keys(input.fields).length || Object.keys(input.fields).some(k=>!keys.includes(k)) || Object.values(input.fields).some(v=>typeof v!=='string'||v.length>64000) || !['claude','codex','other'].includes(input.agent) || !/^[a-zA-Z0-9_-]{8,80}$/.test(input.request_id) || typeof input.summary!=='string'||!input.summary.trim()||input.summary.length>4000)throw fault('INVALID_PATCH','Укажите поля direction/palette/fonts/avoid, агента, request_id и краткое описание.');
  const fields=Object.fromEntries(keys.filter(k=>Object.hasOwn(input.fields,k)).map(k=>[k,input.fields[k]]));
  const fingerprint=hash(JSON.stringify({revision:input.revision,agent:input.agent,request_id:input.request_id,fields,summary:input.summary}));
  let id;
  const result=await updateProject(root,async current=>{
    const s=await snapshot(root);guard(s,input.project_id);id=s.project_id;
    const prior=current.brand.agentDraft;
    if(prior?.request_id===input.request_id && prior.agent===input.agent){
      if(prior.fingerprint!==fingerprint)throw fault('DUPLICATE_REQUEST','Этот request_id уже использован для другого брендбука.');
      return null;
    }
    guard(s,input.project_id,input.revision);
    const next=structuredClone(current);
    next.brand={...next.brand,...fields,status:'draft',agentDraft:{agent:input.agent,request_id:input.request_id,summary:input.summary,fingerprint,base_revision:input.revision,updatedAt:new Date().toISOString()}};
    next.updatedAt=new Date().toISOString();return next;
  });
  return {project_id:id,revision:hash(JSON.stringify(result.state)),brand_revision:hash(JSON.stringify({brand:result.state.brand,references:result.state.references})),brand:result.state.brand,duplicate:!result.changed,backup:result.backup,approval_required:result.state.brand.status!=='approved'};
}
async function updateWorkspace(root,input) {
  const textKeys=['name','genre','pitch','experience','goal','pillars','rules'];
  const allowed=[...textKeys,'brand','tasks','active_task_id','reference_files'];
  const patch=input.fields;
  if(!patch || !Object.keys(patch).length || Object.keys(patch).some(k=>!allowed.includes(k)) || !/^[a-f0-9]{32}$/.test(input.project_id) || !/^[a-f0-9]{64}$/.test(input.revision) || !['claude','codex','other'].includes(input.agent) || !/^[a-zA-Z0-9_-]{8,80}$/.test(input.request_id) || typeof input.summary!=='string' || !input.summary.trim() || input.summary.length>4000)throw fault('INVALID_PATCH','Некорректное обновление проекта.');
  for(const key of textKeys)if(Object.hasOwn(patch,key) && (typeof patch[key]!=='string' || patch[key].length>64000 || key==='name'&&!patch[key].trim()))throw fault('INVALID_PATCH','Некорректное поле '+key);
  if(patch.brand && (Object.keys(patch.brand).some(k=>!['direction','palette','fonts','avoid'].includes(k)) || Object.values(patch.brand).some(v=>typeof v!=='string'||v.length>64000)))throw fault('INVALID_PATCH','Некорректные поля брендбука.');
  if(patch.tasks && (!Array.isArray(patch.tasks)||patch.tasks.length>100||patch.tasks.some(t=>!t||typeof t.title!=='string'||!t.title.trim()||t.title.length>180||typeof t.acceptance!=='string'||t.acceptance.length>12000||t.id!==undefined&&(typeof t.id!=='string'||!t.id||t.id.length>160)||t.status!==undefined&&!['backlog','active'].includes(t.status))))throw fault('INVALID_PATCH','Задачи должны содержать название и критерии; завершение подтверждает пользователь.');
  if(patch.reference_files && (!Array.isArray(patch.reference_files)||patch.reference_files.length>20||patch.reference_files.some(f=>typeof f!=='string')))throw fault('INVALID_PATCH','Некорректный список изображений.');
  const fingerprint=hash(JSON.stringify({revision:input.revision,agent:input.agent,fields:patch,summary:input.summary}));let projectId;
  const result=await updateProject(root,async current=>{
    const s=await snapshot(root);guard(s,input.project_id);projectId=s.project_id;
    if(current.agentUpdate?.request_id===input.request_id && current.agentUpdate.agent===input.agent){if(current.agentUpdate.fingerprint!==fingerprint)throw fault('DUPLICATE_REQUEST','request_id уже использован.');return null;}
    guard(s,input.project_id,input.revision);const next=structuredClone(current);
    for(const key of textKeys)if(Object.hasOwn(patch,key))next[key]=patch[key];
    if(patch.brand)next.brand={...next.brand,...patch.brand,status:'draft',agentDraft:{agent:input.agent,request_id:input.request_id,summary:input.summary,updatedAt:new Date().toISOString()}};
    const ids=new Set();
    for(const task of patch.tasks||[]){const id=task.id||crypto.randomUUID();if(ids.has(id))throw fault('INVALID_PATCH','Повторяющийся ID задачи.');ids.add(id);const old=next.tasks.find(t=>t.id===id);const value={...old,...task,id,status:task.status||(old?.status==='done'&&(old.title!==task.title||old.acceptance!==task.acceptance)?'backlog':old?.status||'backlog')};if(old)Object.assign(old,value);else next.tasks.push(value);}
    if(Object.hasOwn(patch,'active_task_id')){if(patch.active_task_id!==null && (typeof patch.active_task_id!=='string'||!next.tasks.some(t=>t.id===patch.active_task_id&&t.status!=='done')))throw fault('UNKNOWN_TASK','Нельзя выбрать неизвестную или завершённую задачу.');next.activeTaskId=patch.active_task_id;if(patch.active_task_id)next.tasks.find(t=>t.id===patch.active_task_id).status='active';}
    validateState(next);let total=0;const copies=[];
    for(const original of patch.reference_files||[]){
      const file=original.replace(/\\/g,'/');
      if(file.startsWith('/')||file.includes(':')||file.split('/').some(p=>!p||p==='.'||p==='..')||!/[.](png|jpe?g|webp)$/i.test(file))throw fault('INVALID_REFERENCE','Нужен относительный путь PNG/JPG/WebP внутри проекта.');
      await assertSafePath(s.root,file);const data=await boundedRead(path.join(s.root,file),8*1024*1024);total+=data.length;if(total>32*1024*1024)throw fault('TOO_LARGE','Изображения одного запроса превышают 32 МиБ.');
      const ext=path.extname(file).toLowerCase();const valid=ext==='.png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):['.jpg','.jpeg'].includes(ext)?data[0]===255&&data[1]===216&&data[2]===255:data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';
      if(!valid)throw fault('INVALID_REFERENCE','Содержимое файла не соответствует изображению.');
      const target='.opora/references/'+hash(data)+ext;
      if(!next.references.some(r=>r.file===target)){next.references.push({id:crypto.randomUUID(),name:path.basename(file),file:target,status:'draft',source:file});copies.push({target,data});}
    }
    next.agentUpdate={agent:input.agent,request_id:input.request_id,fingerprint,summary:input.summary,updatedAt:new Date().toISOString()};next.updatedAt=new Date().toISOString();validateState(next);
    if(Buffer.byteLength(JSON.stringify(next,null,2))>2*1024*1024)throw fault('TOO_LARGE','Настройки превышают 2 МиБ.');
    for(const {target,data} of copies){await assertSafePath(s.root,target);await fs.mkdir(path.dirname(path.join(s.root,target)),{recursive:true});try{await fs.writeFile(path.join(s.root,target),data,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if(!(await boundedRead(path.join(s.root,target),8*1024*1024)).equals(data))throw fault('REFERENCE_CONFLICT','Копия изображения отличается.');}}
    return next;
  });
  return {project_id:projectId,revision:hash(JSON.stringify(result.state)),brand_revision:hash(JSON.stringify({brand:result.state.brand,references:result.state.references})),state:result.state,backup:result.backup,duplicate:!result.changed};
}
module.exports={snapshot,identity,guard,projectView,contextView,contextReader,listReports,reportProgress,getReference,updateBrandbook,updateWorkspace};
