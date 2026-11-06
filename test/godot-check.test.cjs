const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {check,resolveGodot}=require('../desktop/godot-check.cjs');
test('Automatic Godot check runs without a shell, detects diagnostic errors despite exit 0, and stops on timeout',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"opora Godot & игра ' "));t.after(()=>fs.rm(root,{recursive:true,force:true}));const script=path.join(root,'engine.js'),command={file:process.execPath,args:[script]};
 await fs.writeFile(script,"require('node:fs').writeFileSync('args.json',JSON.stringify(process.argv.slice(2)));console.log('Import complete');");const good=await check(root,{command});assert.equal(good.result,'passed');assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'args.json'))),['--headless','--path',root,'--editor','--import','--quit']);
 await fs.writeFile(script,"console.error('SCRIPT ERROR: Parse Error: invalid syntax');");const bad=await check(root,{command});assert.equal(bad.result,'failed');assert.equal(bad.exit_code,0);assert.equal(bad.diagnostic_errors,true);
 await fs.writeFile(script,'setInterval(()=>{},1000);');const slow=await check(root,{command,timeoutMs:80});assert.equal(slow.result,'failed');assert.equal(slow.timed_out,true);assert.ok(slow.duration_ms<5000);
 assert.equal((await check(root)).result,'not_run');assert.equal((await check(root)).setup_required,true);await assert.rejects(resolveGodot(path.join(root,'missing')),/недоступен/);
 const controller=new AbortController();controller.abort();assert.equal((await check(root,{command,signal:controller.signal})).result,'not_run');
});
test('Installed Godot imports a real fixture and reports a real GDScript parse error',{skip:process.platform!=='linux'},async t=>{
 const command=await resolveGodot();if(!command){t.skip('Godot is not installed');return;}const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-real-godot-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.writeFile(path.join(root,'project.godot'),'config_version=5\n[application]\nconfig/name="Automation check"\n');
 await fs.writeFile(path.join(root,'sample.gd'),'class_name AutomationSample\nextends Node\n');assert.equal((await check(root,{command})).result,'passed');
 await fs.writeFile(path.join(root,'sample.gd'),'class_name AutomationSample\nextends Node\nfunc broken(:\n');const bad=await check(root,{command,scriptFiles:['sample.gd']});assert.equal(bad.result,'failed');assert.match(bad.evidence,/Parse Error|SCRIPT ERROR/);
});
