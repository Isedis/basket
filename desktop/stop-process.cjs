const path=require('node:path'),{spawn}=require('node:child_process');
// Kill only the owned Godot process tree. In particular, Windows console
// launchers must not leave the graphical Godot child behind on cancellation.
function stop(child,force=false){
 if(!child?.pid||child.exitCode!==null||child.signalCode!==null)return;
 if(process.platform==='win32'){
  const tool=path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe');
  const killer=spawn(tool,['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>child.kill());
 }else{try{process.kill(-child.pid,force?'SIGKILL':'SIGTERM');}catch{try{child.kill(force?'SIGKILL':'SIGTERM');}catch{}}}
}
module.exports={stop};
