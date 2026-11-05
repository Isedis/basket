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
    const tools=await client.listTools();assert.equal(tools.tools.length,7);
    const project=(await client.callTool({name:'opora_get_project',arguments:{}})).structuredContent;
    assert.equal(project.name,'MCP fixture');
    const context=(await client.callTool({name:'opora_get_context',arguments:{project_id:project.project_id}})).structuredContent;
    assert.match(context.markdown,/Keyboard navigation/);
    const wrong=await client.callTool({name:'opora_get_context',arguments:{project_id:'0'.repeat(32)}});assert.equal(wrong.isError,true);
    state.rules='Changed while agent was working';await saveProject(root,state);
    const args={project_id:project.project_id,revision:project.revision,agent:'codex',request_id:'mcp-report-0001',task_id:'menu',phase:'ready_for_review',summary:'Prepared for review',checks:[{name:'Godot functional test',result:'not_run'}]};
    const stale=await client.callTool({name:'opora_report_progress',arguments:args});assert.equal(stale.isError,true);assert.match(stale.content[0].text,/STALE_CONTEXT/);
    const refreshed=(await client.callTool({name:'opora_get_context',arguments:{project_id:project.project_id}})).structuredContent;
    const report=await client.callTool({name:'opora_report_progress',arguments:{...args,revision:refreshed.revision}});assert.ok(!report.isError);
    assert.equal((await listReports(root)).reports.length,1);
    assert.equal((await listReports(root)).reports[0].phase,'ready_for_review');
    await client.close();client=null;
    assert.equal(diagnostics,'');
    console.log('PASS MCP stdio: SDK initialization, 7 tools, live context, wrong-project rejection, stale revision rejection, report persistence. Runtime: '+path.basename(command));
  } finally {if(client)await client.close();await fs.rm(root,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
