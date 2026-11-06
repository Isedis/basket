const net=require('node:net'),fs=require('node:fs/promises'),{spawn}=require('node:child_process');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
class TerminalClient{
  constructor({record,entry,executable,native,onEvent=()=>{}}){Object.assign(this,{record,entry,executable,native,onEvent});this.state=null;this.socket=null;this.requests=new Map();this.id=0;this.connecting=null;this.disposed=false;}
  get active(){return !!this.state&&this.state.status!=='exited';}
  snapshot(){return this.state;}
  async connect({start=false}={}){
    if(this.socket&&!this.socket.destroyed)return true;
    if(this.connecting)return this.connecting;
    this.connecting=this.open(start).finally(()=>{this.connecting=null;});return this.connecting;
  }
  async open(start){
    let info;try{info=JSON.parse(await fs.readFile(this.record,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    const alive=record=>{try{process.kill(record.pid,0);return true;}catch(e){return e.code==='EPERM';}};
    if(info&&!alive(info)){await fs.rm(this.record,{force:true});info=null;}
    if(!info&&start){
      await fs.mkdir(require('node:path').dirname(this.record),{recursive:true});
      const child=spawn(this.executable,[this.entry,this.record,...(this.native?[this.native]:[])],{cwd:require('node:path').dirname(this.record),env:{...process.env,ELECTRON_RUN_AS_NODE:'1',ELECTRON_NO_ATTACH_CONSOLE:'1'},stdio:'ignore',detached:true,windowsHide:true});
      await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
      const deadline=Date.now()+15000;
      while(Date.now()<deadline){try{info=JSON.parse(await fs.readFile(this.record,'utf8'));if(alive(info))break;}catch{}await pause(50);}
      if(!info)throw new Error('Не удалось запустить локальный терминал Claude.');
    }
    if(!info)return false;
    if(info.schemaVersion!==1||!Number.isSafeInteger(info.port)||info.port<1||info.port>65535||!/^[a-f0-9]{64}$/.test(info.token))throw new Error('Повреждены настройки локального терминала.');
    const socket=net.createConnection({host:'127.0.0.1',port:info.port});
    socket.setEncoding('utf8');
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.destroy();reject(new Error('Локальный терминал не отвечает.'));},3000);socket.once('error',error=>{clearTimeout(timer);reject(error);});socket.once('connect',()=>{clearTimeout(timer);resolve();});});
    this.socket=socket;this.disposed=false;let buffer='';
    socket.on('error',()=>{});socket.on('data',chunk=>{buffer+=chunk.toString('utf8');if(buffer.length>8*1024*1024){socket.destroy();return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let packet;try{packet=JSON.parse(line);}catch{socket.destroy();return;}
      if(packet.event){if(this.state?.id!==packet.event.id)this.state={...packet.event,output:''};else this.state={...this.state,...packet.event};if(packet.event.data)this.state.output=(this.state.output+packet.event.data).slice(-1024*1024);this.onEvent(packet.event);}
      else{const pending=this.requests.get(packet.id);if(pending){this.requests.delete(packet.id);clearTimeout(pending.timer);packet.error?pending.reject(new Error(packet.error)):pending.resolve(packet.result);}}
    }});
    socket.on('close',()=>{if(this.socket===socket)this.socket=null;for(const request of this.requests.values()){clearTimeout(request.timer);request.reject(new Error('Связь с терминалом прервана.'));}this.requests.clear();if(!this.disposed&&this.active)setTimeout(()=>this.connect().then(connected=>{if(connected&&this.state)this.onEvent({...this.state,snapshot:this.state});}).catch(()=>{}),500);});
    this.state=await this.rpc('hello',null,info.token);return true;
  }
  rpc(op,value,token){return new Promise((resolve,reject)=>{if(!this.socket||this.socket.destroyed)return reject(new Error('Терминал не подключён.'));const id=++this.id,timer=setTimeout(()=>{this.requests.delete(id);reject(new Error('Терминал не ответил вовремя.'));},20000);this.requests.set(id,{resolve,reject,timer});this.socket.write(JSON.stringify({id,op,value,...(token?{token}: {})})+'\n');});}
  async getState(){if(!await this.connect())return null;this.state=await this.rpc('state');return this.state;}
  async start(value){await this.connect({start:true});this.state=await this.rpc('start',value);return this.state;}
  async write(value){await this.connect();return this.rpc('input',value);}
  async resize(value){await this.connect();return this.rpc('resize',value);}
  async stop(value){if(!await this.connect())return this.state;this.state=await this.rpc('stop',value);return this.state;}
  dispose(){this.disposed=true;this.socket?.end();}
  async detach(){
    this.disposed=true;if(!this.socket||this.socket.destroyed)return;
    const socket=this.socket;
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Терминал ещё передаёт ввод. Повторите обновление.')),3000);socket.end(()=>{clearTimeout(timer);resolve();});});
  }
}
module.exports={TerminalClient};
