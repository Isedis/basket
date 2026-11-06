const fs=require('node:fs'),path=require('node:path');
let file,problem='';
const recovering=new WeakSet();
function begin(app){
  file=path.join(app.getPath('userData'),'startup.log');
  log('launch',JSON.stringify({version:require('../package.json').version,platform:process.platform,arch:process.arch,electron:process.versions.electron,executable:process.execPath,softwareRendering:process.platform==='win32'}));
}
function log(stage,detail=''){
  if(!file)return;
  try{
    fs.mkdirSync(path.dirname(file),{recursive:true});
    if(fs.existsSync(file)&&fs.statSync(file).size>65536)fs.renameSync(file,file+'.previous');
    fs.appendFileSync(file,new Date().toISOString()+' '+stage+' '+String(detail).slice(0,8192)+'\n');
  }catch{}
}
async function failure(win,message){
  problem=message;log('interface-error',message);
  if(win.isDestroyed())return;
  if(recovering.has(win))return;
  recovering.add(win);
  try{await win.loadFile(path.join(__dirname,'../ui/startup.html'));win.show();}catch{require('electron').dialog.showErrorBox('Запуск Опоры',message+'\nЖурнал: '+file);}finally{recovering.delete(win);}
}
function watch(win,app){
  const {ipcMain,clipboard}=require('electron');
  let timer=setTimeout(()=>failure(win,'Интерфейс не загрузился за 20 секунд.'),20000);
  win.webContents.once('did-finish-load',()=>{clearTimeout(timer);log('interface-loaded');});
  win.on('closed',()=>clearTimeout(timer));
  win.webContents.on('did-fail-load',(_event,code,description,url,isMainFrame)=>{if(isMainFrame&&code!==-3)failure(win,'Не удалось загрузить интерфейс: '+code+' '+description);});
  win.webContents.on('render-process-gone',(_event,details)=>failure(win,'Процесс интерфейса завершился: '+details.reason+' ('+details.exitCode+').'));
  ipcMain.handle('startup:info',event=>{if(event.sender!==win.webContents)return null;return {error:problem,log:file};});
  ipcMain.handle('startup:copy',event=>{if(event.sender!==win.webContents)return;let content='';try{content=fs.readFileSync(file,'utf8').slice(-32768);}catch{}clipboard.writeText(problem+'\n'+file+'\n'+content);});
  ipcMain.on('startup:retry',event=>{if(event.sender!==win.webContents||!win.webContents.getURL().endsWith('/startup.html'))return;app.relaunch();app.exit(0);});
}
module.exports={begin,log,watch,failure,filename:()=>file};
