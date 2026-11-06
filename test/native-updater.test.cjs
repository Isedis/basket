const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFile}=require('node:child_process'),exec=require('node:util').promisify(execFile),asar=require('@electron/asar');
const updater=require('../desktop/native-updater.cjs'),layout=require('../desktop/install-layout.cjs'),{retry}=require('../desktop/update-watchdog.cjs');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-native-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
async function zipEntries(root,entries){const archive=path.join(root,'archive.zip');await exec('python',['-c',"import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1],'w'); [(z.writestr(e[0],e[1])) for e in json.loads(sys.argv[2])]; z.close()",archive,JSON.stringify(entries)]);return archive;}
test('Native ZIP extraction rejects traversal, Windows device names, ADS and case-colliding paths',async t=>{
  const root=await fixture(t);
  for(const entries of [[['Opora-win32-x64/../outside','x']],[['Opora-win32-x64/resources/file:stream','x']],[['Opora-win32-x64/resources/CON.txt','x']],[['Opora-win32-x64/a','x'],['Opora-win32-x64/A','y']]]){
    const archive=await zipEntries(root,entries),destination=await fs.mkdtemp(path.join(root,'out-'));
    await assert.rejects(updater.extract(archive,destination));
  }
  await assert.rejects(fs.access(path.join(root,'outside')));
});
test('Runtime reuse verifies files and signals automatic repair while preserving the running copy',async t=>{
  const root=await fixture(t),current=path.join(root,'old'),source=path.join(root,'new');await fs.mkdir(current);await fs.mkdir(source);
  await fs.writeFile(path.join(current,'Opora.exe'),'engine');await fs.writeFile(path.join(current,'engine.dll'),'verified');
  const manifest={runtimeVersion:'45.2.3',files:[{name:'engine.dll',sha256:hash('verified')}]};
  await updater.stageEngine(source,current,manifest,'45.2.3');assert.equal(await fs.readFile(path.join(source,'engine.dll'),'utf8'),'verified');
  await fs.writeFile(path.join(current,'engine.dll'),'changed');
  await assert.rejects(updater.stageEngine(path.join(root,'other'),current,manifest,'45.2.3'),error=>error.code==='ENGINE_REPAIR_REQUIRED');
  assert.equal(await fs.readFile(path.join(current,'Opora.exe'),'utf8'),'engine');
});
test('Preparation installs beside the running version, verifies application SHA and leaves activation unchanged',async t=>{
  const root=await fixture(t),current=path.join(root,'old'),payload=path.join(root,'payload/Opora-win32-x64'),input=path.join(root,'input'),storage=path.join(root,'cache');
  await fs.mkdir(current);await fs.mkdir(input);await fs.mkdir(path.join(payload,'resources'),{recursive:true});
  await fs.writeFile(path.join(current,'Opora.exe'),'engine');await fs.writeFile(path.join(current,'engine.dll'),'verified');
  await fs.writeFile(path.join(input,'package.json'),JSON.stringify({name:'opora',version:'0.13.0'}));await asar.createPackage(input,path.join(payload,'resources/app.asar'));
  const meta={runtimeVersion:'45.2.3',appSha256:hash(await fs.readFile(path.join(payload,'resources/app.asar'))),files:[{name:'engine.dll',sha256:hash('verified')}],appFiles:[]};
  await fs.writeFile(path.join(payload,'runtime.json'),JSON.stringify(meta));
  const archive=path.join(root,'update.zip');await exec('python',['-c',"import pathlib,zipfile,sys; r=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'w'); [z.write(p,p.relative_to(r.parent)) for p in r.rglob('*') if p.is_file()]; z.close()",payload,archive]);
  const plan=await updater.prepareInstall({kind:'app',version:'0.13.0',runtimeVersion:'45.2.3',archive},path.join(current,'Opora.exe'),{storage,runtimeVersion:'45.2.3'});
  assert.equal(plan.schemaVersion,3);assert.notEqual(plan.directory,current);assert.equal(plan.previousDirectory,current);assert.equal((await layout.read(plan.pointer)).directory,current);
  assert.equal(await fs.readFile(path.join(plan.directory,'Opora.exe'),'utf8'),'engine');assert.equal(await fs.readFile(path.join(current,'engine.dll'),'utf8'),'verified');
  assert.equal(JSON.parse(await fs.readFile(path.join(plan.directory,layout.MARKER),'utf8')).id,plan.installId);
  const manual=path.join(root,'manual');await fs.mkdir(manual);await fs.copyFile(path.join(payload,'resources/app.asar'),path.join(manual,'new-app.asar'));await fs.copyFile(path.join(payload,'runtime.json'),path.join(manual,'runtime.json'));
  const migration=await updater.prepareInstall({kind:'app',version:'0.13.0',runtimeVersion:'45.2.3',payload:manual},path.join(current,'Opora.exe'),{storage,runtimeVersion:'45.2.3'});
  assert.equal(migration.previousDirectory,current);assert.equal((await layout.read(migration.pointer)).directory,current);
  await fs.writeFile(path.join(manual,'new-app.asar'),'damaged');
  await assert.rejects(updater.prepareInstall({kind:'app',version:'0.13.0',runtimeVersion:'45.2.3',payload:manual},path.join(current,'Opora.exe'),{storage,runtimeVersion:'45.2.3'}),/Контрольная сумма/);
  // After a completed update, the original launcher and active version differ.
  await layout.atomic(plan.pointer,{schemaVersion:1,id:plan.installId,directory:plan.directory,version:'0.13.0'});
  const download={kind:'app',version:'0.13.0',runtimeVersion:'45.2.3',archive};
  const options={storage,runtimeVersion:'45.2.3'};
  await assert.rejects(updater.prepareInstall(download,path.join(current,'Opora.exe'),options),/Запущена предыдущая копия/);
  const repaired=await updater.prepareInstall(download,path.join(plan.directory,'Opora.exe'),options);
  assert.equal(repaired.previousDirectory,plan.directory);
  assert.equal((await layout.read(plan.pointer)).directory,plan.directory);
  assert.equal(await fs.readFile(path.join(current,'Opora.exe'),'utf8'),'engine');
  await assert.rejects(updater.commitAndRelaunch(repaired,{getPath:()=>root,relaunch:()=>{throw new Error('Native relaunch failed');}}),/Native relaunch failed/);
  assert.equal((await layout.read(plan.pointer)).directory,plan.directory);
});
test('Temporary sharing violations are retried; permanent I/O failures are returned immediately',async()=>{
  let calls=0;assert.equal(await retry(async()=>{calls++;if(calls<3)throw Object.assign(new Error('locked'),{code:'EACCES'});return 'ready';}), 'ready');assert.equal(calls,3);
  await assert.rejects(retry(()=>{throw Object.assign(new Error('disk failure'),{code:'EIO'});}),/disk failure/);
});
