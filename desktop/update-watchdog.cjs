// Watches a native Electron relaunch; it never starts the candidate GUI itself.
let raw=require('node:fs');try{raw=require('original-fs');}catch{}
const fs=raw.promises,path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const same=(a,b)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
async function json(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function retry(action,{timeout=15000}={}){const end=Date.now()+timeout;while(true){try{return await action();}catch(e){if(!['EACCES','EPERM','EBUSY','ENOTEMPTY'].includes(e.code)||Date.now()>end)throw e;await pause(100);}}}
async function write(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value),{flag:'wx'});try{await retry(()=>fs.rename(temp,file));}finally{await fs.rm(temp,{force:true}).catch(()=>{});}}
function alive(pid){try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}}
function validate(plan,job){
  const relative=path.relative(path.join(plan.home,'v'),plan.directory);
  if(plan.schemaVersion!==3||!/^\d+\.\d+\.\d+$/.test(plan.version)||!/^[a-f0-9]{64}$/.test(plan.token)||!Number.isSafeInteger(plan.parentPid)||plan.parentPid<1||!same(plan.job,job)||!same(path.dirname(job),plan.home)||!/^\.opora-update-[a-zA-Z0-9]+$/.test(path.basename(job))||!relative||relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).length!==1||!same(plan.pointer,path.join(plan.home,'opora-active.json'))||!same(plan.previous.directory,plan.previousDirectory)||plan.previous.id!==plan.installId)throw new Error('Некорректный план обновления.');
}
async function hash(file){const h=crypto.createHash('sha256');for await(const chunk of raw.createReadStream(file))h.update(chunk);return h.digest('hex');}
async function run(job){
  const plan=await json(path.join(job,'plan.json'));validate(plan,job);
  let lock,phase='Проверка файлов',parentClosed=false,newPid=null;
  const state=async(status,extra={})=>{const value={status,phase,version:plan.version,installId:plan.installId,home:plan.home,directory:plan.directory,previousDirectory:plan.previousDirectory,backup:plan.previousDirectory,job,log:path.join(job,'installer.log'),recordedAt:new Date().toISOString(),...extra};await write(path.join(job,'result.json'),value);await write(plan.resultFile,value);};
  const progress=async text=>{phase=text;await write(path.join(job,'progress.json'),{token:plan.token,pid:process.pid,phase});await fs.appendFile(path.join(job,'installer.log'),text+'\n');};
  try{
    const lockFile=path.join(plan.home,'.opora-install.lock');
    try{lock=await fs.open(lockFile,'wx');}catch(error){
      if(error.code!=='EEXIST')throw error;
      const owner=await json(lockFile).catch(()=>null);
      if(!owner?.pid||alive(owner.pid))throw new Error('Другое обновление ещё выполняется.');
      await fs.rm(lockFile);lock=await fs.open(lockFile,'wx');
    }
    await lock.writeFile(JSON.stringify({pid:process.pid,job}));
    const current=await json(plan.pointer);if(!current||current.id!==plan.installId||!same(current.directory,plan.previousDirectory))throw new Error('Текущая версия уже изменилась.');
    for(const [name,digest] of Object.entries(plan.hashes)){
      if(!/^[a-zA-Z0-9_./-]+$/.test(name)||name.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-f0-9]{64}$/.test(digest)||await hash(path.join(plan.directory,name))!==digest)throw new Error('Не совпала контрольная сумма: '+name);
    }
    for(const name of ['Opora.exe','resources/app.asar'])if(!plan.hashes[name])throw new Error('Неполный пакет.');
    await progress('Готово к штатному перезапуску Electron');await state('waiting');await write(path.join(job,'ready.json'),{token:plan.token,pid:process.pid});
    const exitDeadline=Date.now()+90000;
    while(alive(plan.parentPid)){
      if(await fs.stat(path.join(job,'cancel')).catch(()=>null))throw new Error('Обновление отменено.');
      if(Date.now()>exitDeadline)throw new Error('Приложение не завершило перезапуск.');await pause(100);
    }
    parentClosed=true;
    const handoff=await json(path.join(job,'parent-handoff.json'));
    if(handoff?.token!==plan.token||handoff.nativeRelaunch!==true||handoff.saved!==true||handoff.released!==true)throw new Error('Нет подтверждения сохранения перед перезапуском.');
    await progress('Проверка видимого интерфейса');await state('restarting');
    const deadline=Date.now()+45000;
    while(Date.now()<deadline){
      const started=await json(path.join(job,'gui-process.json'));
      if(started?.token===plan.token&&same(started.executable,path.join(plan.directory,'Opora.exe')))newPid=started.pid;
      const ack=await json(path.join(job,'launch-ack.json'));
      if(newPid&&ack?.token===plan.token&&ack.pid===newPid&&ack.version===plan.version&&ack.painted===true&&same(ack.executable,path.join(plan.directory,'Opora.exe'))&&alive(newPid)){await state('installed');return;}
      const error=await json(path.join(job,'gui-error.json'));
      if(error?.token===plan.token)throw new Error(error.error);
      if(newPid&&!alive(newPid))throw new Error('Новая версия завершилась до отрисовки.');
      await pause(150);
    }
    throw new Error('Не подтверждена отрисовка окна новой версии.');
  }catch(error){
    if(newPid&&alive(newPid)){try{process.kill(newPid,'SIGKILL');}catch{}for(let n=0;n<30&&alive(newPid);n++)await pause(100);}
    if(newPid&&alive(newPid)){await state('needs_attention',{error:error.message});throw error;}
    const current=await json(plan.pointer);
    if(current?.id===plan.installId&&same(current.directory,plan.directory))await write(plan.pointer,plan.previous);
    if(parentClosed){
      const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPORA_UPDATE_JOB;delete env.OPORA_UPDATE_TOKEN;
      const child=spawn(path.join(plan.previousDirectory,'Opora.exe'),[...(plan.launchArgs||[]),'--user-data-dir='+path.dirname(plan.resultFile)],{cwd:plan.previousDirectory,env,stdio:'ignore',detached:true,windowsHide:false});
      await new Promise((ok,no)=>{child.once('spawn',ok);child.once('error',no);});child.unref();
      await state('failed',{error:error.message,rollback:'restored',recoveredPid:child.pid});
    }else await state('failed',{error:error.message,rollback:'not_needed'});
    throw error;
  }finally{if(lock){await lock.close();await fs.rm(path.join(plan.home,'.opora-install.lock'),{force:true});}}
}
if(require.main===module)run(path.dirname(__filename)).catch(async error=>{try{const job=path.dirname(__filename),plan=await json(path.join(job,'plan.json'));await write(path.join(job,'worker-error.json'),{token:plan?.token,pid:process.pid,error:error.message});}catch{}process.exitCode=1;});
module.exports={run,retry,validate};
