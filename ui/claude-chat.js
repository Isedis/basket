/* Persistent, resizable workspace. Messages and tool input are always plain text. */
window.OporaClaudeTerminal={create(options){
  const {bridge,getRoot,prepare,getPrompt,onError,notify}=options,dock=document.querySelector('#claude-dock'),el=name=>dock.querySelector(`[data-chat="${name}"]`);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current=null,mode='chat',visible=false,loading=false,loadedRoot=null,generation=0,context=null,lastPermissions='',legacyState=null,errorMessage='';
  const storage={get(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,value);}catch{}}};
  const busy=()=>['starting','working','permission','stopping'].includes(current?.status);
  const draftKey=()=>`opora:claude-draft:${getRoot()||'none'}:${current?.id||'new'}`;
  function saveDraft(){storage.set(draftKey(),el('input').value);}
  function height(value,persist=true){const max=Math.max(380,window.innerHeight-100),h=Math.min(max,Math.max(380,Number(value)||460));document.body.style.setProperty('--claude-height',h+'px');dock.querySelector('[data-dock="resize"]').setAttribute('aria-valuenow',Math.round(h));dock.querySelector('[data-dock="resize"]').setAttribute('aria-valuemax',Math.round(max));if(persist)storage.set('opora:claude-height',h);legacy?.resize();}
  function controls(){
    const status=mode==='terminal'?(legacyState?.status==='running'?'Терминал работает':'Терминал Claude Code'):(loading?'Подготавливаю…':current?.activity||'Готов к сообщению');
    el('status').textContent=status;el('status').dataset.state=mode==='chat'?current?.status||'idle':'terminal';
    el('title').textContent=current?.title||'Новый разговор';el('project').textContent=getRoot()?.split(/[\\/]/).at(-1)||'Выберите игру';
    for(const action of ['send','new'])dock.querySelector(`[data-chat-action="${action}"]`).disabled=loading||busy()||!getRoot()||!bridge?.chatSend;
    dock.querySelector('[data-chat-action="stop"]').disabled=!busy()||current?.status==='stopping';
    el('input').disabled=!getRoot()||!bridge?.chatSend;el('error').textContent=errorMessage||current?.error||'';
    dock.querySelector('[data-chat-action="task"]').disabled=loading||!getRoot();
    document.querySelectorAll('[data-action="claude-open"]').forEach(b=>b.classList.toggle('terminal-running',busy()||!!legacy?.isActive()));
  }
  function setMode(value){mode=value;el('pane').hidden=value!=='chat';el('legacy').hidden=value!=='terminal';for(const b of dock.querySelectorAll('.claude-mode-tabs button'))b.setAttribute('aria-pressed',String(b.dataset.dock===mode));controls();}
  const legacy=window.OporaClaudeLegacy.create({...options,onShow:()=>setMode('terminal'),onState:s=>{legacyState=s;queueMicrotask(controls);}});
  function show(){visible=true;dock.hidden=false;document.body.classList.add('with-terminal');height(storage.get('opora:claude-height',460),false);controls();}
  function hide(){saveDraft();visible=false;dock.hidden=true;document.body.classList.remove('with-terminal');}
  function renderMessage(message){
    let node=[...el('messages').querySelectorAll('[data-message]')].find(n=>n.dataset.message===message.id);
    if(!node){node=document.createElement('article');node.className='claude-message '+(message.role==='user'?'is-user':'is-assistant');node.dataset.message=message.id;const heading=document.createElement('div');heading.className='claude-message-heading';const who=document.createElement('strong');who.textContent=message.role==='user'?'ВЫ':'CLAUDE';const time=document.createElement('time');time.textContent=new Date(message.time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});const copy=document.createElement('button');copy.className='text-button';copy.textContent='Копировать';copy.onclick=()=>bridge.copy(node.querySelector('.claude-message-text').textContent).catch(onError);heading.append(who,time,copy);const text=document.createElement('div');text.className='claude-message-text';node.append(heading,text);el('messages').append(node);}
    node.querySelector('.claude-message-text').textContent=message.text||'…';
  }
  function empty(){if(!el('messages').children.length)el('messages').innerHTML='<div class="claude-chat-empty"><span>&gt;_</span><h3>Обсудим вашу игру</h3><p>Напишите запрос или вставьте задачу из Опоры.<br>Перед отправкой можно посмотреть контекст.</p></div>';}
  function permissions(){
    const requests=current?.permissions||[],signature=JSON.stringify(requests);if(signature===lastPermissions)return;lastPermissions=signature;
    if(requests.length)el('context-preview').open=false;el('permissions').innerHTML=requests.map(r=>`<section class="claude-permission" data-permission="${esc(r.requestId)}"><strong>${r.tool==='AskUserQuestion'?'Claude ждёт вашего ответа':'Нужно разрешение: '+esc(r.tool)}</strong>${r.tool==='AskUserQuestion'?(r.input.questions||[]).map((q,i)=>`<fieldset><legend>${esc(q.question)}</legend>${(q.options||[]).map((o,j)=>`<label><input type="${q.multiSelect?'checkbox':'radio'}" name="answer-${i}" value="${j}"> ${esc(o.label)}${o.description?`<small>${esc(o.description)}</small>`:''}</label>`).join('')}<textarea data-answer="${i}" rows="2" placeholder="Ваш ответ своими словами"></textarea></fieldset>`).join(''):`<details><summary>${esc(r.input.file_path||r.input.command||r.input.path||'Посмотреть действие').slice(0,250)}</summary><pre>${esc(JSON.stringify(r.input,null,2))}</pre></details>`}<div><button class="button small" data-chat-allow="${esc(r.requestId)}">${r.tool==='AskUserQuestion'?'Отправить ответ':'Разрешить один раз'}</button><button class="text-button" data-chat-deny="${esc(r.requestId)}">Отклонить</button></div></section>`).join('');
  }
  function accept(snapshot){if(!snapshot)return;errorMessage='';current=snapshot;storage.set('opora:claude-current:'+snapshot.root,snapshot.id);el('messages').replaceChildren();if(snapshot.hasEarlierMessages){const note=document.createElement('p');note.className='small';note.textContent='Показана последняя часть переписки. Полная сессия доступна Claude Code.';el('messages').append(note);}for(const m of snapshot.messages||[])renderMessage(m);empty();permissions();controls();el('input').value=storage.get(draftKey(),'');requestAnimationFrame(()=>{el('messages').scrollTop=el('messages').scrollHeight;});contextLabel();}
  function update(event){
    if(event.root!==getRoot()&&getRoot())return;if(!current||current.id!==event.id){if(busy())return;current={...event,messages:[]};el('messages').replaceChildren();}
    const log=el('messages'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<90;
    current={...current,...event};if(event.message){log.querySelector('.claude-chat-empty')?.remove();renderMessage(event.message);}
    permissions();controls();contextLabel();if(bottom)requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight;});
    if(!busy()&&event.status)void history(false);
  }
  function contextLabel(){const s=current?.context;el('context-label').textContent=s?`${s.task||'Без выбранной задачи'} · брендбук: ${s.brand} · замечаний: ${s.notes}`:'Задача · правила · брендбук · замечания';}
  async function history(openSaved=true){
    if(!getRoot()||!bridge?.chatList)return;const root=getRoot(),token=++generation;const items=await bridge.chatList();if(root!==getRoot()||token!==generation)return;
    el('history').innerHTML=items.map(c=>`<button data-chat-id="${esc(c.id)}" class="${c.id===current?.id?'selected':''}"><strong>${esc(c.title)}</strong><small>${c.external?'Claude Code · ':''}${new Date(c.updatedAt).toLocaleDateString('ru-RU')}</small></button>`).join('')||'<p>Здесь появятся разговоры этой игры.</p>';
    const saved=storage.get('opora:claude-current:'+root,'');if(openSaved&&!current&&items.length){const id=items.find(i=>i.id===saved)?.id||items[0].id;accept(await bridge.chatOpen(id));}
  }
  async function openHistory(id){saveDraft();loading=true;controls();try{accept(await bridge.chatOpen(id));await history(false);}finally{loading=false;controls();}}
  async function preview(){await prepare();context=await bridge.workContext({});el('context-text').textContent=JSON.stringify({project:context.root,task:context.task,passport:context.passport,brand:context.brand,feedback:context.feedback},null,2);el('context-preview').open=true;}
  async function send(){
    if(loading||busy()||!el('input').value.trim())return;
    const text=el('input').value,oldDraftKey=draftKey();errorMessage='';loading=true;controls();saveDraft();
    try{await prepare();const snapshot=await bridge.chatSend({id:current?.id,text,includeContext:el('context-enabled').checked});storage.set(oldDraftKey,'');storage.set(`opora:claude-draft:${snapshot.root}:${snapshot.id}`,'');accept(snapshot);el('input').value='';await history(false);}
    catch(error){errorMessage=error.message;el('error').textContent=error.message;notify(error.message,true);}finally{loading=false;controls();}
  }
  dock.addEventListener('click',async event=>{
    const action=event.target.closest('[data-dock],[data-chat-action],[data-chat-id],[data-chat-allow],[data-chat-deny]');if(!action||action.disabled)return;
    try{
      const d=action.dataset;
      if(d.dock==='hide'){hide();return;}
      if(d.dock==='expand'){dock.classList.toggle('expanded');action.textContent=dock.classList.contains('expanded')?'Разделить':'Развернуть';legacy.resize();return;}
      if(d.dock==='chat'){setMode('chat');show();await history(!current);return;}
      if(d.dock==='terminal'){setMode('terminal');show();legacy.show();return;}
      if(d.chatId){await openHistory(d.chatId);return;}
      if(d.chatAction==='send'){await send();return;}
      if(d.chatAction==='new'){saveDraft();accept(await bridge.chatNew());await history(false);el('input').focus();}
      if(d.chatAction==='history'){dock.classList.toggle('history-hidden');storage.set('opora:claude-history-hidden',dock.classList.contains('history-hidden')?'1':'0');}
      if(d.chatAction==='stop'){accept(await bridge.chatStop(current.id));}
      if(d.chatAction==='context')await preview();
      if(d.chatAction==='task'){const text=await getPrompt();el('input').value=text;saveDraft();el('input').focus();}
      if(d.chatAction==='select'){if(await bridge.claudeSelect())notify('Claude Code выбран.');}
      if(d.chatAllow||d.chatDeny){const requestId=d.chatAllow||d.chatDeny,request=current.permissions.find(r=>r.requestId===requestId),answers={};if(d.chatAllow&&request?.tool==='AskUserQuestion'){const section=action.closest('[data-permission]');(request.input.questions||[]).forEach((q,i)=>{const values=[...section.querySelectorAll(`input[name="answer-${i}"]:checked`)].map(input=>q.options[Number(input.value)].label),extra=section.querySelector(`[data-answer="${i}"]`).value.trim();answers[q.question]=[...values,...(extra?[extra]:[])].join(', ');});}accept(await bridge.chatAnswer({id:current.id,requestId,allow:!!d.chatAllow,answers}));}
    }catch(error){errorMessage=error.message;el('error').textContent=error.message;notify(error.message,true);}
  });
  el('input').addEventListener('input',saveDraft);el('input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void send();}});
  const resizer=dock.querySelector('[data-dock="resize"]');
  resizer.addEventListener('pointerdown',event=>{if(dock.classList.contains('expanded'))return;resizer.setPointerCapture(event.pointerId);document.body.classList.add('resizing-claude');});
  resizer.addEventListener('pointermove',event=>{if(resizer.hasPointerCapture(event.pointerId))height(window.innerHeight-27-event.clientY);});
  const end=()=>document.body.classList.remove('resizing-claude');resizer.addEventListener('pointerup',end);resizer.addEventListener('lostpointercapture',end);
  resizer.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const value=parseFloat(getComputedStyle(document.body).getPropertyValue('--claude-height'))||460;height(event.key==='Home'?380:event.key==='End'?window.innerHeight-100:value+(event.key==='ArrowUp'?32:-32));}});
  const font=dock.querySelector('[data-dock="font"]');font.value=storage.get('opora:claude-font','14');function fontSize(){const size=[12,14,16,18].includes(Number(font.value))?Number(font.value):14;dock.style.setProperty('--chat-font',size+'px');legacy.setFontSize(size);storage.set('opora:claude-font',size);}font.addEventListener('change',fontSize);fontSize();
  dock.classList.toggle('history-hidden',storage.get('opora:claude-history-hidden','0')==='1');window.addEventListener('resize',()=>height(storage.get('opora:claude-height',460),false));
  bridge?.onChatEvent?.(update);bridge?.chatState?.().then(snapshot=>{if(snapshot){accept(snapshot);if(busy()){setMode('chat');show();}}}).catch(onError);
  empty();controls();
  return {async open(){if(!getRoot()){notify('Сначала откройте папку игры.',true);return;}setMode('chat');show();await history(!current);el('input').focus();},projectChanged(){const root=getRoot();if(root===loadedRoot){controls();return;}loadedRoot=root;if(!busy()&&current?.root!==root){current=null;el('messages').replaceChildren();empty();lastPermissions='';el('permissions').replaceChildren();el('input').value=storage.get(draftKey(),'');}controls();if(visible&&mode==='chat')void history(!current).catch(onError);}};
}};
