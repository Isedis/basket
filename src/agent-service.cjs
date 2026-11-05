const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {assertSafePath,validateState,contextMarkdown}=require('./core.cjs');
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
      const item=JSON.parse((await boundedRead(path.join(current.root,directory,entry.name),128*1024)).toString('utf8'));
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
    const existing=JSON.parse((await boundedRead(path.join(current.root,relative),128*1024)).toString('utf8'));
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
module.exports={snapshot,identity,guard,projectView,contextView,listReports,reportProgress,getReference};
