const {_electron}=require('playwright-core');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),exec=require('node:util').promisify(execFile),core=require('../src/core.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  if(process.platform!=='win32'||process.env.CI!=='true')throw new Error('Disposable Windows CI runner required');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'opora-published-')),profile=path.join(process.env.APPDATA,'opora-desktop'),game=path.join(temp,'game');
  const report={from:'0.13.0',to:'0.13.1',realPublishedArtifacts:true};let app,oldPid,newPid;
  try{
    const response=await fetch('https://github.com/Isedis/basket/releases/download/v0.13.0/Opora-Windows.zip');assert.equal(response.status,200);
    const data=Buffer.from(await response.arrayBuffer());
    const checksum=await(await fetch('https://github.com/Isedis/basket/releases/download/v0.13.0/Opora-Windows.zip.sha256')).text();
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),checksum.split(/\s+/)[0]);
    const zip=path.join(temp,'old.zip');await fs.writeFile(zip,data);
    await exec('python',['-c','import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',zip,temp]);
    await fs.mkdir(game);await fs.mkdir(profile,{recursive:true});
    await fs.writeFile(path.join(game,'project.godot'),'config_version=5\n[application]\nconfig/name="Published update game"\n');
    await core.saveProject(game,{version:1,name:'Published update game',genre:'idle',pitch:'Test',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'Preserve notes',brand:{status:'draft',direction:'Preserve style',palette:'#123456',fonts:'Game.ttf',avoid:'Neon'},tasks:[],activeTaskId:null,references:[]});
    await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify({lastProject:game}));
    app=await _electron.launch({executablePath:path.join(temp,'Opora-win32-x64/Opora.exe'),args:[],timeout:30000});oldPid=await app.evaluate(()=>process.pid);
    const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#header-name')?.textContent==='Published update game');
    report.profile=await app.evaluate(({app})=>app.getPath('userData'));
    await page.locator('[data-action="updates"]').click();await page.locator('[data-action="install-update"]').click();
    const deadline=Date.now()+150000;let result;
    while(Date.now()<deadline){
      try{result=JSON.parse(await fs.readFile(path.join(profile,'update-result.json'),'utf8'));}catch{}
      if(['installed','failed','needs_attention'].includes(result?.status))break;
      if(!page.isClosed()){
        const text=await page.locator('#modal-content').textContent({timeout:500}).catch(()=>'');
        if(text.includes('Обновление не завершено')){report.modal=text;break;}
      }
      await pause(200);
    }
    report.result=result;
    if(result?.job)for(const file of ['plan.json','gui-process.json','gui-error.json','launch-ack.json','worker-error.json','gui-startup.log','installer.log']){
      try{const value=await fs.readFile(path.join(result.job,file),'utf8');if(file==='plan.json'){const plan=JSON.parse(value);report.plan={directory:plan.directory,previousDirectory:plan.previousDirectory,hashes:Object.keys(plan.hashes)};}else if(file.endsWith('.json')){const parsed=JSON.parse(value);delete parsed.token;report[file]=parsed;if(file==='gui-process.json'||file==='launch-ack.json')newPid=parsed.pid;}else report[file]=value.slice(-12000);}catch{}
    }
    report.startupLog=await fs.readFile(path.join(profile,'startup.log'),'utf8').catch(()=>'');
    report.notesPreserved=(await core.loadProject(game)).state.rules==='Preserve notes';
    const shot=process.env.OPORA_SCREENSHOT;
    if(shot)await exec('powershell.exe',['-NoProfile','-Command',`Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;$r=[Windows.Forms.Screen]::PrimaryScreen.Bounds;$b=New-Object Drawing.Bitmap($r.Width,$r.Height);$g=[Drawing.Graphics]::FromImage($b);$g.CopyFromScreen($r.Location,[Drawing.Point]::Empty,$r.Size);$b.Save($env:OPORA_SCREENSHOT);$g.Dispose();$b.Dispose()`]);
    assert.equal(result?.status,'installed',report.modal||JSON.stringify(result));assert.equal(result.version,'0.13.1');assert.equal(report.notesPreserved,true);
    console.log('PASS published update '+JSON.stringify(report));
  }catch(error){report.error=error.stack;throw error;}
  finally{
    if(process.env.OPORA_REPORT)await fs.writeFile(process.env.OPORA_REPORT,JSON.stringify(report,null,2));
    for(const pid of [oldPid,newPid])if(pid)try{process.kill(pid,'SIGKILL');}catch{}
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
