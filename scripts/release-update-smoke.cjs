const {_electron}=require('playwright-core'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const {execFile}=require('node:child_process'),exec=require('node:util').promisify(execFile),core=require('../src/core.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
  assert.equal(process.platform,'win32');assert.equal(process.env.CI,'true');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'opora-release-')),game=path.join(temp,'game'),profile=path.join(process.env.APPDATA,'opora-desktop'),stage=path.join(temp,'update/Opora-win32-x64'),source=path.join(temp,'asar-source');
  const report={nativeRelaunch:true};let oldPid,newPid;
  try{
    let base=path.resolve('release/Opora-win32-x64');
    const old=process.env.OPORA_TEST_OLD_BASE==='1',version=old?'0.13.0':require('../package.json').version,next=old?require('../package.json').version:require('../package.json').version.split('.').map((v,i)=>i===2?Number(v)+1:v).join('.');
    if(old){const r=await fetch('https://github.com/Isedis/basket/releases/download/v0.13.0/Opora-Windows.zip');assert.equal(r.status,200);const zip=path.join(temp,'old.zip');await fs.writeFile(zip,Buffer.from(await r.arrayBuffer()));await exec('python',['-c','import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',zip,path.join(temp,'old')]);base=path.join(temp,'old/Opora-win32-x64');}
    await fs.mkdir(game);await fs.mkdir(profile,{recursive:true});await fs.mkdir(path.join(stage,'resources'),{recursive:true});
    await fs.writeFile(path.join(game,'project.godot'),'config_version=5\n[application]\nconfig/name="Release game"\n');
    await core.saveProject(game,{version:1,name:'Release game',genre:'idle',pitch:'Test',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'My notes',brand:{status:'draft',direction:'My style',palette:'#123456',fonts:'Game.ttf',avoid:'Neon'},tasks:[],activeTaskId:null,references:[]});
    await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify({lastProject:game}));await fs.rm(path.join(profile,'update-result.json'),{force:true});
    asar.extractAll(path.resolve('release/Opora-win32-x64/resources/app.asar'),source);
    const pkg=JSON.parse(await fs.readFile(path.join(source,'package.json'),'utf8'));pkg.version=next;await fs.writeFile(path.join(source,'package.json'),JSON.stringify(pkg));
    await asar.createPackageWithOptions(source,path.join(stage,'resources/app.asar'),{unpackDir:path.join('node_modules','node-pty')});
    await exec('python',['-c','import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',path.resolve('distribution/app/Opora-Windows.zip.part01'),path.join(temp,'meta')]);
    const meta=JSON.parse(await fs.readFile(path.join(temp,'meta/Opora-win32-x64/runtime.json'),'utf8'));meta.version=next;meta.appSha256=hash(await fs.readFile(path.join(stage,'resources/app.asar')));await fs.writeFile(path.join(stage,'runtime.json'),JSON.stringify(meta));
    const zip=path.join(temp,'update.zip');await exec('python',['-c',"import pathlib,zipfile,sys;r=pathlib.Path(sys.argv[1]);z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED);[z.write(p,p.relative_to(r.parent)) for p in r.rglob('*') if p.is_file()];z.close()",stage,zip]);
    const data=await fs.readFile(zip),digest=hash(data),manifest={schemaVersion:1,version:next,commit:'a'.repeat(40),size:1,sha256:hash(Buffer.from('x')),parts:[{name:'Opora-Windows.zip.part01',size:1,sha256:hash(Buffer.from('x'))}],appPatch:{runtimeVersion:meta.runtimeVersion,size:data.length,sha256:digest,parts:[{name:'Opora-Windows.zip.part01',size:data.length,sha256:digest}]}};
    const app=await _electron.launch({executablePath:path.join(base,'Opora.exe'),args:[],timeout:30000});oldPid=await app.evaluate(()=>process.pid);
    const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#header-name')?.textContent==='Release game');
    await app.evaluate(({session},{manifest,zip})=>{session.fromPartition('opora-updates').fetch=async url=>new Response(String(url).includes('latest.json')?JSON.stringify(manifest):process.getBuiltinModule('fs').readFileSync(zip));},{manifest,zip});
    await page.locator('[data-action="updates"]').click();await page.locator('[data-action="install-update"]').click();
    let result;const deadline=Date.now()+100000;
    while(Date.now()<deadline){try{result=JSON.parse(await fs.readFile(path.join(profile,'update-result.json'),'utf8'));}catch{}if(['installed','failed','needs_attention'].includes(result?.status))break;await pause(200);}
    report.result=result;
    if(result?.job){for(const file of ['gui-process.json','launch-ack.json','gui-error.json','worker-error.json','installer.log','stderr.log'])try{const value=await fs.readFile(path.join(result.job,file),'utf8');if(file.endsWith('.json')){const v=JSON.parse(value);delete v.token;report[file]=v;if(file==='gui-process.json')newPid=v.pid;}else report[file]=value;}catch{}}
    await pause(2000);
    const capture=await exec('powershell.exe',['-NoProfile','-Command',`Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;$r=[Windows.Forms.Screen]::PrimaryScreen.Bounds;$b=New-Object Drawing.Bitmap($r.Width,$r.Height);$g=[Drawing.Graphics]::FromImage($b);$g.CopyFromScreen($r.Location,[Drawing.Point]::Empty,$r.Size);$colors=New-Object 'System.Collections.Generic.HashSet[int]';for($x=100;$x -lt 900;$x+=10){for($y=100;$y -lt 600;$y+=10){[void]$colors.Add($b.GetPixel($x,$y).ToArgb())}};$colors.Count;if($env:OPORA_SCREENSHOT){$b.Save($env:OPORA_SCREENSHOT)};$g.Dispose();$b.Dispose()`]);
    report.visibleColors=Number(capture.stdout.trim());assert.equal(result?.status,'installed',JSON.stringify(report));assert.equal(result.version,next);assert.equal(report['launch-ack.json']?.painted,true);assert.ok(report.visibleColors>5,'Visible window is blank');assert.equal((await core.loadProject(game)).state.rules,'My notes');report.dataPreserved=true;report.from=version;report.to=next;
    console.log('PASS actual release relaunch '+JSON.stringify(report));
  }catch(error){report.error=error.stack;report.startupLog=await fs.readFile(path.join(profile,'startup.log'),'utf8').catch(()=>'');throw error;}
  finally{if(process.env.OPORA_REPORT)await fs.writeFile(process.env.OPORA_REPORT,JSON.stringify(report,null,2));for(const pid of [oldPid,newPid])if(pid)try{process.kill(pid,'SIGKILL');}catch{}}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
