const {app, BrowserWindow, dialog, ipcMain, clipboard} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../src/core.cjs');
let root = null;
let win;
let canClose = false;
const requireProject = () => {if (!root) throw new Error('Сначала подключите папку проекта Godot.'); return root;};

app.whenReady().then(() => {
  win = new BrowserWindow({width:1360, height:920, minWidth:980, minHeight:720, title:'Опора — память вашей игры', backgroundColor:'#101514', autoHideMenuBar:true, webPreferences:{preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true}});
  win.loadFile(path.join(__dirname,'../ui/index.html'));
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.on('close', event => {
    if (!canClose) {event.preventDefault(); win.webContents.send('app:flush');}
  });
  ipcMain.on('app:ready-to-close', event => {
    if (event.sender === win.webContents) {canClose = true; win.close();}
  });

  const preferences = path.join(app.getPath('userData'), 'preferences.json');
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
    return loaded;
  });
  ipcMain.handle('project:save', (_, state) => core.saveProject(requireProject(), state));
  ipcMain.handle('project:preview', (_, state) => core.previewSync(requireProject(), state));
  ipcMain.handle('project:sync', (_, state) => core.syncProject(requireProject(), state));
  ipcMain.handle('clipboard:copy', (_, text) => {if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Слишком большой текст.'); clipboard.writeText(text); return true;});
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
});
app.on('window-all-closed', () => app.quit());
