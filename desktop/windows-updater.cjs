const fs=require('node:fs/promises');
let rawFs=require('node:fs');
try {rawFs=require('original-fs');} catch {} // Read the actual ASAR bytes in Electron.
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
// The helper's native working directory must be outside the app being replaced.
function systemPowerShell(platform=process.platform,env=process.env){
  const systemRoot=env.SystemRoot||env.SYSTEMROOT||env.WINDIR;
  return platform==='win32'&&systemRoot?path.win32.join(systemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'):'powershell.exe';
}
const CHECK="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=(New-Object Text.UTF8Encoding $false); . ([scriptblock]::Create([IO.File]::ReadAllText($env:OPORA_UPDATE_SCRIPT))); Assert-NoUpdateMcp $env:OPORA_UPDATE_DEST";
const EXTRACT=String.raw`$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($env:OPORA_UPDATE_ZIP)
try {
  if ($zip.Entries.Count -gt 5000) { throw 'Too many archive entries.' }
  [long]$total = 0
  foreach ($entry in $zip.Entries) {
    $parts = ($entry.FullName -replace '\\','/').Split('/')
    if ($parts[0] -ne 'Opora-win32-x64' -or $parts -contains '..' -or $parts -contains '.' -or $entry.FullName.Contains(':') -or (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'Unsafe archive entry.' }
    $total += $entry.Length
    if ($total -gt 1610612736) { throw 'Archive is too large.' }
  }
} finally { $zip.Dispose() }
[IO.Compression.ZipFile]::ExtractToDirectory($env:OPORA_UPDATE_ZIP, $env:OPORA_UPDATE_STAGE)
`;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const samePath=(a,b)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const data of rawFs.createReadStream(file))hash.update(data);return hash.digest('hex');}
async function readArchivePackage(file){
  const handle=await rawFs.promises.open(file,'r');
  try {
    const prefix=Buffer.alloc(16);
    if((await handle.read(prefix,0,16,0)).bytesRead!==16)throw new Error('Неполный заголовок ASAR.');
    const headerSize=prefix.readUInt32LE(4),jsonSize=prefix.readUInt32LE(12);
    if(prefix.readUInt32LE(0)!==4 || headerSize<8 || headerSize>16*1024*1024 || prefix.readUInt32LE(8)!==headerSize-4 || jsonSize>headerSize-8)throw new Error('Некорректный заголовок ASAR.');
    const header=Buffer.alloc(jsonSize);
    if((await handle.read(header,0,jsonSize,16)).bytesRead!==jsonSize)throw new Error('Неполный индекс ASAR.');
    const entry=JSON.parse(header.toString('utf8')).files?.['package.json'];
    if(!entry || entry.unpacked || entry.link || !/^\d+$/.test(entry.offset) || !Number.isSafeInteger(entry.size) || entry.size<1 || entry.size>1024*1024)throw new Error('В ASAR нет корректного package.json.');
    const position=8+headerSize+Number(entry.offset);
    if(!Number.isSafeInteger(position) || position+entry.size>(await handle.stat()).size)throw new Error('Данные package.json выходят за пределы ASAR.');
    const body=Buffer.alloc(entry.size);
    if((await handle.read(body,0,entry.size,position)).bytesRead!==entry.size)throw new Error('Неполный package.json в ASAR.');
    return JSON.parse(body.toString('utf8'));
  } finally {await handle.close();}
}
async function writeJson(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value,null,2),{flag:'wx'});await fs.rename(temp,file);}
async function readJson(file){try{return JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));}catch{return null;}}
async function tailText(file,limit=4000){
  try{const handle=await fs.open(file,'r');try{const stat=await handle.stat();const buffer=Buffer.alloc(Math.min(stat.size,limit));const {bytesRead}=await handle.read(buffer,0,buffer.length,Math.max(0,stat.size-buffer.length));return buffer.subarray(0,bytesRead).toString('utf8').trim();}finally{await handle.close();}}catch{return '';}
}
async function readDiagnostics(resultFile,{directory}={}){
  const result=await readJson(resultFile);if(!result)return {result:null};
  if(!directory||!result.job||!result.directory||!samePath(result.directory,directory)||!samePath(path.dirname(result.job),path.dirname(directory))||!/^\.opora-update-[a-zA-Z0-9]+$/.test(path.basename(result.job)))return {result};
  const [progress,bootstrap,bootstrapError,installer,stderr,stdout]=await Promise.all([readJson(path.join(result.job,'progress.json')),readJson(path.join(result.job,'bootstrap-started.json')),readJson(path.join(result.job,'bootstrap-error.json')),tailText(path.join(result.job,'installer.log')),tailText(path.join(result.job,'stderr.log')),tailText(path.join(result.job,'stdout.log'))]);
  const safeBootstrap=value=>value?{pid:value.pid,stage:value.stage,powerShellVersion:value.powerShellVersion,recordedAt:value.recordedAt,error:value.error}:null;
  return {result,bootstrap:safeBootstrap(bootstrap),bootstrapError:safeBootstrap(bootstrapError),progress:progress?{pid:progress.pid,phase:progress.phase,recordedAt:progress.recordedAt}:null,logs:{installer,stderr,stdout}};
}
function runPowerShell(script,env,{powerShell=systemPowerShell(),cwd,spawnProcess=spawn}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawnProcess(powerShell,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{cwd,env:{...process.env,...env},windowsHide:true});
    let error='';
    const timer=setTimeout(()=>{error+=' PowerShell did not finish in time.';child.kill();},180000);
    child.stderr?.on('data',chunk=>{if(error.length<6000)error+=chunk.toString();});
    child.once('error',err=>{clearTimeout(timer);reject(err);});
    child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(error.slice(0,3000)||'PowerShell завершился с кодом '+code));});
  });
}
async function stageRuntime(source,directory,required,actual){
  if(required!==actual)throw new Error('Версия Electron не совпадает. Нужна полная сборка.');
  const manifest=await readJson(path.join(source,'runtime.json'));
  if(!manifest || manifest.runtimeVersion!==actual || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length>5000)throw new Error('Некорректный список файлов Electron.');
  const names=new Set();
  for(const file of manifest.files){
    if(!file || !/^[a-zA-Z0-9_./-]+$/.test(file.name) || file.name.startsWith('/') || file.name.split('/').some(p=>!p || p==='.' || p==='..') || ['Opora.exe','resources/app.asar','runtime.json'].includes(file.name) || names.has(file.name) || !/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Некорректный путь файла Electron.');
    names.add(file.name);
    const input=path.join(directory,file.name);
    if((await rawFs.promises.lstat(input)).isSymbolicLink() || await hashFile(input)!==file.sha256)throw new Error('Файлы Electron отличаются от ожидаемых. Нужна полная сборка.');
    const output=path.join(source,file.name);await fs.mkdir(path.dirname(output),{recursive:true});await rawFs.promises.copyFile(input,output);
    if(await hashFile(output)!==file.sha256)throw new Error('Не удалось скопировать Electron.');
  }
  await rawFs.promises.copyFile(path.join(directory,'Opora.exe'),path.join(source,'Opora.exe'));
}
async function appHashes(source){
  const manifest=await readJson(path.join(source,'runtime.json'));
  const hashes={};
  if(!manifest?.appFiles)return hashes;
  if(!Array.isArray(manifest.appFiles)||manifest.appFiles.length>2000)throw new Error('Некорректный список файлов приложения.');
  for(const file of manifest.appFiles){
    if(!file||!/^resources\/app\.asar\.unpacked\/[a-zA-Z0-9_./-]+$/.test(file.name)||file.name.split('/').some(p=>!p||p==='.'||p==='..')||hashes[file.name]||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Некорректный путь файла приложения.');
    const target=path.join(source,file.name);
    // Reject redirected parent directories as well as redirected files.
    let parent=source;for(const part of file.name.split('/')){parent=path.join(parent,part);if((await rawFs.promises.lstat(parent)).isSymbolicLink())throw new Error('Недопустимая ссылка в обновлении.');}
    if(!(await rawFs.promises.stat(target)).isFile()||await hashFile(target)!==file.sha256)throw new Error('Повреждён файл приложения: '+file.name);
    hashes[file.name]=file.sha256;
  }
  return hashes;
}
async function prepareInstall(download,executable,options={}) {
  const directory=path.dirname(path.resolve(executable));
  const parent=path.dirname(directory);
  const probe=path.join(parent,'.opora-write-check-'+crypto.randomUUID());
  try {await fs.writeFile(probe,'',{flag:'wx'});await fs.rm(probe);} catch {throw new Error('Нет доступа к родительской папке приложения. Перенесите Опору в свою пользовательскую папку и повторите обновление.');}
  // Stage beside the app, including when downloads and the app are on different drives.
  const job=await fs.mkdtemp(path.join(parent,'.opora-update-'));
  try {
    options.onProgress?.('Проверка открытых MCP-сессий');
    const script=path.join(job,'installer.ps1');
    await fs.writeFile(script,await fs.readFile(path.join(__dirname,'windows-install.ps1')));
    const run=options.runPowerShell||runPowerShell;
    await run(CHECK,{OPORA_UPDATE_SCRIPT:script,OPORA_UPDATE_DEST:directory},{...options,cwd:job});
    const stage=path.join(job,'unpacked');
    options.onProgress?.('Распаковка обновления');
    await run(EXTRACT,{OPORA_UPDATE_ZIP:download.archive,OPORA_UPDATE_STAGE:stage},{...options,cwd:job});
    const source=path.join(stage,'Opora-win32-x64');
    if(download.kind==='app'){options.onProgress?.('Проверка и копирование установленного Electron');await stageRuntime(source,directory,download.runtimeVersion,options.runtimeVersion||process.versions.electron);}
    const pkg=await readArchivePackage(path.join(source,'resources/app.asar'));
    if(pkg.name!=='opora' || pkg.version!==download.version)throw new Error('Версия приложения внутри архива не совпала с описанием. Установка отменена.');
    const hashes=await appHashes(source);
    for(const file of ['Opora.exe','resources/app.asar']){if(!(await rawFs.promises.stat(path.join(source,file))).isFile())throw new Error('В обновлении не найден '+file);hashes[file]=await hashFile(path.join(source,file));}
    return {schemaVersion:1,job,script,source,directory,version:download.version,backup:directory+'.opora-backup-'+crypto.randomUUID(),parentPid:process.pid,token:crypto.randomBytes(32).toString('hex'),hashes};
  } catch(error) {
    await fs.rm(job,{recursive:true,force:true}).catch(()=>{});
    throw new Error('Обновление не установлено: '+error.message);
  }
}
async function launchInstaller(plan,resultFile,options={}) {
  const {powerShell=systemPowerShell(),spawnProcess=spawn,readyTimeoutMs=180000,startupTimeoutMs=60000,onProgress=()=>{}}=options;
  if(!samePath(path.dirname(plan.job),path.dirname(plan.directory)) || samePath(plan.job,plan.directory))throw new Error('Папка установщика должна находиться рядом с приложением.');
  const result=path.resolve(resultFile);
  const relative=path.relative(plan.directory,result);
  if(!relative || (relative!=='..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative)))throw new Error('Журнал обновления должен находиться за пределами папки приложения.');
  await fs.mkdir(path.dirname(result),{recursive:true});
  await writeJson(path.join(plan.job,'plan.json'),{...plan,resultFile:result});
  const bootstrapFile=path.join(plan.job,'bootstrap.ps1');
  await fs.writeFile(bootstrapFile,await fs.readFile(path.join(__dirname,'update-bootstrap.ps1')),{flag:'wx'});
  const info={status:'preparing',phase:'Запуск установщика',version:plan.version,directory:plan.directory,backup:plan.backup,job:plan.job,log:path.join(plan.job,'installer.log')};
  await writeJson(result,info);
  let child,exited=false,spawnError=null,exitCode=null,exitSignal=null,lastProgress=null,lastReady=null,lastBootstrap=null;
  const launchStarted=Date.now();
  const out=await fs.open(path.join(plan.job,'stdout.log'),'wx');
  const err=await fs.open(path.join(plan.job,'stderr.log'),'wx');
  try {
    // A normal Windows child survives its parent's exit; unref below releases
    // Node's reference. DETACHED_PROCESS and an inline -Command are unnecessary.
    child=spawnProcess(powerShell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',bootstrapFile],{
      cwd:plan.job,detached:false,stdio:['ignore',out.fd,err.fd],windowsHide:true,
      env:{...process.env,OPORA_UPDATE_SCRIPT:plan.script,OPORA_UPDATE_JOB:plan.job}
    });
    child.once('error',error=>{spawnError=error;});
    child.once('exit',(code,signal)=>{exited=true;exitCode=code;exitSignal=signal;});
    await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});
    onProgress('Ожидание запуска PowerShell');
    const started=Date.now(),deadline=started+readyTimeoutMs,startupDeadline=started+Math.min(startupTimeoutMs,readyTimeoutMs);
    while(Date.now()<deadline){
      const ready=await readJson(path.join(plan.job,'ready.json'));
      lastReady=ready;
      if(ready?.token===plan.token && ready.pid===child.pid && !exited)return;
      const bootstrap=await readJson(path.join(plan.job,'bootstrap-started.json'));
      if(bootstrap?.token===plan.token&&bootstrap.pid===child.pid){if(!lastBootstrap)onProgress('PowerShell запустил сценарий установки');lastBootstrap={pid:bootstrap.pid,powerShellVersion:bootstrap.powerShellVersion,stage:bootstrap.stage,recordedAt:bootstrap.recordedAt};}
      const bootstrapError=await readJson(path.join(plan.job,'bootstrap-error.json'));
      if(bootstrapError?.token===plan.token&&bootstrapError.pid===child.pid&&typeof bootstrapError.error==='string')throw new Error('Ошибка сценария установки ('+bootstrapError.stage+'): '+bootstrapError.error);
      const progress=await readJson(path.join(plan.job,'progress.json'));
      if(progress?.token===plan.token&&progress.pid===child.pid&&typeof progress.phase==='string'&&progress.phase.length<500){if(progress.phase!==lastProgress?.phase)onProgress(progress.phase);lastProgress=progress;}
      if(spawnError || exited)break;
      if(!lastProgress&&!lastBootstrap&&Date.now()>=startupDeadline)break;
      await delay(100);
    }
    if(exited&&!lastProgress)throw new Error(`PowerShell завершился с кодом ${exitCode}${lastBootstrap?' после запуска сценария':' до запуска сценария установки'}. Опора остаётся открытой.`);
    const phase=lastProgress?.phase||(lastBootstrap?'Сценарий запущен, установщик ещё не готов':'PowerShell не сообщил о начале работы');
    throw spawnError || new Error(`Установщик не подтвердил готовность (${phase}). Опора остаётся открытой.`);
  } catch(error) {
    // A helper that starts late must not install after the parent abandoned it.
    await fs.writeFile(path.join(plan.job,'cancel'),'cancelled').catch(()=>{});
    const state=await readJson(path.join(plan.job,'result.json'));
    const stderr=await tailText(path.join(plan.job,'stderr.log'),3000),stdout=await tailText(path.join(plan.job,'stdout.log'),2000);
    const message=state?.error || stderr || error.message;
    const progress=lastProgress?{pid:lastProgress.pid,phase:lastProgress.phase,recordedAt:lastProgress.recordedAt}:null;
    await writeJson(result,{...info,status:'failed',phase:progress?.phase||'Запуск установщика',error:message,diagnostics:{pid:child?.pid||null,powerShell,launchMode:'file',bootstrap:lastBootstrap,exitCode,exitSignal,elapsedMs:Date.now()-launchStarted,progress,ready:lastReady?{pid:lastReady.pid,tokenMatches:lastReady.token===plan.token}:null,stderr,stdout}});
    throw new Error('Установщик не запущен: '+message+' Журнал: '+plan.job);
  } finally {
    await Promise.all([out.close(),err.close()]);
    child?.unref();
  }
}
async function confirmLaunch({version,executable=process.execPath,job=process.env.OPORA_UPDATE_JOB,token=process.env.OPORA_UPDATE_TOKEN}={}) {
  if(!job || !token)return false;
  const plan=await readJson(path.join(job,'plan.json'));
  if(!plan || plan.token!==token || plan.version!==version || !samePath(plan.directory,path.dirname(executable)) || !samePath(path.dirname(job),path.dirname(plan.directory)) || !/^\.opora-update-[a-zA-Z0-9]+$/.test(path.basename(job)))throw new Error('Не удалось подтвердить запуск обновления: неверный план установки.');
  await writeJson(path.join(job,'launch-ack.json'),{token,version,executable:path.resolve(executable),pid:process.pid});
  return true;
}
module.exports={prepareInstall,launchInstaller,confirmLaunch,readResult:readJson,readDiagnostics,systemPowerShell};
