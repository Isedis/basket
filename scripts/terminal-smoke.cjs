const {_electron}=require('playwright-core');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {saveProject}=require('../src/core.cjs');

async function main(){
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'opora terminal & игра-'));
  const project=path.join(temp,'игра [1]'),profile=path.join(temp,'profile'),bin=path.join(temp,'bin');
  let app;
  try{
    await Promise.all([fs.mkdir(project),fs.mkdir(profile),fs.mkdir(bin)]);
    await fs.writeFile(path.join(project,'project.godot'),'config_version=5\n[application]\nconfig/name="Terminal fixture"\n');
    await saveProject(project,{version:1,name:'Terminal fixture',genre:'idle',pitch:'Station',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'Keep buttons',brand:{status:'draft',direction:'Matte',palette:'#123456',fonts:'Game.ttf',avoid:'Neon'},tasks:[{id:'menu',title:'Меню',acceptance:'Keyboard navigation',status:'active'}],activeTaskId:'menu',references:[]});
    await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify({lastProject:project}));
    // A local interactive stand-in; no Claude login or model request is made.
    await fs.writeFile(path.join(bin,'claude'),`#!/usr/bin/env node
const fs=require('node:fs');
fs.appendFileSync(process.env.OPORA_FIXTURE_LOG,JSON.stringify({cwd:process.cwd(),argv:process.argv.slice(2),tty:[process.stdin.isTTY,process.stdout.isTTY]})+'\\n');
process.stdin.setRawMode(true);process.stdin.resume();
process.stdout.write('\\x1b[2J\\x1b[H\\x1b[32mCLAUDE_FIXTURE_READY\\x1b[0m\\r\\nРазрешить? [y/n]\\r\\n');
process.stdout.write('\\x1b]52;c;U0hPVUxEX05PVF9DT1BZ\\x07');
let input='';process.stdin.on('data',data=>{for(const char of data.toString()){
 if(char==='\\x03'){process.stdout.write('\\r\\nINTERRUPTED\\r\\n');continue;}
 if(char==='\\x0b'){process.stdout.write('\\r\\nCTRL_K_RECEIVED\\r\\n');continue;}
 if(char==='\\r'||char==='\\n'){process.stdout.write('\\r\\nRECEIVED:'+input+'\\r\\n');if(input==='exit')process.exit(0);input='';}
 else{input+=char;process.stdout.write(char);}
}});
`,{mode:0o755});
    const entry=path.join(temp,'entry.cjs'),log=path.join(temp,'launch.jsonl');
    await fs.writeFile(entry,`require('electron').app.setPath('userData',${JSON.stringify(profile)});require(${JSON.stringify(path.join(__dirname,'../desktop/main.cjs'))});`);
    app=await _electron.launch({executablePath:require('electron'),args:[entry,'--no-sandbox','--ozone-platform=headless'],env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,OPORA_FIXTURE_LOG:log},timeout:30000});
    const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>document.querySelector('#header-name').textContent==='Terminal fixture');
    await app.evaluate(async({clipboard})=>{await clipboard.writeText('clipboard preserved');});
    await page.locator('.topbar [data-action="claude-open"]').click();await page.locator('[data-dock="terminal"]').click();
    await page.locator('[data-terminal="start"]').click();await page.waitForFunction(()=>document.querySelector('.xterm-screen')?.textContent.includes('CLAUDE_FIXTURE_READY'));
    const launched=JSON.parse((await fs.readFile(log,'utf8')).trim());
    assert.equal(launched.cwd,project);assert.deepEqual(launched.tty,[true,true]);assert.ok(launched.argv.includes('--append-system-prompt'));assert.match(launched.argv.at(-1),/opora_get_work_context/);assert.ok(!launched.argv.some(a=>a.includes('skip-permissions')));
    assert.ok(Object.keys(JSON.parse(await fs.readFile(path.join(project,'.mcp.json'),'utf8')).mcpServers).some(k=>k.startsWith('opora-')));
    assert.equal(await app.evaluate(async({clipboard})=>clipboard.readText()),'clipboard preserved');
    await page.locator('.xterm-helper-textarea').focus();await page.keyboard.type('y');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.xterm-screen').textContent.includes('RECEIVED:y'));
    await app.evaluate(async({clipboard})=>{await clipboard.writeText('текст из буфера');});
    await page.keyboard.press('Control+Shift+v');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.xterm-screen').textContent.includes('RECEIVED:текст из буфера'));
    await page.keyboard.press('Control+k');await page.keyboard.press('Control+c');
    await page.waitForFunction(()=>document.querySelector('.xterm-screen').textContent.includes('CTRL_K_RECEIVED')&&document.querySelector('.xterm-screen').textContent.includes('INTERRUPTED'));
    assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
    const session=await page.evaluate(()=>window.opora.claudeState());
    const switchError=await page.evaluate(()=>window.opora.openProject().catch(e=>e.message));assert.match(switchError,/Завершите|Остановите/);
    await page.locator('[data-dock="hide"]').click();await page.locator('nav [data-tab="brand"]').click();
    await page.locator('[data-field="brand.direction"]').fill('Persistent session style');
    await page.locator('.topbar [data-action="claude-open"]').click();
    assert.equal((await page.evaluate(()=>window.opora.claudeState())).id,session.id);assert.equal((await fs.readFile(log,'utf8')).trim().split('\n').length,1);
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#header-name').textContent==='Terminal fixture'&&document.querySelector('.xterm-screen')?.textContent.includes('CLAUDE_FIXTURE_READY'));
    assert.equal((await page.evaluate(()=>window.opora.claudeState())).id,session.id);
    await page.locator('[data-dock="expand"]').click();
    await page.locator('[data-terminal="prompt"]').click();
    await page.waitForFunction(()=>document.querySelector('.xterm-screen').textContent.includes('Выполни выбранную задачу'));
    assert.ok(!(await page.locator('.xterm-screen').textContent()).includes('RECEIVED:Работаем'));
    await page.screenshot({path:path.join(__dirname,'../artifacts/claude-terminal.png')});
    await page.locator('[data-terminal="stop"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-terminal="status"]').textContent.startsWith('ЗАВЕРШЁН'));
    await page.locator('[data-terminal="resume"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-terminal="status"]').textContent==='ПРОЦЕСС РАБОТАЕТ');
    let launches=[];for(let n=0;n<100;n++){launches=(await fs.readFile(log,'utf8')).trim().split('\n').map(JSON.parse);if(launches.length===2)break;await new Promise(resolve=>setTimeout(resolve,25));}
    assert.equal(launches.length,2);assert.ok(launches[1].argv.includes('--continue'));
    await page.locator('.xterm-helper-textarea').focus();await page.keyboard.type('exit');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('[data-terminal="status"]').textContent==='ЗАВЕРШЁН / 0');
    await page.locator('[data-terminal="start"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-terminal="status"]').textContent==='ПРОЦЕСС РАБОТАЕТ');
    await app.evaluate(async({dialog,BrowserWindow})=>{dialog.showMessageBox=async()=>({response:0});BrowserWindow.getAllWindows()[0].close();});
    assert.equal((await page.evaluate(()=>window.opora.claudeState())).status,'running');
    const closed=app.waitForEvent('close');
    await app.evaluate(async({dialog,BrowserWindow})=>{dialog.showMessageBox=async()=>({response:1});BrowserWindow.getAllWindows()[0].close();});
    await closed;app=null;
    assert.deepEqual(errors,[]);
    console.log('PASS Electron PTY: TTY, Unicode, permission input, hotkeys, MCP config, clipboard isolation, persistent dock, task insertion, stop and resume.');
  }finally{if(app){await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close();}await fs.rm(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
