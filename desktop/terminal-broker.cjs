// A user-local PTY host. GUI updates disconnect from it; Claude keeps running.
const net=require('node:net'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {ClaudeTerminal}=require('./claude-terminal.cjs');
const {ClaudeChat}=require('./claude-chat.cjs');
async function serve(record,native){
  await fs.mkdir(path.dirname(record),{recursive:true});
  const lockFile=record+'.lock';let lock;
  try{lock=await fs.open(lockFile,'wx');}catch(error){if(error.code!=='EEXIST')throw error;let owner;try{owner=JSON.parse(await fs.readFile(lockFile,'utf8'));}catch{}if(owner?.pid){try{process.kill(owner.pid,0);return;}catch(e){if(e.code==='EPERM')return;}}else return;await fs.rm(lockFile,{force:true});lock=await fs.open(lockFile,'wx');}
  await lock.writeFile(JSON.stringify({pid:process.pid}));
  const token=crypto.randomBytes(32).toString('hex'),clients=new Set();let idle;let mutations=Promise.resolve();
  const send=(socket,value)=>{if(socket.destroyed)return;if(socket.writableLength>4*1024*1024){socket.destroy();return;}socket.write(JSON.stringify(value)+'\n');};
  const keepAlive=()=>{clearTimeout(idle);if(!terminal.active&&!chat.active&&!clients.size)idle=setTimeout(()=>server.close(()=>process.exit(0)),2500);};
  const terminal=new ClaudeTerminal({loadPty:()=>require(native||'node-pty'),onEvent:event=>{for(const socket of clients)send(socket,{event});keepAlive();}});
  const chat=new ClaudeChat({directory:path.join(path.dirname(record),'claude-chats'),onEvent:chatEvent=>{for(const socket of clients)send(socket,{chatEvent});keepAlive();}});
  const server=net.createServer(socket=>{
    socket.setEncoding('utf8');
    let buffer='',authenticated=false;const authTimeout=setTimeout(()=>{if(!authenticated)socket.destroy();},3000);
    socket.on('error',()=>{});socket.on('close',()=>{clearTimeout(authTimeout);clients.delete(socket);keepAlive();});
    socket.on('data',chunk=>{buffer+=chunk.toString('utf8');if(buffer.length>8*1024*1024){socket.destroy();return;}let boundary;
      while((boundary=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,boundary);buffer=buffer.slice(boundary+1);let request;try{request=JSON.parse(line);}catch{socket.destroy();return;}
        if(!authenticated){if(request.token!==token||request.op!=='hello'){socket.destroy();return;}authenticated=true;clearTimeout(authTimeout);clients.add(socket);keepAlive();}
        if(!Number.isSafeInteger(request.id)){socket.destroy();return;}
        Promise.resolve().then(()=>{
          if(request.op==='chat:auto-approve')return chat.setAutoApprove(request.value);
          if(request.op==='chat:usage')return chat.refreshUsage(request.value?.command);
          if(request.op==='chat:state')return chat.snapshot();
          if(request.op==='chat:list')return chat.list(request.value.root);
          if(['chat:new','chat:open','chat:send'].includes(request.op)){const run=()=>request.op==='chat:new'?chat.create(request.value.root):request.op==='chat:open'?chat.open(request.value.root,request.value.id):chat.send(request.value);const result=mutations.then(run);mutations=result.catch(()=>{});return result;}
          if(request.op==='chat:answer')return chat.answer(request.value);
          if(request.op==='chat:stop')return chat.stop(request.value.id);
          if(request.op==='hello'||request.op==='state')return terminal.snapshot();
          if(request.op==='start')return terminal.start(request.value);
          if(request.op==='input')return terminal.write(request.value);
          if(request.op==='resize')return terminal.resize(request.value);
          if(request.op==='stop')return terminal.stop(request.value);
          throw new Error('Неизвестная команда терминала.');
        }).then(result=>send(socket,{id:request.id,result:result??null}),error=>send(socket,{id:request.id,error:error.message}));
      }
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const temp=record+'.'+process.pid+'.tmp';await fs.writeFile(temp,JSON.stringify({schemaVersion:1,pid:process.pid,port:server.address().port,token,executable:process.execPath}),{mode:0o600,flag:'wx'});await fs.rename(temp,record);
  keepAlive();
  const cleanup=async()=>{if(chat.active)await chat.stop(chat.current.id);terminal.dispose();server.close();for(const socket of clients)socket.destroy();await lock.close();await fs.rm(lockFile,{force:true});await fs.rm(record,{force:true});};
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>cleanup().finally(()=>process.exit(0)));
  process.on('exit',()=>{try{require('node:fs').unlinkSync(lockFile);}catch{}try{require('node:fs').unlinkSync(record);}catch{}});
}
if(require.main===module)serve(process.argv[2],process.argv[3]).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={serve};
