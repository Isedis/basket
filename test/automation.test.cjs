const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const delivery=require('../src/context-delivery.cjs'),run=require('../src/work-run.cjs'),core=require('../src/core.cjs'),service=require('../src/agent-service.cjs'),{ClaudeChat}=require('../desktop/claude-chat.cjs');
const packet=(root='/game')=>({root,project_id:'a'.repeat(32),revision:'b'.repeat(64),work_revision:'c'.repeat(64),versions:{code:'1'},passport:{rules:{text:'Keep spacing. '.repeat(400),truncated:false}},brand:{status:'draft',direction:{text:'Matte'}},task:{id:'menu',title:'Menu'},feedback:{notes:[]},references:[],references_total:0,warnings:[]});
const wait=async p=>{const deadline=Date.now()+10000;while(!p()){if(Date.now()>deadline)throw new Error('Automation timeout');await new Promise(r=>setTimeout(r,15));}};
test('Context automation keeps unchanged sections out of subsequent turns, replaces changed sections, and resets across task/root changes',()=>{
 const p=packet(),full=delivery.prepare(p),same=delivery.prepare({...p,versions:{code:'2'},work_revision:'d'.repeat(64)},full.cache);
 assert.equal(full.mode,'full');assert.equal(same.mode,'unchanged');assert.ok(same.sent_bytes<full.sent_bytes/2);assert.ok(!same.text.includes('Keep spacing'));assert.ok(!JSON.stringify(full.cache).includes('Keep spacing'));
 const changed=delivery.prepare({...p,brand:{status:'approved',direction:{text:'New'}}},full.cache);assert.equal(changed.mode,'delta');const body=JSON.parse(changed.text.split('\n').at(-1));assert.deepEqual(Object.keys(body.replace),['brand']);assert.equal(body.replace.brand.status,'approved');
 assert.equal(delivery.prepare({...p,task:null},full.cache).mode,'full');assert.equal(delivery.prepare({...p,root:'/other'},full.cache).mode,'full');
 const missing=delivery.prepare({...p,feedback:null},full.cache);assert.equal(JSON.parse(missing.text.split('\n').at(-1)).replace.feedback,null);
});
test('Application automatically records observed file changes and links the original task without approving work or inventing checks',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-auto-run-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.writeFile(path.join(root,'project.godot'),'config_version=5\n');
 await core.saveProject(root,{version:1,name:'Automation',genre:'idle',pitch:'Station',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'Keep spacing',brand:{status:'draft',direction:'Matte',palette:'#000000',fonts:'Game.ttf',avoid:'Neon'},tasks:[{id:'menu',title:'Menu',acceptance:'Readable',status:'active'}],activeTaskId:'menu',references:[]});
 await fs.writeFile(path.join(root,'menu.gd'),'extends Control\n# before');await fs.writeFile(path.join(root,'old.gd'),'extends Node');const before=await run.begin(root);
 await fs.writeFile(path.join(root,'menu.gd'),'extends Control\n# after');await fs.rm(path.join(root,'old.gd'));await fs.writeFile(path.join(root,'added.gd'),'extends Node');
 const result=await run.finish(before,{status:'idle',summary:'Agent summary',sessionId:'session'});assert.equal(result.phase,'ready_for_review');assert.equal(result.task_id,'menu');assert.equal(result.changes_total,3);assert.deepEqual(result.changes.map(c=>c.kind).sort(),['added','changed','removed']);
 const reports=await service.listReports(root);assert.equal(reports.reports[0].origin,'opora-observed');assert.equal(reports.reports[0].summary_source,'agent_response');assert.equal(reports.reports[0].checks[0].result,'not_run');assert.equal(reports.reports[0].stale_code,false);
 const state=(await core.loadProject(root)).state;assert.equal(state.tasks[0].status,'active');assert.equal(state.brand.status,'draft');
 const interrupted=await run.begin(root);assert.equal((await run.finish(interrupted,{status:'interrupted',summary:'Stopped'})).phase,'blocked');
});
test('Chat uses compact context only in a retained session; compaction and restored history force a full packet',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-auto-chat-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const p=packet(root),prompts=[],session=crypto.randomUUID();let count=0;
 const sdk={query(input){prompts.push(input.prompt);const turn=++count;return(async function*(){yield{type:'system',session_id:session};if(turn===2)await input.options.hooks.PreCompact[0].hooks[0]();yield{type:'assistant',message:{id:'reply-'+turn,content:[{type:'text',text:'Done'}]}};yield{type:'result',is_error:false};})();}};
 const chat=new ClaudeChat({directory:path.join(root,'chats'),loadSdk:async()=>sdk,observer:{begin:async()=>null}}),args={root,text:'Continue',command:{file:'unused',args:[]},serverName:'opora',context:{packet:p,summary:{}}};
 await chat.send(args);await wait(()=>!chat.active);await chat.send(args);await wait(()=>!chat.active);await chat.send(args);await wait(()=>!chat.active);
 assert.ok(prompts[0].includes('Keep spacing'));assert.ok(!prompts[1].includes('Keep spacing'));assert.ok(prompts[2].includes('Keep spacing'));
 const restored=new ClaudeChat({directory:path.join(root,'chats'),loadSdk:async()=>sdk,observer:{begin:async()=>null}});await restored.open(root,chat.current.id);assert.equal(restored.current.contextCache,undefined);await restored.send({...args,id:chat.current.id});await wait(()=>!restored.active);assert.ok(prompts[3].includes('Keep spacing'));
 await assert.rejects(restored.send({...args,context:{packet:packet('/wrong')}}),/другой игре/);
});
test('Observed engine errors reach the next request for the same task and never leak into another task',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-check-feedback-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const prompts=[],p=packet(root),session=crypto.randomUUID();
 const sdk={query(input){prompts.push(input.prompt);return(async function*(){yield{type:'system',session_id:session};yield{type:'result',is_error:false,result:'Completed'};})();}};
 const observer={begin:async()=>({}),finish:async()=>({task_id:'menu',phase:'blocked',changes:[],changes_total:1,checks:[{name:'Godot',result:'failed',evidence:'AUTOCHECKERROR'}]})};
 const chat=new ClaudeChat({directory:root,loadSdk:async()=>sdk,observer}),args={root,text:'Fix',command:{file:'unused',args:[]},context:{packet:p}};
 await chat.send(args);await wait(()=>!chat.active);assert.equal(chat.current.activity,'Проверка нашла ошибки');await chat.send(args);await wait(()=>!chat.active);assert.match(prompts[1],/AUTOCHECKERROR/);
 await chat.send({...args,context:{packet:{...p,task:{id:'other'}}}});await wait(()=>!chat.active);assert.ok(!prompts[2].includes('AUTOCHECKERROR'));
});
test('Project context accepts aliases of the same directory and still rejects another physical project',async t=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'opora-root-alias-'));t.after(()=>fs.rm(parent,{recursive:true,force:true}));const root=path.join(parent,'physical'),alias=path.join(parent,'alias'),other=path.join(parent,'other');await fs.mkdir(root);await fs.mkdir(other);await fs.symlink(root,alias,process.platform==='win32'?'junction':'dir');let calls=0;
 const sdk={query(){calls++;return(async function*(){yield{type:'result',is_error:false,result:'Done'};})();}},chat=new ClaudeChat({directory:path.join(parent,'chats'),loadSdk:async()=>sdk,observer:{begin:async()=>null}}),args={root:alias,text:'Work',command:{file:'unused',args:[]},context:{packet:packet(await fs.realpath(root))}};
 await chat.send(args);await wait(()=>!chat.active);assert.equal(calls,1);await assert.rejects(chat.send({...args,context:{packet:packet(other)}}),/другой игре/);assert.equal(calls,1);
});
