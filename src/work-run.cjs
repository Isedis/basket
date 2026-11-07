const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const service=require('./agent-service.cjs'),{scanProjectMap}=require('./project-map.cjs'),{fromMap}=require('./source-snapshot.cjs');
const {assertSafePath}=require('./core.cjs');
function inventory(map){return Object.fromEntries(map.nodes.filter(n=>typeof n.fingerprint==='string').map(n=>[n.file,n.fingerprint]));}
function differences(before,map){
  const after=inventory(map),seen=new Set(map.nodes.map(n=>n.file)),changes=[];
  for(const file of new Set([...Object.keys(before),...Object.keys(after)]))if(before[file]!==after[file]&&(!seen.has(file)||Object.hasOwn(after,file)))changes.push({file,kind:!Object.hasOwn(before,file)?'added':!Object.hasOwn(after,file)?'removed':'changed'});
  return changes.sort((a,b)=>a.file.localeCompare(b.file));
}
async function begin(root,taskId){
  const [s,map]=await Promise.all([service.snapshot(root),scanProjectMap(root)]);
  const task=s.state.tasks.find(t=>t.id===(taskId===undefined?s.state.activeTaskId:taskId)&&t.status!=='done');
  return {id:crypto.randomUUID(),root:s.root,project_id:s.project_id,revision:s.revision,task_id:task?.id||null,task_title:task?.title||null,started_at:new Date().toISOString(),files:inventory(map),source:fromMap(map)};
}
async function finish(start,{status,summary,sessionId,delivery,usage,godotCommand,signal,onChecking=()=>{},forceCheck=false,verifyScripts,agent='claude'}){
  let [s,map,feedback]=await Promise.all([service.snapshot(start.root),scanProjectMap(start.root),require('./visual-feedback.cjs').read(start.root)]);
  service.guard(s,start.project_id);
  let changes=differences(start.files,map);
  let engineCheck={name:'Импорт проекта в Godot (без окна)',result:'not_run',evidence:'Проверка не выполнялась для этого ответа.'};
  if((changes.length||forceCheck)&&status==='idle'){onChecking();engineCheck=await require('./godot-verification.cjs').check(start.root,{command:godotCommand,signal,scriptFiles:verifyScripts?verifyScripts.filter(file=>map.nodes.some(node=>node.file===file&&file.endsWith('.gd'))):changes.filter(c=>c.kind!=='removed'&&c.file.endsWith('.gd')).map(c=>c.file)});[s,map,feedback]=await Promise.all([service.snapshot(start.root),scanProjectMap(start.root),require('./visual-feedback.cjs').read(start.root)]);service.guard(s,start.project_id);changes=differences(start.files,map);if(engineCheck.verified_revision&&engineCheck.verified_revision!==require('./godot-verification.cjs').version(map))engineCheck=require('./godot-verification.cjs').invalidate(engineCheck);}
  const sceneRuns=await require('./scene-run.cjs').list(start.root,{task_id:start.task_id,limit:3}).catch(()=>[]);
  const sceneRun=sceneRuns.find(r=>r.created_at>=start.started_at&&r.status!=='running'&&!r.stale_code&&!r.code_changed_during_run);
  const sceneCheck=sceneRun?.checks?.find(c=>c.kind==='godot-scene');
  const runtimeCheck=sceneCheck?{...sceneCheck,scene_run_id:sceneRun.id,scene:sceneRun.scene}:{name:'Запуск и поведение игры в Godot',result:'not_run',evidence:'Для текущего кода и задачи нет завершённого запуска сцены за время этого ответа. История доступна через opora_scene_result.'};
  const id=crypto.createHash('sha256').update('opora-observed-turn:'+start.id).digest('hex'),source=fromMap(map);
  const report={version:1,id,project_id:s.project_id,revision:s.revision,brand_revision:s.brand_revision,feedback_revision:feedback.feedback_revision,agent:['claude','codex','other'].includes(agent)?agent:'other',task_id:start.task_id,task_title:start.task_title,phase:status!=='idle'||signal?.aborted||(engineCheck.result==='failed'||runtimeCheck.result==='failed')?'blocked':changes.length?'ready_for_review':'in_progress',summary:String(summary||'Ответ без текстовой сводки.').slice(0,12000),recordedAt:new Date().toISOString(),startedAt:start.started_at,selfReported:true,automatic:true,summary_source:'agent_response',file_changes_source:'application_observation',origin:'opora-observed',session_id:sessionId,source_snapshot:source,before_snapshot:start.source,context_changed:start.revision!==s.revision,changes:changes.slice(0,120),changes_total:changes.length,limited:source.limited||start.source.limited,delivery,usage,checks:[engineCheck,runtimeCheck],coverage:'Observed differences in indexed static code/scenes/resources during this turn. Concurrent edits may be included. Runtime checks, when linked by scene_run_id, cover startup and one viewport frame only. No gameplay or visual-quality assertion.'};
  const relative='.opora/agent-reports/'+id+'.json';await assertSafePath(start.root,relative);await fs.mkdir(path.dirname(path.join(start.root,relative)),{recursive:true});
  // Publish a complete record atomically so UI polling cannot read a partial JSON.
  const temp=path.join(start.root,relative+'.tmp');await fs.writeFile(temp,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});try{await fs.rename(temp,path.join(start.root,relative));}finally{await fs.rm(temp,{force:true}).catch(()=>{});}
  return {report_id:id,task_id:start.task_id,task_title:start.task_title,phase:report.phase,changes:report.changes,changes_total:changes.length,limited:report.limited,source_revision:source.revision,checks:report.checks};
}
module.exports={begin,finish};
