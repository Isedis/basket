/* Persistent dock: never mounted inside the project's rerendered #main. */
window.OporaClaudeTerminal={create({bridge,getRoot,prepare,getPrompt,onError,notify}){
  const dock=document.querySelector('#claude-dock');
  let term,fit,session=null,busy=false,pending=false,queue=[],sequence=-1,visible=false;
  const element=name=>dock.querySelector(`[data-terminal="${name}"]`);
  const active=()=>session && session.status!=='exited';
  function controls(){
    element('status').textContent=busy?'Запуск…':session?session.status==='running'?'ПРОЦЕСС РАБОТАЕТ':session.status==='stopping'?'ЗАВЕРШЕНИЕ…':`ЗАВЕРШЁН / ${session.exitCode}`:'НЕ ЗАПУЩЕН';
    element('root').textContent=session?.root||getRoot()||'Выберите проект';
    for(const name of ['start','resume','select'])element(name).disabled=busy||!!active();
    element('stop').disabled=busy||!active()||session.status==='stopping';
    element('prompt').disabled=busy||session?.status!=='running';
    document.querySelectorAll('[data-action="claude-open"]').forEach(button=>button.classList.toggle('terminal-running',!!active()));
  }
  function resize(){if(!term||!visible)return;try{fit.fit();if(active())bridge.claudeResize({id:session.id,cols:term.cols,rows:term.rows}).catch(()=>{});}catch{}}
  function ensure(){
    if(term)return;
    term=new Terminal({fontFamily:'"JetBrains Mono", monospace',fontSize:13,lineHeight:1.2,cursorBlink:true,scrollback:5000,allowProposedApi:false,theme:{background:'#000000',foreground:'#fff1c7',cursor:'#fff1c7',selectionBackground:'#454536',black:'#11130f',red:'#ff4545',green:'#b7cb9b',yellow:'#f1d590',blue:'#8caac7',magenta:'#c7a0c5',cyan:'#9bbfbc',white:'#fff1c7',brightBlack:'#888d7f',brightRed:'#ff7373',brightGreen:'#d8e9bc',brightYellow:'#ffe7ae',brightBlue:'#b3d2ef',brightMagenta:'#e4bee2',brightCyan:'#bbdedb',brightWhite:'#ffffff'}});
    fit=new FitAddon.FitAddon();term.loadAddon(fit);term.open(element('screen'));
    // Terminal output cannot change the system clipboard via OSC 52.
    term.parser.registerOscHandler(52,()=>true);
    term.onData(data=>{
      if(session?.status!=='running')return;
      for(let offset=0;offset<data.length;offset+=65536)bridge.claudeInput({id:session.id,data:data.slice(offset,offset+65536)}).catch(onError);
    });
    term.attachCustomKeyEventHandler(event=>{
      if((event.ctrlKey||event.metaKey)&&event.shiftKey&&['KeyC','KeyV'].includes(event.code)){
        if(event.type==='keydown'){
          event.preventDefault();
          if(event.code==='KeyC'){if(term.hasSelection())bridge.copy(term.getSelection()).catch(onError);}
          else if(session?.status==='running')bridge.claudeClipboard().then(text=>term.paste(text)).catch(onError);
        }
        return false;
      }
      return true;
    });
    new ResizeObserver(resize).observe(element('screen'));
    document.fonts.ready.then(resize);
  }
  function show(){visible=true;dock.hidden=false;document.body.classList.add('with-terminal');ensure();controls();requestAnimationFrame(()=>{resize();term.focus();});}
  function hide(){visible=false;dock.hidden=true;document.body.classList.remove('with-terminal');}
  function accept(snapshot){
    if(!snapshot){controls();return;}
    ensure();
    if(session?.id!==snapshot.id){term.reset();term.write(snapshot.output||'');}
    else if(snapshot.seq>sequence){term.reset();term.write(snapshot.output||'');}
    sequence=snapshot.seq;session=snapshot;controls();
  }
  function event(packet){
    if(pending){queue.push(packet);return;}
    if(packet.snapshot){accept(packet.snapshot);return;}
    if(!session||packet.id!==session.id||packet.seq<=sequence)return;
    sequence=packet.seq;session={...session,...packet};
    if(packet.data)term.write(packet.data);
    controls();
  }
  async function start(resume=false){
    if(busy)return;
    if(!getRoot()){notify('Сначала откройте папку игры.',true);return;}
    show();if(active()){term.focus();return;}
    busy=true;controls();element('error').textContent='';
    try{
      await prepare();resize();pending=true;queue=[];
      const result=await bridge.claudeStart({resume,cols:term.cols,rows:term.rows});
      accept(result);pending=false;for(const packet of queue)event(packet);queue=[];
      term.focus();resize();
    }catch(error){pending=false;queue=[];element('error').textContent=error.message;}
    finally{busy=false;controls();}
  }
  dock.addEventListener('click',async event=>{
    const action=event.target.closest('[data-terminal]')?.dataset.terminal;
    try{
      if(action==='hide')hide();
      if(action==='expand'){dock.classList.toggle('expanded');element('expand').textContent=dock.classList.contains('expanded')?'Разделить':'Развернуть';resize();}
      if(action==='start')await start();
      if(action==='resume')await start(true);
      if(action==='select'){const result=await bridge.claudeSelect();if(result){element('error').textContent='';notify('Claude Code выбран. Нажмите «Новая сессия».');}}
      if(action==='stop'){
        if(!active())return;
        await bridge.claudeStop(session.id);controls();
      }
      if(action==='prompt'){
        const project=session.root,text=await getPrompt();
        if(project!==getRoot()||session?.status!=='running')throw new Error('Сессия или проект изменились.');
        term.paste(text);term.focus();notify('Запрос вставлен. Проверьте его и нажмите Enter в Claude.');
      }
    }catch(error){element('error').textContent=error.message;}
  });
  if(bridge?.onClaudeEvent){
    bridge.onClaudeEvent(event);
    pending=true;
    bridge.claudeState().then(snapshot=>{if(snapshot){show();accept(snapshot);}pending=false;for(const packet of queue)event(packet);queue=[];}).catch(error=>{pending=false;onError(error);});
  }
  return {async open(){if(!bridge?.claudeStart){notify('Встроенный Claude доступен в приложении Опора.',true);return;}await start();}};
}};
