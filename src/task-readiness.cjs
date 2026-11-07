const fs=require('node:fs/promises'),path=require('node:path'),{assertSafePath}=require('./core.cjs'),{normalizeTaskFiles}=require('../ui/context.js');
async function inspectFiles(root,files=[]){
 return Promise.all(normalizeTaskFiles(files).map(async file=>{try{await assertSafePath(root,file);const stat=await fs.stat(path.join(root,file));return {file,status:stat.isFile()?'present':'not_file'};}catch(error){return {file,status:error.code==='ENOENT'?'missing':'unknown'};}}));
}
function assess({task,files=[],plan,linked,replacement,notes=[],report,reportReadFailed=false}){
 const items=[];const add=(code,message,action,extra={})=>items.push({code,message,level:'attention',action,...extra});
 if(!task)return {state:'no_task',advisory:true,items:[],attention_count:0};
 if(!task.acceptance.trim())add('criteria_empty','Не указано, как проверить готовность задачи.',{kind:'edit',label:'Добавить критерии'});
 for(const file of files){if(file.status==='missing')add('file_missing','Закреплённый файл отсутствует: '+file.file+'. Если его нужно создать, уточните это в критериях.',{kind:'files',file:file.file,label:'Проверить связь'},{file:file.file});
  if(file.status==='not_file')add('file_not_file','Вместо файла закреплена папка: '+file.file,{kind:'files',file:file.file,label:'Исправить связь'},{file:file.file});
  if(file.status==='unknown')add('file_unknown','Не удалось проверить файл: '+file.file+'. Путь недоступен или проходит через символическую ссылку.',{kind:'files',file:file.file,label:'Посмотреть файлы'},{file:file.file,level:'info'});}
 if(plan?.stale_task)add('plan_outdated','После создания плана изменились требования или файлы задачи. План нужно пересмотреть.',{kind:'plan',label:'Открыть этапы'});
 if(linked?.note.superseded_by){const n=replacement?.note;add('feedback_superseded','Исходное замечание заменено новым решением. Проверьте привязку и критерии задачи.',{kind:'feedback',shot_id:replacement?.shot.id||linked.shot.id,note_id:n?.id||linked.note.id,label:n?'Открыть актуальное решение':'Открыть историю'},{note_id:linked.note.id,...(n?{replacement:{shot_id:replacement.shot.id,note_id:n.id}}:{})});}
 if(task.feedbackNoteId&&!linked)add('feedback_missing','Связанное с задачей замечание не найдено.',{kind:'feedback',label:'Открыть замечания'});
 const pending=notes.filter(x=>x.note.status==='ready'&&!x.note.superseded_by);
 if(pending.length)add('feedback_review','Есть результаты по замечаниям, которые ещё не приняты: '+pending.length+'.',{kind:'feedback',shot_id:pending[0].shot.id,note_id:pending[0].note.id,label:'Посмотреть результат'},{pending_count:pending.length,note_id:pending[0].note.id});
 if(report){const failed=report.checks.filter(c=>c.result==='failed');
  if(failed.length)add('checks_failed',(report.stale_code?'В последнем отчёте были ошибки; код после этого изменился. Нужна повторная проверка.':'В последнем отчёте есть ошибки проверок.')+' '+failed.map(c=>c.name).slice(0,3).join('; '),{kind:'results',label:'Открыть проверки'},{report_id:report.id,stale_code:!!report.stale_code,checks:failed.slice(0,5).map(c=>({name:c.name,result:c.result,verified_by:c.verified_by||'agent',evidence:String(c.evidence||'').slice(0,800)}))});
  if(report.phase==='blocked'&&!failed.length)add('report_blocked','В последнем отчёте остался блокер. Проверьте его перед продолжением.',{kind:'results',label:'Открыть отчёт'},{report_id:report.id,evidence:report.summary.slice(0,800)});
  if(report.phase==='ready_for_review'&&task.status!=='done')add('report_review','Последний результат агента ещё не подтверждён завершением задачи.',{kind:'results',label:'Посмотреть результат'},{report_id:report.id});
 }
 if(reportReadFailed)add('reports_unknown','Не удалось полностью прочитать отчёты. Состояние последних проверок не подтверждено.',{kind:'results',label:'Открыть результаты'},{level:'info'});
 const attention_count=items.filter(i=>i.level==='attention').length;
 return {read_more:{tool:'opora_list_reports',task_id:task.id},latest_report_id:report?.id||null,state:attention_count?'needs_attention':items.length?'limited':'no_known_issues',advisory:true,attention_count,items,scope:'Saved criteria, linked files, plan, scoped feedback and latest task report. Not a game-quality verdict or permission gate. Review relevant findings before edits; missing files may be intended new files. Pending human review is informational: never accept results for the user or pause normal authorized work just to request approval.'};
}
module.exports={assess,inspectFiles};
