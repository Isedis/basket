const fs=require('node:fs/promises');
let rawFs=require('node:fs');
try {rawFs=require('original-fs');} catch {} // Read the actual ASAR bytes in Electron.
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
// The helper's native working directory must be outside the app being replaced.
const RUN="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=(New-Object Text.UTF8Encoding $false); & ([scriptblock]::Create([IO.File]::ReadAllText($env:OPORA_UPDATE_SCRIPT)))";
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
function runPowerShell(script,env,{powerShell='powershell.exe',cwd,spawnProcess=spawn}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawnProcess(powerShell,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{cwd,env:{...process.env,...env},windowsHide:true});
    let error='';
    const timer=setTimeout(()=>{error+=' PowerShell did not finish in time.';child.kill();},180000);
    child.stderr?.on('data',chunk=>{if(error.length<6000)error+=chunk.toString();});
    child.once('error',err=>{clearTimeout(timer);reject(err);});
    child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(error.slice(0,3000)||'PowerShell завершился с кодом '+code));});
  });
}
async function prepareInstall(download,executable,options={}) {
  const directory=path.dirname(path.resolve(executable));
  const parent=path.dirname(directory);
  const probe=path.join(parent,'.opora-write-check-'+crypto.randomUUID());
  try {await fs.writeFile(probe,'',{flag:'wx'});await fs.rm(probe);} catch {throw new Error('Нет доступа к родительской папке приложения. Перенесите Опору в свою пользовательскую папку и повторите обновление.');}
  // Stage beside the app, including when downloads and the app are on different drives.
  const job=await fs.mkdtemp(path.join(parent,'.opora-update-'));
  try {
    const script=path.join(job,'installer.ps1');
    await fs.writeFile(script,await fs.readFile(path.join(__dirname,'windows-install.ps1')));
    const run=options.runPowerShell||runPowerShell;
    await run(CHECK,{OPORA_UPDATE_SCRIPT:script,OPORA_UPDATE_DEST:directory},{...options,cwd:job});
    const stage=path.join(job,'unpacked');
    await run(EXTRACT,{OPORA_UPDATE_ZIP:download.archive,OPORA_UPDATE_STAGE:stage},{...options,cwd:job});
    const source=path.join(stage,'Opora-win32-x64');
    const pkg=await readArchivePackage(path.join(source,'resources/app.asar'));
    if(pkg.name!=='opora' || pkg.version!==download.version)throw new Error('Версия приложения внутри архива не совпала с описанием. Установка отменена.');
    const hashes={};
    for(const file of ['Opora.exe','resources/app.asar']){if(!(await rawFs.promises.stat(path.join(source,file))).isFile())throw new Error('В обновлении не найден '+file);hashes[file]=await hashFile(path.join(source,file));}
    return {schemaVersion:1,job,script,source,directory,version:download.version,backup:directory+'.opora-backup-'+crypto.randomUUID(),parentPid:process.pid,token:crypto.randomBytes(32).toString('hex'),hashes};
  } catch(error) {
    await fs.rm(job,{recursive:true,force:true}).catch(()=>{});
    throw new Error('Обновление не установлено: '+error.message);
  }
}
async function launchInstaller(plan,resultFile,options={}) {
  const {powerShell='powershell.exe',spawnProcess=spawn,readyTimeoutMs=15000}=options;
  if(!samePath(path.dirname(plan.job),path.dirname(plan.directory)) || samePath(plan.job,plan.directory))throw new Error('Папка установщика должна находиться рядом с приложением.');
  const result=path.resolve(resultFile);
  const relative=path.relative(plan.directory,result);
  if(!relative || (relative!=='..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative)))throw new Error('Журнал обновления должен находиться за пределами папки приложения.');
  await fs.mkdir(path.dirname(result),{recursive:true});
  await writeJson(path.join(plan.job,'plan.json'),{...plan,resultFile:result});
  const info={status:'preparing',phase:'Запуск установщика',version:plan.version,directory:plan.directory,backup:plan.backup,job:plan.job,log:path.join(plan.job,'installer.log')};
  await writeJson(result,info);
  let child,exited=false,spawnError=null;
  const out=await fs.open(path.join(plan.job,'stdout.log'),'wx');
  const err=await fs.open(path.join(plan.job,'stderr.log'),'wx');
  try {
    child=spawnProcess(powerShell,['-NoLogo','-NoProfile','-NonInteractive','-Command',RUN],{
      cwd:plan.job,detached:true,stdio:['ignore',out.fd,err.fd],windowsHide:true,
      env:{...process.env,OPORA_UPDATE_SCRIPT:plan.script,OPORA_UPDATE_JOB:plan.job}
    });
    child.once('error',error=>{spawnError=error;});
    child.once('exit',()=>{exited=true;});
    await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});
    const deadline=Date.now()+readyTimeoutMs;
    while(Date.now()<deadline){
      const ready=await readJson(path.join(plan.job,'ready.json'));
      if(ready?.token===plan.token && ready.pid===child.pid && !exited)return;
      if(spawnError || exited)break;
      await delay(100);
    }
    throw spawnError || new Error('Установщик не подтвердил готовность. Опора остаётся открытой.');
  } catch(error) {
    // A helper that starts late must not install after the parent abandoned it.
    await fs.writeFile(path.join(plan.job,'cancel'),'cancelled').catch(()=>{});
    const state=await readJson(path.join(plan.job,'result.json'));
    const stderr=(await fs.readFile(path.join(plan.job,'stderr.log'),'utf8').catch(()=>'' )).trim().slice(0,1800);
    const message=state?.error || stderr || error.message;
    await writeJson(result,{...info,status:'failed',phase:'Запуск установщика',error:message});
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
module.exports={prepareInstall,launchInstaller,confirmLaunch,readResult:readJson};
