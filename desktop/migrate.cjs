// One-time compatibility entry, run by the already installed Electron runtime.
const fs=require('node:fs/promises'),path=require('node:path'),{spawn,execFile}=require('node:child_process'),exec=require('node:util').promisify(execFile);
const layoutApi=require('./install-layout.cjs'),updater=require('./native-updater.cjs'),legacy=require('./windows-updater.cjs'),{compareVersions}=require('../src/updater.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function compileControl(job){
  const root=process.env.SystemRoot||process.env.WINDIR;let compiler;
  for(const folder of ['Framework64','Framework']){const file=path.join(root,'Microsoft.NET',folder,'v4.0.30319/csc.exe');try{await fs.access(file);compiler=file;break;}catch{}}
  if(!compiler)throw new Error('Не найден системный компилятор .NET Framework.');
  const source=path.join(job,'control.cs'),output=path.join(job,'control.exe');await fs.writeFile(source,await fs.readFile(path.join(__dirname,'windows-control.cs')));
  await exec(compiler,['/nologo','/target:exe','/platform:anycpu','/out:'+output,source],{windowsHide:true});return output;
}
async function main(){
  if(process.platform!=='win32')throw new Error('Этот переход предназначен для Windows.');
  const packageRoot=process.argv[2];if(!packageRoot||!path.isAbsolute(packageRoot))throw new Error('Запустите UPDATE-OPORA.cmd из распакованного ZIP.');
  const userData=path.join(process.env.APPDATA,'opora');await fs.mkdir(userData,{recursive:true});
  const initial=process.execPath,layout=await layoutApi.location(initial,{create:true,storage:path.join(userData,'runtime')});
  const current=await layoutApi.active(layout),pkg=await legacy.readArchivePackage(path.join(current.directory,'resources/app.asar'));
  const version=require('../package.json').version;
  if(compareVersions(pkg.version,version)>=0){console.log('Установлена версия '+pkg.version+'.');const env={...process.env,ELECTRON_NO_ATTACH_CONSOLE:'1'};delete env.ELECTRON_RUN_AS_NODE;const child=spawn(path.join(current.directory,'Opora.exe'),[],{cwd:current.directory,env,stdio:'ignore',windowsHide:true,detached:true});child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.unref();return;}
  await layoutApi.atomic(layout.pointer,{...current,version:pkg.version});
  const onProgress=text=>console.log(text);
  const plan=await updater.prepareInstall({kind:'app',version,runtimeVersion:process.versions.electron,payload:path.join(packageRoot,'opora-update')},initial,{layout,runtimeVersion:process.versions.electron,onProgress});
  let control;try{control=await compileControl(plan.job);}catch(error){console.log('Обновление подготовлено. Дождусь обычного закрытия Опоры. '+error.message);}
  const protect=compareVersions(pkg.version,'0.12.0')<0;let waiting=false;
  while(true){
    let rows=[];
    if(control){
      let query;try{query=await exec(control,[path.join(current.directory,'Opora.exe'),'query',protect?'1':'0'],{windowsHide:true});}catch{control=null;continue;}
      rows=query.stdout.trim().split(/\r?\n/).filter(Boolean);
      if(rows.length&&!rows.some(row=>row.startsWith('PROTECTED:')||row.startsWith('UNKNOWN:'))){
        for(const row of rows)if(row.startsWith('GUI:'))await layoutApi.atomic(path.join(userData,'update-handoff.json'),{pid:Number(row.slice(4)),requesterPid:process.pid,expires:Date.now()+30000});
        await exec(control,[path.join(current.directory,'Opora.exe'),'close',protect?'1':'0'],{windowsHide:true});
      }
    }else{
      const query=await exec(path.join(process.env.SystemRoot||process.env.WINDIR,'System32/tasklist.exe'),['/FI','IMAGENAME eq Opora.exe','/FI','WINDOWTITLE eq Опора*','/FO','CSV','/NH'],{windowsHide:true,encoding:'buffer'});
      rows=new TextDecoder('ibm866').decode(query.stdout).split(/\r?\n/).filter(line=>line.startsWith('"Opora.exe"'));
    }
    if(!rows.length)break;
    if(!waiting){console.log('Дождусь сохранения Опоры. Текущую сессию Claude прерывать не нужно.');waiting=true;}
    await pause(2000);
  }
  // Legacy START-OPORA.cmd must find the new installation too; it cannot use
  // the old GUI's main.js redirect that did not exist before this migration.
  const starter=path.join(packageRoot,'OPORA-START.cjs');
  await fs.writeFile(starter,`const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');const current=JSON.parse(fs.readFileSync(${JSON.stringify(layout.pointer)},'utf8'));if(current.id!==${JSON.stringify(layout.id)})throw new Error('Invalid Opora installation');const env={...process.env,ELECTRON_NO_ATTACH_CONSOLE:'1'};delete env.ELECTRON_RUN_AS_NODE;const child=spawn(path.join(current.directory,'Opora.exe'),[],{cwd:current.directory,env,stdio:'ignore',windowsHide:true,detached:true});child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.unref();\n`);
  const relative=path.relative(packageRoot,initial);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Пакет находится вне установленной Опоры.');
  await fs.writeFile(path.join(packageRoot,'START-OPORA.cmd'),'@echo off\r\nsetlocal DisableDelayedExpansion\r\nset "ELECTRON_RUN_AS_NODE=1"\r\n"%~dp0'+relative+'" "%~dp0OPORA-START.cjs"\r\n');
  await updater.launchInstaller(plan,path.join(userData,'update-result.json'),{onProgress});
  console.log('Запускаю новую Опору...');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={compileControl};
