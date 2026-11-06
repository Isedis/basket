// Run the shipped EXE with its real default profile, while a broken legacy GUI
// holds the old singleton lock. Confined to disposable GitHub Windows runners.
const {_electron}=require('playwright-core');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const core=require('../src/core.cjs');
async function main(){
  if(process.platform!=='win32'||process.env.CI!=='true')throw new Error('Portable default-profile test requires a disposable Windows CI runner.');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'opora-portable-')),legacy=path.join(process.env.APPDATA,'opora'),modern=path.join(process.env.APPDATA,'opora-desktop'),game=path.join(temp,'game');
  const report={version:require('../package.json').version};let oldApp,newApp,oldPid,newPid;
  try{
    await fs.mkdir(legacy,{recursive:true});await fs.mkdir(game);
    // This test must not overwrite any pre-existing settings, even in CI.
    for(const file of [path.join(legacy,'preferences.json'),path.join(modern,'preferences.json')])await assert.rejects(fs.access(file));
    await fs.writeFile(path.join(game,'project.godot'),'config_version=5\n[application]\nconfig/name="My existing game"\n');
    await core.saveProject(game,{version:1,name:'My existing game',genre:'idle',pitch:'Test',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'My saved notes',brand:{status:'draft',direction:'My existing style',palette:'#123456',fonts:'Game.ttf',avoid:'Neon'},tasks:[],activeTaskId:null,references:[]});
    await fs.writeFile(path.join(legacy,'preferences.json'),JSON.stringify({lastProject:game}));
    await fs.writeFile(path.join(legacy,'terminal-broker.json'),'{invalid legacy connection');
    await fs.mkdir(path.join(legacy,'runtime'),{recursive:true});await fs.writeFile(path.join(legacy,'runtime/opora-active.json'),'{broken legacy pointer');
    const entry=path.join(temp,'legacy.cjs'),html=path.join(temp,'legacy.html');await fs.writeFile(html,'<html><title>Old stuck Opora</title><body>Legacy gray window</body></html>');
    await fs.writeFile(entry,`const {app,BrowserWindow}=require('electron');app.setName('opora');app.setPath('userData',${JSON.stringify(legacy)});if(!app.requestSingleInstanceLock())throw new Error('Legacy test lock was unavailable');app.whenReady().then(()=>{const win=new BrowserWindow();win.on('close',e=>e.preventDefault());win.loadFile(${JSON.stringify(html)});});`);
    oldApp=await _electron.launch({executablePath:require('electron'),args:[entry],timeout:20000});oldPid=await oldApp.evaluate(()=>process.pid);
    const executable=path.resolve('release/Opora-win32-x64/Opora.exe');
    async function launch(){
      // No fixture entry or user-data-dir switch: the real double-click path.
      newApp=await _electron.launch({executablePath:executable,args:[],timeout:20000});newPid=await newApp.evaluate(()=>process.pid);
      const page=await newApp.firstWindow();await page.waitForFunction(()=>document.querySelector('#header-name')?.textContent==='My existing game',null,{timeout:15000});
      assert.equal((await newApp.evaluate(({app})=>app.getPath('userData'))).toLowerCase(),modern.toLowerCase());
      process.kill(oldPid,0);return page;
    }
    const page=await launch();report.opensWithLegacyWindowRunning=true;
    await page.locator('nav [data-tab="brand"]').click();assert.equal(await page.locator('[data-field="brand.direction"]').inputValue(),'My existing style');
    await page.locator('nav [data-tab="overview"]').click();assert.equal(await page.locator('[data-field="rules"]').inputValue(),'My saved notes');
    await page.locator('[data-field="rules"]').fill('Saved in the new Opora');
    await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('Сохранено'));
    assert.equal((await core.loadProject(game)).state.rules,'Saved in the new Opora');
    process.kill(newPid,'SIGKILL');newPid=null;newApp=null;
    const restarted=await launch();await restarted.locator('nav [data-tab="overview"]').click();assert.equal(await restarted.locator('[data-field="rules"]').inputValue(),'Saved in the new Opora');
    report.notesAndBrandbookPreserved=true;report.saveAndRestartWorks=true;
    assert.equal(await fs.readFile(path.join(legacy,'terminal-broker.json'),'utf8'),'{invalid legacy connection');
    report.legacyProfileUntouched=true;
    console.log('PASS portable download '+JSON.stringify(report));
  }catch(error){report.error=error.stack;try{report.log=await fs.readFile(path.join(modern,'startup.log'),'utf8');}catch{}throw error;}
  finally{
    if(process.env.OPORA_REPORT)await fs.writeFile(process.env.OPORA_REPORT,JSON.stringify(report,null,2));
    for(const pid of [newPid,oldPid])if(pid)try{process.kill(pid,'SIGKILL');}catch{}
    await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});
    // The runner is discarded after this job. Keep profile logs for diagnostics.
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
