const path=require('node:path');
function title(tool){
  const names={Godot:'Проверяет проект в Godot',Read:'Читает файл',Edit:'Редактирует файл',MultiEdit:'Редактирует файл',Write:'Записывает файл',Bash:'Выполняет команду',Grep:'Ищет в коде',Glob:'Ищет файлы',AskUserQuestion:'Ждёт вашего ответа',Task:'Запускает помощника',Agent:'Работает с помощником'};
  if(names[tool])return names[tool];if(tool.includes('opora_task_plan'))return 'Работает с этапами';if(tool.includes('opora_get_work_context'))return 'Читает контекст Опоры';if(tool.includes('opora_'))return 'Работает с данными Опоры';return 'Использует инструмент: '+tool.slice(0,80);
}
function detail(root,input={}){
  const file=input.file_path||input.path||input.file||input.scene;
  if(typeof file==='string'){const relative=path.isAbsolute(file)?path.relative(root,file):file;return relative.replace(/\\/g,'/').slice(0,240);}
  return String(input.description||input.command||input.pattern||input.query||input.stage_id||'').replace(/\s+/g,' ').slice(0,240);
}
function begin(c,user){c.turn_id=user.id;c.started_at=user.time;c.activity_id='activity-'+user.id;c.activity_detail='';const card={id:c.activity_id,kind:'activity',role:'system',text:'',turn_id:user.id,time:user.time,status:'running',events:[]};c.messages.push(card);return card;}
function track(c,id,tool,input,status='running'){
  const card=c.messages.find(m=>m.id===c.activity_id);if(!card)return null;
  id=id||'tool-'+tool;let row=card.events.find(e=>e.id===id);
  if(!row){row={id,tool,title:title(tool),detail:detail(c.root,input),status,time:new Date().toISOString()};card.events.push(row);card.events=card.events.slice(-80);}
  else {const text=detail(c.root,input);if(text)row.detail=text;if(status!=='running'||['running','waiting'].includes(row.status))row.status=status;}
  if(status==='running'&&row.status==='running'){c.activity=row.title;c.activity_detail=row.detail;}
  if(!['running','waiting'].includes(row.status))row.finished_at=new Date().toISOString();return card;
}
function end(c){const card=c.messages.find(m=>m.id===c.activity_id);if(!card)return null;card.status=c.status;card.finished_at=new Date().toISOString();for(const row of card.events)if(['running','waiting'].includes(row.status))row.status=c.status==='idle'?'ended':'interrupted';return card;}
module.exports={begin,track,end,title};
