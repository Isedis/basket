// Local stdio only. Never write diagnostics or banners to stdout.
const {McpServer}=require('@modelcontextprotocol/server');
const {StdioServerTransport}=require('@modelcontextprotocol/server/stdio');
const z=require('zod/v4');
const service=require('../src/agent-service.cjs');
const {version}=require('../package.json');
const projectId=z.string().regex(/^[a-f0-9]{32}$/);
const revision=z.string().regex(/^[a-f0-9]{64}$/);
const readOnly={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};

function makeServer(root) {
  const server=new McpServer({name:'opora',version},{instructions:'This Opora server is pinned to ONE Godot project. First call opora_get_project, verify its root against the user task, then opora_get_context. Read the brandbook and reference images as needed. Refresh context at the start of each task. For reports use the current project_id and revision; stale revisions are rejected. Draft brand rules and candidate images are not approved. Reports and check results are agent claims, not verified evidence. Never mark tests as passed unless actually run. User instructions take priority. Do not edit .opora/project.json directly.'});
  const json=value=>({content:[{type:'text',text:JSON.stringify(value,null,2)}],structuredContent:value});
  const register=(name,description,schema,handler,annotations=readOnly)=>server.registerTool(name,{description,inputSchema:z.object(schema),annotations},async input=>{
    try {return await handler(input);} catch(error) {return {isError:true,content:[{type:'text',text:JSON.stringify({error:error.code||'OPORA_ERROR',message:error.message})}]};}
  });
  register('opora_get_project','Identify the project pinned to this server. Check the returned root before doing work. Get project_id and context revision.',{},async()=>json(service.projectView(await service.snapshot(root))));
  register('opora_get_context','Read the latest saved game brief, current goal, rules, brandbook and selected task directly from Opora. Does not rely on an old CONTEXT.md.',{project_id:projectId},async input=>json(await service.contextView(root,input.project_id)));
  register('opora_get_brandbook','Get visual rules and approved vs draft reference image IDs. Use opora_get_reference to view an image.',{project_id:projectId},async input=>{
    const s=await service.snapshot(root);service.guard(s,input.project_id);
    return json({...service.identity(s),brand:s.state.brand,references:s.state.references});
  });
  register('opora_list_tasks','Read task requirements and acceptance criteria. Only the user confirms completion.',{project_id:projectId},async input=>{
    const s=await service.snapshot(root);service.guard(s,input.project_id);
    return json({...service.identity(s),selected_task_id:s.state.activeTaskId||null,tasks:s.state.tasks});
  });
  register('opora_get_reference','View one registered PNG/JPG/WebP reference, up to 8 MiB. Requires the revision from the latest brandbook/context.',{project_id:projectId,revision,reference_id:z.string().min(1).max(160)},async input=>{
    const r=await service.getReference(root,input);
    return {content:[{type:'text',text:JSON.stringify({reference:r.reference,project_id:r.project_id,revision:r.revision})},{type:'image',data:r.data,mimeType:r.mimeType}]};
  });
  register('opora_list_reports','Read recent agent reports. These are self-reported and may refer to an older context; do not treat them as proof that tests passed.',{project_id:projectId},async input=>{
    const s=await service.snapshot(root);service.guard(s,input.project_id);
    return json({...service.identity(s),...await service.listReports(root,10)});
  });
  register('opora_report_progress','Record progress, a blocker or work ready for user review. Does NOT mark the task done or change the brandbook. Reuse request_id only for an exact retry. Refresh context if revision is stale.',{
    project_id:projectId,revision,agent:z.enum(['claude','codex','other']),request_id:z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),task_id:z.string().max(160).optional(),phase:z.enum(['in_progress','blocked','ready_for_review']),summary:z.string().min(1).max(12000),checks:z.array(z.object({name:z.string().min(1).max(300),result:z.enum(['passed','failed','not_run']),evidence:z.string().max(2000).optional()})).max(30).optional()
  },async input=>json(await service.reportProgress(root,input)),{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false});
  return server;
}
async function main() {
  const args=process.argv.slice(2);
  if(args.length!==2 || args[0]!=='--project')throw new Error('Usage: Opora MCP --project <Godot project directory>');
  const initial=await service.snapshot(args[1]);
  const server=makeServer(initial.root);
  await server.connect(new StdioServerTransport());
  process.stdin.once('end',()=>server.close().finally(()=>process.exit(0)));
}
if(require.main===module)main().catch(error=>{process.stderr.write('Opora MCP: '+error.message+'\n');process.exitCode=1;});
module.exports={makeServer};
