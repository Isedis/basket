/* Shared context format for desktop and demo. No network or filesystem access. */
function normalizeTaskFiles(files) {
  if(!Array.isArray(files)||files.length>32)throw new Error('К задаче можно прикрепить до 32 файлов.');
  return [...new Set(files.map(value=>{
    if(typeof value!=='string')throw new Error('Укажите путь файла внутри проекта.');
    const file=value.trim().replace(/\\/g,'/').replace(/^res:\/\//,'');
    if(!file||file.length>1024||/[\x00-\x1f:]/.test(file)||file.startsWith('/')||file.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Нужен относительный путь внутри игры, например ui/menu.tscn.');
    return file;
  }))];
}
function validateState(state) {
  if (!state || state.version !== 1 || typeof state.name !== 'string' || !state.name.trim()) throw new Error('Укажите название игры.');
  for (const key of ['genre', 'pitch', 'experience', 'goal', 'pillars', 'rules']) {
    if (typeof state[key] !== 'string') throw new Error(`Некорректное поле: ${key}`);
  }
  if (!state.brand || !['draft', 'approved'].includes(state.brand.status)) throw new Error('Некорректный статус брендбука.');
  for (const key of ['palette', 'fonts', 'direction', 'avoid']) if (typeof state.brand[key] !== 'string') throw new Error(`Некорректное поле стиля: ${key}`);
  if (state.brand.analysis !== undefined) {
    const a=state.brand.analysis;
    const bad=()=>{throw new Error('Повреждён отчёт анализа брендбука.');};
    if(!a || a.version!==1 || typeof a.scannedAt!=='string' || !a.stats || !Array.isArray(a.warnings) || a.warnings.some(w=>typeof w!=='string'))bad();
    for(const key of ['colors','imageColors','fonts','fontSizes','metrics','assets'])if(!Array.isArray(a[key]) || a[key].length>32)bad();
    for(const item of [...a.colors,...a.imageColors,...a.fontSizes,...a.metrics]) {
      if(!item || !Array.isArray(item.sources) || item.sources.some(s=>!s || typeof s.file!=='string' || !Number.isInteger(s.line) || typeof s.property!=='string'))bad();
    }
    if([...a.colors,...a.imageColors].some(c=>!/^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/.test(c.hex)))bad();
    if(a.fonts.some(f=>!f || typeof f.file!=='string' || !Array.isArray(f.sources)) || a.assets.some(f=>!f || typeof f.file!=='string'))bad();
  }
  if (!Array.isArray(state.tasks) || !Array.isArray(state.references)) throw new Error('Повреждены задачи или эталоны.');
  const ids = new Set();
  for (const task of state.tasks) {
    if (!task || typeof task.id !== 'string' || ids.has(task.id) || typeof task.title !== 'string' || typeof task.acceptance !== 'string' || !['backlog', 'active', 'done'].includes(task.status)) throw new Error('Некорректная задача.');
    if(task.files!==undefined){const normalized=normalizeTaskFiles(task.files);if(JSON.stringify(normalized)!==JSON.stringify(task.files))throw new Error('Пути задачи должны быть относительными и без повторов.');}
    ids.add(task.id);
  }
  if(state.deletedTasks!==undefined){
    if(!state.deletedTasks||typeof state.deletedTasks!=='object'||Array.isArray(state.deletedTasks))throw new Error('Повреждена корзина задач.');
    for(const [id,entry] of Object.entries(state.deletedTasks)){
      const task=entry?.task;
      if(!task||task.id!==id||typeof task.title!=='string'||typeof task.acceptance!=='string'||!['backlog','active','done'].includes(task.status)||typeof entry.deletedAt!=='string')throw new Error('Некорректная задача в корзине.');
      if(task.files!==undefined&&JSON.stringify(normalizeTaskFiles(task.files))!==JSON.stringify(task.files))throw new Error('Некорректные пути задачи в корзине.');
    }
  }
  if (state.activeTaskId && !ids.has(state.activeTaskId)) throw new Error('Выбранная задача не найдена.');
  for (const ref of state.references) {
    if (!ref || typeof ref.id !== 'string' || typeof ref.name !== 'string' || !/^\.opora\/references\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(ref.file) || !['draft', 'approved'].includes(ref.status)) throw new Error('Некорректный визуальный эталон.');
  }
  return state;
}

function contextMarkdown(state) {
  validateState(state);
  const s = state;
  const brandStatus = s.brand.status === 'approved' ? 'УТВЕРЖДЁН пользователем' : 'ЧЕРНОВИК — окончательные визуальные решения не утверждены';
  const active = s.tasks.find(t => t.id === s.activeTaskId && t.status !== 'done');
  const text = v => v.trim() || 'Не задано. Не считать это принятым решением.';
  return `# ${s.name}: общий контекст игры

Эту памятку создаёт Opora. Меняйте решения через приложение или MCP-инструменты opora_update_project / opora_update_brandbook; изменения здесь могут быть заменены при следующей синхронизации.
Актуальность: ${s.updatedAt || 'не указана'}. Движок: Godot.
Для правок интерфейса учитывай замечания opora_get_work_context; подробности и снимки читай по необходимости.
Без MCP проверь существующий .opora/visual-feedback.json. Решения «сохранить» учитывай в следующих задачах; результат принимает пользователь.

## Игра
Жанр: ${text(s.genre)}

Замысел: ${text(s.pitch)}

Ощущение игрока: ${text(s.experience)}

## Основы, которые нужно сохранять
${text(s.pillars)}

## Текущая цель
${text(s.goal)}

## Брендбук
Статус: ${brandStatus}

### Визуальное направление
${text(s.brand.direction)}

### Палитра
${text(s.brand.palette)}

### Шрифты и типографика
${text(s.brand.fonts)}

### Не использовать
${text(s.brand.avoid)}

${s.brand.analysis ? `### Основание автоматического черновика
Сканирование файлов: ${s.brand.analysis.scannedAt}. Игра при этом не запускалась.
Найденные объявления цветов:\n${s.brand.analysis.colors.slice(0,12).map(c=>`- ${c.hex}: ${c.sources.map(p=>p.file+':'+p.line).join(', ')}`).join('\n') || 'Не найдены; палитра может быть приблизительно извлечена из изображений.'}
Ограничения:\n${s.brand.analysis.warnings.map(w=>'- '+w).join('\n')}
Выбор основного стиля остаётся за пользователем. Найденные файлы не становятся эталонами автоматически.
` : ''}

### Эталоны (пути от корня проекта)
${s.references.length ? s.references.map(r => `- [${r.status === 'approved' ? 'УТВЕРЖДЁН' : 'КАНДИДАТ, не эталон'}] ${r.name}: ${r.file}`).join('\n') : 'Эталоны ещё не добавлены. Не заявлять визуальное соответствие без эталонов.'}

## Постоянные замечания пользователя
${text(s.rules)}

## Выбранная задача
${active ? `${active.title}\n\nКритерии готовности:\n${text(active.acceptance)}${active.files?.length?'\n\nЗакреплённые файлы (прочитать перед правками):\n'+active.files.map(f=>'res://'+f).join('\n'):''}${active.feedbackNoteId?`\n\nСвязанное замечание: shot_id=${active.feedbackShotId}, note_id=${active.feedbackNoteId}. Прочитай снимок и решения через MCP.`:''}` : 'Нет выбранной незавершённой задачи. Уточнить конкретный запрос пользователя.'}

## Остальные задачи
${s.tasks.filter(t => t.id !== active?.id).map(t => `- [${({backlog:'в очереди', active:'в работе', done:'готово'})[t.status]}] ${t.title}`).join('\n') || 'Нет.'}

## Завершение работы
Проверь критерии выбранной задачи, сохрани существующие решения вне её рамок.
Сообщи, что изменилось, что проверено и что требует просмотра в Godot.
Эта памятка не доказывает, что агент её прочёл или что результат соответствует стилю.
`;
}

function taskBrief(state) {
  return `Работаем над проектом Godot «${state.name}».
Сначала перечитай AGENTS.md или CLAUDE.md, затем .opora/CONTEXT.md и перечисленные визуальные эталоны.
Выполни выбранную в памятке задачу по её критериям готовности.
Если выбранной задачи нет, сначала уточни конкретную задачу.
Ниже — текущая версия контекста на случай, если файлы ещё не синхронизированы.

${contextMarkdown(state)}`;
}


function mergeBrand(base,local,remote) {
  const brand={};const conflicts=[];
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
    if(same(local[key],base[key]))brand[key]=remote[key];
    else if(same(remote[key],base[key]) || same(local[key],remote[key]))brand[key]=local[key];
    else {brand[key]=local[key];conflicts.push(key);}
  }
  if(local.status==='approved' && base.status!=='approved' && !same(remote,base) && !same(local,remote) && !conflicts.includes('status'))conflicts.push('status');
  return {brand,conflicts};
}
function mergeProject(base,local,remote,preferRemote=false) {
  const conflicts=[];const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const merge=(b,l,r,key)=>{
    if(same(l,b))return r;
    if(same(r,b)||same(l,r))return l;
    if(key==='updatedAt')return [l,r].filter(Boolean).sort().at(-1);
    if(key==='deletedTasks'){const values=[b||{},l||{},r||{}];return Object.fromEntries([...new Set(values.flatMap(v=>Object.keys(v)))].map(id=>[id,merge(values[0][id],values[1][id],values[2][id],key+'.'+id)]).filter(([,v])=>v!==undefined));}
    if(key==='brand'){
      const result=mergeBrand(b,l,r);conflicts.push(...result.conflicts.map(k=>'brand.'+k));
      if(preferRemote)for(const k of result.conflicts)result.brand[k]=r[k];
      return result.brand;
    }
    if((key==='tasks'||key==='references') && [b,l,r].every(Array.isArray)){
      const maps=[b,l,r].map(a=>new Map(a.map(v=>[v.id,v])));
      return [...new Set([...maps[0].keys(),...maps[1].keys(),...maps[2].keys()])].map(id=>merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),key+'.'+id)).filter(Boolean);
    }
    if([b,l,r].every(v=>v && typeof v==='object' && !Array.isArray(v))){
      return Object.fromEntries([...new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])].map(k=>[k,merge(b[k],l[k],r[k],key?key+'.'+k:k)]));
    }
    conflicts.push(key);return preferRemote?r:l;
  };
  return {state:merge(base,local,remote,''),conflicts};
}
const OporaContext = {normalizeTaskFiles,validateState, contextMarkdown, taskBrief,mergeBrand,mergeProject};
if (typeof module !== 'undefined' && module.exports) module.exports = OporaContext;
