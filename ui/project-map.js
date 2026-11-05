/* Read-only map UI. Paths are text; file contents are never executed. */
window.OporaProjectMap=(()=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const labels={project:'ПРОЕКТ',scene:'СЦЕНА',script:'СКРИПТ',resource:'РЕСУРС',shader:'ШЕЙДЕР',asset:'АССЕТ',other:'ФАЙЛ'};
  const relations={main:'главная сцена',autoload:'автозагрузка',extends:'наследование',preload:'preload',load:'load',setting:'настройка',literal:'путь в коде',resource:'ресурс'};
  const demoFiles=[{file:'project.godot',kind:'project',outgoing:1},{file:'scenes/main_menu.tscn',kind:'scene',incoming:1,outgoing:3},{file:'scripts/main_menu.gd',kind:'script',incoming:1,functions:[{name:'_on_play_pressed',line:8}],signals:[]},{file:'ui/game_theme.tres',kind:'resource',incoming:1},{file:'assets/logo.png',kind:'asset',incoming:1}].map(n=>({...n,exists:true}));
  const demoEdges=demoFiles.slice(1).map((n,i)=>({from:i?'scenes/main_menu.tscn':'project.godot',to:n.file,line:i?i+2:4,kind:i?'resource':'main',node:n}));
  function demo(options={}){const base={map_revision:'demo',indexed_at:new Date().toISOString(),main:'scenes/main_menu.tscn',summary:{files:5,scenes:1,scripts:1,resources:1,links:4,missing:0,dynamic:0,read:0,reused:0},warnings:[],offset:options.offset||0,limit:40};if(options.file){const incoming=demoEdges.filter(e=>e.to===options.file).map(e=>({...e,node:demoFiles.find(n=>n.file===e.from)})),outgoing=demoEdges.filter(e=>e.from===options.file);return {...base,selected:demoFiles.find(n=>n.file===options.file),incoming,outgoing,incoming_total:incoming.length,outgoing_total:outgoing.length,unresolved:[]};}const files=demoFiles.filter(n=>(!options.query||n.file.includes(options.query.toLowerCase()))&&(!options.kind||options.kind==='all'||(options.kind==='unlinked'?!n.incoming:n.kind===options.kind)));return {...base,files,total:files.length};}
  function create({getRoot,bridge,notify,onError}){
    let host,key,inventory,detail,query='',kind='all',offset=0,linkOffset=0,selected=null,generation=0,searchTimer;
    const request=options=>getRoot()?bridge.projectMap(options):Promise.resolve(demo(options));
    const button=(file,content,extra='')=>`<button class="map-file ${extra}" data-map-file="${esc(file)}" title="${esc(file)}">${content}</button>`;
    const fileLabel=node=>`<span class="map-kind map-kind-${esc(node.kind)}">${labels[node.kind]||'ФАЙЛ'}</span><span class="map-path">${esc(node.file)}</span>`;
    function shell(){return `<div class="page-title"><div><h1><span class="page-prompt" aria-hidden="true">&gt;</span>Карта проекта</h1></div><div class="stack"><button class="button small secondary" data-map-action="main">Главная сцена</button><button class="button small secondary" data-map-action="refresh">Обновить</button><button class="button small" data-map-action="copy">Для агента</button></div></div>${!getRoot()?'<div class="demo-banner"><span><strong>ДЕМО</strong> / Пример связей</span><button class="text-button" data-action="open">Выбрать папку игры →</button></div>':''}<div class="map-meta" role="status"></div><div class="map-stats"></div><div class="map-layout"><aside class="card map-inventory"><label class="field"><span>Найти файл или класс</span><input id="map-search" type="search" maxlength="200" autocomplete="off" placeholder="menu, player, theme…" value="${esc(query)}"></label><label class="field"><span>Показывать</span><select id="map-kind">${[['all','Все файлы'],['scene','Сцены'],['script','Скрипты'],['resource','Ресурсы'],['asset','Ассеты'],['shader','Шейдеры'],['unlinked','Без входящих связей']].map(([value,label])=>`<option value="${value}" ${kind===value?'selected':''}>${label}</option>`).join('')}</select></label><div class="map-list-count"></div><div class="map-file-list" aria-label="Файлы проекта"></div><div class="map-pages"></div></aside><section class="map-detail" aria-label="Связи выбранного файла"></section></div><details class="technical-note map-notes"><summary>Что показывает карта</summary><p>Стрелки направлены от файла к тому, на который он ссылается. Путь и строка — основание связи. Без входящих связей не означает «не используется»: возможны динамические загрузки, встроенные классы и двоичные сцены. Карта не запускает игру и не меняет файлы.</p><div class="map-warnings"></div></details>`;}
    function drawInventory(){
      if(!host?.isConnected||!inventory)return;
      const s=inventory.summary;
      host.querySelector('.map-stats').innerHTML=[['Файлы',s.files],['Сцены',s.scenes],['Скрипты',s.scripts],['Связи',s.links],['Нет файла',s.missing]].map(([name,value])=>`<div><strong>${value}</strong><span>${name}</span></div>`).join('');
      host.querySelector('.map-meta').textContent=`${getRoot()?'Локальная карта':'Демонстрация'} / ${new Date(inventory.indexed_at).toLocaleTimeString('ru-RU')} / ${s.limited?'НЕПОЛНАЯ КАРТА':s.files+' файлов'}${getRoot()?' / повторно использовано: '+s.reused:''}`;
      host.querySelector('.map-list-count').textContent=`Найдено ${inventory.total} / ${inventory.total?offset+1:0}–${Math.min(offset+inventory.files.length,inventory.total)}`;
      host.querySelector('.map-file-list').innerHTML=inventory.files.map(n=>button(n.file,`${fileLabel(n)}<small>← ${n.incoming||0} / ${n.outgoing||0} →</small>`,n.file===selected?'selected':'')).join('')||'<p class="empty">Файлы не найдены.</p>';
      host.querySelector('.map-pages').innerHTML=`<button class="text-button" data-map-action="prev" ${offset?'':'disabled'}>← Назад</button><button class="text-button" data-map-action="next" ${offset+inventory.files.length<inventory.total?'':'disabled'}>Далее →</button>`;
      host.querySelector('.map-warnings').innerHTML=inventory.warnings.map(w=>`<p>${esc(w)}</p>`).join('');
      host.querySelector('[data-map-action="main"]').disabled=!inventory.main;
    }
    function drawDetail(){
      if(!host?.isConnected||!detail)return;const n=detail.selected;
      const column=(title,edges,total,direction)=>`<section class="map-column"><h3>${title} <span>/ ${total}</span></h3>${edges.map(e=>button(e.node.file,`${fileLabel(e.node)}<small>${esc(relations[e.kind]||e.kind)} / ${esc(e.from)}:${e.line}${e.missing?' / НЕТ ФАЙЛА':e.unindexed?' / вне индекса':''}</small>`,e.missing?'map-missing':'')).join('')||`<p class="map-empty">${linkOffset?'На этой странице связей нет.':direction==='in'?'Входящие ссылки не найдены.':'Исходящие ссылки не найдены.'}</p>`}</section>`;
      const symbols=n.functions?.length||n.signals?.length?`<div class="map-symbols"><h3>В скрипте</h3>${[...(n.functions||[]).map(f=>({...f,label:'func'})),...(n.signals||[]).map(f=>({...f,label:'signal'}))].map(f=>`<div><span>${f.label}</span> ${esc(f.name)} <small>:${f.line}</small></div>`).join('')}</div>`:'';
      host.querySelector('.map-detail').innerHTML=`<div class="map-focus-heading"><span class="section-label">ВЫБРАННЫЙ ФАЙЛ</span><h2>${esc(n.file)}</h2><span class="compact-hint">${n.class_name?'class_name '+esc(n.class_name)+' / ':''}${n.exists===false?'Файл отсутствует':n.unparsed?'Содержимое не разобрано':labels[n.kind]||'ФАЙЛ'}</span></div><div class="map-graph" aria-label="Направление связей: использующие файлы, выбранный файл, зависимости">${column('Где используется',detail.incoming,detail.incoming_total,'in')}<div class="map-center"><span aria-hidden="true">→</span><div class="map-selected"><span class="map-kind">${labels[n.kind]||'ФАЙЛ'}</span><strong>${esc(n.file.split('/').at(-1))}</strong><small>${esc(n.file)}</small></div><span aria-hidden="true">→</span></div>${column('На что ссылается',detail.outgoing,detail.outgoing_total,'out')}</div>${detail.incoming_total>40||detail.outgoing_total>40?`<div class="map-pages"><button class="text-button" data-map-action="links-prev" ${linkOffset?'':'disabled'}>← Связи</button><span>${linkOffset+1}–${linkOffset+40}</span><button class="text-button" data-map-action="links-next" ${linkOffset+40<Math.max(detail.incoming_total,detail.outgoing_total)?'':'disabled'}>Связи →</button></div>`:''}${n.dynamic?`<p class="context-note">Динамических загрузок: ${n.dynamic}. Их цели нужно проверить в коде.</p>`:''}${detail.unresolved?.length?`<details class="technical-note"><summary>Не разрешены пути / ${detail.unresolved.length}</summary>${detail.unresolved.map(r=>`<p>${esc(r.file)}:${r.line} / ${esc(r.value)}</p>`).join('')}</details>`:''}${symbols}<p class="map-legend"><span>← Кто ссылается на файл</span><span>Куда ведут ссылки файла →</span></p>`;
      host.querySelectorAll('.map-file-list .map-file').forEach(b=>{b.classList.toggle('selected',b.dataset.mapFile===selected);b.setAttribute('aria-current',b.dataset.mapFile===selected?'true':'false');});
    }
    async function load({focusOnly=false}={}){
      const current=++generation;const root=getRoot();if(!host?.isConnected)return;
      if(focusOnly&&(inventory?.query!==query||inventory?.kind!==kind||inventory?.offset!==offset))focusOnly=false;
      host.querySelector('[data-map-action="copy"]').disabled=true;
      host.setAttribute('aria-busy','true');host.querySelector('.map-meta').textContent='Читаю карту проекта…';
      try{
        if(!focusOnly) {const result=await request({query,kind,offset,limit:40});if(current!==generation||root!==getRoot())return;inventory=result;drawInventory();}
        if(!selected)selected=inventory.main||'project.godot';
        const result=await request({file:selected,offset:linkOffset,limit:40});if(current!==generation||root!==getRoot())return;detail=result;drawDetail();
        host.querySelector('.map-meta').textContent=`${getRoot()?'Локальная карта':'Демонстрация'} / ${new Date(result.indexed_at).toLocaleTimeString('ru-RU')} / ${result.summary.limited?'НЕПОЛНАЯ КАРТА':result.summary.files+' файлов'}`;
      }catch(error){if(current!==generation||root!==getRoot())return;host.querySelector('.map-meta').textContent='Не удалось обновить карту: '+error.message;host.querySelector('.map-detail').innerHTML='<p class="empty">'+esc(error.message)+'<br>Выберите файл в списке или главную сцену.</p>';detail=null;onError(error);}
      finally{if(current===generation&&host?.isConnected){host.removeAttribute('aria-busy');host.querySelector('[data-map-action="copy"]').disabled=!detail;}}
    }
    async function click(event){
      const target=event.target.closest('[data-map-file],[data-map-action]');if(!target||target.disabled)return;
      if(target.dataset.mapFile){selected=target.dataset.mapFile;linkOffset=0;await load({focusOnly:true});return;}
      const action=target.dataset.mapAction;
      if(action==='copy'){
        if(!detail){notify('Сначала дождитесь карты.');return;}
        const text=`Работаем с проектом Godot: ${getRoot()||'ДЕМОНСТРАЦИЯ'}.\nВыбран файл: ${selected}.\nПрочитай актуальный контекст Опоры и исходники перед правкой. Через MCP вызови opora_get_project, проверь папку, затем opora_get_project_map с project_id и file=${JSON.stringify(selected)}. Используй номера строк как подсказки; проверь их актуальность. При большом числе связей читай следующие страницы. Статические связи не доказывают использование при запуске.\n\nСнимок связей (страница, не весь проект):\n${JSON.stringify(detail,null,2)}`;
        try{if(bridge?.copy)await bridge.copy(text);else await navigator.clipboard.writeText(text);notify('Карта файла скопирована для агента.');}catch(error){onError(error);}return;
      }
      if(action==='main'){selected=inventory?.main;linkOffset=0;await load({focusOnly:true});}
      if(action==='refresh'){linkOffset=0;await load();}
      if(action==='prev'||action==='next'){offset=Math.max(0,offset+(action==='next'?40:-40));await load();}
      if(action==='links-prev'||action==='links-next'){linkOffset=Math.max(0,linkOffset+(action==='links-next'?40:-40));await load({focusOnly:true});}
    }
    function mount(element){
      host=element;const next=getRoot()||'demo';if(next!==key){key=next;inventory=null;detail=null;query='';kind='all';offset=0;linkOffset=0;selected=null;}
      host.innerHTML=shell();host.addEventListener('click',click);
      host.querySelector('#map-search').addEventListener('input',event=>{query=event.target.value;offset=0;clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),250);});
      host.querySelector('#map-kind').addEventListener('change',event=>{kind=event.target.value;offset=0;load();});
      drawInventory();drawDetail();load();
    }
    return {mount};
  }
  return {create};
})();
