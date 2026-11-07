// Versioned, cross-process Godot checks. Reuse only successful matching coverage.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {assertSafePath}=require('./core.cjs'),{scanProjectMap}=require('./project-map.cjs');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function version(map){return hash(map.nodes.filter(n=>['project','script','scene','resource','shader','asset'].includes(n.kind)&&!n.file.endsWith('.uid')||/\.(json|cfg|csv|txt|dll|so|dylib|gdextension)$/i.test(n.file)).map(n=>[n.file,n.fingerprint||null]));}
function invalidate(result){return {...result,result:'failed',stale_source:true,reused:false,evidence:'Файлы изменились во время проверки или до сохранения отчёта. Запустите проверку текущей версии снова.\n'+(result.evidence||'')};}
async function acquire(root,signal){await assertSafePath(root,'.opora/godot-verification');const dir=path.join(root,'.opora/godot-verification');await fs.mkdir(dir,{recursive:true});while(!signal?.aborted){try{return await require('proper-lockfile').lock(dir,{stale:120000,retries:0});}catch(e){if(e.code!=='ELOCKED')throw e;await new Promise(r=>setTimeout(r,100));}}return null;}
async function check(root,options={}){
 const release=await acquire(root,options.signal);if(!release)return {name:'Проверка Godot',result:'not_run',cancelled:true,verified_by:'opora-process',evidence:'Проверка остановлена во время ожидания очереди.'};
 try{
  const before=await scanProjectMap(root),input=version(before),files=[...new Set(options.scriptFiles||[])].sort(),command=options.command;let engine=null;
  if(command)try{const executables=await Promise.all([command.file,...(command.args||[]).filter(a=>path.isAbsolute(a))].map(async file=>{try{const stat=await fs.stat(file,{bigint:true});return [file,String(stat.size),String(stat.mtimeNs),String(stat.ctimeNs),String(stat.ino)];}catch{return [file,null];}}));engine=hash([command.file,command.args||[],executables,Object.entries(process.env).filter(([k])=>/^(PATH|Path|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|XDG_CONFIG_HOME|XDG_DATA_HOME|LD_LIBRARY_PATH|GODOT_.*|MESA_.*|GALLIUM_.*|VK_.*)$/.test(k)).sort(([a],[b])=>a.localeCompare(b))]);}catch{}
  const file=path.join(root,'.opora/godot-verification/cache.json');await assertSafePath(root,'.opora/godot-verification/cache.json');let cached;try{const stat=await fs.stat(file);if(stat.size<128000)cached=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
  if(engine&&!before.summary.limited&&cached?.version===1&&cached.engine===engine&&cached.input===input&&Date.now()-cached.at>=0&&Date.now()-cached.at<300000&&cached.result?.result==='passed'&&cached.result.verified_by==='opora-process'&&cached.result.verified_revision===input&&!cached.result.stale_source&&!cached.result.limited&&Array.isArray(cached.files)&&files.every(f=>cached.files.includes(f)))return {...cached.result,reused:true,evidence:'Использована успешная проверка той же версии файлов и Godot ('+cached.result.checked_at+').\n'+cached.result.evidence};
  const result=await require('../desktop/godot-check.cjs').check(root,options),after=await scanProjectMap(root),verified=version(after);
  const value={...result,input_revision:input,verified_revision:verified,checked_files:files.slice(0,result.scripts_checked??0),checked_at:new Date().toISOString(),reused:false};
  if(input!==verified)return invalidate(value);
  if(engine&&result.result==='passed'&&!result.limited&&!after.summary.limited&&!options.signal?.aborted){const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify({version:1,engine,input,at:Date.now(),files:value.checked_files,result:value}),{mode:0o600,flag:'wx'});try{await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}}
  return value;
 }finally{await release();}
}
module.exports={check,version,invalidate};
