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
