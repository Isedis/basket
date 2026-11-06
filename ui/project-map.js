/* Read-only map UI. Paths are text; file contents are never executed. */
window.OporaProjectMap=(()=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const labels={project:'ПРОЕКТ',scene:'СЦЕНА',script:'СКРИПТ',resource:'РЕСУРС',shader:'ШЕЙДЕР',asset:'АССЕТ',other:'ФАЙЛ'};
  const relations={class:'глобальный класс',main:'главная сцена',autoload:'автозагрузка',extends:'наследование',preload:'preload',load:'load',setting:'настройка',literal:'путь в коде',resource:'ресурс'};
  const demoGroups={project:'Запуск и настройки',interface:'Меню и интерфейс',combat:'Бой',characters:'Персонажи',progress:'Прогрессия',inventory:'Инвентарь',saves:'Сохранения'};
  const demoFiles=[['project.godot','project','project'],['scenes/main_menu.tscn','scene','interface'],['scripts/main_menu.gd','script','interface'],['ui/game_theme.tres','resource','interface'],['assets/logo.png','asset','interface'],['combat/arena.tscn','scene','combat'],['combat/combat.gd','script','combat'],['characters/player.tscn','scene','characters'],['characters/player.gd','script','characters'],['characters/enemy.tscn','scene','characters'],['progress/upgrades.tres','resource','progress'],['progress/progress.gd','script','progress'],['inventory/items.tres','resource','inventory'],['inventory/inventory.gd','script','inventory'],['saves/save_manager.gd','script','saves']].map(([file,kind,system_id])=>({file,kind,system_id,system_label:demoGroups[system_id],exists:true}));
  demoFiles[2].functions=[{name:'_on_play_pressed',line:8}];
  const demoEdges=[[0,1],[1,2],[1,3],[1,4],[2,5],[5,6],[5,7],[5,9],[6,10],[7,8],[8,12],[8,13],[11,14],[13,14],[6,11]].map(([from,to],i)=>({from:demoFiles[from].file,to:demoFiles[to].file,line:i+2,kind:i?'resource':'main',node:demoFiles[to]}));
  for(const n of demoFiles){n.incoming=demoEdges.filter(e=>e.to===n.file).length;n.outgoing=demoEdges.filter(e=>e.from===n.file).length;}
  function demo(options={}){
    const offset=options.offset||0,limit=options.limit||40,base={map_revision:'demo',indexed_at:new Date().toISOString(),main:'scenes/main_menu.tscn',summary:{files:demoFiles.length,scenes:demoFiles.filter(n=>n.kind==='scene').length,scripts:demoFiles.filter(n=>n.kind==='script').length,resources:3,links:demoEdges.length,missing:0,dynamic:0,read:0,reused:0},warnings:[],offset,limit};
    if(options.view==='systems'){
      const groups=Object.entries(demoGroups).map(([id,label])=>{const files=demoFiles.filter(n=>n.system_id===id);return {id,label,files:files.length,scenes:files.filter(n=>n.kind==='scene').length,scripts:files.filter(n=>n.kind==='script').length,resources:files.filter(n=>n.kind==='resource').length,assets:files.filter(n=>n.kind==='asset').length,missing:0,entry:files.find(n=>n.kind==='scene')?.file||files[0]?.file};}).filter(g=>g.label.toLowerCase().includes((options.query||'').toLowerCase()));
      const links=new Map();for(const e of demoEdges){const from=demoFiles.find(n=>n.file===e.from).system_id,to=e.node.system_id;if(from!==to){const key=from+'>'+to;if(!links.has(key))links.set(key,{from,to,count:0});links.get(key).count++;}}
      const systems=groups.slice(offset,offset+limit),shown=new Set(systems.map(g=>g.id)),system_links=[...links.values()].filter(e=>shown.has(e.from)&&shown.has(e.to));return {...base,systems,systems_total:groups.length,system_links,system_links_total:system_links.length,main_system:'interface'};
    }
    if(options.file){const incoming=demoEdges.filter(e=>e.to===options.file).map(e=>({...e,node:demoFiles.find(n=>n.file===e.from)})),outgoing=demoEdges.filter(e=>e.from===options.file);return {...base,selected:demoFiles.find(n=>n.file===options.file),incoming:incoming.slice(offset,offset+limit),outgoing:outgoing.slice(offset,offset+limit),incoming_total:incoming.length,outgoing_total:outgoing.length,unresolved:[]};}
    const files=demoFiles.filter(n=>(!options.system||options.system===n.system_id)&&(!options.query||n.file.includes(options.query.toLowerCase()))&&(!options.kind||options.kind==='all'||(options.kind==='unlinked'?!n.incoming:n.kind===options.kind)));return {...base,files:files.slice(offset,offset+limit),total:files.length,query:options.query||'',kind:options.kind||'all',system:options.system||null};
  }
  function create({getRoot,bridge,notify,onError}){
    const LINKS=8;
    const fileCount=n=>`${n} ${n%10===1&&n%100!==11?'файл':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'файла':'файлов'}`;
    let mode='systems',system=null,systems=null,systemQuery='',observer,frame;
    let host,key,inventory,detail,query='',kind='all',offset=0,linkOffset=0,symbolOffset=0,selected=null,generation=0,searchTimer;
    const request=options=>getRoot()?bridge.projectMap(options):Promise.resolve(demo(options));
    const button=(file,content,extra='',group='')=>`<button class="map-file ${extra}" data-map-file="${esc(file)}" data-file-system="${esc(group)}" title="${esc(file)}">${content}</button>`;
    const fileLabel=node=>`<span class="map-kind map-kind-${esc(node.kind)}">${labels[node.kind]||'ФАЙЛ'}</span><span class="map-node-name">${esc(node.file.split('/').at(-1))}</span><span class="map-path">${esc(node.file)}</span>`;
    function shell(){return `<div class="page-title"><div><h1><span class="page-prompt" aria-hidden="true">&gt;</span>Карта проекта</h1></div><div class="stack"><button class="button small secondary" data-map-action="main">Главная сцена</button><button class="button small secondary" data-map-action="refresh">Обновить</button><button class="button small" data-map-action="copy">Для агента</button></div></div>${!getRoot()?'<div class="demo-banner"><span><strong>ДЕМО</strong> / Пример связей</span><button class="text-button" data-action="open">Выбрать папку игры →</button></div>':''}<div class="map-meta" role="status"></div><div class="map-stats"></div><div class="map-view-tabs" role="group" aria-label="Вид карты"><button class="button small" data-map-action="systems">▦ Системы игры</button><button class="button small secondary" data-map-action="files">⌘ Связи файлов</button><span class="map-breadcrumb"></span></div><section class="map-overview" aria-label="Системы игры"></section><div class="map-layout" hidden><aside class="card map-inventory"><label class="field"><span>Найти файл или класс</span><input id="map-search" type="search" maxlength="200" autocomplete="off" placeholder="menu, player, theme…" value="${esc(query)}"></label><label class="field"><span>Показывать</span><select id="map-kind">${[['all','Все файлы'],['scene','Сцены'],['script','Скрипты'],['resource','Ресурсы'],['asset','Ассеты'],['shader','Шейдеры'],['unlinked','Без входящих связей']].map(([value,label])=>`<option value="${value}" ${kind===value?'selected':''}>${label}</option>`).join('')}</select></label><div class="map-list-count"></div><div class="map-file-list" aria-label="Файлы проекта"></div><div class="map-pages"></div></aside><section class="map-detail" aria-label="Связи выбранного файла"></section></div><details class="technical-note map-notes"><summary>Что показывает карта</summary><p>Стрелки направлены от файла к тому, на который он ссылается. Путь и строка — основание связи. Без входящих связей не означает «не используется»: возможны динамические загрузки, встроенные классы и двоичные сцены. Карта не запускает игру и не меняет файлы.</p><div class="map-warnings"></div></details>`;}
    const iconPaths={interface:'M3 4h18v13H3z M8 21h8 M12 17v4',combat:'M4 3l16 17 M3 7l4-4 M3 17l4 4 M20 3L4 19 M17 3l4 4 M17 21l4-4',characters:'M15 7a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M5 21v-3a7 7 0 0 1 14 0v3',progress:'M3 21h18 M5 17v-4h4v4 M11 17V9h4v8 M17 17V4h4v13',inventory:'M3 7l9-4 9 4v13H3z M3 7l9 4 9-4 M12 11v9',saves:'M4 3h14l3 3v15H3V3z M7 3v7h10V3 M7 21v-7h10v7',project:'M8 4l12 8-12 8z',scripts:'M8 5L2 12l6 7 M16 5l6 7-6 7 M14 3l-4 18',resources:'M12 2l10 10-10 10L2 12z'};
    const glyph=(id,kind)=>`<svg class="map-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="${iconPaths[id]||iconPaths[kind]||iconPaths.resources}"/></svg>`;
    function applyMode(){
      host.querySelector('.map-overview').hidden=mode!=='systems';host.querySelector('.map-layout').hidden=mode==='systems';
      for(const b of host.querySelectorAll('.map-view-tabs button')){b.classList.toggle('secondary',b.dataset.mapAction!==mode);b.setAttribute('aria-pressed',String(b.dataset.mapAction===mode));}
      const label=systems?.systems.find(g=>g.id===system)?.label||inventory?.files.find(n=>n.system_id===system)?.system_label;
      host.querySelector('.map-breadcrumb').textContent=mode==='systems'?'Обзор → система → файл':system?(label||system.replace('folder:','')):'Все файлы';
    }
    function drawSystems(){
      const searching=document.activeElement?.id==='map-system-search',caret=document.activeElement?.selectionStart;
      const summary=systems.summary;
      host.querySelector('.map-stats').innerHTML=[['Системы',systems.systems_total],['Сцены',summary.scenes],['Скрипты',summary.scripts],['Связи',summary.links],['Нет файла',summary.missing]].map(([name,value])=>`<div><strong>${value}</strong><span>${name}</span></div>`).join('');
      host.querySelector('.map-meta').textContent=(getRoot()?'По файлам проекта':'Демонстрация')+' / '+(summary.limited?'НЕПОЛНАЯ КАРТА':'Группы по папкам и именам');
      host.querySelector('[data-map-action="main"]').disabled=!systems.main;
      host.querySelector('.map-overview').innerHTML=`<div class="map-overview-heading"><div><h2>Устройство игры</h2><p>Выберите систему, чтобы увидеть её файлы и зависимости.</p></div><label class="field"><span class="sr-only">Найти систему</span><input type="search" id="map-system-search" placeholder="Найти систему…" maxlength="200" value="${esc(systemQuery)}"></label></div><div class="map-system-board">${systems.systems.map((g,i)=>`<button class="map-system-card ${g.missing?'has-issues':''}" data-map-system="${esc(g.id)}"><span class="map-system-top"><span class="map-system-icon">${glyph(g.id,g.scenes?'interface':g.scripts?'scripts':'resources')}</span><span class="map-system-code">SYS / ${String(offset+i+1).padStart(2,'0')}</span>${g.id===systems.main_system?'<span class="map-entry-tag">ВХОД В ИГРУ</span>':'<span class="map-system-open" aria-hidden="true">↗</span>'}</span><strong>${esc(g.label)}</strong><span class="map-system-counts"><span><b>${g.scenes}</b><small>Сцены</small></span><span><b>${g.scripts}</b><small>Скрипты</small></span><span><b>${g.resources+g.assets}</b><small>Ресурсы</small></span></span><span class="map-system-entry" title="${esc(g.entry)}">${esc(g.entry)}</span><span class="map-system-bottom">${fileCount(g.files)}${g.missing?`<span class="map-issue">Нет целей ссылок: ${g.missing}</span>`:'<span>Открыть связи →</span>'}</span></button>`).join('')||'<div class="map-overview-empty">Системы не найдены. Измените поиск или выберите папку игры.</div>'}</div><div class="map-overview-footer"><span>● Откуда → куда / наведите на систему, чтобы увидеть её связи${systems.system_links_total>systems.system_links.length?' / показана часть связей':''}</span><div class="map-pages"><button class="text-button" data-map-action="prev" ${offset?'':'disabled'}>← Назад</button><span>${systems.systems_total?offset+1:0}–${Math.min(offset+24,systems.systems_total)} / ${systems.systems_total}</span><button class="text-button" data-map-action="next" ${offset+24<systems.systems_total?'':'disabled'}>Далее →</button></div></div>`;
      host.querySelector('#map-system-search').addEventListener('input',event=>{systemQuery=event.target.value;offset=0;clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),300);});
      if(searching){const input=host.querySelector('#map-system-search');input.focus();if(caret!==null)input.setSelectionRange(caret,caret);}
      host.querySelector('.map-warnings').innerHTML=systems.warnings.map(w=>`<p>${esc(w)}</p>`).join('');scheduleLines();
    }
    function highlightSystem(event){
      const board=host.querySelector(mode==='systems'?'.map-system-board':'.map-graph');if(!board)return;
      const target=event.target.closest?.(mode==='systems'?'[data-map-system]':'[data-map-file]');
      const id=(mode==='systems'?target?.dataset.mapSystem:target?.dataset.mapFile)||(mode==='systems'?systems?.main_system:selected);
      board.classList.toggle('has-focus',!!id);
      const neighbors=new Set(id?[id]:[]);
      for(const line of board.querySelectorAll('.map-wire')){const active=!!id&&(line.dataset.from===id||line.dataset.to===id);line.classList.toggle('active',active);if(active){neighbors.add(line.dataset.from);neighbors.add(line.dataset.to);}}
      for(const connection of board.querySelectorAll('.map-connection'))connection.classList.toggle('active',!!id&&(connection.dataset.from===id||connection.dataset.to===id));
      for(const card of board.querySelectorAll(mode==='systems'?'[data-map-system]':'[data-map-file]'))card.classList.toggle('map-related',neighbors.has(mode==='systems'?card.dataset.mapSystem:card.dataset.mapFile));
    }
    function scheduleLines(){cancelAnimationFrame(frame);frame=requestAnimationFrame(drawLines);}
    function drawLines(){
      if(!host?.isConnected)return;
      const board=host.querySelector(mode==='systems'?'.map-system-board':'.map-graph');if(!board)return;
      board.querySelector('.map-wires')?.remove();const bounds=board.getBoundingClientRect();if(!bounds.width)return;
      const links=mode==='systems'?(systems?.system_links||[]).map(e=>({...e,a:board.querySelector(`[data-map-system="${CSS.escape(e.from)}"]`),b:board.querySelector(`[data-map-system="${CSS.escape(e.to)}"]`)})):[...(detail?.incoming||[]).map(e=>({...e,a:[...board.querySelectorAll('.map-column:first-child [data-map-file]')].find(n=>n.dataset.mapFile===e.from),b:board.querySelector('.map-selected')})),...(detail?.outgoing||[]).map(e=>({...e,a:board.querySelector('.map-selected'),b:[...board.querySelectorAll('.map-column:last-child [data-map-file]')].find(n=>n.dataset.mapFile===e.to)}))];
      const id=mode==='systems'?'system-arrow':'file-arrow';
      const usable=links.filter(e=>e.a&&e.b);
      const geometry=usable.map(e=>{const a=e.a.getBoundingClientRect(),b=e.b.getBoundingClientRect();const stacked=mode==='files'&&getComputedStyle(board).gridTemplateColumns.trim().split(/\s+/).length===1;const vertical=stacked||(mode==='systems'&&Math.abs(a.top-b.top)>30);const forward=vertical?b.top>a.top:b.left>a.left;const detour=mode==='systems'&&!vertical&&Math.abs(b.left-a.left)>a.width+parseFloat(getComputedStyle(board).columnGap)+2;const longVertical=vertical&&mode==='systems'&&Math.abs(b.top-a.top)>Math.max(a.height,b.height)+parseFloat(getComputedStyle(board).rowGap)+2;return {...e,aRect:a,bRect:b,vertical,forward,detour,longVertical};});
      const port=(edge,source)=>{
        const element=source?edge.a:edge.b,rect=source?edge.aRect:edge.bRect;
        const peers=geometry.filter(e=>(source?e.a:e.b)===element&&e.vertical===edge.vertical&&e.forward===edge.forward&&e.detour===edge.detour);
        const ratio=(peers.indexOf(edge)+1)/(peers.length+1);
        if(edge.detour)return {x:rect.left-bounds.left+rect.width*(.2+.6*ratio),y:rect.top-bounds.top};
        if(edge.vertical)return {x:rect.left-bounds.left+rect.width*(.2+.6*ratio),y:(source===edge.forward?rect.bottom:rect.top)-bounds.top};
        return {x:(source===edge.forward?rect.right:rect.left)-bounds.left,y:rect.top-bounds.top+rect.height*(.15+.7*ratio)};
      };
      const paths=geometry.map(e=>{
        const a=port(e,true),b=port(e,false),sign=e.forward?1:-1;
        // Real border ports plus a visible dot and arrow make direction explicit.
        let d;
        if(e.detour){const lane=Math.min(a.y,b.y)-18;d=`M ${a.x} ${a.y} L ${a.x} ${lane} L ${b.x} ${lane} L ${b.x} ${b.y}`;}
        else if(e.vertical&&(e.longVertical||mode==='files')){const lane=mode==='files'&&e.to===selected?3:bounds.width-3;d=`M ${a.x} ${a.y} L ${a.x} ${a.y+sign*14} L ${lane} ${a.y+sign*14} L ${lane} ${b.y-sign*14} L ${b.x} ${b.y-sign*14} L ${b.x} ${b.y}`;}
        else if(e.vertical){const middle=(a.y+b.y)/2;d=`M ${a.x} ${a.y} L ${a.x} ${a.y+sign*14} L ${a.x} ${middle} L ${b.x} ${middle} L ${b.x} ${b.y-sign*12} L ${b.x} ${b.y}`;}
        else{const middle=(a.x+b.x)/2;d=`M ${a.x} ${a.y} L ${a.x+sign*14} ${a.y} L ${middle} ${a.y} L ${middle} ${b.y} L ${b.x-sign*12} ${b.y} L ${b.x} ${b.y}`;}
        return `<g class="map-connection" data-from="${esc(e.from||'')}" data-to="${esc(e.to||'')}"><path class="map-wire" data-from="${esc(e.from||'')}" data-to="${esc(e.to||'')}" d="${d}" marker-end="url(#${id})"/><circle class="map-port" cx="${a.x}" cy="${a.y}" r="4"/><circle class="map-port-target" cx="${b.x}" cy="${b.y}" r="2"/></g>`;
      }).join('');
      board.insertAdjacentHTML('afterbegin',`<svg class="map-wires" aria-hidden="true" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}"><defs><marker id="${id}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M1,1 L11,6 L1,11" fill="none" stroke="context-stroke" stroke-width="2"/></marker></defs>${paths}</svg>`);
      const focused=document.activeElement?.closest?.('[data-map-system],[data-map-file]');
      highlightSystem({target:focused&&board.contains(focused)?focused:board});
    }

    function drawInventory(){
      if(!host?.isConnected||!inventory)return;
      const s=inventory.summary;
      host.querySelector('.map-stats').innerHTML=[['Файлы',s.files],['Сцены',s.scenes],['Скрипты',s.scripts],['Связи',s.links],['Нет файла',s.missing]].map(([name,value])=>`<div><strong>${value}</strong><span>${name}</span></div>`).join('');
      host.querySelector('.map-meta').textContent=`${getRoot()?'Локальная карта':'Демонстрация'} / ${new Date(inventory.indexed_at).toLocaleTimeString('ru-RU')} / ${s.limited?'НЕПОЛНАЯ КАРТА':s.files+' файлов'}${getRoot()?' / повторно использовано: '+s.reused:''}`;
      host.querySelector('.map-list-count').textContent=`Найдено ${inventory.total} / ${inventory.total?offset+1:0}–${Math.min(offset+inventory.files.length,inventory.total)}`;
      host.querySelector('.map-file-list').innerHTML=inventory.files.map(n=>button(n.file,`${fileLabel(n)}<small>← ${n.incoming||0} / ${n.outgoing||0} →</small>`,n.file===selected?'selected':'',n.system_id)).join('')||'<p class="empty">Файлы не найдены.</p>';
      host.querySelector('.map-pages').innerHTML=`<button class="text-button" data-map-action="prev" ${offset?'':'disabled'}>← Назад</button><button class="text-button" data-map-action="next" ${offset+inventory.files.length<inventory.total?'':'disabled'}>Далее →</button>`;
      host.querySelector('.map-warnings').innerHTML=inventory.warnings.map(w=>`<p>${esc(w)}</p>`).join('');
      host.querySelector('[data-map-action="main"]').disabled=!inventory.main;
    }
    function drawDetail(){
      if(!host?.isConnected||!detail)return;const n=detail.selected;
      const column=(title,edges,total,direction)=>`<section class="map-column"><h3>${title} <span>/ ${total}</span></h3>${edges.map(e=>button(e.node.file,`${fileLabel(e.node)}<small>${esc(relations[e.kind]||e.kind)} / ${esc(e.from)}:${e.line}${e.missing?' / НЕТ ФАЙЛА':e.unindexed?' / вне индекса':''}</small>`,e.missing?'map-missing':'',e.node.system_id)).join('')||`<p class="map-empty">${linkOffset?'На этой странице связей нет.':direction==='in'?'Входящие ссылки не найдены.':'Исходящие ссылки не найдены.'}</p>`}</section>`;
      const symbols=n.functions?.length||n.signals?.length?`<div class="map-symbols"><h3>В скрипте / ${n.functions_total||n.functions?.length||0} функций, ${n.signals_total||n.signals?.length||0} сигналов</h3>${[...(n.functions||[]).map(f=>({...f,label:'func'})),...(n.signals||[]).map(f=>({...f,label:'signal'}))].map(f=>`<div><span>${f.label}</span> ${esc(f.name)} <small>:${f.line}</small></div>`).join('')}${detail.symbol_page?.available>32?`<div class="map-pages"><button class="text-button" data-map-action="symbols-prev" ${symbolOffset?'':'disabled'}>← Символы</button><span>${symbolOffset+1}–${Math.min(symbolOffset+32,detail.symbol_page.available)}</span><button class="text-button" data-map-action="symbols-next" ${detail.symbol_page.has_more?'':'disabled'}>Символы →</button></div>`:''}${n.symbols_limited?'<p class="context-note">Список ограничен 1024 символами каждого типа. Читайте исходник.</p>':''}</div>`:'';
      host.querySelector('.map-detail').innerHTML=`<div class="map-focus-heading"><span class="section-label">ВЫБРАННЫЙ ФАЙЛ</span><h2>${esc(n.file)}</h2><div class="map-focus-counts"><span>← Используют <b>${detail.incoming_total}</b></span><span>Зависимости <b>${detail.outgoing_total}</b> →</span></div><span class="compact-hint">${n.class_name?'class_name '+esc(n.class_name)+' / ':''}${n.exists===false?'Файл отсутствует':n.unparsed?'Содержимое не разобрано':labels[n.kind]||'ФАЙЛ'}</span></div><div class="map-graph" aria-label="Направление связей: использующие файлы, выбранный файл, зависимости">${column('Где используется',detail.incoming,detail.incoming_total,'in')}<div class="map-center"><span aria-hidden="true">→</span><div class="map-selected">${glyph(n.system_id,n.kind==='scene'?'interface':n.kind==='project'?'project':n.kind==='script'?'scripts':'resources')}<span class="map-focus-badge">В ФОКУСЕ</span><span class="map-kind">${labels[n.kind]||'ФАЙЛ'}</span><strong>${esc(n.file.split('/').at(-1))}</strong><small>${esc(n.file)}</small></div><span aria-hidden="true">→</span></div>${column('На что ссылается',detail.outgoing,detail.outgoing_total,'out')}</div>${detail.incoming_total>LINKS||detail.outgoing_total>LINKS?`<div class="map-pages"><button class="text-button" data-map-action="links-prev" ${linkOffset?'':'disabled'}>← Связи</button><span>${linkOffset+1}–${Math.min(linkOffset+LINKS,Math.max(detail.incoming_total,detail.outgoing_total))}</span><button class="text-button" data-map-action="links-next" ${linkOffset+LINKS<Math.max(detail.incoming_total,detail.outgoing_total)?'':'disabled'}>Связи →</button></div>`:''}${n.dynamic?`<p class="context-note">Динамических загрузок: ${n.dynamic}. Их цели нужно проверить в коде.</p>`:''}${detail.unresolved?.length?`<details class="technical-note"><summary>Не разрешены пути / ${detail.unresolved.length}</summary>${detail.unresolved.map(r=>`<p>${esc(r.file)}:${r.line} / ${esc(r.value)}</p>`).join('')}</details>`:''}${symbols}<p class="map-legend"><span>● Начало ссылки → стрелка у цели</span><span>Наведите на карточку, чтобы выделить её связи</span></p>`;
      host.querySelectorAll('.map-file-list .map-file').forEach(b=>{b.classList.toggle('selected',b.dataset.mapFile===selected);b.setAttribute('aria-current',b.dataset.mapFile===selected?'true':'false');});
    }
    async function load({focusOnly=false}={}){
      const current=++generation;const root=getRoot();if(!host?.isConnected)return;
      if(focusOnly&&(inventory?.query!==query||inventory?.kind!==kind||inventory?.offset!==offset))focusOnly=false;
      host.querySelector('[data-map-action="copy"]').disabled=true;
      host.setAttribute('aria-busy','true');host.querySelector('.map-meta').textContent='Читаю карту проекта…';
      try{
        applyMode();
        if(mode==='systems'){const result=await request({view:'systems',query:systemQuery,offset,limit:24});if(current!==generation||root!==getRoot())return;systems=result;drawSystems();return;}
        if(!focusOnly) {const result=await request({query,kind,offset,limit:40,system});if(current!==generation||root!==getRoot())return;inventory=result;drawInventory();applyMode();}
        if(!selected)selected=inventory.main||'project.godot';
        const result=await request({file:selected,offset:linkOffset,limit:LINKS,symbol_offset:symbolOffset});if(current!==generation||root!==getRoot())return;detail=result;drawDetail();scheduleLines();
        host.querySelector('.map-meta').textContent=`${getRoot()?'Локальная карта':'Демонстрация'} / ${new Date(result.indexed_at).toLocaleTimeString('ru-RU')} / ${result.summary.limited?'НЕПОЛНАЯ КАРТА':result.summary.files+' файлов'}`;
      }catch(error){if(current!==generation||root!==getRoot())return;host.querySelector('.map-meta').textContent='Не удалось обновить карту: '+error.message;host.querySelector('.map-detail').innerHTML='<p class="empty">'+esc(error.message)+'<br>Выберите файл в списке или главную сцену.</p>';detail=null;onError(error);}
      finally{if(current===generation&&host?.isConnected){host.removeAttribute('aria-busy');host.querySelector('[data-map-action="copy"]').disabled=mode==='systems'?!systems:!detail;}}
    }
    async function click(event){
      const target=event.target.closest('[data-map-file],[data-map-action],[data-map-system]');if(!target||target.disabled)return;
      if(target.dataset.mapSystem){system=target.dataset.mapSystem;const group=systems.systems.find(g=>g.id===system);mode='files';selected=group?.entry;offset=0;query='';kind='all';host.querySelector('#map-search').value='';host.querySelector('#map-kind').value='all';linkOffset=0;symbolOffset=0;await load();return;}
      if(target.dataset.mapFile){if(!target.closest('.map-file-list')){query='';kind='all';offset=0;host.querySelector('#map-search').value='';host.querySelector('#map-kind').value='all';}if(system&&target.dataset.fileSystem&&system!==target.dataset.fileSystem){system=target.dataset.fileSystem;offset=0;}selected=target.dataset.mapFile;linkOffset=0;symbolOffset=0;await load();return;}
      const action=target.dataset.mapAction;
      if(action==='systems'||action==='files'){mode=action;system=null;offset=0;await load();return;}
      if(action==='copy'&&mode==='systems'){const text='Карта систем проекта Godot. Группы определены по именам и папкам; проверь обязанности по исходникам. Через MCP opora_get_project_map используй view=systems, затем system=<id> для файлов группы. Связи статические, количество ссылок — не порядок выполнения.\n'+JSON.stringify(systems,null,2);try{if(bridge?.copy)await bridge.copy(text);else await navigator.clipboard.writeText(text);notify('Обзор систем скопирован для агента.');}catch(error){onError(error);}return;}
      if(action==='copy'){
        if(!detail){notify('Сначала дождитесь карты.');return;}
        const text=`Работаем с проектом Godot: ${getRoot()||'ДЕМОНСТРАЦИЯ'}.\nВыбран файл: ${selected}.\nПрочитай актуальный контекст Опоры и исходники перед правкой. Через MCP вызови opora_get_project, проверь папку, затем opora_get_project_map с project_id и file=${JSON.stringify(selected)}. Используй номера строк как подсказки; проверь их актуальность. При большом числе связей читай следующие страницы. Статические связи не доказывают использование при запуске.\n\nСнимок связей (страница, не весь проект):\n${JSON.stringify(detail,null,2)}`;
        try{if(bridge?.copy)await bridge.copy(text);else await navigator.clipboard.writeText(text);notify('Карта файла скопирована для агента.');}catch(error){onError(error);}return;
      }
      if(action==='main'){mode='files';system=null;query='';kind='all';host.querySelector('#map-search').value='';host.querySelector('#map-kind').value='all';selected=systems?.main||inventory?.main;offset=0;linkOffset=0;await load();}
      if(action==='refresh'){linkOffset=0;await load();}
      if(action==='prev'||action==='next'){offset=Math.max(0,offset+(action==='next'?(mode==='systems'?24:40):-(mode==='systems'?24:40)));await load();}
      if(action==='symbols-prev'||action==='symbols-next'){symbolOffset=Math.max(0,symbolOffset+(action==='symbols-next'?32:-32));await load({focusOnly:true});}
      if(action==='links-prev'||action==='links-next'){linkOffset=Math.max(0,linkOffset+(action==='links-next'?LINKS:-LINKS));await load({focusOnly:true});}
    }
    function mount(element){
      observer?.disconnect();cancelAnimationFrame(frame);host=element;const next=getRoot()||'demo';if(next!==key){key=next;mode='systems';systems=null;system=null;systemQuery='';inventory=null;detail=null;query='';kind='all';offset=0;linkOffset=0;symbolOffset=0;selected=null;}
      host.innerHTML=shell();host.addEventListener('click',click);
      host.querySelector('#map-search').addEventListener('input',event=>{query=event.target.value;offset=0;clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),250);});
      host.querySelector('#map-kind').addEventListener('change',event=>{kind=event.target.value;offset=0;load();});
      observer=new ResizeObserver(scheduleLines);observer.observe(host);
      host.addEventListener('mouseover',highlightSystem);host.addEventListener('focusin',highlightSystem);host.addEventListener('focusout',event=>{if(!event.relatedTarget?.closest?.('[data-map-system],[data-map-file]'))highlightSystem({target:host});});host.addEventListener('mouseout',event=>{if(!event.relatedTarget?.closest?.('[data-map-system],[data-map-file]'))highlightSystem({target:host});});
      applyMode();load();
    }
    return {mount};
  }
  return {create};
})();
