const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {assertSafePath,withProjectLock}=require('./core.cjs');
const {sourceSnapshot}=require('./source-snapshot.cjs');
const STORE='.opora/visual-feedback.json',MAX_IMAGE=8*1024*1024,MAX_STORE=8*1024*1024;
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const fault=(code,message)=>Object.assign(new Error(message),{code});
const uuid=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(value);
const string=(value,max=4000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const event=(action,extra={})=>({id:uuid(),action,...extra,at:now()});
async function boundedRead(file,max){
  const h=await fs.open(file,'r');
  try{const stat=await h.stat();if(!stat.isFile()||stat.size>max)throw fault('TOO_LARGE','Файл превышает допустимый размер.');const buffer=Buffer.alloc(Math.min(Number(stat.size)+1,max+1));const {bytesRead}=await h.read(buffer,0,buffer.length,0);if(bytesRead>max)throw fault('TOO_LARGE','Файл слишком большой.');return buffer.subarray(0,bytesRead);}finally{await h.close();}
}
function pngInfo(data){
  if(!Buffer.isBuffer(data)||data.length>MAX_IMAGE||data.length<45||!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||data.readUInt32BE(8)!==13||data.toString('ascii',12,16)!=='IHDR')throw fault('INVALID_IMAGE','Нужен PNG размером до 8 МиБ.');
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
  if(!width||!height||width*height>16_000_000)throw fault('INVALID_IMAGE','Снимок должен содержать не больше 16 миллионов пикселей.');
  let offset=8,idat=false,end=false;
  while(offset+12<=data.length){const length=data.readUInt32BE(offset);if(offset+12+length>data.length)throw fault('INVALID_IMAGE','PNG повреждён.');const type=data.toString('ascii',offset+4,offset+8);if(type==='IDAT')idat=true;if(type==='IEND'){end=true;break;}offset+=12+length;}
  if(!idat||!end)throw fault('INVALID_IMAGE','PNG не содержит полного изображения.');
  return {file:'.opora/feedback-images/'+hash(data)+'.png',sha256:hash(data),width,height,mimeType:'image/png'};
}
function rectValid(r){return r&&['x','y','w','h'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k]))&&r.x>=0&&r.y>=0&&r.w>=0.003&&r.h>=0.003&&r.x+r.w<=1.000001&&r.y+r.h<=1.000001;}
function validate(store){
  if(!store||store.version!==1||!Array.isArray(store.shots)||store.shots.length>2000)throw fault('INVALID_FEEDBACK','Повреждён список замечаний.');
  const ids=new Set();
  const imageValid=i=>i&&/^\.opora\/feedback-images\/[a-f0-9]{64}\.png$/.test(i.file)&&/^[a-f0-9]{64}$/.test(i.sha256)&&i.file.includes(i.sha256)&&Number.isInteger(i.width)&&Number.isInteger(i.height)&&i.width>0&&i.height>0&&i.width*i.height<=16_000_000;
  for(const shot of store.shots){
    if(!validId(shot.id)||ids.has(shot.id)||!string(shot.title,180)||!imageValid(shot.image)||!Array.isArray(shot.notes)||shot.notes.length>200||!Array.isArray(shot.results)||shot.results.length>240)throw fault('INVALID_FEEDBACK','Повреждён снимок.');
    ids.add(shot.id);
    if(shot.archives!==undefined&&(!Array.isArray(shot.archives)||shot.archives.some(a=>!/^\.opora\/feedback-archives\/[a-f0-9]{64}\.json$/.test(a.file)||!a.file.includes(a.sha256))))throw fault('INVALID_FEEDBACK','Повреждён индекс архива.');
    for(const note of shot.notes){
      if(!validId(note.id)||ids.has(note.id)||!string(note.text)||!rectValid(note.rect)||!['fix','keep'].includes(note.kind)||!['open','ready','accepted'].includes(note.status)||typeof note.scene!=='string'||note.scene.length>1024||note.scope!==undefined&&!['region','scene','project'].includes(note.scope)||!Array.isArray(note.history)||note.history.length>110||note.history.some(h=>!h||!['created','result','accept','reopen','superseded'].includes(h.action)||typeof h.at!=='string'||h.reason!==undefined&&(typeof h.reason!=='string'||h.reason.length>4000)))throw fault('INVALID_FEEDBACK','Повреждено замечание.');
      ids.add(note.id);
    }
    for(const result of shot.results){if(!validId(result.id)||ids.has(result.id)||!imageValid(result.image)||!string(result.summary)||!Array.isArray(result.note_ids)||!result.note_ids.length||result.note_ids.some(id=>!shot.notes.some(n=>n.id===id))||!['user','claude','codex','other'].includes(result.agent))throw fault('INVALID_FEEDBACK','Повреждён результат.');ids.add(result.id);}
  }
  return store;
}
function noteRevision(shot,note){return hash(JSON.stringify({image:shot.image.sha256,text:note.text,kind:note.kind,scene:note.scene,scope:note.scope||'region',rect:note.rect,status:note.status,superseded_by:note.superseded_by||null,supersedes:note.supersedes||null,latest:note.latest_result_id||shot.results.filter(r=>r.note_ids.includes(note.id)).at(-1)?.id||null,event:note.history.at(-1)}));}
function view(store){return {store,feedback_revision:hash(JSON.stringify(store)),note_revisions:Object.fromEntries(store.shots.flatMap(s=>s.notes.map(n=>[n.id,noteRevision(s,n)])))};}
async function read(root){
  await assertSafePath(root,STORE);let store;
  try{store=validate(JSON.parse((await boundedRead(path.join(root,STORE),MAX_STORE)).toString('utf8')));}catch(error){if(error.code!=='ENOENT')throw error;store={version:1,shots:[]};}
  return view(store);
}
async function writeImmutable(root,file,data){
  await assertSafePath(root,file);await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});
  try{await fs.writeFile(path.join(root,file),data,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if(hash(await boundedRead(path.join(root,file),Math.max(MAX_STORE,MAX_IMAGE)))!==hash(data))throw fault('CORRUPT_COPY','Сохранённая копия повреждена.');}
}
function compact(shot,pending){
  for(const r of shot.results)if(r.request_id&&r.fingerprint)(shot.receipts||={})[hash(r.agent+'\n'+r.request_id)]={result_id:r.id,fingerprint:r.fingerprint};
  const {archives,receipts,...snapshot}=shot;
  const data=Buffer.from(JSON.stringify({version:1,shot:snapshot}));
  const sha256=hash(data),file='.opora/feedback-archives/'+sha256+'.json';
  if(!shot.archives?.some(a=>a.sha256===sha256)){pending.push({file,data});(shot.archives||=[]).push({file,sha256,createdAt:now(),results:shot.results.length});}
  const latestIds=new Set(shot.notes.map(n=>n.latest_result_id||shot.results.filter(r=>r.note_ids.includes(n.id)).at(-1)?.id).filter(Boolean));
  const recent=new Set(shot.results.slice(-8).map(r=>r.id));
  shot.results=shot.results.filter(r=>latestIds.has(r.id)||recent.has(r.id));
  for(const note of shot.notes)if(note.history.length>8){note.history_archived=(note.history_archived||0)+note.history.length-8;note.history=note.history.slice(-8);}
}
async function transaction(root,revision,work){
  return withProjectLock(root,async()=>{
    const current=await read(root),next=structuredClone(current.store);
    const outcome=await work(next,current.feedback_revision);
    if(outcome.duplicate)return {...current,...outcome};
    if(revision!==current.feedback_revision&&!outcome.scoped_match)throw fault('STALE_FEEDBACK','Затронутые замечания изменились. Обновите список; ваш текст сохранён в форме.');
    const pending=[];
    for(const shot of next.shots){const latestCount=new Set(shot.notes.map(n=>n.latest_result_id||shot.results.filter(r=>r.note_ids.includes(n.id)).at(-1)?.id).filter(Boolean)).size;if(outcome.compact_id===shot.id||shot.results.length>Math.max(30,latestCount+10)||shot.notes.some(n=>n.history.length>80))compact(shot,pending);}
    let data=JSON.stringify(next,null,2)+'\n';
    if(Buffer.byteLength(data)>MAX_STORE){for(const shot of next.shots){if(shot.results.length>8||shot.notes.some(n=>n.history.length>8))compact(shot,pending);}data=JSON.stringify(next,null,2)+'\n';}
    validate(next);if(Buffer.byteLength(data)>MAX_STORE)throw fault('TOO_LARGE','Текущие замечания превышают 8 МиБ. Архивируйте завершённые обсуждения; история уже хранится отдельно.');
    for(const item of pending)await writeImmutable(root,item.file,item.data);
    if(outcome.image)await writeImmutable(root,outcome.image.info.file,outcome.image.data);
    const backup='.opora/backups/feedback-'+uuid()+'.json';await assertSafePath(root,backup);await fs.mkdir(path.dirname(path.join(root,backup)),{recursive:true});await fs.writeFile(path.join(root,backup),JSON.stringify(current.store,null,2),{flag:'wx'});
    const temp='.opora/feedback-'+uuid()+'.tmp';try{await fs.writeFile(path.join(root,temp),data,{flag:'wx'});await fs.rename(path.join(root,temp),path.join(root,STORE));}finally{await fs.rm(path.join(root,temp),{force:true});}
    const {image,scoped_match,compact_id,...result}=outcome;return {...view(next),backup,...result};
  });
}
function findShot(store,id){const shot=store.shots.find(s=>s.id===id);if(!shot)throw fault('UNKNOWN_SHOT','Снимок не найден. Обновите список.');return shot;}
async function addShot(root,{revision,title,data}){
  if(!string(title,180))throw fault('INVALID_INPUT','Укажите название снимка.');
  const info=pngInfo(data),source_snapshot=await sourceSnapshot(root);
  return transaction(root,revision,store=>{const existing=store.shots.find(s=>s.image.sha256===info.sha256);if(existing)return {shot_id:existing.id,duplicate:true};if(store.shots.filter(s=>!s.archived).length>=200||store.shots.length>=2000)throw fault('TOO_LARGE','Архивируйте завершённые снимки: одновременно доступны 200 обсуждений.');const shot={id:uuid(),title:title.trim(),image:info,source_snapshot,notes:[],results:[],createdAt:now()};store.shots.push(shot);return {shot_id:shot.id,image:{data,info}};});
}
async function addNote(root,{revision,shot_id,text,kind,rect,scene='',scope,supersedes=null}){
  if(typeof scene!=='string')throw fault('INVALID_INPUT','Некорректный путь сцены.');
  scene=scene.trim().replace(/\\/g,'/').replace(/^res:\/\//,'');
  scope||=scene?'scene':'region';
  if(!string(text)||!['fix','keep'].includes(kind)||!rectValid(rect)||typeof scene!=='string'||scene.length>1024||!['region','scene','project'].includes(scope)||scope==='scene'&&!scene.trim()||supersedes!==null&&!validId(supersedes))throw fault('INVALID_INPUT','Укажите комментарий, область и область применения решения.');
  return transaction(root,revision,store=>{
    const shot=findShot(store,shot_id);if(shot.archived)throw fault('ARCHIVED','Восстановите обсуждение из архива.');
    if(supersedes&&!store.shots.some(s=>s.notes.some(n=>n.id===supersedes&&n.kind==='keep'&&n.status==='accepted'&&!n.superseded_by))||supersedes&&kind!=='keep')throw fault('INVALID_INPUT','Заменить можно действующее принятое решение «сохранить».');
    const normalized=text.trim().replace(/\s+/g,' ').toLocaleLowerCase();
    const existing=shot.notes.find(n=>!n.superseded_by&&n.kind===kind&&n.text.trim().replace(/\s+/g,' ').toLocaleLowerCase()===normalized&&n.scene===scene.trim()&&(n.scope||'region')===scope&&['x','y','w','h'].every(k=>Math.abs(n.rect[k]-rect[k])<0.02));
    if(existing)return {note_id:existing.id,duplicate:true};if(shot.notes.length>=200)throw fault('TOO_LARGE','На снимке уже 200 замечаний.');
    const note={id:uuid(),text:text.trim(),kind,rect:{x:rect.x,y:rect.y,w:rect.w,h:rect.h},scene:scene.trim(),scope,supersedes,status:'open',history:[event('created')],createdAt:now()};shot.notes.push(note);return {note_id:note.id};
  });
}
function matchesNotes(shot,ids,revisions){return revisions&&ids.every(id=>typeof revisions[id]==='string'&&shot.notes.some(n=>n.id===id&&noteRevision(shot,n)===revisions[id]));}
async function decide(root,{revision,shot_id,note_id,action,reason='',result_id=null,note_revisions}){
  if(!['accept','reopen'].includes(action)||typeof reason!=='string'||reason.length>4000||action==='reopen'&&!reason.trim())throw fault('INVALID_INPUT','Для возврата добавьте причину.');
  return transaction(root,revision,store=>{
    const shot=findShot(store,shot_id),note=shot.notes.find(n=>n.id===note_id);if(!note)throw fault('UNKNOWN_NOTE','Замечание не найдено.');
    const scoped_match=!note.supersedes&&matchesNotes(shot,[note_id],note_revisions);
    const latest=note.latest_result_id||shot.results.filter(r=>r.note_ids.includes(note_id)).at(-1)?.id||null;
    if(action==='accept'&&latest!==result_id)throw fault('STALE_FEEDBACK','Сначала просмотрите последний результат.');
    note.status=action==='accept'?'accepted':'open';note.history.push(event(action,{reason:reason.trim(),result_id}));
    if(action==='accept'&&note.supersedes){const old=store.shots.flatMap(s=>s.notes).find(n=>n.id===note.supersedes);if(!old||old.superseded_by&&old.superseded_by!==note.id)throw fault('STALE_FEEDBACK','Предыдущее решение уже заменено.');old.superseded_by=note.id;old.history.push(event('superseded',{replacement_id:note.id}));}
    return {note_id,scoped_match};
  });
}
async function submitResult(root,{revision,shot_id,note_ids,summary,agent,request_id,data,note_revisions}){
  if(!Array.isArray(note_ids)||!note_ids.length||note_ids.length>200||new Set(note_ids).size!==note_ids.length||!note_ids.every(validId)||!string(summary)||!['user','claude','codex','other'].includes(agent)||!validId(request_id))throw fault('INVALID_INPUT','Некорректный результат проверки.');
  const info=pngInfo(data),fingerprint=hash(JSON.stringify({revision,shot_id,note_ids,summary,agent,request_id,sha256:info.sha256,note_revisions})),source_snapshot=await sourceSnapshot(root);
  return transaction(root,revision,store=>{
    const shot=findShot(store,shot_id),receiptKey=hash(agent+'\n'+request_id),prior=shot.receipts?.[receiptKey]||shot.results.find(r=>r.request_id===request_id&&r.agent===agent);
    if(prior){if(prior.fingerprint!==fingerprint)throw fault('DUPLICATE_REQUEST','request_id уже использован для другого результата.');return {result_id:prior.result_id||prior.id,duplicate:true};}
    if(shot.archived)throw fault('ARCHIVED','Восстановите обсуждение из архива.');
    const scoped_match=matchesNotes(shot,note_ids,note_revisions);
    for(const id of note_ids){const note=shot.notes.find(n=>n.id===id);if(!note)throw fault('UNKNOWN_NOTE','Замечание не найдено.');if(note.status==='accepted'||note.superseded_by)throw fault('ALREADY_ACCEPTED','Пользователь уже принял или заменил это замечание.');}
    const result={id:uuid(),image:info,note_ids,summary:summary.trim(),agent,request_id,fingerprint,source_snapshot,same_as_original:info.sha256===shot.image.sha256,createdAt:now()};shot.results.push(result);(shot.receipts||={})[receiptKey]={result_id:result.id,fingerprint};
    for(const note of shot.notes.filter(n=>note_ids.includes(n.id))){note.status='ready';note.latest_result_id=result.id;note.history.push(event('result',{result_id:result.id}));}
    return {result_id:result.id,image:{data,info},scoped_match,same_as_original:result.same_as_original,source_snapshot};
  });
}
async function archive(root,{revision,shot_id,closed=false}){return transaction(root,revision,store=>{const shot=findShot(store,shot_id);if(typeof closed!=='boolean')throw fault('INVALID_INPUT','Некорректный статус архива.');shot.archived=closed;return {shot_id,compact_id:shot_id};});}
async function readArchive(root,descriptor){if(!/^\.opora\/feedback-archives\/[a-f0-9]{64}\.json$/.test(descriptor.file))throw fault('INVALID_PATH','Некорректный архив.');await assertSafePath(root,descriptor.file);const data=await boundedRead(path.join(root,descriptor.file),MAX_STORE);if(hash(data)!==descriptor.sha256)throw fault('CORRUPT_ARCHIVE','Архив повреждён.');const parsed=JSON.parse(data);if(parsed.version!==1||!parsed.shot)throw fault('CORRUPT_ARCHIVE','Неверный формат архива.');validate({version:1,shots:[parsed.shot]});return parsed.shot;}
async function history(root,{shot_id,note_id,offset=0,limit=30}){
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw fault('INVALID_INPUT','Некорректная страница истории.');
  const current=await read(root),shot=findShot(current.store,shot_id),results=new Map(),events=new Map();
  const add=s=>{for(const result of s.results)if(!note_id||result.note_ids.includes(note_id))results.set(result.id,result);for(const n of s.notes)if(!note_id||n.id===note_id)for(const e of n.history)events.set(e.id||hash(JSON.stringify(e)),{...e,note_id:n.id});};
  for(const descriptor of shot.archives||[])add(await readArchive(root,descriptor));add(shot);
  const allResults=[...results.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),allEvents=[...events.values()].sort((a,b)=>b.at.localeCompare(a.at));
  return {feedback_revision:current.feedback_revision,results:allResults.slice(offset,offset+limit),events:allEvents.slice(offset,offset+limit),results_total:allResults.length,events_total:allEvents.length,offset,limit};
}
async function projectImage(root,file){
  if(typeof file!=='string'||file.length>2048)throw fault('INVALID_PATH','Нужен относительный путь PNG внутри проекта.');file=file.replace(/\\/g,'/');
  if(file.includes(':')||file.startsWith('/')||file.split('/').some(p=>!p||p==='.'||p==='..')||!file.toLowerCase().endsWith('.png'))throw fault('INVALID_PATH','Нужен относительный путь PNG внутри проекта.');await assertSafePath(root,file);return boundedRead(path.join(root,file),MAX_IMAGE);
}
async function image(root,{shot_id,result_id,note_id}){
  const current=await read(root),shot=findShot(current.store,shot_id);let selected=result_id?shot.results.find(r=>r.id===result_id):null;
  if(result_id&&!selected)for(const descriptor of [...(shot.archives||[])].reverse()){selected=(await readArchive(root,descriptor)).results.find(r=>r.id===result_id);if(selected)break;}
  if(result_id&&!selected)throw fault('UNKNOWN_RESULT','Результат не найден.');if(note_id&&selected&&!selected.note_ids.includes(note_id))throw fault('UNKNOWN_NOTE','Этот результат не относится к выбранному замечанию.');
  const info=selected?selected.image:shot.image;await assertSafePath(root,info.file);const data=await boundedRead(path.join(root,info.file),MAX_IMAGE);if(hash(data)!==info.sha256)throw fault('INVALID_IMAGE','Копия изображения повреждена.');
  return {data,info,shot,result:selected,feedback_revision:current.feedback_revision};
}
function list(current,{shot_id,offset=0,limit=20,status,scene,query='',scope,include_archived=false,include_superseded=false}={}){
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>50||typeof query!=='string'||query.length>200||status&&!['open','ready','accepted'].includes(status)||scope&&!['region','scene','project'].includes(scope))throw fault('INVALID_INPUT','Некорректные фильтры.');
  const matches=n=>(include_superseded||!n.superseded_by)&&(!status||n.status===status)&&(!scene||n.scene===scene)&&(!scope||(n.scope||'region')===scope)&&(!query||(n.text+' '+n.scene).toLowerCase().includes(query.toLowerCase()));
  const all=(shot_id?[findShot(current.store,shot_id)]:current.store.shots.filter(s=>(include_archived||!s.archived)&&(!(status||scene||scope||query)||s.notes.some(matches)))).slice().reverse();
  return {feedback_revision:current.feedback_revision,total:all.length,offset,limit,shots:all.slice(offset,offset+limit).map(s=>shot_id?{...s,notes:s.notes.filter(matches).map(n=>({...n,note_revision:current.note_revisions[n.id]}))}:{id:s.id,title:s.title,image:s.image,archived:!!s.archived,createdAt:s.createdAt,notes_total:s.notes.length,open:s.notes.filter(n=>n.status==='open'&&!n.superseded_by).length,ready:s.notes.filter(n=>n.status==='ready').length,accepted:s.notes.filter(n=>n.status==='accepted'&&!n.superseded_by).length}),instructions:'Use shot_id for notes and note_revision tokens. Accepted keep notes apply only within scope and while not superseded. Archived decisions remain readable. Only the user accepts results.'};
}
module.exports={read,list,addShot,addNote,decide,submitResult,projectImage,image,pngInfo,rectValid,boundedRead,noteRevision,history,archive};
