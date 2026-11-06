// Local stdio only. Never write diagnostics or banners to stdout.
const {McpServer}=require('@modelcontextprotocol/server');
const {StdioServerTransport}=require('@modelcontextprotocol/server/stdio');
const z=require('zod/v4');
const service=require('../src/agent-service.cjs');
const {reviewProject}=require('../src/brand-review.cjs');
const {version}=require('../package.json');
const {getProjectMap}=require('../src/project-map.cjs');
const feedback=require('../src/visual-feedback.cjs');
const projectId=z.string().regex(/^[a-f0-9]{32}$/);
const revision=z.string().regex(/^[a-f0-9]{64}$/);
const readOnly={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};

function makeServer(root) {
  const readContext=service.contextReader(root);
  const server=new McpServer({name:'opora',version},{instructions:'This Opora server is pinned to ONE Godot project. First call opora_get_project, verify its root against the user task, then opora_get_context. Use opora_get_project_map to find relevant scenes, scripts and resource dependencies before a broad file search. Inspect incoming links before changing a shared resource. Read the brandbook and reference images as needed. For UI tasks read opora_list_feedback, including accepted keep preferences and previous user decisions. Use opora_get_feedback_image for the actual screenshots. Submit results for user review; never accept visual feedback yourself. Refresh context at the start of each task. To save tokens pass known_revision ONLY if you retain the previous context; apply delta field replacements or accept unchanged. After compaction or losing context, omit known_revision to get full data. Never infer that unread fields are empty. For reports use the current project_id and revision; stale revisions are rejected. Draft brand rules and candidate images are not approved. Reports and check results are agent claims, not verified evidence. Never mark tests as passed unless actually run. User instructions take priority. For user-requested project data edits use opora_update_project. For a user-requested brandbook edit use opora_update_brandbook with the current revision. It saves a draft. Do not edit .opora/project.json directly.'});
  const json=value=>({content:[{type:'text',text:JSON.stringify(value,null,2)}],structuredContent:value});
  const register=(name,description,schema,handler,annotations=readOnly)=>server.registerTool(name,{description,inputSchema:z.object(schema),annotations},async input=>{
    try {return await handler(input);} catch(error) {return {isError:true,content:[{type:'text',text:JSON.stringify({error:error.code||'OPORA_ERROR',message:error.message})}]};}
  });
  register('opora_get_project','Identify the project pinned to this server. Check the returned root before doing work. Get project_id and context revision.',{},async()=>json(service.projectView(await service.snapshot(root))));
  register('opora_list_feedback','Read user visual feedback and decisions before changing UI. Without shot_id: screenshot summaries. With shot_id: paginated notes including normalized rectangles (x,y,w,h from 0 to 1), latest 8 history entries and result summaries. With note_id: paginate that note history instead. offset/limit apply to shots, notes or history respectively. Accepted keep notes are user preferences. feedback_revision is separate from project revision. User alone accepts results.',{project_id:projectId,shot_id:z.string().optional(),note_id:z.string().optional(),offset:z.number().int().min(0).optional(),limit:z.number().int().min(1).max(50).optional()},async input=>{
    const s=await service.snapshot(root);service.guard(s,input.project_id);const current=await feedback.read(s.root);let result=feedback.list(current,input);
    if(input.shot_id){const shot=current.store.shots.find(s=>s.id===input.shot_id);const offset=input.offset||0,limit=input.limit||20;
      if(input.note_id){const note=shot.notes.find(n=>n.id===input.note_id);if(!note)throw new Error('Замечание не найдено.');result={feedback_revision:current.feedback_revision,shot_id:shot.id,note:{...note,history:note.history.slice(offset,offset+limit),history_total:note.history.length},total:note.history.length,offset,limit};}
      else {const notes=shot.notes.slice(offset,offset+limit);result={feedback_revision:current.feedback_revision,shot:{...shot,notes:notes.map(n=>({...n,history:n.history.slice(-8),history_total:n.history.length})),results:shot.results.filter(r=>r.note_ids.some(id=>notes.some(n=>n.id===id)))},total:shot.notes.length,offset,limit};}
    }
    if(Buffer.byteLength(JSON.stringify(result))>256*1024)throw new Error('Слишком большой ответ. Уменьшите limit или запросите note_id.');return json({project_id:s.project_id,...result});
  });
  register('opora_get_feedback_image','View the original screenshot or a submitted result. Optionally select note_id to get its normalized and pixel rectangle and user text. Images are shown without a painted annotation overlay; use supplied coordinates. Read other notes via opora_list_feedback.',{project_id:projectId,shot_id:z.string(),result_id:z.string().optional(),note_id:z.string().optional()},async input=>{
    const s=await service.snapshot(root);service.guard(s,input.project_id);const result=await feedback.image(s.root,input);const note=input.note_id?result.shot.notes.find(n=>n.id===input.note_id):null;if(input.note_id&&!note)throw new Error('Замечание не найдено.');const rect=note?.rect;const original=result.shot.image;const metadata={project_id:s.project_id,feedback_revision:result.feedback_revision,shot_id:result.shot.id,image:result.info,note,original_pixel_rect:rect?{x:Math.round(rect.x*original.width),y:Math.round(rect.y*original.height),w:Math.round(rect.w*original.width),h:Math.round(rect.h*original.height)}:null,coordinates_refer_to:'original screenshot; result layout or dimensions may differ'};if(note)metadata.note={...note,history:note.history.slice(-8)};
    return {content:[{type:'text',text:JSON.stringify(metadata)},{type:'image',data:result.data.toString('base64'),mimeType:'image/png'}]};
  });
  register('opora_submit_feedback_result','Attach an existing project-relative PNG (up to 8 MiB/16M pixels) as the agent result for selected visual notes. Requires current feedback_revision from opora_list_feedback. Marks notes ready for USER review, never accepts them. Preserves previous results and user history. Reuse request_id only for exact retry; cannot change accepted notes.',{project_id:projectId,feedback_revision:revision,shot_id:z.string(),note_ids:z.array(z.string()).min(1).max(200),image_file:z.string().max(2048),summary:z.string().min(1).max(4000),agent:z.enum(['claude','codex','other']),request_id:z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/)},async input=>{
    const s=await service.snapshot(root);service.guard(s,input.project_id);const result=await feedback.submitResult(s.root,{...input,revision:input.feedback_revision,data:await feedback.projectImage(s.root,input.image_file)});return json({project_id:s.project_id,feedback_revision:result.feedback_revision,result_id:result.result_id,duplicate:!!result.duplicate,review_required:true});
  },{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false});
  register('opora_get_project_map','Explore the Godot file map before searching the whole project. Without file: paginated inventory, main scene, type counts and warnings. With file: incoming/outgoing static references with source line numbers, functions/signals, missing targets and unresolved UIDs. query matches path/class name; kind filters inventory. Each call refreshes file metadata and reuses unchanged parsed files. map_revision tracks game files independently of context revision. Static links do not prove runtime use; unlinked files are not necessarily unused. Read actual source before editing.',{
    project_id:projectId,file:z.string().min(1).max(2048).optional(),query:z.string().max(200).optional(),kind:z.enum(['all','scene','script','resource','shader','asset','project','other','unlinked']).optional(),offset:z.number().int().min(0).max(100000).optional(),limit:z.number().int().min(1).max(100).optional()
  },async input=>{const s=await service.snapshot(root);service.guard(s,input.project_id);const result={project_id:s.project_id,...await getProjectMap(s.root,input)};if(Buffer.byteLength(JSON.stringify(result))>256*1024)throw new Error('Ответ карты больше 256 КБ. Уменьшите limit или уточните query/file.');return json(result);});
  register('opora_get_context','Read current context. First call without known_revision returns the full readable context. When you RETAIN that context, pass its revision as known_revision: unchanged returns only identity, changed returns exact top-level replacements. Unknown revisions fall back to full. After chat compaction or if unsure, omit known_revision. Do not skip freshness checks.',{project_id:projectId,known_revision:revision.optional()},async input=>json(await readContext(input.project_id,input.known_revision)));
  register('opora_get_brandbook','Get visual rules and approved vs draft reference image IDs. Use opora_get_reference to view an image.',{project_id:projectId},async input=>{
    const s=await service.snapshot(root);service.guard(s,input.project_id);
    return json({...service.identity(s),brand:s.state.brand,references:s.state.references});
  });
  register('opora_update_project','Fill saved Opora data: game passport, rules, draft brandbook, task upserts and candidate reference images from project-relative paths. Requires fresh revision and explicit user request. Omitted fields and existing tasks/references are preserved. Cannot approve images/style or mark tasks done. Changed completed tasks reopen. Images are copied, originals remain. Returns full saved state, new revision and backup.',{
    project_id:projectId,revision,agent:z.enum(['claude','codex','other']),request_id:z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),summary:z.string().min(1).max(4000),
    fields:z.object({
      name:z.string().min(1).max(180).optional(),genre:z.string().max(64000).optional(),pitch:z.string().max(64000).optional(),experience:z.string().max(64000).optional(),goal:z.string().max(64000).optional(),pillars:z.string().max(64000).optional(),rules:z.string().max(64000).optional(),
      brand:z.object({direction:z.string().max(64000).optional(),palette:z.string().max(64000).optional(),fonts:z.string().max(64000).optional(),avoid:z.string().max(64000).optional()}).strict().optional(),
      tasks:z.array(z.object({id:z.string().min(1).max(160).optional(),title:z.string().min(1).max(180),acceptance:z.string().max(12000),status:z.enum(['backlog','active']).optional()}).strict()).max(100).optional(),
      active_task_id:z.string().max(160).nullable().optional(),reference_files:z.array(z.string().min(1).max(1024)).max(20).optional()
    }).strict().refine(v=>Object.keys(v).length>0)
  },async input=>json(await service.updateWorkspace(root,input)),{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false});
  register('opora_update_brandbook','Fill or revise the saved brandbook directly. Only direction, palette, fonts and avoid are editable. ALWAYS creates a draft, never approves style or images. Requires fresh context revision; preserves tasks and references, saves a backup. Use only when the user asks to fill/update style; do not invent evidence from files you did not read. Exact retries may reuse request_id.',{
    project_id:projectId,revision,agent:z.enum(['claude','codex','other']),request_id:z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),summary:z.string().min(1).max(4000),
    fields:z.object({direction:z.string().max(64000).optional(),palette:z.string().max(64000).optional(),fonts:z.string().max(64000).optional(),avoid:z.string().max(64000).optional()}).strict().refine(value=>Object.keys(value).length>0,'At least one brand field is required')
  },async input=>json(await service.updateBrandbook(root,input)),{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false});
  register('opora_review_brandbook','Assess written brand rules: explicit color pairs and contrast, missing font/role rules, draft status, and reference file availability. Returns explainable suggestions, not an artistic rating or proof that the game looks correct. Does not modify rules or approve them.',{project_id:projectId},async input=>{
    const s=await service.snapshot(root);service.guard(s,input.project_id);
    return json({...service.identity(s),review:await reviewProject(root,s.state)});
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
