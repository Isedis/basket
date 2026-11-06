/* Persistent chat workspace. Only sanitized Markdown is rendered. */
window.OporaClaudeTerminal={create(options){
  const {bridge,getRoot,prepare,getPrompt,onError,notify}=options,dock=document.querySelector('#claude-dock'),nodes=new Map([...dock.querySelectorAll('[data-chat]')].map(n=>[n.dataset.chat,n])),el=name=>nodes.get(name);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current=null,mode='chat',visible=false,loading=false,loadedRoot=null,generation=0,context=null,lastPermissions='',legacyState=null,errorMessage='';
  let plan=null,planKey='',planBusy=false,planHistory=false,planSignature='';
  const storage={get(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,value);}catch{}}};
  const busy=()=>['starting','working','permission','stopping'].includes(current?.status);
  const draftKey=()=>`opora:claude-draft:${getRoot()||'none'}:${current?.id||'new'}`;
  function saveDraft(){storage.set(draftKey(),el('input').value);}
  function height(value,persist=true){const max=Math.max(380,window.innerHeight-100),h=Math.min(max,Math.max(380,Number(value)||460));document.body.style.setProperty('--claude-height',h+'px');dock.querySelector('[data-dock="resize"]').setAttribute('aria-valuenow',Math.round(h));dock.querySelector('[data-dock="resize"]').setAttribute('aria-valuemax',Math.round(max));if(persist)storage.set('opora:claude-height',h);legacy?.resize();}
  function controls(){
    const status=mode==='terminal'?(legacyState?.status==='running'?'Терминал работает':'Терминал Claude Code'):(loading?'Подготавливаю…':current?.activity||'Готов к сообщению');
    el('status').textContent=status;el('status').dataset.state=mode==='chat'?current?.status||'idle':'terminal';
    el('title').textContent=current?.title||'Новый разговор';el('project').textContent=getRoot()?.split(/[\\/]/).at(-1)||'Выберите игру';
    for(const action of ['send','new','run-task','plan-build'])dock.querySelector(`[data-chat-action="${action}"]`).disabled=loading||busy()||!getRoot()||!bridge?.chatSend;
    dock.querySelector('[data-chat-action="stop"]').disabled=!busy()||current?.status==='stopping';
    renderAutomation();renderPlan();adoptCards();updateLive();for(const tab of el('history').querySelectorAll('[data-chat-id]'))tab.disabled=busy()&&tab.dataset.chatId!==current?.id;el('input').disabled=!getRoot()||!bridge?.chatSend;el('error').textContent=errorMessage||current?.error||'';
    dock.querySelector('[data-chat-action="task"]').disabled=loading||!getRoot();
    document.querySelectorAll('[data-action="claude-open"]').forEach(b=>b.classList.toggle('terminal-running',busy()||!!legacy?.isActive()));
  }
  function setMode(value){mode=value;el('pane').hidden=value!=='chat';el('legacy').hidden=value!=='terminal';for(const b of dock.querySelectorAll('.claude-mode-tabs button'))b.setAttribute('aria-pressed',String(b.dataset.dock===mode));controls();}
  const legacy=window.OporaClaudeLegacy.create({...options,onShow:()=>setMode('terminal'),onState:s=>{legacyState=s;queueMicrotask(controls);}});
  function show(){visible=true;dock.hidden=false;document.body.classList.add('with-terminal');height(storage.get('opora:claude-height',460),false);controls();}
  function hide(){saveDraft();visible=false;dock.hidden=true;document.body.classList.remove('with-terminal');}
  const tail=document.createElement('div');tail.className='chat-tail';
  const live=document.createElement('div');live.className='chat-live';live.setAttribute('role','status');
  const currentCards=[el('plan'),el('automation'),el('context-preview')];
  function resetMessages(){for(const node of currentCards)tail.append(node);tail.append(live);el('messages').replaceChildren(tail);}
  function updateLive(){const active=loading||busy();live.hidden=!active;if(!active)return;const seconds=Math.max(0,Math.floor((Date.now()-new Date(current?.started_at||Date.now()).getTime())/1000));live.dataset.waiting=String(current?.status==='permission');live.innerHTML='<i aria-hidden="true"></i><div><strong>'+esc(loading?'Готовит контекст':current?.activity||'Ожидает ответ Claude')+'</strong><small>'+esc(current?.activity_detail||'')+'</small></div><time>'+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+'</time>';}
  function adoptCards(){const results=[...el('messages').querySelectorAll('.chat-turn-result')],latest=results.at(-1);for(const result of results)result.querySelector('.chat-saved-result')?.removeAttribute('hidden');const matching=latest&&latest.dataset.turn===current?.turn_id&&!busy();for(const node of currentCards){const target=matching&&node!==el('context-preview')?latest:tail;if(node.parentNode!==target)target.append(node);}if(matching)latest.querySelector('.chat-saved-result')?.setAttribute('hidden','');tail.append(live);}
  function archivedResult(message){const run=message.automation?.run;return '<details class="chat-saved-result"><summary>Результат · '+(run?'изменено файлов: '+esc(run.changes_total):'сводка')+'</summary>'+(message.plan?'<p>План: '+esc(message.plan.completed)+' / '+esc(message.plan.total)+'</p><ol>'+message.plan.stages.map(stage=>'<li>'+esc(stage.title)+' · '+esc(stage.status)+'</li>').join('')+'</ol>':'')+(run?'<ul>'+run.changes.map(c=>'<li>'+esc(c.file)+'</li>').join('')+'</ul>'+run.checks.map(c=>'<p>'+esc(({passed:'[+] Пройдено',failed:'[!] Ошибка',not_run:'[—] Не проверено'})[c.result])+' · '+esc(c.name)+'</p>').join(''):'')+'</details>';}
  function renderMessage(message){
    let node=[...el('messages').querySelectorAll('[data-message]')].find(n=>n.dataset.message===message.id);
    if(!node){node=document.createElement('article');node.dataset.message=message.id;el('messages').insertBefore(node,tail);}
    if(message.kind==='activity'){node.className='chat-activity';const opened=node.querySelector('details')?.open||false,events=message.events||[];node.innerHTML='<details><summary>Действия · '+events.length+(message.status==='running'?' · в работе':' · завершено')+'</summary><ol>'+events.map(e=>'<li data-state="'+esc(e.status)+'"><span>'+({done:'✓',error:'!',running:'›',ended:'·',interrupted:'—'})[e.status]+'</span><div>'+esc(e.title)+'<small>'+esc(e.detail)+'</small></div><em>'+esc(({done:'завершено',error:'ошибка',running:'в работе',ended:'запрос завершён',interrupted:'прервано'})[e.status]||e.status)+'</em></li>').join('')+'</ol></details>';node.querySelector('details').open=opened;return;}
    if(message.kind==='result'){node.className='chat-turn-result';node.dataset.turn=message.turn_id;if(!node.querySelector('.chat-saved-result'))node.innerHTML=archivedResult(message);adoptCards();return;}
    if(!node.querySelector('.claude-message-text')){node.className='claude-message '+(message.role==='user'?'is-user':'is-assistant');const heading=document.createElement('div');heading.className='claude-message-heading';const who=document.createElement('strong');who.textContent=message.role==='user'?'ВЫ':'CLAUDE';const time=document.createElement('time');time.textContent=new Date(message.time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});const copy=document.createElement('button');copy.className='text-button';copy.textContent='Копировать';copy.onclick=()=>bridge.copy(node.rawText).catch(onError);heading.append(who,time,copy);const text=document.createElement('div');text.className='claude-message-text';node.append(heading,text);}
    node.rawText=message.text||'';node.classList.toggle('is-streaming',!!message.streaming);
    const paint=()=>{node.renderTimer=null;if(message.role==='user')node.querySelector('.claude-message-text').textContent=node.rawText;else window.OporaChatMarkdown.render(node.querySelector('.claude-message-text'),node.rawText,{copy:text=>bridge.copy(text).catch(onError),onLink:href=>bridge.copy(href).then(()=>notify('Ссылка скопирована')).catch(onError)});};
    if(!message.streaming){clearTimeout(node.renderTimer);paint();}else if(!node.renderTimer)node.renderTimer=setTimeout(paint,100);
  }
  function empty(){if(!el('messages').querySelector('[data-message]')&&!el('messages').querySelector('.claude-chat-empty')){const node=document.createElement('div');node.className='claude-chat-empty';node.innerHTML='<span>&gt;_</span><h3>Над чем работаем?</h3><p>Запрос, задача или идея для вашей игры.</p>';el('messages').insertBefore(node,tail);}}
  resetMessages();el('context-preview').hidden=true;
  function permissions(){
    const requests=current?.permissions||[],signature=JSON.stringify(requests);if(signature===lastPermissions)return;lastPermissions=signature;
    if(requests.length)el('context-preview').open=false;el('permissions').innerHTML=requests.map(r=>`<section class="claude-permission" data-permission="${esc(r.requestId)}"><strong>${r.tool==='AskUserQuestion'?'Claude ждёт вашего ответа':'Нужно разрешение: '+esc(r.tool)}</strong>${r.tool==='AskUserQuestion'?(r.input.questions||[]).map((q,i)=>`<fieldset><legend>${esc(q.question)}</legend>${(q.options||[]).map((o,j)=>`<label><input type="${q.multiSelect?'checkbox':'radio'}" name="answer-${i}" value="${j}"> ${esc(o.label)}${o.description?`<small>${esc(o.description)}</small>`:''}</label>`).join('')}<textarea data-answer="${i}" rows="2" placeholder="Ваш ответ своими словами"></textarea></fieldset>`).join(''):`<details><summary>${esc(r.input.file_path||r.input.command||r.input.path||'Посмотреть действие').slice(0,250)}</summary><pre>${esc(JSON.stringify(r.input,null,2))}</pre></details>`}<div><button class="button small" data-chat-allow="${esc(r.requestId)}">${r.tool==='AskUserQuestion'?'Отправить ответ':'Разрешить один раз'}</button><button class="text-button" data-chat-deny="${esc(r.requestId)}">Отклонить</button></div></section>`).join('');
  }
  function accept(snapshot){if(!snapshot)return;errorMessage='';current=snapshot;storage.set('opora:claude-current:'+snapshot.root,snapshot.id);resetMessages();if(snapshot.hasEarlierMessages){const note=document.createElement('p');note.className='small';note.textContent='Показана последняя часть переписки. Полная сессия доступна Claude Code.';el('messages').append(note);}for(const m of snapshot.messages||[])renderMessage(m);empty();permissions();controls();el('input').value=storage.get(draftKey(),'');requestAnimationFrame(()=>{el('messages').scrollTop=el('messages').scrollHeight;});contextLabel();}
  function update(event){
    if(event.root!==getRoot()&&getRoot())return;if(!current||current.id!==event.id){if(busy())return;current={...event,messages:[]};resetMessages();}
    const log=el('messages'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<90;
    const previousTurn=current.turn_id;current={...current,...event};if(previousTurn!==current.turn_id){resetMessages();for(const m of current.messages||[])renderMessage(m);}if(event.message){const index=(current.messages||[]).findIndex(m=>m.id===event.message.id);if(index<0)current.messages.push(event.message);else current.messages[index]=event.message;}if(event.message){log.querySelector('.claude-chat-empty')?.remove();renderMessage(event.message);}
    permissions();controls();contextLabel();if(bottom)requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight;});
    if(!busy()&&event.status)void history(false);
  }
  const planTaskId=()=>busy()?(current?.task_id||options.getTaskId?.()):(options.getTaskId?.()||current?.task_id);
  function renderPlan(){
    const node=el('plan');node.hidden=!plan;if(!plan)return;
    const signature=JSON.stringify(plan)+'|'+busy()+'|'+planHistory;if(signature===planSignature)return;planSignature=signature;
    const opened=[...el('plan-body').querySelectorAll('details[data-plan-stage][open]')].map(n=>n.dataset.planStage);
    const names={ready:'Готов к следующему этапу',running:'Выполняется',paused:'Приостановлен',blocked:'Нужна помощь',ready_for_review:'Результат для просмотра'};
    el('plan-title').textContent=`План · ${plan.completed}/${plan.total} · ${plan.stale_task?'Требуется пересмотр':names[plan.status]||plan.status}`;
    el('plan-body').innerHTML=`<p class="claude-plan-goal">${esc(plan.title)} · ${esc(plan.goal)}</p><ol>${plan.stages.map(s=>`<li class="plan-stage-${esc(s.status)}"><details data-plan-stage="${esc(s.id)}"><summary><span>${({pending:'○',running:'▶',checking:'…',blocked:'!',implemented:'✓'})[s.status]||'○'}</span> ${esc(s.title)} <small>${({pending:'ожидает',running:'в работе',checking:'проверяется',blocked:'блокер',implemented:'выполнено агентом'})[s.status]||s.status}</small></summary><p>${esc(s.result)}</p><p>Проверить: ${esc(s.verification)}</p>${s.summary?`<p>${esc(s.summary)}</p>`:''}${s.blocker?`<p class="claude-plan-blocker">${esc(s.blocker)}</p>`:''}${s.checks.map(c=>`<p>${c.result==='passed'?'[+]':c.result==='failed'?'[!]':'[—]'} ${esc(c.name)}: ${({passed:'прошло на этапе',failed:'ошибка',not_run:'не запускалось'})[c.result]}</p>`).join('')}${s.agent_checks.map(c=>`<p>Агент: ${esc(c.name)} — ${({passed:'заявлено пройденным',failed:'ошибка',not_run:'не запускалось'})[c.result]}</p>`).join('')}</details></li>`).join('')}</ol><div class="claude-plan-actions">${plan.status!=='ready_for_review'?`<button class="text-button" data-chat-action="plan-pause" ${plan.status==='paused'?'disabled':''}>Приостановить</button><button class="button small" data-chat-action="plan-resume" ${busy()||plan.stale_task||plan.parent_done?'disabled':''}>Продолжить</button>`:''}<button class="text-button" data-chat-action="plan-edit">Попросить изменить</button><button class="text-button" data-chat-action="plan-history">${planHistory?'Скрыть историю':'История плана'} (${plan.history_count})</button></div><p class="small">Этапы выполнены агентом. Принятие задачи и визуала — за вами.</p>${planHistory?`<div class="claude-plan-history">${(plan.history||[]).map(h=>`<details><summary>${esc(new Date(h.recorded_at).toLocaleString('ru-RU'))} · ${esc(h.reason||'Изменение плана')}</summary><ol>${h.plan.stages.map(s=>`<li>${esc(s.title)} — ${esc(s.result)}</li>`).join('')}</ol></details>`).join('')||'<p>План ещё не менялся.</p>'}</div>`:''}`;
    for(const n of el('plan-body').querySelectorAll('details[data-plan-stage]'))n.open=opened.includes(n.dataset.planStage);
  }
  async function refreshPlan(){
    if(planBusy||!visible||mode!=='chat'||!bridge?.planGet||!getRoot())return;
    const root=getRoot(),taskId=planTaskId(),key=root+'|'+taskId;if(!taskId){plan=null;renderPlan();return;}
    if(key!==planKey){plan=null;planKey=key;planHistory=false;planSignature='';}
    planBusy=true;try{const next=await bridge.planGet({taskId,history:planHistory});if(root!==getRoot()||taskId!==planTaskId())return;const first=!plan&&next;plan=next;renderPlan();if(first)el('plan').open=true;}catch{if(root===getRoot()){plan=null;renderPlan();}}finally{planBusy=false;}
  }
  function renderAutomation(){
    const data=current?.automation,run=data?.run,node=el('automation');node.hidden=!run&&!data?.warning;if(node.hidden)return;
    el('automation-title').textContent=run?`Сводка сохранена · файлов: ${run.changes_total}${run.limited?' · карта неполная':''}${run.checks.some(c=>c.result==='failed')?' · ошибка проверки':run.checks.some(c=>c.setup_required)?' · Godot не выбран':''}`:'Сводка требует внимания';
    el('automation-body').innerHTML=(data.warning?`<p>${esc(data.warning)}</p>`:'')+(run?`<p>${esc(run.task_title||'Без выбранной задачи')} · ${run.phase==='blocked'?(run.checks.some(c=>c.result==='failed')?'ошибка проверки':'работа прервана'):run.changes_total?'результат для проверки':'ответ без изменений кода'}</p>${run.changes.length?`<ul>${run.changes.map(c=>`<li>${({added:'+',removed:'−',changed:'~'})[c.kind]||'?'} ${esc(c.file)}</li>`).join('')}</ul>`:''}${run.checks.map(c=>`<p>${({passed:'[+] Пройдено',failed:'[!] Ошибка',not_run:'[—] Не проверено'})[c.result]}: ${esc(c.name)}</p>${c.result==='failed'?`<pre>${esc(c.evidence||c.error||'Ошибка проверки')}</pre>`:''}${c.setup_required?'<button class="text-button" data-chat-action="godot">Указать Godot один раз →</button>':''}`).join('')}<p>Изменения за время ответа; возможны параллельные правки.</p>${run.checks.some(c=>c.result==='failed')?'<button class="button small" data-chat-action="fix-check">Исправить ошибки →</button>':''}<button class="text-button" data-chat-action="review">Открыть отчёт →</button>`:'');
  }
  function contextLabel(){const s=current?.context;el('context-label').textContent=s?`${s.task||'Без выбранной задачи'} · брендбук: ${s.brand} · замечаний: ${s.notes}`:'Задача · правила · брендбук · замечания';if(current?.automation?.context_mode)el('context-label').textContent+=' · '+({full:'полный пакет',delta:'только изменения',unchanged:'правила без изменений'})[current.automation.context_mode];}
  async function history(openSaved=true){
    if(!getRoot()||!bridge?.chatList)return;const root=getRoot(),token=++generation;const items=await bridge.chatList();if(root!==getRoot()||token!==generation)return;
    el('history').innerHTML=items.map(c=>`<button role="tab" aria-selected="${c.id===current?.id}" data-chat-id="${esc(c.id)}" class="${c.id===current?.id?'selected':''}"><strong>${esc(c.title)}</strong><small>${c.external?'Claude Code · ':''}${new Date(c.updatedAt).toLocaleDateString('ru-RU')}</small></button>`).join('')||'<p>Здесь появятся разговоры этой игры.</p>';
    const saved=storage.get('opora:claude-current:'+root,'');if(openSaved&&!current&&items.length){const id=items.find(i=>i.id===saved)?.id||items[0].id;accept(await bridge.chatOpen(id));}
  }
  async function openHistory(id){saveDraft();loading=true;controls();try{accept(await bridge.chatOpen(id));await history(false);}finally{loading=false;controls();}}
  async function preview(){await prepare();context=await bridge.workContext({});el('context-text').textContent=JSON.stringify({project:context.root,task:context.task,passport:context.passport,brand:context.brand,feedback:context.feedback},null,2);el('context-preview').hidden=false;el('context-preview').open=true;el('context-preview').scrollIntoView({block:'nearest'});}
  async function send(task=false,forcedTaskId,extra={}){
    if(loading||busy()||(!task&&!el('input').value.trim()))return;
    const oldDraftKey=draftKey(),draft=el('input').value;errorMessage='';loading=true;controls();saveDraft();
    try{
      let text=draft,taskId=forcedTaskId;
      if(task){const request=await getPrompt({inline:true});taskId=request.taskId;text=(extra.requirePlan?'Составь и выполни поэтапный план этой задачи через opora_task_plan. ':'')+request.text+(draft.trim()?'\nУточнения: '+draft:'');el('context-enabled').checked=true;}
      await prepare();const snapshot=await bridge.chatSend({id:current?.id,text,taskId,includeContext:el('context-enabled').checked,...extra});storage.set(oldDraftKey,'');storage.set(`opora:claude-draft:${snapshot.root}:${snapshot.id}`,'');accept(snapshot);el('input').value='';await history(false);
    }catch(error){errorMessage=error.message;el('error').textContent=error.message;notify(error.message,true);}finally{loading=false;controls();}
  }
  dock.addEventListener('click',async event=>{
    const action=event.target.closest('[data-dock],[data-chat-action],[data-chat-id],[data-chat-allow],[data-chat-deny]');if(!action||action.disabled)return;
    try{
      const d=action.dataset;
      if(d.dock==='hide'){hide();return;}
      if(d.dock==='expand'){dock.classList.toggle('expanded');action.textContent=dock.classList.contains('expanded')?'Разделить':'Развернуть';legacy.resize();return;}
      if(d.dock==='chat'){setMode('chat');show();await history(!current);return;}
      if(d.dock==='terminal'){setMode('terminal');show();legacy.show();return;}
      if(d.chatId){if(busy()||loading)return;await openHistory(d.chatId);return;}
      if(d.chatAction==='send'){await send();return;}
      if(d.chatAction==='run-task'){await send(true);return;}
      if(d.chatAction==='plan-build'){await send(true,undefined,{requirePlan:true});await refreshPlan();return;}
      if(d.chatAction==='plan-pause'){await bridge.planPause({taskId:plan.task_id});await refreshPlan();return;}
      if(d.chatAction==='plan-resume'){el('context-enabled').checked=true;el('input').value='Продолжи план задачи «'+plan.title+'» с первого незавершённого этапа. Сохрани выполненные части и проверь актуальные исходники.'+(el('input').value.trim()?'\nУточнения: '+el('input').value:'');await send(false,plan.task_id,{resumePlan:true,requirePlan:true});await refreshPlan();return;}
      if(d.chatAction==='plan-edit'){await bridge.planPause({taskId:plan.task_id});await refreshPlan();el('input').value='Измени только план задачи «'+plan.title+'» через opora_task_plan, сохрани прежнюю версию и объясни изменения. Файлы игры пока не меняй. Мои уточнения: ';el('input').focus();return;}
      if(d.chatAction==='plan-history'){planHistory=!planHistory;await refreshPlan();return;}
      if(d.chatAction==='fix-check'){if(busy()||loading)return;el('input').value='Исправь ошибки автоматической проверки Godot из предыдущего ответа, сохрани критерии и принятые решения. Прочитай актуальные исходники перед исправлением.'+(el('input').value.trim()?'\nУточнения: '+el('input').value:'');await send(false,current?.automation?.run?.task_id);return;}
      if(d.chatAction==='godot'){if(await bridge.godotSelect())notify('Godot выбран. Следующие изменения будут проверяться автоматически.');return;}
      if(d.chatAction==='review'){hide();await options.onReview?.();return;}
      if(d.chatAction==='new'){saveDraft();accept(await bridge.chatNew());await history(false);el('input').focus();}
      if(d.chatAction==='history'){dock.classList.toggle('history-hidden');storage.set('opora:claude-history-hidden',dock.classList.contains('history-hidden')?'1':'0');}
      if(d.chatAction==='stop'){accept(await bridge.chatStop(current.id));}
      if(d.chatAction==='context')await preview();
      if(d.chatAction==='task'){const text=await getPrompt();el('input').value=text;saveDraft();el('input').focus();}
      if(d.chatAction==='select'){if(await bridge.claudeSelect())notify('Claude Code выбран.');}
      if(d.chatAllow||d.chatDeny){const requestId=d.chatAllow||d.chatDeny,request=current.permissions.find(r=>r.requestId===requestId),answers={};if(d.chatAllow&&request?.tool==='AskUserQuestion'){const section=action.closest('[data-permission]');(request.input.questions||[]).forEach((q,i)=>{const values=[...section.querySelectorAll(`input[name="answer-${i}"]:checked`)].map(input=>q.options[Number(input.value)].label),extra=section.querySelector(`[data-answer="${i}"]`).value.trim();answers[q.question]=[...values,...(extra?[extra]:[])].join(', ');});}accept(await bridge.chatAnswer({id:current.id,requestId,allow:!!d.chatAllow,answers}));}
    }catch(error){errorMessage=error.message;el('error').textContent=error.message;notify(error.message,true);}
  });
  el('input').addEventListener('input',()=>{saveDraft();el('input').style.height='auto';el('input').style.height=Math.min(120,el('input').scrollHeight)+'px';});el('input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void send();}});
  const resizer=dock.querySelector('[data-dock="resize"]');
  resizer.addEventListener('pointerdown',event=>{if(dock.classList.contains('expanded'))return;resizer.setPointerCapture(event.pointerId);document.body.classList.add('resizing-claude');});
  resizer.addEventListener('pointermove',event=>{if(resizer.hasPointerCapture(event.pointerId))height(window.innerHeight-27-event.clientY);});
  const end=()=>document.body.classList.remove('resizing-claude');resizer.addEventListener('pointerup',end);resizer.addEventListener('lostpointercapture',end);
  resizer.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const value=parseFloat(getComputedStyle(document.body).getPropertyValue('--claude-height'))||460;height(event.key==='Home'?380:event.key==='End'?window.innerHeight-100:value+(event.key==='ArrowUp'?32:-32));}});
  const font=dock.querySelector('[data-dock="font"]');font.value=storage.get('opora:claude-font','14');function fontSize(){const size=[12,14,16,18].includes(Number(font.value))?Number(font.value):14;dock.style.setProperty('--chat-font',size+'px');legacy.setFontSize(size);storage.set('opora:claude-font',size);}font.addEventListener('change',fontSize);fontSize();
  dock.classList.toggle('history-hidden',storage.get('opora:claude-history-hidden','0')==='1');window.addEventListener('resize',()=>height(storage.get('opora:claude-height',460),false));
  bridge?.onChatEvent?.(update);bridge?.chatState?.().then(snapshot=>{if(snapshot){accept(snapshot);if(busy()){setMode('chat');show();}}}).catch(onError);
  setInterval(()=>{if(!document.hidden){void refreshPlan();updateLive();}},1500);
  empty();controls();
  return {async runTask(){if(!getRoot()){notify('Сначала откройте папку игры.',true);return;}if(loading||busy()){notify('Claude ещё работает.');return;}await this.open();await send(true);},async open(){if(!getRoot()){notify('Сначала откройте папку игры.',true);return;}setMode('chat');show();await history(!current);await refreshPlan();el('input').focus();},projectChanged(){const root=getRoot();if(root===loadedRoot){controls();return;}loadedRoot=root;plan=null;planKey='';planSignature='';renderPlan();if(!busy()&&current?.root!==root){current=null;resetMessages();empty();lastPermissions='';el('permissions').replaceChildren();el('input').value=storage.get(draftKey(),'');}controls();if(visible&&mode==='chat')void history(!current).catch(onError);}};
}};
