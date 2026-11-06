const busy=state=>['starting','working','permission','stopping'].includes(state?.status);
async function restore(modern,legacy){
  const previous=Array.isArray(legacy)?legacy:[legacy];
  const read=async host=>{try{return await host.connect()?await host.rpc('chat:state'):null;}catch{host.dispose();return null;}};
  const [current,...old]=await Promise.all([read(modern),...previous.map(read)]);
  const active=old.findIndex(busy);
  if(active>=0&&!busy(current)){modern.dispose();previous.forEach((host,i)=>{if(i!==active)host.dispose();});return {host:previous[active],state:old[active]};}
  previous.forEach(host=>host.dispose());return {host:modern,state:current};
}
async function forOperation(current,modern,op){
  if(current===modern||!['chat:new','chat:open','chat:send'].includes(op))return current;
  const state=await current.rpc('chat:state');
  if(busy(state))return current;
  // Old host finishes its live turn first; its next idle timeout releases the old copy.
  await current.detach();return modern;
}
module.exports={restore,forOperation};
