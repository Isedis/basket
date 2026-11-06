// Exercise the published recovery ZIP through its real -File entry point.
// Linux substitutes Electron's runtime and launch flags; Windows PS 5.1/CIM
// and Windows file locking are not simulated as successful platform checks.
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process');
const exec=require('node:util').promisify(execFile);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
async function main(){
  assert.equal(process.platform,'linux');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"opora recovery & игра [1] ' "));
  const packageRoot=path.join(temp,'basket-opora'),directory=path.join(packageRoot,'Opora-App/Opora-win32-x64'),profile=path.join(temp,'profile');
  let pid;
  try{
    await fs.mkdir(packageRoot);await fs.mkdir(profile);
    await exec('python',['-c','import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',path.join(__dirname,'../distribution/Opora-small-update.zip'),packageRoot]);
    const script=path.join(packageRoot,'light-update.ps1');
    assert.deepEqual((await fs.readFile(script)).subarray(0,3),Buffer.from([239,187,191]));
    const cmd=await fs.readFile(path.join(packageRoot,'UPDATE-OPORA.cmd'),'utf8');
    assert.match(cmd,/-File "%OPORA_PACKAGE_ROOT%light-update\.ps1"/);assert.ok(!cmd.includes('-Command'));
    await fs.cp(path.dirname(require('electron')),directory,{recursive:true});
    await fs.rename(path.join(directory,'electron'),path.join(directory,'Opora.exe'));
    const meta=JSON.parse(await fs.readFile(path.join(packageRoot,'runtime.json'),'utf8'));
    assert.equal(digest(await fs.readFile(path.join(packageRoot,'new-app.asar'))),meta.appSha256);
    meta.files=[];
    for(const file of await fs.readdir(directory,{recursive:true})){
      const input=path.join(directory,file);if(file==='Opora.exe'||!(await fs.lstat(input)).isFile())continue;
      meta.files.push({name:file.split(path.sep).join('/'),sha256:digest(await fs.readFile(input))});
    }
    await fs.writeFile(path.join(packageRoot,'runtime.json'),JSON.stringify(meta));
    const helper=path.join(packageRoot,'update-helper.ps1');
    const original=await fs.readFile(helper,'utf8');const target='$startInfo.UseShellExecute=$false';
    assert.equal(original.split(target).length,2);
    await fs.writeFile(helper,original.replace(target,target+"; $startInfo.Arguments='--no-sandbox --ozone-platform=headless'"));
    const child=spawn(process.env.OPORA_PWSH||'pwsh',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{cwd:temp,stdio:['ignore','pipe','pipe'],env:{...process.env,OPORA_PACKAGE_ROOT:packageRoot,APPDATA:profile,XDG_CONFIG_HOME:profile}});
    let output='';child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    if(code!==0){try{output+='\n'+await fs.readFile(path.join(profile,'opora/update-result.json'),'utf8');}catch{}}
    assert.equal(code,0,output);
    const jobs=(await fs.readdir(path.dirname(directory))).filter(f=>f.startsWith('.opora-update-'));
    assert.equal(jobs.length,1,output);const job=path.join(path.dirname(directory),jobs[0]);
    const ack=JSON.parse(await fs.readFile(path.join(job,'launch-ack.json'),'utf8'));pid=ack.pid;
    assert.equal(code,0,output);assert.equal(ack.version,require('../package.json').version);
    const result=JSON.parse(await fs.readFile(path.join(profile,'opora/update-result.json'),'utf8'));assert.equal(result.status,'installed');
    assert.equal(digest(await fs.readFile(path.join(directory,'resources/app.asar'))),meta.appSha256);
    for(const file of meta.appFiles)assert.equal(digest(await fs.readFile(path.join(directory,file.name))),file.sha256);
    assert.ok((await fs.stat(path.join(result.backup,'Opora.exe'))).isFile());
    console.log('PASS actual recovery ZIP: UTF-8 BOM -File entry, muted stdin, local runtime copy, native files, backup, GUI restart and '+ack.version+' acknowledgement. Linux runtime.');
  }finally{
    if(pid){try{process.kill(pid,'SIGTERM');}catch{}for(let n=0;n<40;n++){try{process.kill(pid,0);await pause(25);}catch{break;}}}
    await fs.rm(temp,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
