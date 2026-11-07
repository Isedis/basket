const service=require('./agent-service.cjs'),context=require('./work-context.cjs'),{scanProjectMap}=require('./project-map.cjs'),{normalizeTaskFiles}=require('../ui/context.js');
async function read(root,taskId){
 if(typeof taskId!=='string'||!taskId||taskId.length>160)throw new Error('Некорректная задача.');
 for(let attempt=0;attempt<3;attempt++){
  const packet=await context.reader(root)({task_id:taskId,limit:50});
  const [s,activity,map]=await Promise.all([service.snapshot(root),service.listReports(root,100,taskId),scanProjectMap(root)]);
  if(s.revision!==packet.revision||map.map_revision!==packet.versions.map){if(attempt<2)continue;throw new Error('Проект меняется. Обновите карточку.');}
  const task=s.state.tasks.find(t=>t.id===taskId);if(!task)throw new Error('Задача удалена.');
  const nodes=new Map(map.nodes.map(n=>[n.file,n])),files=new Map();
  function add(raw,source){let file;try{file=normalizeTaskFiles([raw])[0];}catch{return;}if(files.size>=80&&!files.has(file))return;let item=files.get(file);if(!item){const n=nodes.get(file);item={file,kind:n?.kind||null,exists:n?.exists===false?false:n?true:map.summary.limited?null:false,system:n?.system_label||null,sources:[]};files.set(file,item);}if(!item.sources.includes(source))item.sources.push(source);}
  for(const file of task.files||[])add(file,'task');
  for(const note of packet.feedback.notes)if(note.scene)add(note.scene,'feedback');
  const reports=activity.reports.filter(r=>!r.fromDifferentPath);
  for(const report of reports.slice(0,10))for(const change of report.changes||[])add(change.file,'report');
  return {root:s.root,project_id:s.project_id,revision:s.revision,task,selected:s.state.activeTaskId===taskId,packet,files:[...files.values()],reports:reports.slice(0,10),reports_total:reports.length,reports_limited:(activity.total||0)>100,unreadable_reports:activity.unreadable,updatedAt:new Date().toISOString()};
 }
}
module.exports={read};
