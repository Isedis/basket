const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const toml=require('smol-toml');
const core=require('../src/core.cjs');
const service=require('../src/agent-service.cjs');
const configs=require('../src/agent-config.cjs');

async function fixture(t) {
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'opora-agent-'));
  t.after(()=>fs.rm(base,{recursive:true,force:true}));
  const root=path.join(base,'game');await fs.mkdir(root);
  await fs.writeFile(path.join(root,'project.godot'),'config_version=5\n[application]\nconfig/name="Agent game"\n');
  const state={version:1,name:'Agent game',genre:'idle',pitch:'A calm station',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'Keep typography',brand:{status:'draft',direction:'Matte',palette:'#123456',fonts:'Game.ttf',avoid:'Neon'},references:[],tasks:[{id:'menu',title:'Menu',acceptance:'Keyboard navigation',status:'active'}],activeTaskId:'menu'};
  await core.saveProject(root,state);
  const config=await configs.connection(root,{executable:'C:\\Apps & Games\\Opora.exe',entry:'C:\\Apps & Games\\resources\\app.asar\\mcp\\server.cjs',codexHome:path.join(base,'codex')});
  return {base,root,state,config};
}
test('MCP snapshot binds to a physical project and changes revision when the user edits context',async t=>{
  const {root,state,base}=await fixture(t);
  const first=await service.snapshot(root);
  const context=await service.contextView(root,first.project_id);
  assert.match(context.markdown,/Keyboard navigation/);
  state.rules='New typography rule';await core.saveProject(root,state);
  const second=await service.snapshot(root);assert.equal(second.project_id,first.project_id);assert.notEqual(second.revision,first.revision);
  assert.match((await service.contextView(root,first.project_id)).markdown,/New typography rule/);
  const other=path.join(base,'other');await fs.cp(root,other,{recursive:true});
  const copied=await service.snapshot(other);assert.notEqual(copied.project_id,first.project_id);
  await assert.rejects(service.contextView(root,copied.project_id),/другой проект/);
});
test('Agent reports are separate, idempotent, scoped and cannot approve tasks or brand rules',async t=>{
  const {root,state}=await fixture(t);const s=await service.snapshot(root);
  const input={project_id:s.project_id,revision:s.revision,agent:'claude',request_id:'menu-report-1',task_id:'menu',phase:'ready_for_review',summary:'Menu prepared',checks:[{name:'Godot smoke',result:'not_run'}]};
  const first=await service.reportProgress(root,input);assert.equal(first.duplicate,false);
  const retry=await service.reportProgress(root,input);assert.equal(retry.duplicate,true);
  assert.deepEqual((await core.loadProject(root)).state,state);
  await assert.rejects(service.reportProgress(root,{...input,summary:'Different'}),/уже использован/);
  await assert.rejects(service.reportProgress(root,{...input,request_id:'different-id',project_id:'0'.repeat(32)}),/другой проект/);
  state.goal='New goal';await core.saveProject(root,state);
  await assert.rejects(service.reportProgress(root,{...input,request_id:'different-id'}),/Контекст изменился/);
  const activity=await service.listReports(root);
  assert.equal(activity.reports.length,1);assert.equal(activity.reports[0].stale,true);
  assert.equal(activity.reports[0].checks[0].result,'not_run');
});
test('MCP image reads are limited to registered references of the current revision',async t=>{
  const {root,state}=await fixture(t);
  await fs.mkdir(path.join(root,'.opora/references'));
  await fs.writeFile(path.join(root,'.opora/references/menu.png'),Buffer.from('reference bytes'));
  state.references=[{id:'menu-image',name:'Menu',file:'.opora/references/menu.png',status:'approved'}];await core.saveProject(root,state);
  const s=await service.snapshot(root);
  const image=await service.getReference(root,{project_id:s.project_id,revision:s.revision,reference_id:'menu-image'});
  assert.equal(image.mimeType,'image/png');assert.equal(Buffer.from(image.data,'base64').toString(),'reference bytes');
  await assert.rejects(service.getReference(root,{project_id:s.project_id,revision:s.revision,reference_id:'../../outside'}),/не найден/);
});
test('Reports near tool field limits remain readable and idempotent with multibyte text',async t=>{
  const {root}=await fixture(t);const s=await service.snapshot(root);
  const input={project_id:s.project_id,revision:s.revision,agent:'codex',request_id:'long-report-0001',phase:'ready_for_review',summary:'И'.repeat(12000),checks:Array.from({length:30},()=>({name:'Проверка',result:'not_run',evidence:'Я'.repeat(2000)}))};
  await service.reportProgress(root,input);
  assert.equal((await service.reportProgress(root,input)).duplicate,true);
  const result=await service.listReports(root);
  assert.equal(result.unreadable,0);assert.equal(result.reports[0].summary.length,12000);
});
test('Claude project configuration preserves other servers and backs up exact original content',async t=>{
  const {config}=await fixture(t);
  const original='{"mcpServers":{"existing":{"command":"example","env":{"TOKEN":"test-placeholder"}}},"other":true}\n';
  await fs.writeFile(config.claudeFile,original);
  const result=await configs.configure('claude',config);
  assert.equal(await fs.readFile(result.backup,'utf8'),original);
  const updated=JSON.parse(await fs.readFile(config.claudeFile,'utf8'));
  assert.equal(updated.other,true);assert.equal(updated.mcpServers.existing.env.TOKEN,'test-placeholder');
  assert.equal(updated.mcpServers[config.server_name].env.ELECTRON_RUN_AS_NODE,'1');
  assert.deepEqual(updated.mcpServers[config.server_name].args,config.spec.args);
  assert.equal((await configs.configure('claude',config)).changed,false);
  assert.equal((await configs.status(config)).claude.configured,true);
});
test('Codex configuration preserves comments, unrelated values, and updates only its managed block',async t=>{
  const {config}=await fixture(t);
  await fs.mkdir(path.dirname(config.codexFile));
  const original='# My choices\nmodel = "chosen-model"\n[mcp_servers.existing]\ncommand = "example"\n';
  await fs.writeFile(config.codexFile,original);
  const result=await configs.configure('codex',config);
  const updated=await fs.readFile(config.codexFile,'utf8');
  assert.ok(updated.startsWith(original));assert.equal(await fs.readFile(result.backup,'utf8'),original);
  const parsed=toml.parse(updated);assert.equal(parsed.model,'chosen-model');
  assert.deepEqual(parsed.mcp_servers[config.server_name].args,config.spec.args);
  assert.equal((await configs.configure('codex',config)).changed,false);
  config.spec.command='C:\\New Location\\Opora.exe';
  await configs.configure('codex',config);
  const rewritten=await fs.readFile(config.codexFile,'utf8');
  assert.ok(rewritten.startsWith(original));assert.equal((rewritten.match(/OPORA MCP START/g)||[]).length,1);
  assert.equal((await configs.status(config)).codex.configured,true);
});
test('Invalid or conflicting client configurations are preserved without exposing their content',async t=>{
  const {config}=await fixture(t);
  await fs.writeFile(config.claudeFile,'{"TOKEN":"test-private-marker", BROKEN');
  await assert.rejects(configs.configure('claude',config),error=>!error.message.includes('test-private-marker'));
  assert.equal(await fs.readFile(config.claudeFile,'utf8'),'{"TOKEN":"test-private-marker", BROKEN');
  await fs.mkdir(path.dirname(config.codexFile));
  const original='[mcp_servers.'+config.server_name+']\ncommand="another-server"\n';
  await fs.writeFile(config.codexFile,original);
  await assert.rejects(configs.configure('codex',config),/настроен вручную/);
  assert.equal(await fs.readFile(config.codexFile,'utf8'),original);
});

test('MCP brand writes only requested fields as a draft, backs up exact prior state and returns fresh revisions',async t=>{
  const {root,state}=await fixture(t);state.brand.status='approved';await core.saveProject(root,state);
  const s=await service.snapshot(root);
  const args={project_id:s.project_id,revision:s.revision,agent:'codex',request_id:'brand-write-01',summary:'Palette and typography proposal',fields:{palette:'Текст: #FFFFFF на #000000',fonts:'Game.ttf; текст 18 px'}};
  const result=await service.updateBrandbook(root,args);
  assert.equal(result.brand.status,'draft');assert.equal(result.approval_required,true);assert.notEqual(result.revision,s.revision);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,result.backup),'utf8')),s.state);
  const saved=(await core.loadProject(root)).state;
  assert.deepEqual(saved.tasks,state.tasks);assert.deepEqual(saved.references,state.references);assert.equal(saved.rules,state.rules);assert.equal(saved.brand.direction,state.brand.direction);
  assert.equal((await service.updateBrandbook(root,args)).duplicate,true);
  await assert.rejects(service.updateBrandbook(root,{...args,fields:{palette:'different'}}),/уже использован/);
  saved.brand.status='approved';await core.saveProject(root,saved);
  await service.updateBrandbook(root,args);assert.equal((await core.loadProject(root)).state.brand.status,'approved','A retry must not undo manual approval');
});
test('MCP rejects stale, wrong-project and unsupported-field edits without changing files',async t=>{
  const {root,state}=await fixture(t);const s=await service.snapshot(root);
  const args={project_id:s.project_id,revision:s.revision,agent:'claude',request_id:'brand-write-02',summary:'Proposal',fields:{direction:'New direction'}};
  for(const change of [{project_id:'0'.repeat(32)},{fields:{status:'approved'}},{fields:{}},{fields:{fonts:'x'.repeat(64001)}},{revision:undefined}])await assert.rejects(service.updateBrandbook(root,{...args,...change}));
  assert.deepEqual((await core.loadProject(root)).state,state);
  state.rules='Manual update';await core.saveProject(root,state);
  await assert.rejects(service.updateBrandbook(root,args),/Контекст изменился/);
  assert.deepEqual((await core.loadProject(root)).state,state);
});
test('Two simultaneous agent edits of one revision yield one commit and one stale rejection',async t=>{
  const {root}=await fixture(t);const s=await service.snapshot(root);
  const args={project_id:s.project_id,revision:s.revision,agent:'codex',request_id:'parallel-brand-1',summary:'Proposal',fields:{direction:'First'}};
  const results=await Promise.allSettled([service.updateBrandbook(root,args),service.updateBrandbook(root,{...args,request_id:'parallel-brand-2',fields:{direction:'Second'}})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'STALE_CONTEXT');
});
test('GUI saves merge unrelated manual edits with agent fields, but refuse competing field edits and stale exports',async t=>{
  const {root,state}=await fixture(t);const base=structuredClone(state.brand);const s=await service.snapshot(root);
  await service.updateBrandbook(root,{project_id:s.project_id,revision:s.revision,agent:'codex',request_id:'merge-brand-001',summary:'Proposal',fields:{palette:'#FFFFFF — текст'}});
  state.goal='Manual goal';
  const merged=await core.saveProject(root,state,{baseBrand:base});
  assert.equal(merged.goal,'Manual goal');assert.equal(merged.brand.palette,'#FFFFFF — текст');
  state.brand.palette='My competing palette';
  await assert.rejects(core.saveProject(root,state,{baseBrand:base}),/BRAND_CONFLICT/);
  await assert.rejects(core.syncProject(root,state,{baseBrand:base}),/предпросмотр/);
  assert.deepEqual((await core.loadProject(root)).state,merged);
});

test('Approving unseen remote brand changes is refused until the user reviews them',async t=>{
  const {root,state}=await fixture(t);const base=structuredClone(state.brand);const s=await service.snapshot(root);
  await service.updateBrandbook(root,{project_id:s.project_id,revision:s.revision,agent:'codex',request_id:'approve-race-01',summary:'Proposal',fields:{fonts:'NewFont.ttf'}});
  state.brand.status='approved';
  await assert.rejects(core.saveProject(root,state,{baseBrand:base}),/BRAND_CONFLICT/);
  assert.equal((await core.loadProject(root)).state.brand.status,'draft');
});

test('Project MCP fills passport, rules, brand, task upserts and candidate images without deleting existing data',async t=>{
 const {root,state}=await fixture(t);await fs.writeFile(path.join(root,'menu.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6X7sAAAAASUVORK5CYII=','base64'));
 const s=await service.snapshot(root);const input={project_id:s.project_id,revision:s.revision,agent:'codex',request_id:'all-fields-001',summary:'Initial project draft',fields:{name:'New name',genre:'Roguelike',pitch:'Explore',experience:'Wonder',goal:'Prototype',pillars:'Progress',rules:'Keep existing UI',brand:{fonts:'Game.ttf 18 px'},tasks:[{id:'menu',title:'Revised menu',acceptance:'Keyboard input'},{id:'new',title:'New task',acceptance:'Runs'}],active_task_id:'new',reference_files:['menu.png']}};
 const result=await service.updateWorkspace(root,input);assert.equal(result.state.tasks.length,2);assert.equal(result.state.brand.status,'draft');assert.equal(result.state.references[0].status,'draft');assert.equal(result.state.activeTaskId,'new');assert.equal(result.state.tasks[1].status,'active');assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,result.backup),'utf8')),state);assert.equal((await service.updateWorkspace(root,input)).duplicate,true);
 const fresh=await service.snapshot(root);await assert.rejects(service.updateWorkspace(root,{...input,request_id:'unsafe-001',revision:fresh.revision,fields:{reference_files:['../outside.png']}}));await assert.rejects(service.updateWorkspace(root,{...input,request_id:'unsafe-002',revision:fresh.revision,fields:{tasks:[{id:'new',title:'Wrong',acceptance:'Wrong',status:'done'}]}}));assert.deepEqual((await core.loadProject(root)).state,result.state);
});
test('GUI preserves unrelated remote project data and task additions, but detects competing passport edits',async t=>{
 const {root,state}=await fixture(t);const base=structuredClone(state);const s=await service.snapshot(root);
 await service.updateWorkspace(root,{project_id:s.project_id,revision:s.revision,agent:'claude',request_id:'project-merge-01',summary:'Proposal',fields:{goal:'Remote goal',tasks:[{id:'remote-task',title:'Remote task',acceptance:'Runs'}]}});
 state.rules='Local rules';const merged=await core.saveProject(root,state,{baseState:base});assert.equal(merged.goal,'Remote goal');assert.equal(merged.rules,'Local rules');assert.equal(merged.tasks.length,2);
 state.goal='Competing goal';await assert.rejects(core.saveProject(root,state,{baseState:base}),/BRAND_CONFLICT/);
});

test('Context deltas reduce repeat reads, preserve changes and fall back after cache loss',async t=>{
 const {root,state}=await fixture(t);state.rules='Long stable rules. '.repeat(500);await core.saveProject(root,state);
 const read=service.contextReader(root);const id=(await service.snapshot(root)).project_id;
 const full=await read(id);assert.equal(full.mode,'full');
 const unchanged=await read(id,full.revision);assert.equal(unchanged.mode,'unchanged');assert.ok(JSON.stringify(unchanged).length<JSON.stringify(full).length/10);
 state.goal='New goal';state.tasks.push({id:'new',title:'New task',acceptance:'Runs',status:'backlog'});await core.saveProject(root,state);
 const delta=await read(id,full.revision);assert.equal(delta.mode,'delta');assert.equal(delta.changes.goal,'New goal');assert.equal(delta.changes.tasks.length,2);assert.equal(delta.changes.rules,undefined);
 state.activeTaskId='new';await core.saveProject(root,state);
 const selection=await read(id,delta.revision);assert.equal(selection.changes.activeTaskId,'new');assert.equal(selection.changes.tasks.find(t=>t.id==='new').acceptance,'Runs');
 assert.equal((await service.contextReader(root)(id,delta.revision)).mode,'full');
 await assert.rejects(read('0'.repeat(32),delta.revision),/другой проект/);
 assert.equal((await read(id)).mode,'full');
});

test('An owned previous-version connection remains configured without rewriting or interrupting it',async t=>{
  const f=await fixture(t);await configs.configure('claude',f.config);
  const before=await fs.readFile(f.config.claudeFile,'utf8');
  const next=await configs.connection(f.root,{executable:f.config.spec.command,entry:'C:\\New\\.opora-runtime\\mcp\\server.cjs',codexHome:path.join(f.base,'codex')});
  const info=await configs.status(next);assert.equal(info.claude.configured,true);assert.equal(info.claude.previousVersion,true);assert.equal(await fs.readFile(f.config.claudeFile,'utf8'),before);
});
