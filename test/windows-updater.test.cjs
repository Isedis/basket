const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {EventEmitter}=require('node:events');
const asar=require('@electron/asar');
const {prepareInstall,launchInstaller,confirmLaunch,readResult,readDiagnostics}=require('../desktop/windows-updater.cjs');
async function fixture(t,version='0.5.1'){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-win-update-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const directory=path.join(root,"игра [app] % ! & '");
  await fs.mkdir(directory);await fs.writeFile(path.join(directory,'Opora.exe'),'old executable');
  const input=path.join(root,'input');await fs.mkdir(input);
  await fs.writeFile(path.join(input,'package.json'),JSON.stringify({name:'opora',version}));
  const archive=path.join(root,'fixture.asar');await asar.createPackage(input,archive);
  const calls=[];
  const runPowerShell=async (script,env,options)=>{
    calls.push({script,env,options});
    assert.equal(path.dirname(options.cwd),root);assert.notEqual(options.cwd,directory);
    if(env.OPORA_UPDATE_STAGE){
      const app=path.join(env.OPORA_UPDATE_STAGE,'Opora-win32-x64');
      await fs.mkdir(path.join(app,'resources'),{recursive:true});
      await fs.writeFile(path.join(app,'Opora.exe'),'new executable');
      await fs.copyFile(archive,path.join(app,'resources/app.asar'));
    }
  };
  const download={archive:path.join(root,'release.zip'),version:'0.5.1',directory:path.join(root,'downloads')};
  return {root,directory,archive,calls,runPowerShell,download};
}
test('Windows preparation stages on the install drive, uses real ASAR metadata and leaves the old app untouched',async t=>{
  const f=await fixture(t);
  const plan=await prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:f.runPowerShell});
  assert.equal(plan.version,'0.5.1');assert.equal(f.calls.length,2);
  assert.equal(path.dirname(plan.job),path.dirname(f.directory));
  assert.ok(plan.source.startsWith(plan.job+path.sep));
  assert.match(plan.hashes['resources/app.asar'],/^[a-f0-9]{64}$/);
  assert.equal(await fs.readFile(path.join(f.directory,'Opora.exe'),'utf8'),'old executable');
  assert.match(await fs.readFile(plan.script,'utf8'),/CurrentDirectory=\$Plan.job/);
});
test('An MCP preflight failure stops before extraction and does not leave a replacement directory',async t=>{
  const f=await fixture(t);let called=0;
  await assert.rejects(prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:async()=>{called++;throw new Error('Close MCP first');}}),/MCP/);
  assert.equal(called,1);
  assert.equal((await fs.readdir(f.root)).filter(p=>p.startsWith('.opora-update-')).length,0);
  assert.equal(await fs.readFile(path.join(f.directory,'Opora.exe'),'utf8'),'old executable');
});
test('A wrong or truncated ASAR fails before the GUI is asked to quit',async t=>{
  for(const invalid of ['wrong-version','truncated']){
    const f=await fixture(t,invalid==='wrong-version'?'0.1.0':'0.5.1');
    if(invalid==='truncated')await fs.writeFile(f.archive,'broken asar');
    await assert.rejects(prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:f.runPowerShell}),/ASAR|Версия/);
    assert.equal(await fs.readFile(path.join(f.directory,'Opora.exe'),'utf8'),'old executable');
  }
});
function fakeSpawn(callback){return (_command,_args,options)=>{
  const child=new EventEmitter();child.pid=34567;child.unref=()=>{};
  process.nextTick(()=>{child.emit('spawn');Promise.resolve(callback(child,options)).catch(error=>child.emit('error',error));});return child;
};}
test('A spawned PowerShell is insufficient: readiness must match the job token and PID before shutdown is allowed',async t=>{
  const f=await fixture(t);const plan=await prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:f.runPowerShell});
  let returned=false;
  const spawnProcess=fakeSpawn(async(child,options)=>{
    assert.equal(options.cwd,plan.job);assert.equal(options.detached,true);
    assert.equal(returned,false);
    await new Promise(resolve=>setTimeout(resolve,40));
    await fs.writeFile(path.join(plan.job,'ready.json'),JSON.stringify({token:plan.token,pid:child.pid}));
  });
  await launchInstaller(plan,path.join(f.root,'profile/update-result.json'),{spawnProcess});returned=true;
  assert.equal((await readResult(path.join(plan.job,'plan.json'))).directory,f.directory);
  await assert.rejects(fs.access(path.join(plan.job,'cancel')));
});
test('A helper that exits before readiness records an error, cancels late work and never permits quitting',async t=>{
  const f=await fixture(t);const plan=await prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:f.runPowerShell});
  const result=path.join(f.root,'update-result.json');
  await assert.rejects(launchInstaller(plan,result,{spawnProcess:fakeSpawn(child=>child.emit('exit',1))}),/не запущен/);
  assert.equal((await readResult(result)).status,'failed');
  await fs.access(path.join(plan.job,'cancel'));
  assert.equal(await fs.readFile(path.join(f.directory,'Opora.exe'),'utf8'),'old executable');
});
test('An unrelated ready file cannot authorize the GUI to close',async t=>{
  const f=await fixture(t);const plan=await prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:f.runPowerShell});
  const spawnProcess=fakeSpawn(async child=>{await fs.writeFile(path.join(plan.job,'ready.json'),JSON.stringify({token:'wrong',pid:child.pid}));});
  await assert.rejects(launchInstaller(plan,path.join(f.root,'result.json'),{spawnProcess,readyTimeoutMs:150}),/не запущен/);
  await fs.access(path.join(plan.job,'cancel'));
});
test('Startup acknowledgement binds to the running version, executable, job and token',async t=>{
  const f=await fixture(t);const plan=await prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:f.runPowerShell});
  await fs.writeFile(path.join(plan.job,'plan.json'),JSON.stringify(plan));
  const input={job:plan.job,token:plan.token,version:plan.version,executable:path.join(f.directory,'Opora.exe')};
  for(const change of [{version:'0.3.0'},{token:'wrong'},{executable:path.join(f.root,'other/Opora.exe')}])await assert.rejects(confirmLaunch({...input,...change}),/подтвердить/);
  await assert.rejects(fs.access(path.join(plan.job,'launch-ack.json')));
  assert.equal(await confirmLaunch(input),true);
  const ack=await readResult(path.join(plan.job,'launch-ack.json'));
  assert.equal(ack.pid,process.pid);assert.equal(ack.version,'0.5.1');
});

test('Authenticated preparation progress tolerates a slow hash check beyond the process-start budget',async t=>{
  const f=await fixture(t),plan=await prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:f.runPowerShell}),phases=[];
  const spawnProcess=fakeSpawn(async child=>{
    await fs.writeFile(path.join(plan.job,'progress.json'),JSON.stringify({token:plan.token,pid:child.pid,phase:'Проверка SHA256: Opora.exe'}));
    await new Promise(resolve=>setTimeout(resolve,350));
    await fs.writeFile(path.join(plan.job,'ready.json'),JSON.stringify({token:plan.token,pid:child.pid}));
  });
  await launchInstaller(plan,path.join(f.root,'result.json'),{spawnProcess,startupTimeoutMs:120,readyTimeoutMs:1500,onProgress:phase=>phases.push(phase)});
  assert.ok(phases.includes('Проверка SHA256: Opora.exe'));await assert.rejects(fs.access(path.join(plan.job,'cancel')));
  assert.equal(await fs.readFile(path.join(f.directory,'Opora.exe'),'utf8'),'old executable');
});
test('A foreign progress file cannot extend startup or authorize shutdown',async t=>{
  const f=await fixture(t),plan=await prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:f.runPowerShell});
  await assert.rejects(launchInstaller(plan,path.join(f.root,'result.json'),{startupTimeoutMs:120,readyTimeoutMs:1000,spawnProcess:fakeSpawn(async child=>{await fs.writeFile(path.join(plan.job,'progress.json'),JSON.stringify({token:'wrong',pid:child.pid,phase:'fake'}));})}),/не запущен/);
  await fs.access(path.join(plan.job,'cancel'));assert.equal((await readResult(path.join(f.root,'result.json'))).diagnostics.progress,null);
});
test('Failure diagnostics contain the actual helper phase and output, with protocol tokens omitted',async t=>{
  const f=await fixture(t),plan=await prepareInstall(f.download,path.join(f.directory,'Opora.exe'),{runPowerShell:f.runPowerShell}),file=path.join(f.root,'profile/result.json');
  const spawnProcess=fakeSpawn(async child=>{
    await fs.writeFile(path.join(plan.job,'progress.json'),JSON.stringify({token:plan.token,pid:child.pid,phase:'Проверка SHA256: Opora.exe'}));
    await new Promise(resolve=>setTimeout(resolve,160));
    await fs.appendFile(path.join(plan.job,'stderr.log'),'TEST: native startup denied');child.emit('exit',5);
  });
  await assert.rejects(launchInstaller(plan,file,{spawnProcess}),/native startup denied/);
  const info=await readDiagnostics(file,{directory:f.directory});assert.equal(info.result.diagnostics.exitCode,5);assert.match(info.logs.stderr,/native startup denied/);assert.equal(info.result.phase,'Проверка SHA256: Opora.exe');assert.ok(!JSON.stringify(info).includes(plan.token));
  await fs.writeFile(file,JSON.stringify({directory:f.directory,job:path.join(f.root,'unrelated-directory')}));assert.equal((await readDiagnostics(file,{directory:f.directory})).logs,undefined);
});

test('Application-only preparation copies verified runtime locally and rejects changed DLLs',async t=>{
  for(const corrupt of [false,true]){
    const f=await fixture(t);const crypto=require('node:crypto');
    await fs.writeFile(path.join(f.directory,'engine.dll'),'stable engine');
    const digest=crypto.createHash('sha256').update('stable engine').digest('hex');
    const run=async(script,env,options)=>{await f.runPowerShell(script,env,options);if(env.OPORA_UPDATE_STAGE){const source=path.join(env.OPORA_UPDATE_STAGE,'Opora-win32-x64');await fs.rm(path.join(source,'Opora.exe'));await fs.writeFile(path.join(source,'runtime.json'),JSON.stringify({runtimeVersion:'45.2.3',files:[{name:'engine.dll',sha256:digest}]}));}};
    if(corrupt)await fs.writeFile(path.join(f.directory,'engine.dll'),'changed');
    const action=()=>prepareInstall({...f.download,kind:'app',runtimeVersion:'45.2.3'},path.join(f.directory,'Opora.exe'),{runPowerShell:run,runtimeVersion:'45.2.3'});
    if(corrupt)await assert.rejects(action(),/Electron/);
    else{const plan=await action();assert.equal(await fs.readFile(path.join(plan.source,'engine.dll'),'utf8'),'stable engine');assert.equal(await fs.readFile(path.join(plan.source,'Opora.exe'),'utf8'),'old executable');}
    assert.equal(await fs.readFile(path.join(f.directory,'Opora.exe'),'utf8'),'old executable');
  }
});
