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
let root = null;
let lastScan = null;
let win;
let canClose = false;
const requireProject = () => {if (!root) throw new Error('Сначала подключите папку проекта Godot.'); return root;};

const primary=app.requestSingleInstanceLock();
if(!primary)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
if(primary)app.whenReady().then(async () => {
  win = new BrowserWindow({width:1360, height:920, minWidth:980, minHeight:720, title:'Опора — память вашей игры', backgroundColor:'#000000', autoHideMenuBar:true, webPreferences:{preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true}});
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.on('close', event => {
    if (!canClose) {event.preventDefault(); win.webContents.send('app:flush');}
  });
  ipcMain.on('app:ready-to-close', event => {
    if (event.sender === win.webContents) {canClose = true; win.close();}
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
  ipcMain.handle('updates:download',()=>updater.download());
  ipcMain.handle('updates:install',async ()=>{
    if(!updater.supported)throw new Error('Установка обновлений доступна только в готовой Windows-сборке.');
    if(installing)throw new Error('Установка уже выполняется.');
    installing=true;
    try {
      updater.emit({status:'installing'});
      const download=await updater.verifiedDownload();
      const plan=await windowsUpdater.prepareInstall(download,process.execPath);
      await windowsUpdater.launchInstaller(plan,path.join(app.getPath('userData'),'update-result.json'));
      canClose=true;
      setTimeout(()=>app.quit(),250);
      return {restarting:true};
    } catch(error) {installing=false;updater.emit({status:'error',error:error.message});throw error;}
  });

  const preferences = path.join(app.getPath('userData'), 'preferences.json');
  const getAgentConfig=()=>agentConfig.connection(requireProject(),{executable:process.execPath,entry:path.join(__dirname,'../mcp/server.cjs'),codexHome:process.env.CODEX_HOME||path.join(app.getPath('home'),'.codex')});
  ipcMain.handle('agents:info',async ()=>{
    const config=await getAgentConfig();
    return {...config,status:await agentConfig.status(config)};
  });
  ipcMain.handle('agents:configure',async (_,client)=>{
    const config=await getAgentConfig();
    const result=await agentConfig.configure(client,config);
    return {...result,status:await agentConfig.status(config)};
  });
  ipcMain.handle('agents:reports',()=>agentService.listReports(requireProject()));
  ipcMain.handle('project:restore', async () => {
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
    const selected = await dialog.showOpenDialog(win, {title:'Выберите папку с project.godot', properties:['openDirectory']});
    if (selected.canceled) return null;
    const loaded = await core.loadProject(selected.filePaths[0]);
    await fs.mkdir(path.dirname(preferences), {recursive:true});
    await fs.writeFile(preferences, JSON.stringify({lastProject:loaded.root}), 'utf8');
    root = loaded.root;
    lastScan = null;
    return loaded;
  });
  ipcMain.handle('project:save', (_, state,baseBrand,baseState) => core.saveProject(requireProject(), state,{baseBrand,baseState}));
  ipcMain.handle('project:snapshot',()=>core.loadProject(requireProject()));
  ipcMain.handle('project:map',(_,options)=>projectMap.getProjectMap(requireProject(),options||{}));
  ipcMain.handle('feedback:read',()=>visualFeedback.read(requireProject()));
  ipcMain.handle('feedback:note',(_,input)=>visualFeedback.addNote(requireProject(),input));
  ipcMain.handle('feedback:decide',(_,input)=>visualFeedback.decide(requireProject(),input));
  ipcMain.handle('feedback:image',async(_,input)=>{const result=await visualFeedback.image(requireProject(),input);return 'data:image/png;base64,'+result.data.toString('base64');});
  async function saveFeedbackImage(project,image,title,input){
    if(project!==root)throw new Error('Проект сменился. Повторите добавление снимка.');
    const size=image.getSize();if(image.isEmpty()||!size.width||!size.height||size.width*size.height>16_000_000)throw new Error('Нужен снимок до 16 миллионов пикселей.');
    const data=image.toPNG();visualFeedback.pngInfo(data);
    if(input.shot_id)return visualFeedback.submitResult(project,{revision:input.revision,shot_id:input.shot_id,note_ids:[input.note_id],summary:input.summary||'Результат добавлен пользователем',agent:'user',request_id:crypto.randomUUID(),data});
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
  try {await windowsUpdater.confirmLaunch({version:require('../package.json').version});}
  catch(error) {dialog.showErrorBox('Подтверждение обновления',error.message);}
  finally {delete process.env.OPORA_UPDATE_JOB;delete process.env.OPORA_UPDATE_TOKEN;}
});
app.on('window-all-closed', () => app.quit());
