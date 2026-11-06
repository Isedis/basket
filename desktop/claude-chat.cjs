const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
const busy=status=>['starting','working','permission','stopping'].includes(status);
class ClaudeChat{
  constructor({directory,onEvent=()=>{},loadSdk=()=>import('@anthropic-ai/claude-agent-sdk')}){Object.assign(this,{directory,onEvent,loadSdk});this.current=null;this.pending=new Map();this.controller=null;this.query=null;this.timer=null;this.dirty=new Set();this.saving=Promise.resolve();}
  get active(){return !!this.controller||busy(this.current?.status);}
  folder(root){return path.join(this.directory,crypto.createHash('sha256').update(root).digest('hex').slice(0,32));}
  file(root,id){if(!uuid(id))throw new Error('Некорректный разговор.');return path.join(this.folder(root),id+'.json');}
  snapshot(){if(!this.current)return null;const messages=this.current.messages.slice(-100);while(messages.length>1&&Buffer.byteLength(JSON.stringify(messages))>2*1024*1024)messages.shift();return {...this.current,messages,hasEarlierMessages:!!this.current.hasEarlierMessages||messages.length<this.current.messages.length,permissions:[...this.pending.values()].map(p=>p.public)};}
  publish(message){if(!this.current)return;if(message)this.dirty.add(message.id);if(this.timer)return;this.timer=setTimeout(()=>{this.timer=null;for(const id of this.dirty){const message=this.current.messages.find(m=>m.id===id);this.onEvent({...this.meta(),message});}this.dirty.clear();this.onEvent(this.meta());},45);}
  meta(){const c=this.current;return c?{id:c.id,root:c.root,title:c.title,status:c.status,sessionId:c.sessionId,activity:c.activity,error:c.error,context:c.context,permissions:[...this.pending.values()].map(p=>p.public)}:null;}
  save(){if(!this.current)return Promise.resolve();const c=structuredClone(this.current),file=this.file(c.root,c.id);while(c.messages.length>1&&Buffer.byteLength(JSON.stringify(c))>6*1024*1024){c.messages.shift();c.hasEarlierMessages=true;}this.saving=this.saving.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(c),{flag:'wx',mode:0o600});try{await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}});return this.saving;}
  async list(root){
    const folder=this.folder(root);let names=[];try{names=await fs.readdir(folder);}catch(e){if(e.code!=='ENOENT')throw e;}
    const result=[];for(const name of names.filter(n=>/^[a-f0-9-]{36}\.json$/i.test(n)).slice(0,500)){try{const c=JSON.parse(await fs.readFile(path.join(folder,name),'utf8'));if(c.root===root)result.push({id:c.id,title:c.title,updatedAt:c.updatedAt,sessionId:c.sessionId});}catch{}}
    try{const sdk=await this.loadSdk();if(sdk.listSessions){const sessions=await sdk.listSessions({dir:root,limit:50});for(const session of sessions){if(!uuid(session.sessionId)||!session.cwd)continue;const cwd=await fs.realpath(session.cwd).catch(()=>null);if(cwd!==root||result.some(c=>c.sessionId===session.sessionId))continue;result.push({id:session.sessionId,external:true,title:session.summary||session.firstPrompt||'Разговор Claude',updatedAt:new Date(session.lastModified).toISOString(),sessionId:session.sessionId});}}}catch{}
    return result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100);
  }
  async create(root){if(this.active)throw new Error('Дождитесь ответа или остановите текущую работу.');this.current={id:crypto.randomUUID(),root,title:'Новый разговор',sessionId:null,messages:[],status:'idle',activity:'Готов к сообщению',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await this.save();this.publish();return this.snapshot();}
  async open(root,id){if(this.active&&(this.current.root!==root||this.current.id!==id))throw new Error('Сначала остановите текущую работу.');if(this.current?.id===id&&this.current.root===root)return this.snapshot();const file=this.file(root,id);let stat;try{stat=await fs.stat(file);}catch(error){if(error.code!=='ENOENT')throw error;const item=(await this.list(root)).find(c=>c.id===id&&c.external);if(!item)throw new Error('Разговор не найден в этой игре.');const sdk=await this.loadSdk();const messages=await sdk.getSessionMessages(id,{dir:root,limit:100});await this.create(root);this.current.sessionId=id;this.current.title=item.title;this.current.messages=messages.filter(m=>['user','assistant'].includes(m.type)).map(m=>({id:m.uuid||crypto.randomUUID(),role:m.type,time:item.updatedAt,text:typeof m.message?.content==='string'?m.message.content:(m.message?.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')})).filter(m=>m.text).map(m=>({...m,text:m.text.slice(0,131072)}));await this.save();return this.snapshot();}if(stat.size>16*1024*1024)throw new Error('История разговора слишком велика.');const c=JSON.parse(await fs.readFile(file,'utf8'));if(c.root!==root||c.id!==id||!Array.isArray(c.messages))throw new Error('Разговор относится к другой игре.');if(busy(c.status)){c.status='interrupted';c.activity='Прошлая работа прервана. Можно продолжить разговор.';}this.current=c;this.publish();return this.snapshot();}
  message(role,text,id=crypto.randomUUID()){const m={id,role,text:String(text).slice(0,131072),time:new Date().toISOString()};this.current.messages.push(m);this.current.messages=this.current.messages.slice(-200);this.publish(m);return m;}
  async send({root,id,text,context,command,serverName,serverSpec}){
    if(this.active)throw new Error('Claude ещё работает.');if(typeof text!=='string'||!text.trim()||text.length>32000)throw new Error('Введите сообщение до 32 000 символов.');
    if(id)await this.open(root,id);else if(!this.current||this.current.root!==root)await this.create(root);
    const c=this.current;c.title=c.messages.length?c.title:text.trim().slice(0,70);c.updatedAt=new Date().toISOString();c.status='starting';c.error=null;c.activity='Подключаю Claude';c.context=context?.summary||null;this.message('user',text);try{await this.save();}catch(error){c.status='error';c.error='Не удалось сохранить сообщение.';this.publish();throw error;}this.controller=new AbortController();this.publish();
    void this.run({command,serverName,serverSpec,text,context,controller:this.controller}).catch(()=>{});
    return this.snapshot();
  }
  async permission(tool,input,{signal}={}){
    const requestId=crypto.randomUUID(),c=this.current;
    return new Promise(resolve=>{
      const finish=value=>{signal?.removeEventListener('abort',abort);this.pending.delete(requestId);if(c===this.current){c.status=this.pending.size?'permission':'working';c.activity=this.pending.size?'Нужен ваш ответ':'Продолжаю работу';this.publish();}resolve(value);};
      const abort=()=>finish({behavior:'deny',message:'Операция остановлена пользователем.'});
      if(signal?.aborted)return abort();
      this.pending.set(requestId,{public:{requestId,tool,input:Buffer.byteLength(JSON.stringify(input))>128000?{file_path:input.file_path,preview:JSON.stringify(input).slice(0,64000),truncated:true}:input},input,finish});signal?.addEventListener('abort',abort,{once:true});c.status='permission';c.activity=tool==='AskUserQuestion'?'Claude задаёт вопрос':'Claude запрашивает разрешение';this.publish();
    });
  }
  answer({id,requestId,allow,answers}){
    if(id!==this.current?.id)throw new Error('Разговор изменился.');const request=this.pending.get(requestId);if(!request)throw new Error('Запрос уже закрыт.');
    if(!allow){request.finish({behavior:'deny',message:'Пользователь отклонил эту операцию.'});return this.snapshot();}
    let updatedInput=request.input;
    if(request.public.tool==='AskUserQuestion'){
      if(!answers||typeof answers!=='object')throw new Error('Ответьте на вопросы Claude.');const clean={};for(const q of request.input.questions||[]){if(typeof answers[q.question]!=='string'||!answers[q.question].trim()||answers[q.question].length>8000)throw new Error('Заполните ответ на каждый вопрос.');clean[q.question]=answers[q.question];}updatedInput={...request.input,answers:clean};
    }
    request.finish({behavior:'allow',updatedInput});return this.snapshot();
  }
  async stop(id){if(id!==this.current?.id)throw new Error('Разговор изменился.');for(const request of [...this.pending.values()])request.finish({behavior:'deny',message:'Остановлено пользователем.'});if(this.controller){this.current.status='stopping';this.current.activity='Останавливаю Claude';this.controller.abort();this.publish();}return this.snapshot();}
  async run({command,serverName,serverSpec,text,context,controller}){
    const c=this.current;let draft=null,resultReady=false;
    try{
      const sdk=await this.loadSdk();const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPORA_UPDATE_JOB;delete env.OPORA_UPDATE_TOKEN;
      const instruction=`You work inside Opora in ${c.root}. The project MCP server is ${serverName}. At the start of a game task call opora_get_work_context, verify its root, read source files and respect the current task, brandbook, rules and feedback. Do not approve brand rules, accept visual results or complete tasks for the user. After context loss fetch context again. Permission requests must be handled normally.`;
      const prompt=(context?.text?context.text+'\n\nСообщение пользователя:\n':'')+text;
      const query=sdk.query({prompt,options:{cwd:c.root,pathToClaudeCodeExecutable:command.args[0]||command.file,settingSources:['user','project','local'],permissionMode:'default',...(serverSpec?{mcpServers:{[serverName]:{type:'stdio',...serverSpec}}}:{}),canUseTool:(tool,input,options)=>this.permission(tool,input,options),abortController:controller,includePartialMessages:true,...(c.sessionId?{resume:c.sessionId}:{}),systemPrompt:{type:'preset',preset:'claude_code',append:instruction},env,
        spawnClaudeCodeProcess:options=>{const childEnv={...options.env};delete childEnv.ELECTRON_RUN_AS_NODE;delete childEnv.OPORA_UPDATE_JOB;delete childEnv.OPORA_UPDATE_TOKEN;const child=spawn(command.file,options.args,{cwd:options.cwd,env:childEnv,stdio:['pipe','pipe','pipe'],windowsHide:true,signal:options.signal});child.stderr?.on('data',()=>{});return child;}}});
      this.query=query;c.status='working';c.activity='Claude работает';this.publish();
      for await(const packet of query){
        if(packet.session_id&&packet.session_id!==c.sessionId){c.sessionId=packet.session_id;void this.save().catch(()=>{});}
        if(packet.type==='stream_event'&&!packet.parent_tool_use_id){const e=packet.event;if(e.type==='message_start'){draft=this.message('assistant','',e.message.id);}if(e.type==='content_block_delta'&&e.delta?.type==='text_delta'){if(!draft)draft=this.message('assistant','');draft.text=(draft.text+e.delta.text).slice(0,131072);this.publish(draft);}if(e.type==='content_block_start'&&e.content_block?.type==='tool_use'){c.activity=this.describeTool(e.content_block.name);this.publish();}}
        if(packet.type==='assistant'&&!packet.parent_tool_use_id){const blocks=packet.message?.content||[],body=blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n');if(body){const existing=c.messages.find(m=>m.id===packet.message.id);if(existing){existing.text=body.slice(0,131072);this.publish(existing);}else this.message('assistant',body,packet.message.id);}for(const b of blocks)if(b.type==='tool_use'){c.activity=this.describeTool(b.name);this.publish();}}
        if(packet.type==='result'){if(packet.is_error)throw new Error(packet.errors?.join('\n')||packet.result||'Claude завершил запрос с ошибкой.');if(!c.messages.some(m=>m.role==='assistant'&&m.text)&&packet.result)this.message('assistant',packet.result);c.usage=packet.usage;resultReady=true;}
      }
      if(c.status==='working'||c.status==='starting'){c.status='idle';c.activity=resultReady?'Ответ готов':'Готов к сообщению';}
    }catch(error){c.status=controller.signal.aborted?'interrupted':'error';c.activity=controller.signal.aborted?'Работа остановлена':'Не удалось завершить запрос';c.error=controller.signal.aborted?null:error.message;}
    finally{const status=c.status,activity=c.activity;for(const request of [...this.pending.values()])request.finish({behavior:'deny',message:'Запрос завершён.'});c.status=status;c.activity=activity;if(controller.signal.aborted){c.status='interrupted';c.activity='Работа остановлена';}this.query=null;this.controller=null;c.updatedAt=new Date().toISOString();await this.save().catch(error=>{c.error='Не удалось сохранить историю: '+error.message;});this.publish();}
  }
  describeTool(name){return ({Read:'Читает файлы',Edit:'Редактирует файл',Write:'Записывает файл',Bash:'Выполняет команду',Grep:'Ищет в коде',Glob:'Ищет файлы',AskUserQuestion:'Ждёт вашего ответа'})[name]||'Инструмент: '+name;}
}
module.exports={ClaudeChat,busy};
