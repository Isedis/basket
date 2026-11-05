const {chromium} = require('playwright-core');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const core = require('../src/core.cjs');

async function main() {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(),'opora-ui-'));
  await fs.writeFile(path.join(fixture,'project.godot'),'config_version=5\n[application]\nconfig/name="UI test game"\n');
  await fs.writeFile(path.join(fixture,'AGENTS.md'),'# Existing rules\nKeep original assets.\n');
  const server = http.createServer(async (req,res) => {
    const files = {'/':'index.html','/index.html':'index.html','/style.css':'style.css','/context.js':'context.js','/app.js':'app.js'};
    const file = files[req.url];
    if (!file) {res.writeHead(404); res.end(); return;}
    const types={'.html':'text/html','.css':'text/css','.js':'text/javascript'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]+'; charset=utf-8'});
    res.end(await fs.readFile(path.join(__dirname,'../ui',file)));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    const url=`http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    await page.getByRole('heading',{name:'У каждой игры — своя опора.'}).waitFor();
    await fs.mkdir(path.join(__dirname,'../artifacts'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'../artifacts/overview.png'),fullPage:true});
    await page.locator('[data-field="rules"]').fill('Не менять форму кнопок.');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('opora-demo')||'null')?.rules === 'Не менять форму кнопок.');
    await page.reload();
    assert.equal(await page.locator('[data-field="rules"]').inputValue(),'Не менять форму кнопок.');
    await page.locator('[data-tab="tasks"]').click();
    await page.getByRole('button',{name:'+ Новая задача'}).click();
    await page.locator('[name="title"]').fill('Проверить экран магазина');
    await page.locator('[name="acceptance"]').fill('Кнопки совпадают с утверждённым меню.');
    await page.getByRole('button',{name:'Сохранить задачу'}).click();
    const task=page.locator('article.task').filter({has:page.getByRole('heading',{name:'Проверить экран магазина'})});
    await task.getByRole('button',{name:'Выбрать →'}).click();
    await task.getByRole('button',{name:'Открыть контекст →'}).click();
    assert.match(await page.locator('#context-preview').textContent(),/Кнопки совпадают с утверждённым меню/);
    assert.match(await page.locator('#context-preview').textContent(),/Не менять форму кнопок/);
    await page.locator('[data-tab="brand"]').click();
    await page.locator('[data-field="brand.status"]').selectOption('approved');
    await page.locator('[data-tab="context"]').click();
    assert.match(await page.locator('#context-preview').textContent(),/УТВЕРЖДЁН пользователем/);
    await page.screenshot({path:path.join(__dirname,'../artifacts/context.png'),fullPage:true});
    console.log('PASS demo: persisted edits, task creation/selection, brand status, shared context');

    const desktop = await browser.newContext({viewport:{width:1440,height:1000}});
    let copied=''; let closed=false;
    await desktop.exposeFunction('nativeCall', async (method,arg) => {
      if (method==='restoreProject') return null;
      if (method==='openProject') return core.loadProject(fixture);
      if (method==='save') return core.saveProject(fixture,arg);
      if (method==='preview') return core.previewSync(fixture,arg);
      if (method==='sync') return core.syncProject(fixture,arg);
      if (method==='copy') {copied=arg; return true;}
      if (method==='readyToClose') {closed=true; return;}
      if (method==='addReferences') {
        const ref={id:'test-image',name:'Approved menu.png',file:'.opora/references/test-image.png',status:'draft'};
        await fs.mkdir(path.join(fixture,'.opora/references'),{recursive:true});
        await fs.writeFile(path.join(fixture,ref.file),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6X7sAAAAASUVORK5CYII=','base64'));
        return [ref];
      }
      if (method==='referenceImage') return 'data:image/png;base64,'+(await fs.readFile(path.join(fixture,arg))).toString('base64');
      throw new Error('Unknown bridge method '+method);
    });
    await desktop.addInitScript(()=>{
      window.opora={};
      for (const name of ['restoreProject','openProject','save','preview','sync','copy','addReferences','referenceImage','readyToClose']) window.opora[name]=arg=>window.nativeCall(name,arg);
      window.opora.onCloseRequested=callback=>{window.testClose=callback;};
    });
    const app=await desktop.newPage();
    app.on('pageerror',error=>errors.push(error.message));
    await app.goto(url);
    await app.getByRole('button',{name:'Подключить проект'}).click();
    await app.getByRole('heading',{name:'С чего начнём вашу игру?'}).waitFor();
    await app.locator('[data-field="pitch"]').fill('Тестовое описание игры');
    await app.locator('[data-field="rules"]').fill('Не менять шрифт меню');
    await app.locator('[data-tab="brand"]').click();
    await app.getByRole('button',{name:'+ Добавить образцы'}).click();
    await app.locator('[data-ref-status]').selectOption('approved');
    await app.waitForFunction(()=>document.querySelector('img')?.complete);
    await app.locator('[data-tab="context"]').click();
    await app.getByRole('button',{name:'Обновить файлы проекта'}).click();
    await app.getByRole('heading',{name:'Передать общий контекст'}).waitFor();
    // Preview must not silently modify existing instructions.
    assert.equal(await fs.readFile(path.join(fixture,'AGENTS.md'),'utf8'),'# Existing rules\nKeep original assets.\n');
    await app.getByRole('button',{name:'Обновить эти файлы'}).click();
    await app.waitForFunction(()=>document.querySelector('.badge')?.textContent.includes('ПЕРЕДАНО В ФАЙЛЫ'));
    const saved=await core.loadProject(fixture);
    assert.equal(saved.state.pitch,'Тестовое описание игры');
    assert.equal(saved.state.references[0].status,'approved');
    const markdown=await fs.readFile(path.join(fixture,'.opora/CONTEXT.md'),'utf8');
    assert.match(markdown,/Не менять шрифт меню/);
    assert.match(markdown,/УТВЕРЖДЁН.*Approved menu/);
    assert.ok((await fs.readFile(path.join(fixture,'AGENTS.md'),'utf8')).startsWith('# Existing rules\nKeep original assets.\n'));
    await app.getByRole('button',{name:'Скопировать запрос'}).click();
    await app.waitForTimeout(100);
    assert.match(copied,/Тестовое описание игры/);
    await app.locator('[data-tab="overview"]').click();
    await app.locator('[data-field="goal"]').fill('Сохранить перед закрытием');
    await app.evaluate(()=>window.testClose());
    assert.equal(closed,true);
    assert.equal((await core.loadProject(fixture)).state.goal,'Сохранить перед закрытием');
    assert.deepEqual(errors,[]);
    console.log('PASS desktop bridge: connect, native persistence, reference approval, preview, file sync, clipboard, save on close');
    console.log('PASS no renderer errors. Screenshots: artifacts/overview.png, artifacts/context.png');
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
    await fs.rm(fixture,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error); process.exitCode=1;});
