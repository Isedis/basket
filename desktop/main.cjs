const {app, BrowserWindow, dialog, ipcMain, clipboard, session, nativeImage} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../src/core.cjs');
const brandbook = require('../src/brandbook.cjs');
const brandReview = require('../src/brand-review.cjs');
const {readImage} = require('./image-analysis.cjs');
const {Updater} = require('../src/updater.cjs');
const windowsUpdater = require('./windows-updater.cjs');
const agentConfig = require('../src/agent-config.cjs');
const agentService = require('../src/agent-service.cjs');
const projectMap = require('../src/project-map.cjs');
const visualFeedback = require('../src/visual-feedback.cjs');
const workContext = require('../src/work-context.cjs');
const {resolveClaude}=require('./claude-terminal.cjs');
const {TerminalClient}=require('./terminal-client.cjs');
const installLayout=require('./install-layout.cjs');
const nativeUpdater=require('./native-updater.cjs');
const workReaders=new Map();
let root = null;
let lastScan = null;
let win;
let canClose = false;
let restarting=false;
let installation=null;
let mcpRuntime=null;
const startupUpdate={job:process.env.OPORA_UPDATE_JOB,token:process.env.OPORA_UPDATE_TOKEN};
let terminal;
let terminalStarting=false;
let terminalClosePrompt=false;
let externalHandoff=false;
const requireProject = () => {if (!root) throw new Error('Сначала подключите папку проекта Godot.'); return root;};

async function runDesktop(){
if(app.isPackaged){
  installation=await installLayout.location(process.execPath,{create:true,storage:path.join(app.getPath('userData'),'runtime')});
  const active=await installLayout.active(installation);
  if(active&&!installLayout.same(active.directory,path.dirname(process.execPath))&&!process.env.OPORA_UPDATE_JOB){
    const child=require('node:child_process').spawn(path.join(active.directory,'Opora.exe'),process.argv.slice(1),{cwd:active.directory,stdio:'ignore',windowsHide:true,env:{...process.env}});
    await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();app.quit();return;
  }
  mcpRuntime=await installLayout.stableMcp(installation);
}
const primary=app.requestSingleInstanceLock();
if(!primary)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
if(primary)await app.whenReady().then(async () => {
  win = new BrowserWindow({show:!startupUpdate.job,width:1360, height:920, minWidth:980, minHeight:720, title:'Опора — память вашей игры', backgroundColor:'#000000', autoHideMenuBar:true, webPreferences:{preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true}});
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  let readyTimer;
  const workspaceReady=new Promise((resolve,reject)=>{
    ipcMain.once('app:workspace-ready',event=>{if(event.sender===win.webContents){clearTimeout(readyTimer);resolve();}});
    if(startupUpdate.job)readyTimer=setTimeout(()=>reject(new Error('Интерфейс новой версии не завершил запуск.')),45000);
  });
  win.on('close', event => {
    if(restarting)return;
    try{
      const handoff=require('node:fs').existsSync(path.join(app.getPath('userData'),'update-handoff.json'))?JSON.parse(require('node:fs').readFileSync(path.join(app.getPath('userData'),'update-handoff.json'),'utf8')):null;
      if(handoff?.pid===process.pid&&handoff.expires>Date.now()){process.kill(handoff.requesterPid,0);externalHandoff=true;event.preventDefault();win.webContents.send('app:flush');return;}
    }catch{}
    if(terminal?.active || terminalStarting){
      event.preventDefault();
      if(terminalClosePrompt)return;
      terminalClosePrompt=true;
      (async()=>{
        try {
          if(terminalStarting)throw new Error('Claude запускается. Дождитесь запуска перед закрытием.');
          const answer=await dialog.showMessageBox(win,{type:'question',title:'Claude Code работает',message:'Завершить Claude Code и закрыть Опору?',detail:'Текущая операция агента будет прервана. История разговора сохраняется самим Claude Code.',buttons:['Вернуться','Завершить и закрыть'],defaultId:0,cancelId:0});
          if(answer.response===1){await terminal.stop(terminal.snapshot().id);win.close();}
        }catch(error){dialog.showErrorBox('Claude Code',error.message);}
        finally{terminalClosePrompt=false;}
      })();return;
    }
    if (!canClose) {event.preventDefault(); win.webContents.send('app:flush');}
  });
  ipcMain.on('app:ready-to-close', event => {
    if (event.sender === win.webContents) {canClose = true;if(externalHandoff)restarting=true;win.close();}
  });
  const updateSession=session.fromPartition('opora-updates');
  const proxy=process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  let proxyError=null;
  if(proxy)try {await updateSession.setProxy({proxyRules:proxy,proxyBypassRules:'<local>'});} catch(error) {proxyError=error;}
  const updater=new Updater({runtimeVersion:process.versions.electron,currentVersion:require('../package.json').version,directory:path.join(app.getPath('userData'),'updates'),fetch:(url,options)=>{if(proxyError)throw new Error('Не удалось настроить прокси для обновлений.');return updateSession.fetch(url,options);},supported:process.platform==='win32' && app.isPackaged,onProgress:info=>{if(!win.isDestroyed())win.webContents.send('updates:progress',info);}});
  let installing=false;
  ipcMain.handle('updates:info',async ()=>{
    const previousInstall=await windowsUpdater.readResult(path.join(app.getPath('userData'),'update-result.json'));
    return {...updater.info(),previousInstall,installDirectory:path.dirname(process.execPath)};
  });
  ipcMain.handle('updates:check',()=>updater.check());
  ipcMain.handle('updates:diagnostics',async()=>({currentVersion:require('../package.json').version,installDirectory:path.dirname(process.execPath),...await nativeUpdater.readDiagnostics(path.join(app.getPath('userData'),'update-result.json'),{layout:installation})}));
  ipcMain.handle('updates:download',()=>updater.download());
  ipcMain.handle('updates:install',async ()=>{
    if(!updater.supported)throw new Error('Установка обновлений доступна только в готовой Windows-сборке.');
    if(installing)throw new Error('Установка уже выполняется.');
    installing=true;
    updater.emit({transaction:true});
    try {
      if(terminalStarting)await new Promise((resolve,reject)=>{const deadline=Date.now()+20000;const tick=()=>{if(!terminalStarting)return resolve();if(Date.now()>deadline)return reject(new Error('Claude ещё запускается. Повторите обновление через несколько секунд.'));setTimeout(tick,100);};tick();});
      await updater.check();
      if(updater.info().status==='up-to-date'){installing=false;updater.emit({transaction:false});return {restarting:false};}
      await updater.download();
      updater.emit({status:'installing',installPhase:'Подготовка обновления',previousInstall:null});
      let download=await updater.verifiedDownload();
      const onProgress=installPhase=>updater.emit({status:'installing',installPhase});
      let plan;
      try{plan=await nativeUpdater.prepareInstall(download,process.execPath,{onProgress,layout:installation});}
      catch(error){
        if(error.code!=='ENGINE_REPAIR_REQUIRED'||download.kind!=='app')throw error;
        onProgress('Автоматическое восстановление Electron');updater.useFullPackage();await updater.download();download=await updater.verifiedDownload();
        plan=await nativeUpdater.prepareInstall(download,process.execPath,{onProgress,layout:installation});
      }
      await nativeUpdater.launchInstaller(plan,path.join(app.getPath('userData'),'update-result.json'),{onProgress});
      canClose=true;restarting=true;
      setTimeout(()=>app.quit(),250);
      return {restarting:true};
    } catch(error) {installing=false;updater.emit({status:'error',transaction:false,error:error.message,previousInstall:await windowsUpdater.readResult(path.join(app.getPath('userData'),'update-result.json'))});throw error;}
  });

  const preferences = path.join(app.getPath('userData'), 'preferences.json');
  const getAgentConfig=()=>agentConfig.connection(requireProject(),{executable:mcpRuntime?.executable||process.execPath,entry:mcpRuntime?.entry||path.join(__dirname,'../mcp/server.cjs'),codexHome:process.env.CODEX_HOME||path.join(app.getPath('home'),'.codex')});
  terminal=new TerminalClient({
    record:path.join(app.getPath('userData'),'terminal-broker.json'),entry:path.join(__dirname,'terminal-broker.cjs'),executable:process.execPath,
    native:app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked/node_modules/node-pty'):undefined,
    onEvent:event=>{if(!win.isDestroyed())win.webContents.send('claude:event',event);}
  });
  await terminal.connect();if(terminal.active)root=terminal.snapshot().root;
  const terminalPreferences=path.join(app.getPath('userData'),'claude-terminal.json');
  async function claudeCommand(){
    let selected;
    try{selected=JSON.parse(await fs.readFile(terminalPreferences,'utf8')).executable;}catch(error){if(error.code!=='ENOENT')throw new Error('Не удалось прочитать путь Claude Code. Выберите исполняемый файл заново.');}
    return resolveClaude({selected,home:app.getPath('home')});
  }
  function terminalHandle(channel,handler){ipcMain.handle(channel,(event,...args)=>{if(event.sender!==win.webContents)throw new Error('Недоступный отправитель.');return handler(...args);});}
  terminalHandle('claude:state',()=>terminal.getState());
  terminalHandle('claude:start',async(options={})=>{
    const project=requireProject();
    if(terminalStarting)throw new Error('Claude уже запускается.');
    if(terminal.active)return terminal.snapshot();
    if(installing)throw new Error('Дождитесь завершения обновления.');
    terminalStarting=true;
    try{
      const command=await claudeCommand();
      const config=await getAgentConfig();
      await agentConfig.configure('claude',config);
      if(root!==project)throw new Error('Проект сменился. Повторите запуск.');
      return await terminal.start({root:project,command,serverName:config.server_name,cols:options.cols,rows:options.rows,resume:options.resume===true});
    }finally{terminalStarting=false;}
  });
  terminalHandle('claude:input',input=>terminal.write(input));
  terminalHandle('claude:resize',input=>terminal.resize(input));
  terminalHandle('claude:stop',id=>terminal.stop(id));
  terminalHandle('claude:select',async()=>{
    if(terminal.active || terminalStarting)throw new Error('Завершите текущую сессию перед выбором Claude Code.');
    const selected=await dialog.showOpenDialog(win,{title:'Выберите Claude Code',properties:['openFile'],...(process.platform==='win32'?{filters:[{name:'Claude Code',extensions:['exe','cmd']}]}:{})});
    if(selected.canceled)return null;
    const command=await resolveClaude({selected:selected.filePaths[0],home:app.getPath('home')});
    await fs.mkdir(path.dirname(terminalPreferences),{recursive:true});
    await fs.writeFile(terminalPreferences,JSON.stringify({executable:command.display}),{mode:0o600});
    return {executable:command.display};
  });
  terminalHandle('claude:clipboard',()=>clipboard.readText());
  ipcMain.handle('agents:info',async ()=>{
    const config=await getAgentConfig();
    return {...config,status:await agentConfig.status(config)};
  });
  ipcMain.handle('agents:configure',async (_,client)=>{
    const config=await getAgentConfig();
    const result=await agentConfig.configure(client,config);
    return {...result,status:await agentConfig.status(config)};
  });
  ipcMain.handle('agents:disconnect',async(_,client)=>{const config=await getAgentConfig();const result=await agentConfig.disconnect(client,config);return {...result,status:await agentConfig.status(config)};});
  ipcMain.handle('agents:reports',()=>agentService.listReports(requireProject()));
  ipcMain.handle('project:restore', async () => {
    if(terminal?.active || terminalStarting)return core.loadProject(requireProject());
    try {
      const settings = JSON.parse(await fs.readFile(preferences, 'utf8'));
      const loaded = await core.loadProject(settings.lastProject);
      root = loaded.root;
      return loaded;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      return {error:'Не удалось открыть последний проект. Выберите его папку заново. ' + error.message};
    }
  });

  ipcMain.handle('project:open', async () => {
    if(terminal?.active || terminalStarting)throw new Error('Завершите Claude Code в панели терминала перед сменой проекта.');
    const selected = await dialog.showOpenDialog(win, {title:'Выберите папку с project.godot', properties:['openDirectory']});
    if (selected.canceled) return null;
    const loaded = await core.loadProject(selected.filePaths[0]);
    await fs.mkdir(path.dirname(preferences), {recursive:true});
    await fs.writeFile(preferences, JSON.stringify({lastProject:loaded.root}), 'utf8');
    root = loaded.root;
    lastScan = null;
    return loaded;
  });
  ipcMain.handle('project:save', (_, state,baseBrand,baseState,approvedBrand) => core.saveProject(requireProject(), state,{baseBrand,baseState,approvedBrand}));
  ipcMain.handle('project:snapshot',()=>core.loadProject(requireProject()));
  ipcMain.handle('project:map',(_,options)=>projectMap.getProjectMap(requireProject(),options||{}));
  ipcMain.handle('workspace:read',(_,input={})=>{const project=requireProject();if(!workReaders.has(project)){workReaders.clear();workReaders.set(project,workContext.reader(project));}return workReaders.get(project)(input);});
  ipcMain.handle('feedback:read',()=>visualFeedback.read(requireProject()));
  ipcMain.handle('feedback:history',(_,input)=>visualFeedback.history(requireProject(),input));
  ipcMain.handle('feedback:archive',(_,input)=>visualFeedback.archive(requireProject(),input));
  ipcMain.handle('feedback:note',(_,input)=>visualFeedback.addNote(requireProject(),input));
  ipcMain.handle('feedback:decide',(_,input)=>visualFeedback.decide(requireProject(),input));
  ipcMain.handle('feedback:image',async(_,input)=>{const result=await visualFeedback.image(requireProject(),input);return 'data:image/png;base64,'+result.data.toString('base64');});
  async function saveFeedbackImage(project,image,title,input){
    if(project!==root)throw new Error('Проект сменился. Повторите добавление снимка.');
    const size=image.getSize();if(image.isEmpty()||!size.width||!size.height||size.width*size.height>16_000_000)throw new Error('Нужен снимок до 16 миллионов пикселей.');
    const data=image.toPNG();visualFeedback.pngInfo(data);
    if(input.shot_id)return visualFeedback.submitResult(project,{revision:input.revision,shot_id:input.shot_id,note_ids:[input.note_id],summary:input.summary||'Результат добавлен пользователем',agent:'user',request_id:crypto.randomUUID(),note_revisions:input.note_revisions,data});
    return visualFeedback.addShot(project,{revision:input.revision,title,data});
  }
  ipcMain.handle('feedback:import',async(_,input={})=>{
    const project=requireProject();const selected=await dialog.showOpenDialog(win,{title:input.shot_id?'Добавить результат':'Добавить снимок игры',properties:['openFile'],filters:[{name:'Изображения',extensions:['png','jpg','jpeg','webp']}]});
    if(selected.canceled)return null;const data=await visualFeedback.boundedRead(selected.filePaths[0],8*1024*1024);if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))visualFeedback.pngInfo(data);
    return saveFeedbackImage(project,nativeImage.createFromBuffer(data),path.basename(selected.filePaths[0]).slice(0,180),input);
  });
  ipcMain.handle('feedback:clipboard',async(_,input={})=>{
    const project=requireProject();const items=await clipboard.read();
    for(const item of items){const type=item.types.find(t=>t==='image/png')||item.types.find(t=>['image/jpeg','image/webp'].includes(t));if(!type)continue;const blob=await item.getType(type);if(blob.size>8*1024*1024)throw new Error('Снимок из буфера должен быть меньше 8 МиБ.');const data=Buffer.from(await blob.arrayBuffer());if(type==='image/png')visualFeedback.pngInfo(data);return saveFeedbackImage(project,nativeImage.createFromBuffer(data),'Снимок из буфера обмена',input);}
    throw new Error('В буфере нет изображения. Сделайте снимок через Win+Shift+S или выберите файл.');
  });
  ipcMain.handle('project:preview', (_, state) => core.previewSync(requireProject(), state));
  ipcMain.handle('project:sync', (_, state,baseBrand,baseState) => core.syncProject(requireProject(), state,{baseBrand,baseState}));
  ipcMain.handle('brandbook:review',(_,state)=>brandReview.reviewProject(requireProject(),state));
  ipcMain.handle('brandbook:scan', async () => {
    const project = requireProject();
    const report = await brandbook.scanProject(project, {readImage});
    if(root !== project)throw new Error('Проект сменился во время анализа. Повторите анализ.');
    lastScan = {root:project,report};
    return report;
  });
  ipcMain.handle('brandbook:apply', async (_, selection) => {
    if(!lastScan || lastScan.root !== requireProject() || lastScan.report.id !== selection.id)throw new Error('Результат анализа устарел. Повторите анализ.');
    return brandbook.applyDraft(root,selection.state,lastScan.report,selection);
  });
  ipcMain.handle('clipboard:copy', async (_, text) => {if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Слишком большой текст.'); await clipboard.writeText(text); return true;});
  ipcMain.handle('reference:add', async () => {
    const project = requireProject();
    const selected = await dialog.showOpenDialog(win, {title:'Добавить визуальные образцы', properties:['openFile','multiSelections'], filters:[{name:'Изображения', extensions:['png','jpg','jpeg','webp']}]});
    if (selected.canceled) return [];
    const refs = [];
    await core.assertSafePath(project, '.opora/references');
    await fs.mkdir(path.join(project, '.opora/references'), {recursive:true});
    for (const source of selected.filePaths) {
      const ext = path.extname(source).toLowerCase();
      if (!['.png','.jpg','.jpeg','.webp'].includes(ext)) throw new Error('Поддерживаются PNG, JPG и WebP.');
      const stat = await fs.stat(source);
      if (stat.size > 20 * 1024 * 1024) throw new Error('Изображение должно быть меньше 20 МБ.');
      const id = crypto.randomUUID();
      const file = `.opora/references/${id}${ext}`;
      await fs.copyFile(source, path.join(project,file), 1);
      refs.push({id, name:path.basename(source), file, status:'draft'});
    }
    return refs;
  });
  ipcMain.handle('reference:image', async (_, file) => {
    if (typeof file !== 'string' || !/^\.opora\/references\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(file)) throw new Error('Некорректный путь изображения.');
    const project = requireProject();
    await core.assertSafePath(project, file);
    const stat = await fs.stat(path.join(project,file));
    if (stat.size > 20 * 1024 * 1024) throw new Error('Изображение слишком большое.');
    const data = await fs.readFile(path.join(project,file));
    const ext = path.extname(file).slice(1);
    return `data:image/${['jpg','jpeg'].includes(ext)?'jpeg':ext};base64,${data.toString('base64')}`;
  });
  await win.loadFile(path.join(__dirname,'../ui/index.html'));
  if(startupUpdate.job)await workspaceReady;
  try {await nativeUpdater.confirmLaunch({version:require('../package.json').version});if(startupUpdate.job)win.show();}
  catch(error) {throw error;}
  finally {delete process.env.OPORA_UPDATE_JOB;delete process.env.OPORA_UPDATE_TOKEN;}
});
}
runDesktop().catch(async error=>{
  if(startupUpdate.job&&startupUpdate.token){
    try{await fs.writeFile(path.join(startupUpdate.job,'gui-error.json'),JSON.stringify({token:startupUpdate.token,pid:process.pid,error:error.message}));}catch{}
    app.exit(1);return;
  }
  dialog.showErrorBox('Запуск Опоры',error.message);app.quit();
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit',()=>terminal?.dispose());
