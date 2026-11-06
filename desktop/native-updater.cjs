const path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),{pipeline}=require('node:stream/promises'),{Transform}=require('node:stream');
let raw=require('node:fs');try{raw=require('original-fs');}catch{}const fs=raw.promises;
const yauzl=require('yauzl');
const layoutApi=require('./install-layout.cjs');
const legacy=require('./windows-updater.cjs');
const {retry}=require('./install-worker.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function digest(file){const hash=crypto.createHash('sha256');for await(const data of raw.createReadStream(file))hash.update(data);return hash.digest('hex');}
function extract(archive,destination){return new Promise((resolve,reject)=>{
  yauzl.open(archive,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
    if(error)return reject(error);let count=0,total=0;const seen=new Set();
    const fail=error=>{zip.close();reject(error);};zip.on('error',fail);zip.once('end',resolve);
    zip.on('entry',entry=>{(async()=>{
      const name=entry.fileName.replace(/\\/g,'/'),directory=name.endsWith('/'),parts=name.replace(/\/$/,'').split('/');
      const kind=(entry.externalFileAttributes>>>16)&0xf000;
      if(++count>5000||parts[0]!=='Opora-win32-x64'||parts.some(p=>!p||p==='.'||p==='..'||/[<>:"|?*]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||![0,0x8000,0x4000].includes(kind)||seen.has(name.toLowerCase())||!Number.isSafeInteger(entry.uncompressedSize))throw new Error('Небезопасный путь в архиве обновления.');
      seen.add(name.toLowerCase());const file=path.join(destination,...parts);
      if(directory){await fs.mkdir(file,{recursive:true});zip.readEntry();return;}
      total+=entry.uncompressedSize;if(total>1.5*1024**3)throw new Error('Архив обновления слишком большой.');
      await fs.mkdir(path.dirname(file),{recursive:true});
      const stream=await new Promise((resolve,reject)=>zip.openReadStream(entry,(err,stream)=>err?reject(err):resolve(stream)));
      let actual=0;const bounded=new Transform({transform(chunk,_encoding,done){actual+=chunk.length;if(actual>entry.uncompressedSize)return done(new Error('Размер файла в архиве не совпал.'));done(null,chunk);}});
      await pipeline(stream,bounded,raw.createWriteStream(file,{flags:'wx',mode:0o600}));
      zip.readEntry();
    })().catch(fail);});zip.readEntry();
  });
});}
async function stageEngine(source,current,manifest,version){
  if(manifest.runtimeVersion!==version||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>5000)throw new Error('Некорректное описание Electron.');
  const seen=new Set();
  for(const file of [...manifest.files,{name:'Opora.exe',sha256:await digest(path.join(current,'Opora.exe'))}]){
    if(!file||!/^[a-zA-Z0-9_./-]+$/.test(file.name)||file.name.split('/').some(p=>!p||p==='.'||p==='..')||file.name.startsWith('resources/app.asar')||seen.has(file.name)||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Некорректный файл Electron.');
    seen.add(file.name);const input=path.join(current,file.name),output=path.join(source,file.name);
    let valid=false;try{valid=!(await fs.lstat(input)).isSymbolicLink()&&await digest(input)===file.sha256;}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!valid)throw Object.assign(new Error('Установленные файлы Electron требуют восстановления.'),{code:'ENGINE_REPAIR_REQUIRED'});
    await fs.mkdir(path.dirname(output),{recursive:true});
    try{await fs.link(input,output);}catch(error){if(!['EXDEV','EPERM','EACCES','ENOTSUP','EMLINK'].includes(error.code))throw error;await fs.copyFile(input,output);if(await digest(output)!==file.sha256)throw new Error('Ошибка копирования Electron.');}
  }
}
async function prepareInstall(download,executable,{storage,layout:provided,runtimeVersion=process.versions.electron,onProgress=()=>{}}={}){
  const layout=provided||await layoutApi.location(executable,{storage,create:true});
  const previous=await layoutApi.active(layout);if(!previous||!layoutApi.same(previous.directory,path.dirname(executable)))throw new Error('Запущена предыдущая копия Опоры. Откройте текущую версию.');
  await fs.mkdir(path.join(layout.home,'v'),{recursive:true});
  const job=await fs.mkdtemp(path.join(layout.home,'.opora-update-'));
  const directory=path.join(layout.home,'v',download.version+'-'+crypto.randomUUID().replace(/-/g,'').slice(0,12));
  try{
    onProgress('Распаковка новой версии');await extract(download.archive,job);
    const source=path.join(job,'Opora-win32-x64');
    if(download.kind==='app'){
      if(download.runtimeVersion!==runtimeVersion)throw new Error('Для этой версии нужен другой Electron.');
      onProgress('Проверка и подключение установленного Electron');await stageEngine(source,previous.directory,JSON.parse(await fs.readFile(path.join(source,'runtime.json'),'utf8')),runtimeVersion);
    }
    const pkg=await legacy.readArchivePackage(path.join(source,'resources/app.asar'));
    if(pkg.name!=='opora'||pkg.version!==download.version)throw new Error('Версия внутри архива не совпала.');
    const hashes=await legacy.appHashes(source);
    for(const file of ['Opora.exe','resources/app.asar'])hashes[file]=await digest(path.join(source,file));
    const marker={schemaVersion:1,id:layout.id,home:layout.home,base:layout.base};
    await fs.writeFile(path.join(source,layoutApi.MARKER),JSON.stringify(marker));hashes[layoutApi.MARKER]=await digest(path.join(source,layoutApi.MARKER));
    await retry(()=>fs.rename(source,directory));
    await fs.writeFile(path.join(job,'install-worker.cjs'),await require('node:fs').promises.readFile(path.join(__dirname,'install-worker.cjs')));
    return {schemaVersion:2,installId:layout.id,home:layout.home,pointer:layout.pointer,job,directory,source:directory,previousDirectory:previous.directory,previous,version:download.version,parentPid:process.pid,token:crypto.randomBytes(32).toString('hex'),hashes};
  }catch(error){await fs.rm(directory,{recursive:true,force:true}).catch(()=>{});await fs.rm(job,{recursive:true,force:true}).catch(()=>{});throw Object.assign(new Error('Подготовка обновления остановлена: '+error.message),{code:error.code});}
}
async function launchInstaller(plan,resultFile,{spawnProcess=spawn,onProgress=()=>{},timeout=180000}={}){
  plan={...plan,resultFile:path.resolve(resultFile)};
  await layoutApi.atomic(path.join(plan.job,'plan.json'),plan);
  const out=await fs.open(path.join(plan.job,'stdout.log'),'wx'),err=await fs.open(path.join(plan.job,'stderr.log'),'wx');
  let child,exited=false,code=null;
  try{
    child=spawnProcess(path.join(plan.directory,'Opora.exe'),[path.join(plan.job,'install-worker.cjs')],{cwd:plan.job,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore',out.fd,err.fd],detached:false,windowsHide:true});
    child.on('error',()=>{});child.once('exit',value=>{exited=true;code=value;});
    await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
    const deadline=Date.now()+timeout;let phase;
    while(Date.now()<deadline){
      const ready=await layoutApi.read(path.join(plan.job,'ready.json'));
      if(ready?.token===plan.token&&ready.pid===child.pid&&!exited)return;
      const progress=await layoutApi.read(path.join(plan.job,'progress.json'));
      if(progress?.token===plan.token&&progress.pid===child.pid&&phase!==progress.phase){phase=progress.phase;onProgress(phase);}
      const failure=await layoutApi.read(path.join(plan.job,'worker-error.json'));
      if(failure?.token===plan.token&&failure.pid===child.pid)throw new Error(failure.error);
      if(exited)throw new Error('Установщик завершился до готовности, код '+code+'.');
      await pause(100);
    }
    throw new Error('Установщик не завершил подготовку вовремя.');
  }catch(error){
    await fs.writeFile(path.join(plan.job,'cancel'),'cancelled').catch(()=>{});
    const result=await layoutApi.read(path.join(plan.job,'result.json'));
    await layoutApi.atomic(resultFile,{...result,status:'failed',version:plan.version,installId:plan.installId,home:plan.home,directory:plan.directory,previousDirectory:plan.previousDirectory,job:plan.job,error:result?.error||error.message,diagnostics:{pid:child?.pid,exitCode:code,launchMode:'electron-node'}});
    throw new Error('Обновление не началось. Опора остаётся открытой. '+(result?.error||error.message));
  }finally{await out.close();await err.close();child?.unref();}
}
async function confirmLaunch({version,executable=process.execPath,job=process.env.OPORA_UPDATE_JOB,token=process.env.OPORA_UPDATE_TOKEN}={}){
  if(!job||!token)return false;
  const plan=await layoutApi.read(path.join(job,'plan.json'));
  if(plan?.schemaVersion!==2)return legacy.confirmLaunch({version,executable,job,token});
  require('./install-worker.cjs').validate(plan,job);
  if(plan.token!==token||plan.version!==version||!layoutApi.same(path.dirname(executable),plan.directory))throw new Error('Не удалось подтвердить новую версию.');
  await layoutApi.atomic(path.join(job,'launch-ack.json'),{token,version,executable,pid:process.pid});return true;
}
async function readDiagnostics(file,{layout}={}){
  const result=await layoutApi.read(file);if(!result)return {result:null};
  if(!layout||result.installId!==layout.id||!result.job||!layoutApi.same(path.dirname(result.job),layout.home)||!/^\.opora-update-[a-zA-Z0-9]+$/.test(path.basename(result.job)))return {result};
  const logs={};for(const file of ['installer.log','stdout.log','stderr.log','gui-startup.log','recovery-startup.log'])try{const bytes=await fs.readFile(path.join(result.job,file));logs[file]=bytes.subarray(-5000).toString('utf8');}catch{}
  return {result,logs};
}
module.exports={prepareInstall,launchInstaller,confirmLaunch,readDiagnostics,extract,stageEngine};
