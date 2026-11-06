// Linux integration: real old/new Electron GUIs and the real PowerShell installer.
// This validates the handshake and restart, not Windows-specific file locking/CIM.
const {_electron}=require('playwright-core');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const asar=require('@electron/asar');
const core=require('../src/core.cjs');
const {launchInstaller}=require('../desktop/windows-updater.cjs');
const root=path.join(__dirname,'..');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  assert.equal(process.platform,'linux','This integration uses the installed Linux Electron runtime.');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'opora-restart-'));
  const profile=path.join(temp,'profile'),game=path.join(temp,'game');
  const directory=path.join(temp,'Opora-win32-x64');
  const job=await fs.mkdtemp(path.join(temp,'.opora-update-'));
  const source=path.join(job,'unpacked/Opora-win32-x64');
  let oldApp,newPid;
  try{
    await fs.mkdir(profile);await fs.mkdir(game);
    await fs.writeFile(path.join(game,'project.godot'),'config_version=5\n[application]\nconfig/name="Сохранённая игра"\n');
    const loaded=await core.loadProject(game);
    loaded.state={version:1,name:'Сохранённая игра',genre:'idle',pitch:'Сохранённый замысел',experience:'Спокойствие',goal:'Меню',pillars:'Один стиль',rules:'Не терять решения при обновлении',brand:{status:'draft',direction:'Утверждённое направление',palette:'#000000 — фон',fonts:'Game.ttf',avoid:'Неон'},tasks:[],activeTaskId:null,references:[]};
    await core.saveProject(game,loaded.state);
    await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify({lastProject:game}));
    const base=path.join(root,'release/Opora-win32-x64/resources/app.asar');
    const appSource=path.join(temp,'app-source');asar.extractAll(base,appSource);
    for(const dir of ['desktop','ui','src','mcp'])await fs.cp(path.join(root,dir),path.join(appSource,dir),{recursive:true});
    const pkg=JSON.parse(await fs.readFile(path.join(appSource,'package.json'),'utf8'));
    pkg.main='restart-test-bootstrap.cjs';
    await fs.writeFile(path.join(appSource,pkg.main),`
const {app,BrowserWindow}=require('electron');
app.commandLine.appendSwitch('no-sandbox');app.commandLine.appendSwitch('ozone-platform','headless');
app.setPath('userData',${JSON.stringify(profile)});
require('./desktop/main.cjs');
if(process.env.OPORA_UPDATE_JOB){
  const fs=require('node:fs');const path=require('node:path');
  const timer=setInterval(async()=>{try{
    const win=BrowserWindow.getAllWindows()[0];if(!win)return;
    const name=await win.webContents.executeJavaScript('document.querySelector("#header-name")?.textContent');
    if(name!=='Сохранённая игра')return;
    fs.writeFileSync(path.join(process.env.OPORA_TEST_JOB,'ui-proof.json'),JSON.stringify({name,version:require('./package.json').version,executable:process.execPath}));clearInterval(timer);
  }catch{}},100);
}
`);
    const runtime=path.dirname(require('electron'));
    for(const [folder,version] of [[directory,'0.5.1'],[source,require('../package.json').version]]){
      await fs.cp(runtime,folder,{recursive:true});
      await fs.rename(path.join(folder,'electron'),path.join(folder,'Opora.exe'));
      pkg.version=version;await fs.writeFile(path.join(appSource,'package.json'),JSON.stringify(pkg));
      await asar.createPackage(appSource,path.join(folder,'resources/app.asar'));
    }
    oldApp=await _electron.launch({executablePath:path.join(directory,'Opora.exe'),args:['--no-sandbox','--ozone-platform=headless'],timeout:30000});
    const page=await oldApp.firstWindow();
    await page.waitForFunction(()=>document.querySelector('#header-name')?.textContent==='Сохранённая игра');
    const hashes={};for(const file of ['Opora.exe','resources/app.asar'])hashes[file]=crypto.createHash('sha256').update(await fs.readFile(path.join(source,file))).digest('hex');
    const script=path.join(job,'installer.ps1');
    let helper=await fs.readFile(path.join(root,'desktop/windows-install.ps1'),'utf8');
    const slowPreparation=process.env.OPORA_TEST_SLOW_PREP==='1';
    if(slowPreparation)helper=helper.replace('$expected=$Plan.hashes.PSObject.Properties[$relative].Value','Start-Sleep -Milliseconds 9000; $expected=$Plan.hashes.PSObject.Properties[$relative].Value');
    const startup='$startInfo.UseShellExecute=$false';
    assert.equal(helper.split(startup).length,2);
    // Platform adapter only: Linux CI needs Chromium flags before main.js loads.
    // All installer checks, moves, rollback, tokens and GUI acknowledgements stay intact.
    await fs.writeFile(script,helper.replace(startup,startup+"; $startInfo.Arguments='--no-sandbox --ozone-platform=headless'"));
    const plan={schemaVersion:1,job,script,source,directory,backup:directory+'.opora-backup-'+crypto.randomUUID(),version:require('../package.json').version,parentPid:oldApp.process().pid,token:crypto.randomBytes(32).toString('hex'),hashes};
    const result=path.join(profile,'update-result.json');
    // The proof hook is test-only; the normal startup ack comes from desktop/main.cjs.
    process.env.OPORA_TEST_JOB=job;
    const phases=[],started=Date.now();
    await launchInstaller(plan,result,{powerShell:process.env.OPORA_PWSH||'pwsh',...(slowPreparation?{startupTimeoutMs:3000,readyTimeoutMs:40000}:{}),onProgress:phase=>phases.push(phase)});
    if(slowPreparation){assert.ok(Date.now()-started>15000,'The former 15-second deadline was not exceeded');assert.ok(phases.some(phase=>phase.includes('SHA256')),'Hashing progress was not received');}
    delete process.env.OPORA_TEST_JOB;
    assert.equal(oldApp.process().exitCode,null,'GUI closed before the helper confirmed readiness');
    await oldApp.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
    await oldApp.waitForEvent('close');oldApp=null;
    const deadline=Date.now()+45000;let state,proof;
    while(Date.now()<deadline){
      state=JSON.parse(await fs.readFile(result,'utf8'));
      if(['failed','needs_attention'].includes(state.status))throw new Error(state.error);
      try{proof=JSON.parse(await fs.readFile(path.join(job,'ui-proof.json'),'utf8'));}catch{}
      try{newPid=JSON.parse(await fs.readFile(path.join(job,'launch-ack.json'),'utf8')).pid;}catch{}
      if(state.status==='installed' && proof)break;
      await pause(150);
    }
    assert.equal(state.status,'installed');assert.equal(proof?.version,plan.version);
    assert.equal(proof?.name,'Сохранённая игра');assert.equal(proof?.executable,path.join(directory,'Opora.exe'));
    assert.equal((await core.loadProject(game)).state.rules,'Не терять решения при обновлении');
    assert.equal(JSON.parse(asar.extractFile(path.join(plan.backup,'resources/app.asar'),'package.json')).version,'0.5.1');
    console.log('PASS real restart: helper readiness → old GUI closes → files replaced → new Electron GUI confirms '+plan.version+' → same project restored; backup retained. Linux runtime.');
  }catch(error){
    for(const file of ['installer.log','stderr.log'])try{console.error((await fs.readFile(path.join(job,file),'utf8')).slice(-5000));}catch{}
    throw error;
  }finally{
    delete process.env.OPORA_TEST_JOB;
    if(oldApp)await oldApp.close().catch(()=>{});
    if(!newPid)try{newPid=JSON.parse(await fs.readFile(path.join(job,'launch-ack.json'),'utf8')).pid;}catch{}
    if(newPid)try{process.kill(newPid,'SIGTERM');await pause(300);}catch{}
    await fs.rm(temp,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
