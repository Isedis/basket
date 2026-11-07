const {spawn}=require('node:child_process');
/* An empty streaming input initializes the CLI control channel without a model prompt. */
async function probe({loadSdk,root,command,sessionId,timeoutMs=5000}){
 const sdk=await loadSdk(),controller=new AbortController();let wake;const prompt={async *[Symbol.asyncIterator](){await new Promise(resolve=>{wake=resolve;if(controller.signal.aborted)resolve();else controller.signal.addEventListener('abort',resolve,{once:true});});}};
 const env={...process.env};for(const key of ['ELECTRON_RUN_AS_NODE','OPORA_UPDATE_JOB','OPORA_UPDATE_TOKEN'])delete env[key];
 const query=sdk.query({prompt,options:{cwd:root,pathToClaudeCodeExecutable:command.args[0]||command.file,abortController:controller,persistSession:false,settingSources:[],tools:[],...(sessionId?{resume:sessionId}:{}),env,spawnClaudeCodeProcess:options=>{const child=spawn(command.file,options.args,{cwd:options.cwd,env,stdio:['pipe','pipe','pipe'],windowsHide:true,signal:options.signal});child.stderr?.on('data',()=>{});return child;}}});
 const drain=(async()=>{try{for await(const _ of query){}}catch{}})();let timer;
 try{const method=query.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET;if(typeof method!=='function')return null;return await Promise.race([method.call(query,{skipBehaviors:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Claude не ответил на запрос лимитов.')),timeoutMs);})]);}
 finally{clearTimeout(timer);controller.abort();wake?.();query.close?.();await drain;}
}
module.exports={probe};
