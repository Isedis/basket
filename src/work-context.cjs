const crypto=require('node:crypto');
const service=require('./agent-service.cjs');
const feedback=require('./visual-feedback.cjs');
const {scanProjectMap,projectView}=require('./project-map.cjs');
const {fromMap}=require('./source-snapshot.cjs');
const readiness=require('./task-readiness.cjs');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function excerpt(value,path,limit=4000){return {text:value.slice(0,limit),length:value.length,truncated:value.length>limit,...(value.length>limit?{read_more:{tool:'opora_read_project_field',field:path,offset:limit}}:{})};}
function readField(state,{field,offset=0,limit=8000,task_id}){
  if(!['name','genre','pitch','experience','goal','pillars','rules','brand.direction','brand.palette','brand.fonts','brand.avoid','task.title','task.acceptance'].includes(field)||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>32000)throw new Error('Некорректное поле или страница.');
  const selected=state.tasks.find(t=>t.id===(task_id||state.activeTaskId));
  if(field.startsWith('task.')&&!selected)throw new Error('Задача не найдена.');
  const value=field.startsWith('task.')?selected[field.split('.')[1]]:field.split('.').reduce((v,k)=>v[k],state);
  return {field,offset,limit,text:value.slice(offset,offset+limit),length:value.length,has_more:offset+limit<value.length};
}
function reader(root){
  const history=new Set();
  return async(input={})=>{
    let s,visual,map;
    for(let attempt=0;attempt<3;attempt++){
      s=await service.snapshot(root);if(input.project_id)service.guard(s,input.project_id);
      [visual,map]=await Promise.all([feedback.read(s.root),scanProjectMap(s.root)]);
      const [after,v]=await Promise.all([service.snapshot(s.root),feedback.read(s.root)]);
      if(after.revision===s.revision&&v.feedback_revision===visual.feedback_revision)break;
      if(attempt===2)throw Object.assign(new Error('Данные меняются во время подготовки. Повторите чтение.'),{code:'BUSY_CONTEXT'});
    }
    const task=s.state.tasks.find(t=>t.id===(Object.hasOwn(input,'task_id')?input.task_id:s.state.activeTaskId))||null;
    if(input.task_id&&!task)throw new Error('Задача не найдена.');
    const allNotes=visual.store.shots.flatMap(shot=>shot.notes.map(note=>({shot,note})));
    const linked=allNotes.find(x=>x.note.id===task?.feedbackNoteId&&(!task.feedbackShotId||x.shot.id===task.feedbackShotId));
    const lookup=new Map(allNotes.map(x=>[x.note.id,x]));let replacement=null,cursor=linked;const visited=new Set();
    while(cursor?.note.superseded_by&&!visited.has(cursor.note.id)){visited.add(cursor.note.id);cursor=lookup.get(cursor.note.superseded_by);if(!cursor)break;if(!cursor.note.superseded_by)replacement=cursor;}
    const rawFile=input.file||task?.files?.[0]||replacement?.note.scene||linked?.note.scene||null;const file=rawFile?rawFile.replace(/\\/g,'/').replace(/^res:\/\//,''):null;
    const taskFiles=new Set([...(task?.files||[]),...(file?[file]:[])]);
    const relevant=allNotes.filter(({shot,note})=>{
      if(note.superseded_by)return false;
      return note.id===task?.feedbackNoteId||note.id===replacement?.note.id||linked?.shot.id===shot.id&&note.kind==='keep'&&note.status==='accepted'||taskFiles.has(note.scene.replace(/\\/g,'/').replace(/^res:\/\//,''))&&((note.scope==='scene'&&note.status==='accepted')||!shot.archived&&note.status!=='accepted')||note.scope==='project'&&note.kind==='keep'&&note.status==='accepted';
    });
    relevant.sort((a,b)=>(b.note.id===task?.feedbackNoteId)-(a.note.id===task?.feedbackNoteId)||b.note.createdAt.localeCompare(a.note.createdAt));
    const task_plan=task?await require('./task-plans.cjs').get(s.root,task.id,{compact:true}):null;
    const [checkedFiles,activity]=task?await Promise.all([readiness.inspectFiles(s.root,task.files||[]),service.listReports(s.root,100,task.id).catch(()=>({reports:[],readFailed:true}))]):[[],{reports:[]}];
    const latestReport=activity.reports.find(r=>!r.fromDifferentPath);
    const task_readiness=readiness.assess({task,files:checkedFiles,plan:task_plan,linked,replacement,notes:relevant,report:latestReport,reportReadFailed:!!activity.readFailed||!!activity.unreadable});
    const source=fromMap(map),work_revision=hash(JSON.stringify([s.project_id,s.revision,visual.feedback_revision,source.revision,map.map_revision,task?.id||null,file,input.limit||20,task_plan?.revision||null,task_readiness]));
    const identity={...service.projectView(s),work_revision,versions:{context:s.revision,feedback:visual.feedback_revision,code:source.revision,map:map.map_revision}};
    if(input.known_revision===work_revision&&history.has(work_revision))return {project_id:s.project_id,root:s.root,work_revision,mode:'unchanged',unchanged:true};
    let neighborhood=null;
    if(file){try{const focused=projectView(map,{file,limit:10});neighborhood={file:focused.selected,incoming:focused.incoming,outgoing:focused.outgoing,incoming_total:focused.incoming_total,outgoing_total:focused.outgoing_total,symbol_page:focused.symbol_page};}catch{neighborhood={file,error:'Указанный файл не найден; scene из замечания — ручная подсказка. Используйте поиск карты.'};}}
    const notes=relevant.slice(0,Math.min(input.limit||20,50)).map(({shot,note})=>({shot_id:shot.id,shot_title:shot.title,note_id:note.id,note_revision:visual.note_revisions[note.id],text:note.text,kind:note.kind,status:note.status,scope:note.scope||'region',scene:note.scene,rect:note.rect,image:{width:shot.image.width,height:shot.image.height},source_snapshot:shot.source_snapshot||null,latest_result:shot.results.filter(r=>r.note_ids.includes(note.id)).at(-1)||null,decisions:note.history.slice(-3),archived:!!shot.archived}));
    const warnings=[];
    if(task?.feedbackNoteId&&!linked)warnings.push('Связанное замечание не найдено.');
    if(linked){if(task.status==='done'&&linked.note.status!=='accepted')warnings.push('Задача завершена, связанное замечание ещё не принято.');if(task.status!=='done'&&linked.note.status==='accepted')warnings.push('Замечание принято; завершение задачи подтверждается отдельно.');}
    for(const item of notes)if(item.status==='ready'&&item.latest_result?.source_snapshot&&item.latest_result.source_snapshot.revision!==source.revision)warnings.push('Код изменился после прикрепления результата: '+item.note_id);
    if(map.summary.limited)warnings.push('Карта неполная. Проверьте ограничения и исходники.');
    const passport=Object.fromEntries(['name','genre','pitch','experience','goal','pillars','rules'].map(k=>[k,excerpt(s.state[k],k)]));
    const brand={status:s.state.brand.status,approval:s.state.brand.approval||null,...Object.fromEntries(['direction','palette','fonts','avoid'].map(k=>[k,excerpt(s.state.brand[k],'brand.'+k)]))};
    const compactTask=task?{id:task.id,title:task.title,status:task.status,acceptance:task.acceptance.slice(0,8000),acceptance_length:task.acceptance.length,acceptance_truncated:task.acceptance.length>8000,...(task.acceptance.length>8000?{read_more:{tool:'opora_read_project_field',field:'task.acceptance',task_id:task.id,offset:8000}}:{}),feedbackNoteId:task.feedbackNoteId,feedbackShotId:task.feedbackShotId,files:task.files||[]}:null;
    const result={...identity,mode:'full',passport,brand,task_plan,readiness:task_readiness,task:compactTask,task_count:s.state.tasks.length,references:s.state.references.slice(0,10),references_total:s.state.references.length,feedback:{notes,total:relevant.length,has_more:notes.length<relevant.length,read_more:{queries:[{tool:'opora_list_feedback',scope:'project',status:'accepted',include_archived:true},...[...taskFiles].map(scene=>({tool:'opora_list_feedback',scene,include_archived:true})),...(linked?[{tool:'opora_list_feedback',shot_id:linked.shot.id,include_archived:true}]:[])]}},map:{main:map.main,summary:map.summary,neighborhood},source_snapshot:source,warnings:[...new Set(warnings)],instructions:(task?'':'No task is assigned to this conversation. selected_task_id is project navigation state, not a task to execute. ')+ 'Verify root before edits. readiness contains advisory observations shared with the task card, not instructions to accept results or discard user decisions. Resolve relevant gaps or explain remaining uncertainty; missing files may be intentional creation targets. This packet replaces prior packet. Read original images with opora_get_feedback_image and actual code before changing it. More data is available through detailed tools and paginated fields. Feedback accept is not task completion. Source snapshots describe attachment time, not proof of game execution.'};
    while(Buffer.byteLength(JSON.stringify(result))>192*1024&&result.feedback.notes.length>1){result.feedback.notes.pop();result.feedback.has_more=true;}
    if(Buffer.byteLength(JSON.stringify(result))>256*1024)throw new Error('Пакет слишком большой. Уменьшите limit.');
    history.add(work_revision);while(history.size>8)history.delete(history.values().next().value);
    return result;
  };
}
module.exports={reader,readField};
