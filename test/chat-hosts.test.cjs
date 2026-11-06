const {test}=require('node:test'),assert=require('node:assert/strict'),{restore,forOperation}=require('../desktop/chat-hosts.cjs');
function host(state){return {state,disposed:false,detached:false,connect:async()=>true,async rpc(){return this.state;},dispose(){this.disposed=true;},async detach(){this.detached=true;}};}
test('Upgrade keeps a live legacy chat and moves the next idle request to the modern host',async()=>{
 const modern=host(null),legacy=host({status:'permission',id:'old-chat'}),restored=await restore(modern,legacy);assert.equal(restored.host,legacy);assert.equal(restored.state.id,'old-chat');assert.equal(legacy.disposed,false);
 assert.equal(await forOperation(legacy,modern,'chat:answer'),legacy);assert.equal(await forOperation(legacy,modern,'chat:send'),legacy);assert.equal(legacy.detached,false);
 legacy.state.status='idle';assert.equal(await forOperation(legacy,modern,'chat:send'),modern);assert.equal(legacy.detached,true);
});
test('Idle legacy state does not keep an outdated implementation alive',async()=>{const modern=host(null),legacy=host({status:'idle'});assert.equal((await restore(modern,legacy)).host,modern);assert.equal(legacy.disposed,true);});
