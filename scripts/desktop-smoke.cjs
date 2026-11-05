const {_electron} = require('playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const core = require('../src/core.cjs');

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(),'opora-electron-'));
  const project = path.join(temp,'game');
  const profile = path.join(temp,'profile');
  await fs.mkdir(project); await fs.mkdir(profile);
  await fs.writeFile(path.join(project,'project.godot'),'config_version=5\n[application]\nconfig/name="Native game"\n');
  await fs.writeFile(path.join(project,'CLAUDE.md'),'# Existing Claude instructions\nUse existing components.\n');
  const image = path.join(temp,'reference.png');
  await fs.writeFile(image,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6X7sAAAAASUVORK5CYII=','base64'));
  const entry = path.join(temp,'entry.cjs');
  await fs.writeFile(entry,`require('electron').app.setPath('userData', ${JSON.stringify(profile)});\nrequire(${JSON.stringify(path.join(__dirname,'../desktop/main.cjs'))});\n`);
  let app;
  async function launch() {
    const instance = await _electron.launch({executablePath:require('electron'),args:[entry,'--no-sandbox','--ozone-platform=headless'],timeout:30000});
    await instance.evaluate(({dialog}, {project,image})=>{
      dialog.showOpenDialog = async (_win, options) => ({canceled:false,filePaths:options.properties.includes('openDirectory') ? [project] : [image]});
    },{project,image});
    return instance;
  }
  try {
    app = await launch();
    const page=await app.firstWindow();
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.getByRole('button',{name:'Подключить проект'}).click();
    await page.getByRole('heading',{name:'С чего начнём вашу игру?'}).waitFor();
    await page.locator('[data-field="rules"]').fill('Не менять размер кнопок');
    await page.locator('[data-tab="brand"]').click();
    await page.getByRole('button',{name:'+ Добавить образцы'}).click();
    await page.locator('[data-ref-status]').selectOption('approved');
    await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth > 0);
    await page.locator('[data-tab="context"]').click();
    await page.getByRole('button',{name:'Обновить файлы проекта'}).click();
    await page.getByRole('button',{name:'Обновить эти файлы'}).click();
    await page.waitForFunction(()=>document.querySelector('.badge')?.textContent.includes('ПЕРЕДАНО В ФАЙЛЫ'));
    await page.getByRole('button',{name:'Скопировать запрос'}).click();
    const copied=await app.evaluate(({clipboard})=>clipboard.readText());
    assert.match(copied,/Не менять размер кнопок/);
    const data=await core.loadProject(project);
    assert.equal(data.state.references[0].status,'approved');
    assert.ok((await fs.readFile(path.join(project,'CLAUDE.md'),'utf8')).startsWith('# Existing Claude instructions\nUse existing components.\n'));
    assert.deepEqual(errors,[]);
    await page.locator('[data-tab="overview"]').click();
    await page.locator('[data-field="goal"]').fill('Данные сохраняются при закрытии');
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
    await app.waitForEvent('close'); app=null;
    assert.equal((await core.loadProject(project)).state.goal,'Данные сохраняются при закрытии');
    app=await launch();
    const reopened=await app.firstWindow();
    await reopened.waitForFunction(()=>document.querySelector('[data-field="goal"]')?.value === 'Данные сохраняются при закрытии');
    assert.equal(await reopened.locator('#side-name').textContent(),'Native game');
    await reopened.locator('[data-field="name"]').fill('');
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
    await reopened.getByRole('heading',{name:'Изменения не сохранены'}).waitFor();
    await reopened.getByRole('button',{name:'Продолжить работу'}).click();
    await reopened.locator('[data-field="name"]').fill('Native game');
    console.log('PASS real Electron: preload/IPC, Godot folder, reference image copy/read, file sync, native clipboard, save on close, restore project on restart, recover from save failure');
  } finally {
    if(app) await app.close();
    await fs.rm(temp,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
