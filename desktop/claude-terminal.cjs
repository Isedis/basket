// A real PTY. Claude owns authentication, conversation storage and permission prompts.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');

async function executable(file,platform){
  if(!path.isAbsolute(file))return false;
  try {await fs.access(file,platform==='win32'?0:1);return (await fs.stat(file)).isFile();}catch{return false;}
}
function pathDirectories(env,platform){
  const value=env.PATH||env.Path||env.path||'';
  return [...new Set(value.split(platform==='win32'?';':':').map(p=>p.replace(/^"|"$/g,'')).filter(p=>path.isAbsolute(p)))];
}
async function resolveClaude({selected,home,env=process.env,platform=process.platform}={}){
  const dirs=pathDirectories(env,platform);
  const candidates=selected?[selected]:platform==='win32'?[
    path.join(home,'.local','bin','claude.exe'),
    ...dirs.map(p=>path.join(p,'claude.exe')),
    ...(env.APPDATA?[path.join(env.APPDATA,'npm','claude.cmd')]:[]),
    ...dirs.map(p=>path.join(p,'claude.cmd'))
  ]:[path.join(home,'.local','bin','claude'),...dirs.map(p=>path.join(p,'claude'))];
  for(const file of [...new Set(candidates)]){
    if(!await executable(file,platform))continue;
    if(platform==='win32' && /\.cmd$/i.test(file)){
      // Run the official npm entry directly. Never interpolate a shell command.
      const cli=path.join(path.dirname(file),'node_modules','@anthropic-ai','claude-code','cli.js');
      try {if(!(await fs.stat(cli)).isFile())continue;}catch{continue;}
      for(const node of [path.join(path.dirname(file),'node.exe'),...dirs.map(p=>path.join(p,'node.exe'))]){
        if(await executable(node,platform))return {file:node,args:[cli],display:file};
      }
      continue;
    }
    if(platform==='win32' && !/\.exe$/i.test(file))continue;
    return {file,args:[],display:file};
  }
  throw new Error(selected?'Выбранный Claude Code недоступен. Для npm-установки также нужен node.exe в PATH.':'Claude Code не найден. Установите его обычным способом или укажите claude.exe. Для npm-установки выберите claude.cmd; Node.js должен быть в PATH.');
}

class ClaudeTerminal {
  constructor({loadPty=()=>require('node-pty'),onEvent=()=>{}}={}){
    this.loadPty=loadPty;this.onEvent=onEvent;this.session=null;this.pty=null;this.pending='';this.timer=null;
  }
  get active(){return !!this.pty;}
  snapshot(){return this.session?{...this.session}:null;}
  publish(data=''){
    if(!this.session)return;
    this.session.seq++;
    if(data)this.session.output=(this.session.output+data).slice(-1024*1024);
    const {output,...state}=this.session;
    this.onEvent({...state,data});
  }
  flush(){clearTimeout(this.timer);this.timer=null;if(this.pending){const data=this.pending;this.pending='';this.publish(data);}}
  start({root,command,serverName,cols=100,rows=28,resume=false}){
    if(this.active){if(this.session.root!==root)throw new Error('Claude работает в другой игре. Завершите сессию перед сменой проекта.');return this.snapshot();}
    const env={...process.env,TERM:'xterm-256color',COLORTERM:'truecolor',TERM_PROGRAM:'Opora'};
    delete env.ELECTRON_RUN_AS_NODE;
    const instruction=`You are working inside Opora in the selected game directory. The project-local MCP server is ${serverName}. At the beginning of a game task call opora_get_work_context and verify its root matches the current directory. Read source files before editing. Use Opora's task, brandbook and feedback tools; do not approve the brandbook, accept visual results or finish tasks on the user's behalf. After context loss fetch the work context again. Respect Claude Code's normal permission prompts.`;
    const args=[...command.args,...(resume?['--continue']:[]),'--append-system-prompt',instruction];
    const size=this.size(cols,rows);
    const pty=this.loadPty().spawn(command.file,args,{cwd:root,env,name:'xterm-256color',...size,useConpty:true,useConptyDll:true});
    this.pending='';this.pty=pty;
    this.session={id:crypto.randomUUID(),root,command:command.display,status:'running',pid:pty.pid,exitCode:null,seq:0,output:'',...size};
    pty.onData(data=>{this.pending+=data;if(this.pending.length>=65536)this.flush();else if(!this.timer)this.timer=setTimeout(()=>this.flush(),16);});
    pty.onExit(({exitCode})=>{this.flush();this.pty=null;this.session.status='exited';this.session.exitCode=exitCode;this.publish();});
    this.publish();return this.snapshot();
  }
  size(cols,rows){return {cols:Math.max(20,Math.min(500,Math.round(Number(cols)||100))),rows:Math.max(5,Math.min(200,Math.round(Number(rows)||28)))};}
  assert(id){if(!this.pty||id!==this.session?.id)throw new Error('Сессия Claude завершилась.');}
  write({id,data}={}){this.assert(id);if(typeof data!=='string'||data.length>65536)throw new Error('Слишком большой ввод терминала.');this.pty.write(data);}
  resize({id,cols,rows}={}){this.assert(id);const size=this.size(cols,rows);this.pty.resize(size.cols,size.rows);Object.assign(this.session,size);}
  async stop(id){
    if(!this.pty)return this.snapshot();this.assert(id);
    this.session.status='stopping';this.publish();
    const pty=this.pty;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{subscription.dispose();reject(new Error('Claude ещё завершает работу. Подождите и повторите.'));},6000);
      const subscription=pty.onExit(()=>{clearTimeout(timer);subscription.dispose();resolve();});
      try {pty.kill();}catch(error){clearTimeout(timer);subscription.dispose();reject(error);}
    });
    return this.snapshot();
  }
  dispose(){clearTimeout(this.timer);try{this.pty?.kill();}catch{}}
}
module.exports={ClaudeTerminal,resolveClaude};
