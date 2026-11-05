const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');

// Paths come through environment variables, never interpolated into PowerShell code.
const EXTRACT=`$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($env:OPORA_UPDATE_ZIP)
try {
  if ($zip.Entries.Count -gt 5000) { throw 'Too many archive entries.' }
  [long]$total = 0
  foreach ($entry in $zip.Entries) {
    $parts = ($entry.FullName -replace '\\\\','/').Split('/')
    if ($parts[0] -ne 'Opora-win32-x64' -or $parts -contains '..' -or $parts -contains '.' -or $entry.FullName.Contains(':') -or (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'Unsafe archive entry.' }
    $total += $entry.Length
    if ($total -gt 1610612736) { throw 'Archive is too large.' }
  }
} finally { $zip.Dispose() }
Expand-Archive -LiteralPath $env:OPORA_UPDATE_ZIP -DestinationPath $env:OPORA_UPDATE_STAGE -Force
`;
const INSTALL=`$ErrorActionPreference = 'Stop'
$destination = $env:OPORA_UPDATE_DEST
$staged = $env:OPORA_UPDATE_SOURCE
$backup = $env:OPORA_UPDATE_BACKUP
$movedOld = $false
$movedNew = $false
try {
  $deadline = (Get-Date).AddSeconds(90)
  while (Get-Process -Id ([int]$env:OPORA_UPDATE_PID) -ErrorAction SilentlyContinue) {
    if ((Get-Date) -gt $deadline) { throw 'Opora did not close in time.' }
    Start-Sleep -Milliseconds 400
  }
  Move-Item -LiteralPath $destination -Destination $backup
  $movedOld = $true
  Move-Item -LiteralPath $staged -Destination $destination
  $movedNew = $true
  @{ status='installed'; version=$env:OPORA_UPDATE_VERSION; backup=$backup } | ConvertTo-Json | Set-Content -LiteralPath $env:OPORA_UPDATE_RESULT -Encoding UTF8
  Start-Process -FilePath (Join-Path $destination 'Opora.exe') -WorkingDirectory $destination
} catch {
  $message = $_.Exception.Message
  try {
    if ($movedOld -and (Test-Path -LiteralPath $destination)) { Remove-Item -LiteralPath $destination -Recurse -Force }
    if ($movedOld -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $destination }
    @{ status='failed'; error=$message; backup=$backup } | ConvertTo-Json | Set-Content -LiteralPath $env:OPORA_UPDATE_RESULT -Encoding UTF8
    if (Test-Path -LiteralPath (Join-Path $destination 'Opora.exe')) { Start-Process -FilePath (Join-Path $destination 'Opora.exe') -WorkingDirectory $destination }
  } catch { $message | Set-Content -LiteralPath $env:OPORA_UPDATE_RESULT -Encoding UTF8 }
  exit 1
}
`;
function runPowerShell(script,env) {
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,...env},windowsHide:true});
    let error='';
    child.stderr.on('data',chunk=>{if(error.length<5000)error+=chunk.toString();});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(new Error('Не удалось распаковать обновление: '+error.slice(0,1500))));
  });
}
async function prepareInstall(download,executable) {
  const directory=path.dirname(executable);
  const probe=path.join(directory,'.opora-write-check-'+crypto.randomUUID());
  try {await fs.writeFile(probe,'',{flag:'wx'});await fs.rm(probe);} catch {throw new Error('Нет доступа к папке приложения. Перенесите Опору в свою пользовательскую папку и повторите обновление.');}
  const stage=path.join(download.directory,'unpacked');
  await fs.mkdir(stage,{recursive:true});
  await runPowerShell(EXTRACT,{OPORA_UPDATE_ZIP:download.archive,OPORA_UPDATE_STAGE:stage});
  const source=path.join(stage,'Opora-win32-x64');
  const pkg=JSON.parse(await fs.readFile(path.join(source,'resources/app.asar/package.json'),'utf8'));
  if(pkg.name!=='opora' || pkg.version!==download.version)throw new Error('Версия приложения внутри архива не совпала с описанием. Установка отменена.');
  const stat=await fs.stat(path.join(source,'Opora.exe'));
  if(!stat.isFile())throw new Error('В обновлении не найдено приложение.');
  return {source,directory,version:download.version,backup:directory+'.opora-backup-'+crypto.randomUUID()};
}
async function launchInstaller(plan,resultFile) {
  const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',INSTALL],{
    detached:true,stdio:'ignore',windowsHide:true,
    env:{...process.env,OPORA_UPDATE_DEST:plan.directory,OPORA_UPDATE_SOURCE:plan.source,OPORA_UPDATE_BACKUP:plan.backup,OPORA_UPDATE_PID:String(process.pid),OPORA_UPDATE_VERSION:plan.version,OPORA_UPDATE_RESULT:resultFile}
  });
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});
  child.unref();
}
module.exports={prepareInstall,launchInstaller};
