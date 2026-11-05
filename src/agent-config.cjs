const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const toml=require('smol-toml');
const {snapshot}=require('./agent-service.cjs');
const {assertSafePath}=require('./core.cjs');

async function read(file) {try {const stat=await fs.lstat(file);if(stat.isSymbolicLink() || !stat.isFile())throw new Error('Файл настроек должен быть обычным файлом, не ссылкой.');if(stat.size>2*1024*1024)throw new Error('Файл настроек слишком большой.');return await fs.readFile(file,'utf8');} catch(error) {if(error.code==='ENOENT')return null;throw error;}}
async function connection(root,{executable,entry,codexHome}) {
  const s=await snapshot(root);
  const name='opora-'+s.project_id.slice(0,12);
  const spec={command:executable,args:[entry,'--project',s.root],env:{ELECTRON_RUN_AS_NODE:'1'}};
  return {project_id:s.project_id,project_name:s.state.name,server_name:name,spec,claudeFile:path.join(s.root,'.mcp.json'),codexFile:path.join(codexHome,'config.toml'),root:s.root};
}
function codexMerge(old,name,spec) {
  let parsed;
  try {parsed=toml.parse(old);} catch {throw new Error('Не удалось разобрать TOML Codex. Настройки не изменены.');}
  const start='# OPORA MCP START '+name;
  const end='# OPORA MCP END '+name;
  const starts=old.split(start).length-1,ends=old.split(end).length-1;
  if((starts||ends) && (starts!==1 || ends!==1 || old.indexOf(end)<old.indexOf(start)))throw new Error('Повреждены маркеры подключения Opora. Настройки не изменены.');
  const existing=parsed.mcp_servers?.[name];
  if(existing && !starts)throw new Error('Сервер с таким именем уже настроен вручную. Остальные настройки сохранены; выберите другое подключение или удалите старую запись через Codex.');
  const entry={...existing,...spec,env:{...existing?.env,...spec.env}};
  const block=start+'\n'+toml.stringify({mcp_servers:{[name]:entry}}).trimEnd()+'\n'+end;
  const merged=starts?old.slice(0,old.indexOf(start))+block+old.slice(old.indexOf(end)+end.length):old+(old && !old.endsWith('\n')?'\n':'')+'\n'+block+'\n';
  try {toml.parse(merged);} catch {throw new Error('Существующая структура TOML не допускает добавление сервера. Настройки не изменены.');}
  return merged;
}
async function configure(client,config) {
  if(!['claude','codex'].includes(client))throw new Error('Неизвестный клиент.');
  const file=client==='claude'?config.claudeFile:config.codexFile;
  if(client==='claude')await assertSafePath(config.root,'.mcp.json');
  const old=await read(file);
  let text;
  if(client==='claude') {
    let data;
    try {data=old===null?{}:JSON.parse(old);} catch {throw new Error('Не удалось разобрать .mcp.json. Файл не изменён.');}
    if(!data || typeof data!=='object' || Array.isArray(data) || (data.mcpServers!==undefined && (!data.mcpServers || typeof data.mcpServers!=='object' || Array.isArray(data.mcpServers))))throw new Error('Некорректная структура .mcp.json. Файл не изменён.');
    const existing=data.mcpServers?.[config.server_name];
    if(existing && !(existing.env?.ELECTRON_RUN_AS_NODE==='1' && existing.args?.includes(config.root) && existing.args?.some(a=>typeof a==='string' && /mcp[/\\]server\.cjs$/.test(a))))throw new Error('Имя сервера занято другим подключением. Файл не изменён.');
    data.mcpServers={...data.mcpServers,[config.server_name]:{...existing,type:'stdio',...config.spec,env:{...existing?.env,...config.spec.env}}};
    text=JSON.stringify(data,null,2)+'\n';
  } else text=codexMerge(old||'',config.server_name,config.spec);
  if(text===old)return {file,changed:false,backup:null};
  await fs.mkdir(path.dirname(file),{recursive:true});
  if(await read(file)!==old)throw new Error('Настройки изменились во время подключения. Повторите операцию.');
  let backup=null;
  if(old!==null) {
    const directory=client==='claude'?path.join(config.root,'.opora/config-backups'):path.join(path.dirname(file),'opora-backups');
    if(client==='claude')await assertSafePath(config.root,'.opora/config-backups');
    await fs.mkdir(directory,{recursive:true});
    try {await fs.writeFile(path.join(directory,'.gitignore'),'# Local configuration backups.\n*\n',{flag:'wx',mode:0o600});} catch(error) {if(error.code!=='EEXIST')throw error;}
    backup=path.join(directory,client+'-'+crypto.randomUUID()+path.extname(file));
    await fs.writeFile(backup,old,{flag:'wx',mode:0o600});
  }
  const temp=file+'.opora-'+crypto.randomUUID()+'.tmp';
  try {await fs.writeFile(temp,text,{flag:'wx',mode:0o600});await fs.rename(temp,file);} finally {await fs.rm(temp,{force:true});}
  return {file,backup,changed:true};
}
async function status(config) {
  const result={};
  for(const client of ['claude','codex']) {
    try {
      const text=await read(client==='claude'?config.claudeFile:config.codexFile);
      const item=text===null?null:client==='claude'?JSON.parse(text).mcpServers?.[config.server_name]:toml.parse(text).mcp_servers?.[config.server_name];
      result[client]={configured:!!item && item.command===config.spec.command && JSON.stringify(item.args)===JSON.stringify(config.spec.args) && item.env?.ELECTRON_RUN_AS_NODE==='1'};
    } catch {result[client]={configured:false,error:'Не удалось прочитать настройки клиента.'};}
  }
  return result;
}
module.exports={connection,configure,codexMerge,status};
