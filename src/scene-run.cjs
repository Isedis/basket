// Fixed Godot 4 capture runner. No shell, desktop capture, or user command recipes.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const service=require('./agent-service.cjs'),{assertSafePath}=require('./core.cjs'),{sourceSnapshot}=require('./source-snapshot.cjs');
async function boundedRead(file,max){const h=await fs.open(file,'r');try{const stat=await h.stat();if(!stat.isFile()||stat.size>max)throw new Error('Файл запуска слишком большой.');const data=Buffer.alloc(max+1),{bytesRead}=await h.read(data,0,data.length,0);if(bytesRead>max)throw new Error('Файл запуска слишком большой.');return data.subarray(0,bytesRead);}finally{await h.close();}}
const ID=/^[a-f0-9-]{36}$/;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function atomic(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});try{await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}}
async function directory(root,id){if(!ID.test(id))throw new Error('Некорректный ID запуска.');const rel='.opora/scene-runs/'+id;await assertSafePath(root,rel);return path.join(root,rel);}
function scenePath(value){const file=String(value||'').replace(/^res:\/\//,'');if(!/\.(tscn|scn)$/i.test(file)||file.length>1024||file.includes('\\')||file.includes(':')||file.split('/').some(p=>!p||p==='.'||p==='..')||/[\x00-\x1f]/.test(file))throw new Error('Выберите сцену .tscn / .scn внутри проекта.');return file;}
function options(input={}){const width=input.width??1280,height=input.height??720,delay=input.capture_after_ms??2000;if(!Number.isInteger(width)||width<320||width>1920||!Number.isInteger(height)||height<240||height>1080||!Number.isInteger(delay)||delay<500||delay>15000)throw new Error('Размер: 320–1920 × 240–1080; ожидание кадра: 500–15000 мс.');return {width,height,capture_after_ms:delay};}
async function start(root,input={},runtime={}){
 const s=await service.snapshot(root);if(input.project_id)service.guard(s,input.project_id);
 const file=scenePath(input.scene||(await require('./project-map.cjs').scanProjectMap(s.root)).main);await assertSafePath(s.root,file);if(!(await fs.stat(path.join(s.root,file))).isFile())throw new Error('Сцена отсутствует.');
 const taskId=input.task_id===undefined?s.state.activeTaskId:input.task_id;if(taskId&&!s.state.tasks.some(t=>t.id===taskId))throw new Error('Задача не найдена.');
 const command=runtime.command||await require('../desktop/godot-check.cjs').resolveGodot(process.env.OPORA_GODOT_EXECUTABLE);if(!command)throw Object.assign(new Error('Godot не найден. Укажите редактор кнопкой «Указать Godot».'),{code:'GODOT_REQUIRED'});
 const id=crypto.randomUUID(),dir=await directory(s.root,id);await fs.mkdir(dir,{recursive:true});
 const request={version:1,id,root:s.root,project_id:s.project_id,revision:s.revision,scene:file,task_id:taskId||null,task_title:s.state.tasks.find(t=>t.id===taskId)?.title||null,...options(input),command,created_at:new Date().toISOString()};
 await atomic(path.join(dir,'request.json'),request);
 const env={...process.env,ELECTRON_RUN_AS_NODE:'1'};delete env.OPORA_UPDATE_JOB;delete env.OPORA_UPDATE_TOKEN;
 const child=spawn(runtime.executable||process.execPath,[runtime.entry||path.join(__dirname,'../mcp/server.cjs'),'--scene-worker',s.root,id],{env,cwd:s.root,detached:true,windowsHide:true,stdio:'ignore'});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
 await atomic(path.join(dir,'worker.json'),{pid:child.pid});return get(s.root,id);
}
async function get(root,id){const dir=await directory(root,id);const request=JSON.parse(await boundedRead(path.join(dir,'request.json'),16000));const s=await service.snapshot(root);service.guard(s,request.project_id);
 let result;try{result=JSON.parse(await boundedRead(path.join(dir,'result.json'),128000));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(result){const now=await sourceSnapshot(root);return {...result,stale_code:now.revision!==result.source_snapshot?.revision||result.code_changed_during_run};}
 let progress;try{progress=JSON.parse(await boundedRead(path.join(dir,'progress.json'),128000));}catch(e){if(e.code!=='ENOENT')throw e;}
 let alive=true;try{const worker=JSON.parse(await fs.readFile(path.join(dir,'worker.json'),'utf8'));process.kill(worker.pid,0);}catch{alive=false;}
 if(Date.now()-Date.parse(request.created_at)>90000||!alive&&Date.now()-Date.parse(request.created_at)>5000)return {id,scene:request.scene,task_id:request.task_id,status:'interrupted',error:'Процесс проверки прерван. Запустите сцену снова.',verified_by:'opora-process'};
 return {id,scene:request.scene,task_id:request.task_id,status:'running',phase:progress?.phase||'Запуск Godot',log:progress?.log||'',created_at:request.created_at};
}
async function list(root,{task_id,limit=8}={}){await assertSafePath(root,'.opora/scene-runs');const names=await fs.readdir(path.join(root,'.opora/scene-runs'),{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});const result=[];
 for(const entry of names.filter(e=>e.isDirectory()&&ID.test(e.name))){try{const dir=await directory(root,entry.name),r=JSON.parse(await boundedRead(path.join(dir,'request.json'),16000));if(task_id!==undefined&&r.task_id!==task_id)continue;result.push({id:r.id,created_at:r.created_at,scene:r.scene});}catch{}}
 result.sort((a,b)=>b.created_at.localeCompare(a.created_at));return Promise.all(result.slice(0,Math.max(1,Math.min(limit,20))).map(r=>get(root,r.id)));
}
async function cancel(root,id){const dir=await directory(root,id),current=await get(root,id);if(current.status==='running')await fs.writeFile(path.join(dir,'cancel'),'cancel',{mode:0o600});return current;}
async function wait(root,id,{signal}={}){for(;;){if(signal?.aborted){await cancel(root,id);throw new Error('Запуск остановлен по запросу агента.');}const r=await get(root,id);if(r.status!=='running')return r;await sleep(350);}}
async function image(root,id){const r=await get(root,id);if(!r.screenshot)throw new Error('У этого запуска нет снимка.');const dir=await directory(root,id);await assertSafePath(root,'.opora/scene-runs/'+id+'/capture.png');const data=await boundedRead(path.join(dir,'capture.png'),8*1024*1024);if(crypto.createHash('sha256').update(data).digest('hex')!==r.screenshot.sha256)throw new Error('Снимок изменён после проверки.');return {data:data.toString('base64'),mimeType:'image/png'};}
function script(request,output,receipt){return `extends SceneTree
func _initialize():
    call_deferred("_opora_start")
func _opora_start():
    if DisplayServer.get_name() == "headless":
        push_error("Opora capture needs a graphical display")
        quit(2)
        return
    root.size = Vector2i(${request.width}, ${request.height})
    root.mode = Window.MODE_WINDOWED
    var err = change_scene_to_file(${JSON.stringify('res://'+request.scene)})
    if err != OK:
        push_error("Opora could not load scene: " + str(err))
        quit(2)
        return
    await process_frame
    await create_timer(${request.capture_after_ms/1000}, true, false, true).timeout
    await RenderingServer.frame_post_draw
    var frame = root.get_texture().get_image()
    if frame == null or frame.is_empty():
        push_error("Opora viewport is empty")
        quit(3)
        return
    var saved = frame.save_png(${JSON.stringify(output.replaceAll('\\','/'))})
    if saved != OK:
        push_error("Opora screenshot save failed: " + str(saved))
        quit(3)
        return
    var record = FileAccess.open(${JSON.stringify(receipt.replaceAll('\\','/'))}, FileAccess.WRITE)
    if record == null:
        quit(4)
        return
    record.store_string(JSON.stringify({"scene": current_scene.scene_file_path if current_scene != null else "", "width": frame.get_width(), "height": frame.get_height()}))
    record.close()
    quit(0)
`;}
async function worker(root,id){
 const dir=await directory(root,id),request=JSON.parse(await boundedRead(path.join(dir,'request.json'),16000));const s=await service.snapshot(root);service.guard(s,request.project_id);scenePath(request.scene);options(request);await assertSafePath(root,request.scene);
 let release,child,timer,poll,forceTimer,flushTimer,log='',tail='',diagnostics='',errors=false,cancelled=false,timedOut=false,phase='Импорт ресурсов',before,after,check,code=null,exitSignal=null,shot=null;
 const started=Date.now();const progress=()=>atomic(path.join(dir,'progress.json'),{phase,log}).catch(()=>{});
 const read=chunk=>{const text=chunk.toString().replace(/\x1b\[[0-9;]*[A-Za-z]/g,'');log=(log+text).slice(-64000);const scan=tail+text;if(/(?:^|\n)\s*(SCRIPT ERROR:|ERROR:|Parse Error:)/i.test(scan)){errors=true;diagnostics=(diagnostics+'\n'+scan.slice(-2000)).slice(-8000);}tail=scan.slice(-256);};
 const kill=()=>{if(!child||child.exitCode!==null||child.signalCode!==null)return;require('../desktop/stop-process.cjs').stop(child);clearTimeout(forceTimer);forceTimer=setTimeout(()=>{if(child?.exitCode===null&&child?.signalCode===null)require('../desktop/stop-process.cjs').stop(child,true);},1000);};
 try{
  release=await require('proper-lockfile').lock(path.dirname(dir),{realpath:true,stale:120000,retries:0});
  before=await sourceSnapshot(root);
  const controller=new AbortController();poll=setInterval(()=>{fs.access(path.join(dir,'cancel')).then(()=>{cancelled=true;controller.abort();kill();}).catch(()=>{});},200);flushTimer=setInterval(progress,400);await progress();
  check=await require('../desktop/godot-check.cjs').check(root,{command:request.command,signal:controller.signal,timeoutMs:45000});read(check.evidence+'\n');
  if(check.result!=='passed')throw new Error(check.error||'Godot не смог импортировать проект.');
  if(cancelled)throw new Error('Запуск остановлен.');
  before=await sourceSnapshot(root);
  phase='Сцена работает · ожидание кадра';await progress();
  const helper=path.join(dir,'capture.gd');await fs.writeFile(helper,script(request,path.join(dir,'capture.png'),path.join(dir,'capture.json')),{mode:0o600});
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPORA_UPDATE_JOB;delete env.OPORA_UPDATE_TOKEN;
  const outcome=await new Promise((resolve,reject)=>{
   child=spawn(request.command.file,[...(request.command.args||[]),'--path',root,'--windowed','--resolution',request.width+'x'+request.height,'--script',helper],{cwd:root,env,detached:process.platform!=='win32',windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',read);child.stderr.on('data',read);child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));timer=setTimeout(()=>{timedOut=true;kill();},30000);if(cancelled)kill();
  });code=outcome.code;exitSignal=outcome.signal;
  try{const data=await boundedRead(path.join(dir,'capture.png'),8*1024*1024),meta=JSON.parse(await boundedRead(path.join(dir,'capture.json'),4000));if(data.length<24||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||data.readUInt32BE(16)*data.readUInt32BE(20)>16000000)throw new Error('Некорректный PNG.');shot={...meta,sha256:crypto.createHash('sha256').update(data).digest('hex'),file:'.opora/scene-runs/'+id+'/capture.png'};}catch(e){if(e.code!=='ENOENT')read('\nERROR: '+e.message);}
  if(cancelled)throw new Error('Запуск остановлен.');if(timedOut)throw new Error('Сцена не отдала кадр за 30 секунд.');if(code!==0||errors||!shot)throw new Error(code===0&&!errors?'Godot завершился до сохранения кадра.':'В Godot обнаружены ошибки.');
 }catch(error){read('\n'+(error.code==='ELOCKED'?'Уже идёт проверка сцены в этом проекте. Дождитесь результата или остановите её.':error.message));errors=true;}
 finally{clearTimeout(timer);clearTimeout(forceTimer);clearInterval(poll);clearInterval(flushTimer);if(release)await release().catch(()=>{});}
 after=await sourceSnapshot(root).catch(()=>null);
 const status=cancelled?'cancelled':errors?'failed':'passed',result={version:1,id,project_id:s.project_id,scene:request.scene,task_id:request.task_id,task_title:request.task_title,status,verified_by:'opora-process',created_at:request.created_at,finished_at:new Date().toISOString(),duration_ms:Date.now()-started,exit_code:code,exit_signal:exitSignal,timed_out:timedOut,log,diagnostics,screenshot:shot,source_snapshot:after,before_snapshot:before,code_changed_during_run:!before||!after||before.revision!==after.revision,checks:[...(check?[check]:[]),{name:'Запуск сцены и снимок игрового окна',kind:'godot-scene',result:cancelled?'not_run':status,verified_by:'opora-process',evidence:(diagnostics?diagnostics.slice(-2000)+'\n':'')+log.slice(-2000)}],coverage:'Godot 4 startup and one viewport frame only. Project autoloads run. No simulated input, gameplay or visual-quality assertion. The game may write its normal saves. Static source hashes exclude image/audio content.'};
 await atomic(path.join(dir,'result.json'),result);
}
function receipt(run){const {log,diagnostics,checks,...rest}=run;return {...rest,log:log?.slice(-4000),log_length:log?.length||0,log_truncated:(log?.length||0)>4000,diagnostics:diagnostics?.slice(-2000),checks:checks?.map(c=>({...c,evidence:c.evidence?.slice(-1200)})),...(log?.length>4000?{read_more:{tool:'opora_scene_result',action:'log',run_id:run.id,offset:0}}:{})};}
module.exports={receipt,start,get,list,cancel,wait,image,worker,scenePath,options};
