const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const MARKER='.opora-location.json',ACTIVE='opora-active.json';
const same=(a,b)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
async function read(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function atomic(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value),{flag:'wx',mode:0o600});try{const deadline=Date.now()+5000;while(true){try{await fs.rename(temp,file);break;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||Date.now()>deadline)throw error;await new Promise(r=>setTimeout(r,100));}}}finally{await fs.rm(temp,{force:true}).catch(()=>{});}}
function contained(root,file){const relative=path.relative(root,file);return !!relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
async function location(executable,{create=false,storage}={}){
  const directory=path.dirname(path.resolve(executable));
  const defaultHome=storage?path.join(storage,crypto.createHash('sha256').update(process.platform==='win32'?directory.toLowerCase():directory).digest('hex').slice(0,20)):path.dirname(directory);
  const marker=await read(path.join(directory,MARKER))||await read(path.join(defaultHome,'.opora-installation.json'));
  if(marker){
    if(marker.schemaVersion!==1||!path.isAbsolute(marker.home)||!path.isAbsolute(marker.base)||!(same(directory,marker.base)||contained(path.join(marker.home,'.opora-versions'),directory))||!/^[-a-zA-Z0-9]{36}$/.test(marker.id))throw new Error('Повреждены сведения об установке Опоры.');
    const base=await read(path.join(marker.home,'.opora-installation.json'));if(!base||base.id!==marker.id||!same(base.home,marker.home)||!same(base.base,marker.base))throw new Error('Не найдена основная папка этой установки Опоры.');
    return {...marker,directory,pointer:path.join(marker.home,ACTIVE)};
  }
  const result={schemaVersion:1,id:crypto.randomUUID(),home:defaultHome,base:directory};
  if(create){await fs.mkdir(result.home,{recursive:true});await atomic(path.join(result.home,'.opora-installation.json'),result);await atomic(path.join(result.home,ACTIVE),{schemaVersion:1,id:result.id,directory,version:require('../package.json').version});}
  return {...result,directory,pointer:path.join(result.home,ACTIVE)};
}
async function active(layout){
  const record=await read(layout.pointer);if(!record)return null;
  if(record.schemaVersion!==1||record.id!==layout.id||!path.isAbsolute(record.directory)||!(same(record.directory,layout.base)||contained(path.join(layout.home,'.opora-versions'),record.directory))||!/^\d+\.\d+\.\d+$/.test(record.version))throw new Error('Повреждён указатель текущей версии Опоры.');
  const marker=same(record.directory,layout.base)?layout:await read(path.join(record.directory,MARKER));if(!marker||marker.id!==layout.id||!same(marker.home,layout.home))throw new Error('Текущая версия относится к другой установке.');
  if(!(await fs.stat(path.join(record.directory,'Opora.exe'))).isFile())throw new Error('Не найден запуск текущей версии Опоры.');
  return record;
}
async function stableMcp(layout){
  const dir=path.join(layout.home,'.opora-runtime','mcp');await fs.mkdir(dir,{recursive:true});
  const entry=path.join(dir,'server.cjs');
  const script=`// Stable stdio launcher. Existing servers keep their version until the session ends.\nconst fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');\nconst home=path.resolve(__dirname,'../..');const active=JSON.parse(fs.readFileSync(path.join(home,'opora-active.json'),'utf8'));\nconst relative=path.relative(home,active.directory);if(active.id!==${JSON.stringify(layout.id)}||!(active.directory===${JSON.stringify(layout.base)}||(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))))throw new Error('Invalid Opora installation');\nconst child=spawn(path.join(active.directory,'Opora.exe'),[path.join(active.directory,'resources/app.asar/mcp/server.cjs'),...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});\nchild.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});\nfor(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill();});\n`;
  let old;try{old=await fs.readFile(entry,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(old!==script){const temp=entry+'.tmp-'+crypto.randomUUID();await fs.writeFile(temp,script);await fs.rename(temp,entry);}
  return {executable:path.join(layout.base,'Opora.exe'),entry};
}
module.exports={MARKER,ACTIVE,same,contained,read,atomic,location,active,stableMcp};
