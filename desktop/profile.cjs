const fs=require('node:fs'),path=require('node:path');
function same(a,b){a=path.resolve(a);b=path.resolve(b);return process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;}
// Fresh downloads must not inherit legacy singleton locks, Chromium caches or
// installation pointers. Only user preferences cross this boundary once.
function configure(app){
  const legacy=path.join(app.getPath('appData'),'opora');
  if(!app.isPackaged||app.commandLine.hasSwitch('user-data-dir')||!same(app.getPath('userData'),legacy))return {migrated:false,warnings:[]};
  const directory=path.join(app.getPath('appData'),'opora-desktop'),warnings=[];
  fs.mkdirSync(directory,{recursive:true});app.setPath('userData',directory);
  for(const [name,key] of [['preferences.json','lastProject'],['claude-terminal.json','executable']]){
    const source=path.join(legacy,name),target=path.join(directory,name);
    try{
      if(fs.existsSync(target)||!fs.existsSync(source))continue;
      if(fs.statSync(source).size>65536)throw new Error('Слишком большой файл настроек.');
      const value=JSON.parse(fs.readFileSync(source,'utf8'));
      if(typeof value[key]!=='string'||!path.isAbsolute(value[key]))throw new Error('Некорректный путь в настройках.');
      fs.writeFileSync(target,JSON.stringify({[key]:value[key]}),{flag:'wx',mode:0o600});
    }catch(error){if(error.code!=='EEXIST')warnings.push(name+': '+error.message);}
  }
  // A live standalone Claude session can be reattached without inheriting any
  // Chromium state or installation registry from the legacy GUI.
  try{
    const source=path.join(legacy,'terminal-broker.json'),target=path.join(directory,'terminal-broker.json');
    if(!fs.existsSync(target)&&fs.existsSync(source)&&fs.statSync(source).size<8192){
      const value=JSON.parse(fs.readFileSync(source,'utf8'));
      if(value.schemaVersion===1&&Number.isSafeInteger(value.pid)&&value.pid>0&&Number.isSafeInteger(value.port)&&value.port>0&&value.port<65536&&/^[a-f0-9]{64}$/.test(value.token)){
        process.kill(value.pid,0);fs.writeFileSync(target,JSON.stringify(value),{flag:'wx',mode:0o600});
      }
    }
  }catch{}
  return {migrated:true,warnings};
}
module.exports={configure};
