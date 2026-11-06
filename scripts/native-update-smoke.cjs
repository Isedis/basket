// Real packaged GUI → button → native worker → new GUI, with an active PTY and MCP.
const {_electron}=require('playwright-core');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),asar=require('@electron/asar');
const assert=require('node:assert/strict'),{execFile}=require('node:child_process'),exec=require('node:util').promisify(execFile);
const {Client}=require('@modelcontextprotocol/client'),{StdioClientTransport}=require('@modelcontextprotocol/client/stdio');
const core=require('../src/core.cjs');
const repo=path.join(__dirname,'..'),pause=ms=>new Promise(r=>setTimeout(r,ms)),hash=data=>crypto.createHash('sha256').update(data).digest('hex');
async function main(){
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'opora-update-'));
  const base=path.join(temp,"original app игра [1] & '"),source=path.join(temp,'app-source'),candidate=path.join(temp,'payload/Opora-win32-x64'),profile=path.join(temp,'profile'),game=path.join(temp,'game'),bin=path.join(temp,'bin');
  let oldApp,newPid,client,brokerPid;let report={platform:process.platform,version:require('../package.json').version};
  const failLaunch=process.env.OPORA_TEST_UPDATE_FAILURE==='launch';
  try{
    await Promise.all([fs.mkdir(source),fs.mkdir(profile),fs.mkdir(game),fs.mkdir(bin),fs.mkdir(path.join(candidate,'resources'),{recursive:true})]);
    await fs.writeFile(path.join(game,'project.godot'),'config_version=5\n[application]\nconfig/name="Update fixture"\n');
    await core.saveProject(game,{version:1,name:'Update fixture',genre:'idle',pitch:'Station',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'Keep all game data',brand:{status:'draft',direction:'Matte',palette:'#123456',fonts:'Game.ttf',avoid:'Neon'},tasks:[],activeTaskId:null,references:[]});
    await fs.writeFile(path.join(profile,'preferences.json'),JSON.stringify({lastProject:game}));
    for(const dir of ['desktop','src','ui','mcp'])await fs.cp(path.join(repo,dir),path.join(source,dir),{recursive:true});
    const lock=require('../package-lock.json');
    for(const [relative,info] of Object.entries(lock.packages))if(relative.startsWith('node_modules/')&&!info.dev&&!info.devOptional){await fs.mkdir(path.dirname(path.join(source,relative)),{recursive:true});await fs.cp(path.join(repo,relative),path.join(source,relative),{recursive:true});}
    const pty=path.join(source,'node_modules/node-pty');
    for(const name of await fs.readdir(pty))if(!['lib','prebuilds','build','package.json','LICENSE'].includes(name))await fs.rm(path.join(pty,name),{recursive:true,force:true});
    for(const name of await fs.readdir(path.join(pty,'prebuilds')))if(name!==process.platform+'-'+process.arch)await fs.rm(path.join(pty,'prebuilds',name),{recursive:true,force:true});
    if(process.platform==='win32')await fs.rm(path.join(pty,'build'),{recursive:true,force:true});
    if(process.platform!=='win32'){
      const file=path.join(source,'desktop/main.cjs'),text=await fs.readFile(file,'utf8'),gate="process.platform==='win32' && app.isPackaged";assert.equal(text.split(gate).length,2);await fs.writeFile(file,text.replace(gate,'app.isPackaged'));
      const updater=path.join(source,'desktop/native-updater.cjs'),code=await fs.readFile(updater,'utf8');
      await fs.writeFile(updater,code.replace('schemaVersion:2,installId:',"schemaVersion:2,launchArgs:['--no-sandbox','--ozone-platform=headless'],installId:"));
    }
    const version=require('../package.json').version,proof=path.join(temp,'proof.json');
    const lifecycle=path.join(temp,'lifecycle.log');
    const bootstrap=`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(profile)});for(const event of ['before-quit','will-quit','quit','window-all-closed'])app.on(event,()=>require('node:fs').appendFileSync(${JSON.stringify(lifecycle)},process.pid+' '+event+'\\n'));${process.platform==='linux'?"app.commandLine.appendSwitch('no-sandbox');app.commandLine.appendSwitch('ozone-platform','headless');":''}\nconst updateJob=process.env.OPORA_UPDATE_JOB;${failLaunch?'if(updateJob)process.exit(19);':''}\nrequire('./desktop/main.cjs');\nif(updateJob){const timer=setInterval(async()=>{try{const win=BrowserWindow.getAllWindows()[0];if(!win)return;const name=await win.webContents.executeJavaScript('document.querySelector("#header-name")?.textContent');if(name!=='Update fixture')return;const state=await win.webContents.executeJavaScript('window.opora.claudeState()');if(!state)return;await win.webContents.executeJavaScript('window.opora.claudeInput('+JSON.stringify({id:state.id,data:'after\\r'})+')');require('node:fs').writeFileSync(${JSON.stringify(proof)},JSON.stringify({pid:process.pid,name,version:require('./package.json').version,terminal:state}));clearInterval(timer);}catch{}},200);}`;
    const pkg={...require('../package.json'),main:'test-entry.cjs'};await fs.writeFile(path.join(source,'test-entry.cjs'),bootstrap);
    pkg.version=version;await fs.writeFile(path.join(source,'package.json'),JSON.stringify(pkg));
    await asar.createPackageWithOptions(source,path.join(candidate,'resources/app.asar'),{unpackDir:path.join('node_modules','node-pty')});
    await fs.cp(path.dirname(require('electron')),base,{recursive:true});
    const electronName=process.platform==='win32'?'electron.exe':'electron';await fs.rename(path.join(base,electronName),path.join(base,'Opora.exe'));
    pkg.version=process.env.OPORA_UPDATE_FROM||'0.11.1';await fs.writeFile(path.join(source,'package.json'),JSON.stringify(pkg));
    await asar.createPackageWithOptions(source,path.join(base,'resources/app.asar'),{unpackDir:path.join('node_modules','node-pty')});
    const runtime={version,runtimeVersion:require('../package.json').devDependencies.electron,appSha256:hash(await fs.readFile(path.join(candidate,'resources/app.asar'))),files:[],appFiles:[]};
    for(const file of await fs.readdir(base,{recursive:true}))if(file!=='Opora.exe'&&!file.startsWith('resources'+path.sep+'app.asar')&&(await fs.lstat(path.join(base,file))).isFile())runtime.files.push({name:file.split(path.sep).join('/'),sha256:hash(await fs.readFile(path.join(base,file)))});
    for(const file of await fs.readdir(path.join(candidate,'resources/app.asar.unpacked'),{recursive:true}))if((await fs.lstat(path.join(candidate,'resources/app.asar.unpacked',file))).isFile())runtime.appFiles.push({name:'resources/app.asar.unpacked/'+file.split(path.sep).join('/'),sha256:hash(await fs.readFile(path.join(candidate,'resources/app.asar.unpacked',file)))});
    await fs.writeFile(path.join(candidate,'runtime.json'),JSON.stringify(runtime));const archive=path.join(temp,'update.zip');
    await exec('python',['-c',"import pathlib,zipfile,sys; r=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(r.parent)) for p in r.rglob('*') if p.is_file()]; z.close()",candidate,archive]);
    const bytes=await fs.readFile(archive),digest=hash(bytes),manifest={schemaVersion:1,version,commit:'a'.repeat(40),size:1,sha256:hash(Buffer.from('x')),parts:[{name:'Opora-Windows.zip.part01',size:1,sha256:hash(Buffer.from('x'))}],appPatch:{runtimeVersion:runtime.runtimeVersion,size:bytes.length,sha256:digest,parts:[{name:'Opora-Windows.zip.part01',size:bytes.length,sha256:digest}]}};
    const cli=path.join(bin,'node_modules/@anthropic-ai/claude-code/cli.js');await fs.mkdir(path.dirname(cli),{recursive:true});
    await fs.writeFile(cli,`process.stdin.setRawMode(true);process.stdin.resume();process.stdout.write('CLAUDE_FIXTURE_READY\\r\\n');let input='';process.stdin.on('data',chunk=>{for(const char of chunk.toString()){if(char==='\\r'){process.stdout.write('RECEIVED:'+input+'\\r\\n');input='';}else input+=char;}});`);
    const shim=path.join(bin,process.platform==='win32'?'claude.cmd':'claude');
    if(process.platform==='win32'){await fs.writeFile(shim,'official npm shim fixture');await fs.copyFile(process.execPath,path.join(bin,'node.exe'));}
    else await fs.writeFile(shim,'#!/bin/sh\nexec '+"'"+process.execPath.replace(/'/g,"'\\''")+"' "+"'"+cli.replace(/'/g,"'\\''")+"' \"$@\"\n",{mode:0o755});
    await fs.writeFile(path.join(profile,'claude-terminal.json'),JSON.stringify({executable:shim}));
    oldApp=await _electron.launch({executablePath:path.join(base,'Opora.exe'),args:process.platform==='linux'?['--no-sandbox','--ozone-platform=headless']:[],env:{...process.env,CODEX_HOME:path.join(temp,'codex')},timeout:45000});
    const oldPid=await oldApp.evaluate(()=>process.pid);
    const page=await oldApp.firstWindow();await page.waitForFunction(()=>document.querySelector('#header-name')?.textContent==='Update fixture');
    await oldApp.evaluate(({session},{manifest,archive})=>{const raw=process.getBuiltinModule('fs');session.fromPartition('opora-updates').fetch=async url=>new Response(String(url).includes('latest.json')?JSON.stringify(manifest):raw.readFileSync(archive),{status:200});},{manifest,archive});
    await page.locator('.topbar [data-action="claude-open"]').click();await page.waitForFunction(()=>document.querySelector('.xterm-screen')?.textContent.includes('CLAUDE_FIXTURE_READY'));
    const terminal=await page.evaluate(()=>window.opora.claudeState());brokerPid=JSON.parse(await fs.readFile(path.join(profile,'terminal-broker.json'),'utf8')).pid;
    const config=JSON.parse(await fs.readFile(path.join(game,'.mcp.json'),'utf8')).mcpServers;const spec=Object.values(config)[0];
    client=new Client({name:'update-live-client',version:'1.0.0'},{capabilities:{}});await client.connect(new StdioClientTransport({command:spec.command,args:spec.args,env:spec.env,stderr:'pipe'}));
    await client.callTool({name:'opora_get_work_context',arguments:{}});
    await page.locator('[data-action="updates"]').click();await page.locator('[data-action="install-update"]').click();
    const deadline=Date.now()+90000;let result;
    while(Date.now()<deadline){try{result=JSON.parse(await fs.readFile(path.join(profile,'update-result.json'),'utf8'));}catch{}if(result?.status==='installed'||result?.status==='failed'||result?.status==='needs_attention')break;
      if(!page.isClosed()){const message=await page.locator('#modal-content').innerText().catch(()=>'');if(message.includes('Обновление не завершено'))throw new Error(message);}
      await pause(100);}
    assert.ok(result,result?.error||'No update result');
    report.oldProcess={pid:oldPid,pageClosed:page.isClosed()};
    try{report.lifecycle=await fs.readFile(lifecycle,'utf8');}catch{}
    if(result.status!=='installed'){
      for(const file of ['worker-launch.json','progress.json','ready.json','plan.json'])try{const value=JSON.parse(await fs.readFile(path.join(result.job,file),'utf8'));report[file]={pid:value.pid,parentPid:value.parentPid,expectedPid:value.expectedPid,phase:value.phase,tokenMatches:file==='ready.json'?value.token===JSON.parse(await fs.readFile(path.join(result.job,'plan.json'),'utf8')).token:undefined};}catch{}
    }
    if(failLaunch){assert.equal(result.status,'failed');assert.equal(result.rollback,'restored');newPid=result.recoveredPid;report.rollback=true;}
    else{
      if(result.status!=='installed'){try{report.startupLog=(await fs.readFile(path.join(result.job,'gui-startup.log'),'utf8')).slice(-5000);console.error(report.startupLog);}catch{}newPid=result.recoveredPid;}
      assert.equal(result.status,'installed',JSON.stringify(result));const ack=JSON.parse(await fs.readFile(path.join(result.job,'launch-ack.json'),'utf8'));newPid=ack.pid;
      let ui;for(let n=0;n<100;n++){try{ui=JSON.parse(await fs.readFile(proof,'utf8'));break;}catch{}await pause(100);}
      assert.equal(ui?.version,version);assert.equal(ui?.terminal.id,terminal.id);assert.equal(ui?.terminal.pid,terminal.pid);assert.equal(ui?.name,'Update fixture');report.terminalSurvived=true;
      assert.notEqual(result.directory,base);assert.ok((await fs.stat(path.join(base,'Opora.exe'))).isFile());
      const statOld=await fs.stat(path.join(base,'Opora.exe')),statNew=await fs.stat(path.join(result.directory,'Opora.exe'));report.hardlinkedRuntime=statOld.dev===statNew.dev&&statOld.ino===statNew.ino;
      assert.equal(hash(await fs.readFile(path.join(base,'Opora.exe'))),hash(await fs.readFile(path.join(result.directory,'Opora.exe'))));
      report.localRuntimeReused=true;
    }
    const live=await client.callTool({name:'opora_get_work_context',arguments:{}});assert.ok(!live.isError);report.mcpSurvived=true;
    assert.equal((await core.loadProject(game)).state.rules,'Keep all game data');report.dataPreserved=true;
    const pointer=JSON.parse(await fs.readFile(path.join(result.home,'opora-active.json'),'utf8'));assert.equal(pointer.directory,failLaunch?base:result.directory);
    console.log('PASS native button update '+JSON.stringify(report));
  }catch(error){report.error=error.message;console.error(error);throw error;}
  finally{
    if(process.env.OPORA_REPORT)await fs.writeFile(process.env.OPORA_REPORT,JSON.stringify(report,null,2));
    if(client)await client.close().catch(()=>{});
    if(oldApp)await oldApp.close().catch(()=>{});
    if(newPid)try{process.kill(newPid);}catch{}
    if(brokerPid)try{process.kill(brokerPid);}catch{}
    await pause(400);await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});
  }
}
main().catch(()=>{process.exitCode=1;});
