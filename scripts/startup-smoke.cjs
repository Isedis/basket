// Windows uses the exact shipped Opora.exe and ASAR without a fixture bootstrap.
const {_electron}=require('playwright-core');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict');
const core=require('../src/core.cjs');
async function main(){
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'opora-startup-')),report={platform:process.platform,cases:[]};
  let application,pid,server;const sockets=new Set();
  try{
    for(const scenario of ['clean','invalid-broker','silent-broker']){
      const appdata=path.join(temp,scenario),profile=path.join(appdata,'opora'),game=path.join(temp,'game-'+scenario);
      await fs.mkdir(profile,{recursive:true});await fs.mkdir(game);
      await fs.writeFile(path.join(game,'project.godot'),'config_version=5\n[application]\nconfig/name="Saved game"\n');
      await core.saveProject(game,{version:1,name:'Saved game',genre:'idle',pitch:'Test',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'Preserve my notes',brand:{status:'draft',direction:'Matte',palette:'#123456',fonts:'Game.ttf',avoid:'Neon'},tasks:[],activeTaskId:null,references:[]});
      await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify({lastProject:game}));
      if(scenario==='invalid-broker')await fs.writeFile(path.join(profile,'terminal-broker.json'),'{bad json');
      if(scenario==='silent-broker'){
        server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        await fs.writeFile(path.join(profile,'terminal-broker.json'),JSON.stringify({schemaVersion:1,pid:process.pid,port:server.address().port,token:'a'.repeat(64)}));
      }
      const executable=process.env.OPORA_EXECUTABLE||(process.platform==='win32'?path.resolve('release/Opora-win32-x64/Opora.exe'):require('electron'));
      let args=['--user-data-dir='+profile];
      if(process.platform!=='win32'){
        const entry=path.join(appdata,'entry.cjs');await fs.writeFile(entry,`require('electron').app.setPath('userData',${JSON.stringify(profile)});require(${JSON.stringify(path.resolve('desktop/main.cjs'))});`);
        args=[entry,'--no-sandbox','--ozone-platform=headless','--user-data-dir='+profile];
      }
      const started=Date.now();
      application=await _electron.launch({executablePath:executable,args,env:{...process.env,APPDATA:appdata},timeout:20000});
      pid=await application.evaluate(()=>process.pid);
      report.current={scenario,profile:await application.evaluate(({app})=>app.getPath('userData'))};
      const page=await application.firstWindow();
      await page.locator('nav [data-tab="brand"]').waitFor({timeout:12000});
      const visibleMs=Date.now()-started;
      await page.waitForFunction(()=>document.querySelector('#header-name')?.textContent==='Saved game',null,{timeout:12000});
      assert.equal(await application.evaluate(({app})=>app.getPath('userData')),profile);
      await page.locator('nav [data-tab="overview"]').click();
      assert.equal(await page.locator('[data-field="rules"]').inputValue(),'Preserve my notes');
      const log=await fs.readFile(path.join(profile,'startup.log'),'utf8');assert.match(log,/interface-loaded/);
      if(scenario!=='clean')assert.match(log,/terminal-unavailable/);
      assert.equal((await core.loadProject(game)).state.rules,'Preserve my notes');
      if(process.platform==='win32')assert.equal(await application.evaluate(({app})=>app.isHardwareAccelerationEnabled()),false);
      report.cases.push({scenario,visibleMs,version:await application.evaluate(()=>require(require('node:path').join(process.resourcesPath,'app.asar/package.json')).version).catch(()=>require('../package.json').version),notesPreserved:true});
      if(scenario==='clean'){
        await application.evaluate(async({BrowserWindow})=>{try{await BrowserWindow.getAllWindows()[0].loadFile('missing-opora-interface.html');}catch{}});
        await page.waitForURL(/startup\.html$/);
        await page.getByRole('button',{name:'Скопировать диагностику'}).click();
        assert.match(await application.evaluate(({clipboard})=>clipboard.readText()),/Не удалось загрузить интерфейс/);
        const closed=page.waitForEvent('close');
        await application.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].close();}).catch(()=>{});
        await closed;report.failureScreenWorks=true;
      }
      // Only terminate our fixture GUI, never a user process or a process tree.
      if(pid)process.kill(pid,'SIGKILL');pid=null;application=null;
      for(const socket of sockets)socket.destroy();
      if(server){await new Promise(resolve=>server.close(resolve));server=null;}
    }
    console.log('PASS startup '+JSON.stringify(report));
  }catch(error){report.error=error.stack;try{report.log=await fs.readFile(path.join(report.current.profile,'startup.log'),'utf8');}catch{}throw error;}
  finally{
    if(process.env.OPORA_REPORT)await fs.writeFile(process.env.OPORA_REPORT,JSON.stringify(report,null,2));
    if(pid)try{process.kill(pid,'SIGKILL');}catch{}
    for(const socket of sockets)socket.destroy();if(server)await new Promise(resolve=>server.close(resolve));
    await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
