const net=require('node:net'),crypto=require('node:crypto'),path=require('node:path'),fs=require('node:fs/promises');
class GuiInstance{
  constructor(profile,onFocus){this.endpoint=process.platform==='win32'?'\\\\.\\pipe\\opora-gui-v3-'+crypto.createHash('sha256').update(profile.toLowerCase()).digest('hex').slice(0,24):path.join(profile,'gui-v3.sock');this.onFocus=onFocus;this.server=null;}
  async acquire(){
    for(let attempt=0;attempt<2;attempt++){
      const server=net.createServer(socket=>{socket.once('data',()=>this.onFocus());socket.end();});
      try{await new Promise((ok,no)=>{server.once('error',no);server.listen(this.endpoint,ok);});this.server=server;return true;}
      catch(error){if(error.code!=='EADDRINUSE')throw error;}
      try{await new Promise((ok,no)=>{const socket=net.connect(this.endpoint);socket.setTimeout(1500,()=>socket.destroy(new Error('Окно не отвечает.')));socket.once('error',no);socket.once('connect',()=>{socket.end('focus');ok();});});return false;}
      catch(error){if(process.platform==='win32'||!['ENOENT','ECONNREFUSED'].includes(error.code))throw error;const stat=await fs.lstat(this.endpoint).catch(()=>null);if(stat?.isSocket())await fs.unlink(this.endpoint);}
    }
    throw new Error('Не удалось открыть рабочее окно.');
  }
  async release(){if(!this.server)return;const server=this.server;this.server=null;await new Promise(resolve=>server.close(resolve));}
}
module.exports={GuiInstance};
