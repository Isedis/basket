const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
async function resolveGodot(selected,env=process.env){
  const dirs=[...new Set((env.PATH||env.Path||'').split(path.delimiter).filter(p=>path.isAbsolute(p)))];
  const candidates=selected?[selected]:dirs.flatMap(dir=>(process.platform==='win32'?['godot.exe','godot4.exe']:['godot','godot4']).map(name=>path.join(dir,name)));
  if(!selected&&process.platform==='win32')for(const dir of dirs){const names=await fs.readdir(dir).catch(()=>[]);candidates.push(...names.filter(n=>/^Godot_v[\w.-]+_win64(?:_console)?\.exe$/i.test(n)).slice(0,12).map(n=>path.join(dir,n)));}
  for(const file of candidates){if(!path.isAbsolute(file)||process.platform==='win32'&&!/\.exe$/i.test(file))continue;try{if(!(await fs.stat(file)).isFile())continue;await fs.access(file,process.platform==='win32'?0:require('node:fs').constants.X_OK);return {file,args:[]};}catch{}}
  if(selected)throw new Error('Выбранный Godot недоступен. Укажите исполняемый файл редактора.');return null;
}
async function runProcess(root,{command,signal,timeoutMs=45000,args}={}){
  const name='Импорт проекта в Godot (без окна)',base={name,kind:'godot-import',verified_by:'opora-process',scope:'Editor import only; does not prove gameplay, visual quality or every script path.'};
  if(!command)return {...base,result:'not_run',setup_required:true,evidence:'Godot не найден. Укажите редактор один раз, чтобы запускать проверку автоматически.'};
  if(signal?.aborted)return {...base,result:'not_run',evidence:'Работа остановлена до проверки.'};
  const started=Date.now();return new Promise(resolve=>{
    let output='',tail='',hasErrors=false,finished=false,timedOut=false,cancelled=false,timer,forceTimer,child;
    const done=(result,extra={})=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(forceTimer);signal?.removeEventListener('abort',cancel);resolve({...base,result,duration_ms:Date.now()-started,evidence:output.slice(-4000)||extra.error||'Процесс завершён без диагностических сообщений.',...extra});};
    const read=chunk=>{const text=chunk.toString();output=(output+text).slice(-64000);const scan=(tail+text).replace(/\x1b\[[0-9;]*[A-Za-z]/g,'');if(/(?:^|\n)\s*(?:SCRIPT ERROR:|ERROR:|Parse Error:)/i.test(scan))hasErrors=true;tail=scan.slice(-256);};
    const kill=()=>{child?.kill();forceTimer=setTimeout(()=>child?.kill('SIGKILL'),1000);};
    const cancel=()=>{cancelled=true;kill();};
    try{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPORA_UPDATE_JOB;delete env.OPORA_UPDATE_TOKEN;child=spawn(command.file,[...(command.args||[]),...(args||['--headless','--path',root,'--editor','--import','--quit'])],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});}catch(error){done('failed',{error:error.message});return;}
    child.stdout.on('data',read);child.stderr.on('data',read);child.once('error',error=>done('failed',{error:error.message}));
    child.once('close',(code,exitSignal)=>done(cancelled?'not_run':code===0&&!hasErrors&&!timedOut?'passed':'failed',{exit_code:code,exit_signal:exitSignal,...(timedOut?{error:`Проверка превысила ${Math.ceil(timeoutMs/1000)} секунд.`,timed_out:true}:{}),...(cancelled?{error:'Проверка остановлена.',cancelled:true}:{}),...(hasErrors?{diagnostic_errors:true}:{})}));
    timer=setTimeout(()=>{timedOut=true;kill();},timeoutMs);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  });
}
async function check(root,options={}){
  const start=Date.now(),files=[...new Set(options.scriptFiles||[])],limit=20,timeout=options.timeoutMs||45000;
  const imported=await runProcess(root,options);if(imported.result!=='passed'||!files.length)return imported;
  let checked=0,evidence=imported.evidence;
  for(const file of files.slice(0,limit)){
    const name=`Импорт Godot и разбор GDScript (${checked}/${files.length})`;
    if(Date.now()-start>=timeout)return {...imported,name,result:'failed',timed_out:true,evidence:'Общий лимит времени проверки исчерпан.',scripts_checked:checked,scripts_total:files.length};
    try{if(typeof file!=='string'||!file.endsWith('.gd'))throw new Error('Ожидался GDScript.');await require('../src/core.cjs').assertSafePath(root,file);}catch(error){return {...imported,name,result:'failed',evidence:error.message};}
    const result=await runProcess(root,{...options,timeoutMs:timeout-(Date.now()-start),args:['--headless','--path',root,'--check-only','--script','res://'+file]});checked++;
    evidence=(evidence+'\n'+file+':\n'+result.evidence).slice(-4000);
    if(result.result!=='passed')return {...result,name:`Импорт Godot и разбор GDScript (${checked}/${files.length})`,evidence,scripts_checked:checked,scripts_total:files.length,duration_ms:Date.now()-start};
  }
  return {...imported,name:`Импорт Godot и разбор GDScript (${checked}/${files.length})`,evidence,duration_ms:Date.now()-start,scripts_checked:checked,scripts_total:files.length,limited:checked<files.length,scope:'Editor import and parsing of listed changed GDScript files only; no gameplay, visual or C# build verification.'};
}
module.exports={resolveGodot,check};
