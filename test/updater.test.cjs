const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {Updater,validateManifest,compareVersions,SOURCE}=require('../src/updater.cjs');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const chunks=[Buffer.from('first zip bytes'),Buffer.from('second zip bytes')];
function manifest(version='0.3.0') {
  return {schemaVersion:1,version,commit:'a'.repeat(40),size:Buffer.concat(chunks).length,sha256:sha(Buffer.concat(chunks)),notes:'New version',parts:chunks.map((data,i)=>({name:`Opora-Windows.zip.part0${i+1}`,size:data.length,sha256:sha(data)}))};
}
async function fixture(t,options={}) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'opora-updater-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const requested=[],progress=[];
  const m=options.manifest||manifest();
  const updater=new Updater({currentVersion:'0.2.0',directory,supported:options.supported??true,onProgress:state=>progress.push(state),fetch:async (url,opts)=>{
    requested.push(url);assert.equal(opts.redirect,'error');
    if(url.endsWith('latest.json'))return new Response(JSON.stringify(m),{status:options.status||200});
    const index=m.parts.findIndex(p=>url.endsWith(p.name));assert.ok(index>=0);
    const data=options.corrupt?Buffer.alloc(chunks[index].length,1):chunks[index];
    return new Response(new ReadableStream({start(controller){controller.enqueue(data.subarray(0,3));controller.enqueue(data.subarray(3));controller.close();}}));
  }});
  return {updater,directory,requested,progress,m};
}
test('Updater compares semantic versions numerically and rejects unsupported versions',()=>{
  assert.equal(compareVersions('0.10.0','0.2.0'),1);
  assert.equal(compareVersions('1.0.0','1.0.0'),0);
  assert.equal(compareVersions('0.9.9','1.0.0'),-1);
  assert.throws(()=>compareVersions('v1.2.0','1.0.0'));
  assert.throws(()=>compareVersions('1.2.0-beta','1.0.0'));
});
test('Update manifests reject traversal, duplicate parts, wrong totals and unpinned commits',()=>{
  for(const alter of [m=>{m.parts[0].name='../evil.exe';},m=>{m.parts[1].name=m.parts[0].name;},m=>{m.size++;},m=>{m.commit='opora';},m=>{m.parts[0].sha256='invalid';}]) {
    const m=manifest();alter(m);assert.throws(()=>validateManifest(m),/некорректное/);
  }
});
test('Update download uses immutable GitHub paths, streams exact bytes and verifies final archive',async t=>{
  const {updater,requested,progress,m}=await fixture(t);
  assert.equal((await updater.check()).status,'available');
  assert.equal((await updater.download()).status,'downloaded');
  const verified=await updater.verifiedDownload();
  assert.deepEqual(await fs.readFile(verified.archive),Buffer.concat(chunks));
  assert.equal(requested[0],SOURCE+'/opora/updates/latest.json');
  assert.ok(requested.slice(1).every(url=>url.startsWith(SOURCE+'/'+m.commit+'/distribution/windows/')));
  assert.ok(progress.some(p=>p.status==='downloading'));
  assert.equal(progress.at(-1).received,m.size);
});
test('A changed download is removed, cannot be installed and preserves unrelated files',async t=>{
  const {updater,directory}=await fixture(t,{corrupt:true});
  await fs.writeFile(path.join(directory,'keep.txt'),'user data');
  await updater.check();
  await assert.rejects(updater.download(),/Контрольная сумма/);
  await assert.rejects(updater.verifiedDownload(),/Сначала скачайте/);
  assert.deepEqual(await fs.readdir(directory),['keep.txt']);
  assert.equal(await fs.readFile(path.join(directory,'keep.txt'),'utf8'),'user data');
});
test('An archive changed after successful download fails the install preflight',async t=>{
  const {updater}=await fixture(t);await updater.check();await updater.download();
  const file=(await updater.verifiedDownload()).archive;
  const data=await fs.readFile(file);data[0]^=1;await fs.writeFile(file,data);
  await assert.rejects(updater.verifiedDownload(),/изменился/);
});
test('The updater never downloads an equal or older version, nor installs in development mode',async t=>{
  for(const version of ['0.2.0','0.1.0']) {
    const {updater}=await fixture(t,{manifest:manifest(version)});
    assert.equal((await updater.check()).status,'up-to-date');
    await assert.rejects(updater.download(),/Сначала проверьте/);
  }
  const {updater}=await fixture(t,{supported:false});await updater.check();
  await assert.rejects(updater.download(),/Windows-сборке/);
});
test('A blocked or unavailable GitHub endpoint produces a visible failure, without staging files',async t=>{
  const {updater,directory}=await fixture(t,{status:403});
  await assert.rejects(updater.check(),/HTTP 403/);
  assert.equal(updater.info().status,'error');
  assert.deepEqual(await fs.readdir(directory),[]);
});
