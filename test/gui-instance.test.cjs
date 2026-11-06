const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {GuiInstance}=require('../desktop/gui-instance.cjs');
test('New GUI coordination focuses its owner and releases ownership for native relaunch',{timeout:5000},async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-gui-'));let focus;
  const focused=new Promise(resolve=>{focus=resolve;}),first=new GuiInstance(root,focus),second=new GuiInstance(root,()=>{});
  t.after(async()=>{await first.release();await second.release();await fs.rm(root,{recursive:true,force:true});});
  assert.equal(await first.acquire(),true);assert.equal(await second.acquire(),false);await focused;
  await first.release();assert.equal(await second.acquire(),true);
});
