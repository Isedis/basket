const {Client}=require('@modelcontextprotocol/client');
const {StdioClientTransport}=require('@modelcontextprotocol/client/stdio');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {saveProject}=require('../src/core.cjs');
const {listReports}=require('../src/agent-service.cjs');

async function main() {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora MCP & игра-'));
  let client;
  const entry=process.env.OPORA_MCP_ENTRY || path.join(__dirname,'../mcp/server.cjs');
  const command=process.env.OPORA_MCP_EXECUTABLE || process.execPath;
  try {
    await fs.writeFile(path.join(root,'project.godot'),'config_version=5\n[application]\nconfig/name="MCP fixture"\n');
    const state={version:1,name:'MCP fixture',genre:'idle',pitch:'Station',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'Keep buttons',brand:{status:'draft',direction:'Matte',palette:'#123456',fonts:'Game.ttf',avoid:'Neon'},tasks:[{id:'menu',title:'Menu',acceptance:'Keyboard navigation',status:'active'}],activeTaskId:'menu',references:[]};
    await saveProject(root,state);
    client=new Client({name:'opora-protocol-test',version:'1.0.0'},{capabilities:{}});
    const transport=new StdioClientTransport({command,args:[entry,'--project',root],env:process.env.OPORA_MCP_EXECUTABLE?{ELECTRON_RUN_AS_NODE:'1'}:{},stderr:'pipe'});
    let diagnostics='';
    transport.stderr?.on('data',data=>{diagnostics+=data.toString();});
    await client.connect(transport);
    const tools=await client.listTools();assert.equal(tools.tools.length,11);
    const project=(await client.callTool({name:'opora_get_project',arguments:{}})).structuredContent;
    assert.equal(project.name,'MCP fixture');
    await fs.writeFile(path.join(root,'menu.tscn'),'[gd_scene format=3]\n[ext_resource type="Script" path="res://menu.gd" id="1"]\n');
    await fs.writeFile(path.join(root,'menu.gd'),'extends Control\nfunc open_menu():\n  pass\n');
    const map=(await client.callTool({name:'opora_get_project_map',arguments:{project_id:project.project_id,kind:'scene'}})).structuredContent;
    assert.equal(map.files[0].file,'menu.tscn');assert.equal(map.total,1);
    const focused=(await client.callTool({name:'opora_get_project_map',arguments:{project_id:project.project_id,file:'menu.gd'}})).structuredContent;
    assert.equal(focused.incoming[0].from,'menu.tscn');assert.equal(focused.selected.functions[0].name,'open_menu');
    const wrongMap=await client.callTool({name:'opora_get_project_map',arguments:{project_id:'0'.repeat(32)}});assert.equal(wrongMap.isError,true);
    const unsafeMap=await client.callTool({name:'opora_get_project_map',arguments:{project_id:project.project_id,file:'../private'}});assert.equal(unsafeMap.isError,true);
    const context=(await client.callTool({name:'opora_get_context',arguments:{project_id:project.project_id}})).structuredContent;
    assert.match(context.markdown,/Keyboard navigation/);
    const cached=await client.callTool({name:'opora_get_context',arguments:{project_id:project.project_id,known_revision:context.revision}});
    assert.equal(cached.structuredContent.mode,'unchanged');assert.equal(cached.structuredContent.markdown,undefined);

    const assessment=await client.callTool({name:'opora_review_brandbook',arguments:{project_id:project.project_id}});
    assert.ok(!assessment.isError);assert.ok(assessment.structuredContent.review.findings.some(f=>f.id==='contrast-unspecified'));
    const updated=await client.callTool({name:'opora_update_brandbook',arguments:{project_id:project.project_id,revision:project.revision,agent:'codex',request_id:'smoke-brand-001',summary:'Fill written rules',fields:{direction:'Matte space station',palette:'Текст: #FFFFFF на #000000',fonts:'Game.ttf, body 18 px',avoid:'No neon'}}});
    assert.ok(!updated.isError,JSON.stringify(updated));assert.equal(updated.structuredContent.brand.status,'draft');
    state.brand=updated.structuredContent.brand;
    const wrong=await client.callTool({name:'opora_get_context',arguments:{project_id:'0'.repeat(32)}});assert.equal(wrong.isError,true);
    state.rules='Changed while agent was working';await saveProject(root,state);
    const args={project_id:project.project_id,revision:project.revision,agent:'codex',request_id:'mcp-report-0001',task_id:'menu',phase:'ready_for_review',summary:'Prepared for review',checks:[{name:'Godot functional test',result:'not_run'}]};
    const stale=await client.callTool({name:'opora_report_progress',arguments:args});assert.equal(stale.isError,true);assert.match(stale.content[0].text,/STALE_CONTEXT/);
    const refreshed=(await client.callTool({name:'opora_get_context',arguments:{project_id:project.project_id}})).structuredContent;
    const report=await client.callTool({name:'opora_report_progress',arguments:{...args,revision:refreshed.revision}});assert.ok(!report.isError);
    assert.equal((await listReports(root)).reports.length,1);
    assert.equal((await listReports(root)).reports[0].phase,'ready_for_review');
    const allBefore=(await client.callTool({name:'opora_get_project',arguments:{}})).structuredContent;
    const all=await client.callTool({name:'opora_update_project',arguments:{project_id:allBefore.project_id,revision:allBefore.revision,agent:'codex',request_id:'all-data-smoke-01',summary:'Project data via MCP',fields:{pitch:'Updated project pitch',rules:'Keep all existing decisions',tasks:[{id:'new-task',title:'Create prototype',acceptance:'Playable loop'}],active_task_id:'new-task'}}});
    assert.ok(!all.isError,JSON.stringify(all));assert.equal(all.structuredContent.state.activeTaskId,'new-task');assert.equal(all.structuredContent.state.tasks.length,2);
    const second=new Client({name:'parallel-agent',version:'1.0.0'},{capabilities:{}});
    try {
      await second.connect(new StdioClientTransport({command,args:[entry,'--project',root],env:process.env.OPORA_MCP_EXECUTABLE?{ELECTRON_RUN_AS_NODE:'1'}:{},stderr:'pipe'}));
      const latest=(await client.callTool({name:'opora_get_project',arguments:{}})).structuredContent;
      const input={project_id:latest.project_id,revision:latest.revision,agent:'codex',request_id:'parallel-sdk-001',summary:'Parallel write',fields:{avoid:'First proposal'}};
      const results=await Promise.all([client.callTool({name:'opora_update_brandbook',arguments:input}),second.callTool({name:'opora_update_brandbook',arguments:{...input,request_id:'parallel-sdk-002',fields:{avoid:'Second proposal'}}})]);
      assert.equal(results.filter(r=>r.isError).length,1);assert.match(results.find(r=>r.isError).content[0].text,/STALE_CONTEXT/);
    }finally{await second.close();}
    await client.close();client=null;
    assert.equal(diagnostics,'');
    console.log('PASS MCP stdio: SDK initialization, 11 tools, brand review, live context, wrong-project rejection, stale revision rejection, report persistence. Runtime: '+path.basename(command));
  } finally {if(client)await client.close();await fs.rm(root,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
