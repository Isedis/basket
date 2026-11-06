// Standalone worker: only Node built-ins, executed by the staged Electron runtime.
let raw=require('node:fs');try{raw=require('original-fs');}catch{}const fs=raw.promises,path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const same=(a,b)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
async function json(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function write(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value),{flag:'wx'});try{await retry(()=>fs.rename(temp,file));}finally{await fs.rm(temp,{force:true}).catch(()=>{});}}
async function retry(action,{timeout=15000}={}){const deadline=Date.now()+timeout;let delay=80;while(true){try{return await action();}catch(error){if(!['EACCES','EPERM','EBUSY','ENOTEMPTY'].includes(error.code)||Date.now()>=deadline)throw error;await pause(delay);delay=Math.min(delay*2,700);}}}
function alive(pid){try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}}
async function hash(file){const hash=crypto.createHash('sha256');for await(const chunk of raw.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
function validate(plan,job){
  const versions=path.join(plan.home,'.opora-versions'),relative=path.relative(versions,plan.directory);
  if(plan.schemaVersion!==2||!/^\d+\.\d+\.\d+$/.test(plan.version)||!/^[a-f0-9]{64}$/.test(plan.token)||!Number.isSafeInteger(plan.parentPid)||plan.parentPid<1||!same(plan.job,job)||!same(path.dirname(job),plan.home)||!/^\.opora-update-[a-zA-Z0-9]+$/.test(path.basename(job))||!relative||relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).length!==1||!same(plan.pointer,path.join(plan.home,'opora-active.json'))||!same(plan.source,plan.directory)||!same(plan.previous.directory,plan.previousDirectory)||plan.previous.id!==plan.installId)throw new Error('Некорректный план установки.');
}
async function run(job){
  const plan=await json(path.join(job,'plan.json'));validate(plan,job);
  let phase='Проверка подготовленной версии',lock,switched=false,child=null,parentClosed=false;
  const state=async(status,extra={})=>{const value={status,phase,version:plan.version,installId:plan.installId,home:plan.home,directory:plan.directory,previousDirectory:plan.previousDirectory,backup:plan.previousDirectory,job,log:path.join(job,'installer.log'),recordedAt:new Date().toISOString(),...extra};await write(path.join(job,'result.json'),value);await write(plan.resultFile,value);};
  const progress=async message=>{phase=message;await write(path.join(job,'progress.json'),{token:plan.token,pid:process.pid,phase,recordedAt:new Date().toISOString()});await fs.appendFile(path.join(job,'installer.log'),phase+'\n');};
  const cancelled=async()=>{if(await json(path.join(job,'cancel.json')))throw new Error('Установка отменена.');try{await fs.access(path.join(job,'cancel'));throw new Error('Установка отменена.');}catch(error){if(error.code!=='ENOENT')throw error;}};
  const launch=async(directory,confirm)=>{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    if(confirm){env.OPORA_UPDATE_JOB=job;env.OPORA_UPDATE_TOKEN=plan.token;}else{delete env.OPORA_UPDATE_JOB;delete env.OPORA_UPDATE_TOKEN;}
    return retry(async()=>{
      const processChild=spawn(path.join(directory,'Opora.exe'),plan.launchArgs||[],{cwd:directory,env,stdio:'ignore',windowsHide:true,detached:false});
      await new Promise((resolve,reject)=>{processChild.once('spawn',resolve);processChild.once('error',reject);});processChild.unref();return processChild;
    });
  };
  try{
    await progress(phase);
    const lockFile=path.join(plan.home,'.opora-install.lock');const deadline=Date.now()+60000;
    while(!lock){await cancelled();try{lock=await fs.open(lockFile,'wx');await lock.writeFile(JSON.stringify({pid:process.pid,job}));}catch(error){if(error.code!=='EEXIST')throw error;const owner=await json(lockFile).catch(()=>null);if(owner?.pid&&!alive(owner.pid)){await fs.rm(lockFile,{force:true});continue;}if(Date.now()>=deadline)throw new Error('Другой установщик ещё выполняется. Повторите обновление позже.');await progress('Ожидание другого установщика');await pause(300);}}
    const current=await json(plan.pointer);if(!current||current.id!==plan.installId||!same(current.directory,plan.previousDirectory))throw new Error('Текущая версия изменилась во время подготовки.');
    for(const [relative,digest] of Object.entries(plan.hashes)){
      if(!/^[a-zA-Z0-9_./-]+$/.test(relative)||relative.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-f0-9]{64}$/.test(digest))throw new Error('Некорректный список SHA256.');
      await cancelled();await progress('Проверка SHA256: '+relative);
      if(await hash(path.join(plan.directory,relative))!==digest)throw new Error('Файлы обновления изменились: '+relative);
    }
    for(const required of ['Opora.exe','resources/app.asar'])if(!plan.hashes[required])throw new Error('Неполный пакет обновления.');
    await state('waiting');await cancelled();await progress('Установщик готов. Перезапуск окна Опоры');
    await write(path.join(job,'ready.json'),{token:plan.token,pid:process.pid});
    const parentDeadline=Date.now()+90000;
    while(alive(plan.parentPid)){await cancelled();if(Date.now()>parentDeadline)throw new Error('Окно Опоры не завершило сохранение.');await pause(100);}
    parentClosed=true;await cancelled();await progress('Включение новой версии');
    await write(plan.pointer,{schemaVersion:1,id:plan.installId,directory:plan.directory,version:plan.version});switched=true;
    await state('restarting');child=await launch(plan.directory,true);await progress('Проверка запуска новой версии');
    const launchDeadline=Date.now()+60000;
    while(Date.now()<launchDeadline){
      const ack=await json(path.join(job,'launch-ack.json'));
      if(ack?.token===plan.token&&ack.pid===child.pid&&ack.version===plan.version&&same(ack.executable,path.join(plan.directory,'Opora.exe'))&&alive(child.pid)){await state('installed');return;}
      if(!alive(child.pid)){const failure=await json(path.join(job,'gui-error.json'));throw new Error(failure?.token===plan.token&&failure.pid===child.pid?'Ошибка новой версии: '+failure.error:'Новая версия завершилась до подтверждения запуска.');}await pause(150);
    }
    // The candidate window stays hidden until the renderer acknowledges startup.
    // Only this worker's unconfirmed GUI is terminated; PTY/MCP hosts are separate.
    if(alive(child.pid)){
      if(process.platform==='win32')await new Promise(resolve=>{const command=path.join(process.env.SystemRoot||process.env.WINDIR,'System32/taskkill.exe');const killer=spawn(command,['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});killer.once('error',resolve);killer.once('exit',resolve);});
      else try{process.kill(child.pid,'SIGTERM');}catch{}
      const stopDeadline=Date.now()+10000;while(alive(child.pid)&&Date.now()<stopDeadline)await pause(100);
    }
    throw new Error('Новая версия не завершила запуск. Восстанавливаю предыдущую.');
  }catch(error){
    const running=!!child&&alive(child.pid);
    if(switched&&!running)await write(plan.pointer,plan.previous);
    if(parentClosed&&!running){
      await state('rolling-back',{error:error.message,rollback:'restored'});
      try{const recovered=await launch(plan.previousDirectory,false);await state('failed',{error:error.message,rollback:'restored',recoveredPid:recovered.pid});}
      catch(e){await state('failed',{error:error.message+' '+e.message,rollback:'restored'});}
    }else await state(running?'needs_attention':'failed',{error:error.message,rollback:switched&&!running?'restored':'not_needed'});
    throw error;
  }finally{if(lock){await lock.close();await fs.rm(path.join(plan.home,'.opora-install.lock'),{force:true});}}
}
if(require.main===module)run(path.dirname(__filename)).catch(async error=>{try{const job=path.dirname(__filename),plan=await json(path.join(job,'plan.json'));await write(path.join(job,'worker-error.json'),{token:plan?.token,pid:process.pid,error:error.message});}catch{}process.exitCode=1;});
module.exports={run,retry,validate};
