/* Local renderer. Filesystem access is limited to the desktop bridge. */
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const id = () => crypto.randomUUID();
const demoState = () => ({
  version:1, name:'Тихая орбита', genre:'Incremental idle · космическая станция',
  pitch:'Маленькая станция на краю обитаемого космоса. Игрок восстанавливает её, запускает производство и постепенно открывает новые орбиты.',
  experience:'Спокойное любопытство. Каждый небольшой шаг делает станцию чуть более живой.',
  goal:'Собрать главное меню, которое ощущается частью мира игры.',
  pillars:'Медленный, ощутимый прогресс.\nУютная научная фантастика без военной эстетики.\nЧистый интерфейс: один главный акцент на экране.',
  rules:'Не менять стиль соседних экранов ради одной задачи.\nНе добавлять свечение и градиенты без обсуждения.\nИспользовать существующие компоненты интерфейса.',
  brand:{status:'draft',direction:'Тихая ретрофутуристичная обсерватория. Матовые поверхности, тонкие линии, немного воздуха. Скругления сдержанные. Это направление для обсуждения, ещё не утверждённый брендбук.',palette:'#151E21 — фон\n#2B423F — панели\n#B7CB9B — основной акцент\n#E7DFCA — текст\n#DBA775 — редкий тёплый акцент',fonts:'Пока не выбраны. Не подменять системными шрифтами молча.',avoid:'Кислотный неон, военные HUD, глянцевые 3D-кнопки. Не вводить новые акцентные цвета.'},
  tasks:[{id:'menu',title:'Собрать главное меню',acceptance:'Кнопки: продолжить, новая игра, настройки.\nОдин основной акцент.\nСостояния наведения и фокуса.\nПроверить в Godot при 1280×720 и 1920×1080.',status:'active'},{id:'icons',title:'Определить стиль иконок ресурсов',acceptance:'Подготовить три образца в одном стиле: энергия, металл, исследования. Не считать образцы утверждёнными автоматически.',status:'backlog'},{id:'brief',title:'Сформулировать ощущение игры',acceptance:'Короткое описание без противоречий с основной механикой.',status:'done'}],
  activeTaskId:'menu', references:[], updatedAt:new Date().toISOString()
});
const blankState = name => ({version:1,name,genre:'',pitch:'',experience:'',goal:'',pillars:'',rules:'',brand:{status:'draft',direction:'',palette:'',fonts:'',avoid:''},tasks:[],activeTaskId:null,references:[],updatedAt:new Date().toISOString()});
let state;
try {state = JSON.parse(localStorage.getItem('opora-demo') || 'null'); if (state) OporaContext.validateState(state);} catch {state = null;}
state ||= demoState();
let root = null;
let tab = 'overview';
let timer = null;
let toastTimer;
let revision = 0;
let syncedRevision = -1;
let saves = Promise.resolve();
let failedSave = false;
let pendingSync = null;
let closing = false;
let scanning = false;
let applyingBrand = false;
let pendingBrand = null;
let updateState = null;
let updatesOpen = false;
let agentConnection = null;
let agentActivity = {reports:[],unreadable:0};
let agentLoading = false;
let pendingAgent = null;
let brandAssessment = null;
let assessmentFor = null;
let reviewBusy = false;
let reviewTimer = null;
let reviewErrorFor = null;
const bridge = window.opora;

function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').className = 'toast visible' + (error ? ' error' : '');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), error ? 11000 : 5500);
}
function fail(error) {console.error(error); toast(error.message || String(error), true);}
function status(text) {$('#save-status').textContent = text;}
function persist() {
  clearTimeout(timer);
  timer = null;
  const snapshot = structuredClone(state);
  const saveRevision = revision;
  if (!root) {
    try {localStorage.setItem('opora-demo', JSON.stringify(snapshot)); failedSave = false; status('Демо · сохранено в браузере');} catch {failedSave = true; toast('Не удалось сохранить демо в браузере.', true);}
    return Promise.resolve();
  }
  saves = saves.catch(() => {}).then(() => bridge.save(snapshot)).then(() => {
    failedSave = false;
    if (saveRevision === revision) status('Сохранено в проекте');
  }).catch(error => {failedSave = true; status('Не сохранено · ошибка'); fail(error); throw error;});
  // Attach a rejection handler for debounced, unawaited saves as well.
  saves.catch(() => {});
  return saves;
}
function changed() {
  state.updatedAt = new Date().toISOString();
  revision++;
  status('Сохраняю…');
  clearTimeout(timer);
  timer = setTimeout(() => {persist();}, 450);
  refreshChrome();
  if(tab==='brand'){refreshReviewPanel();queueBrandReview();}
}
function refreshChrome() {
  $('#side-name').textContent = state.name;
  $('#header-name').textContent = state.name;
  $('#side-mode').textContent = root ? 'Godot · папка подключена' : 'Демонстрационный проект';
  $('#task-count').textContent = state.tasks.filter(t => t.status !== 'done').length;
  $('#footer-status').textContent = root ? 'GODOT WORKSPACE / LOCAL' : 'GODOT WORKSPACE / DEMO';
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
}
function field(label, key, placeholder = '', multiline = false, rows = 3) {
  const value = key.split('.').reduce((obj,k) => obj[k], state);
  return `<label class="field"><span>${escapeHtml(label)}</span>${multiline ? `<textarea rows="${rows}" data-field="${key}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>` : `<input data-field="${key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`}</label>`;
}
function pageTitle(eyebrow, title, subtitle, action = '') {return `<div class="page-title"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;}
function demoBanner() {return root ? '' : '<div class="demo-banner"><span>◈</span><span><strong>Это пример, а не ваша игра.</strong> Всё можно попробовать. Файлы игры появятся здесь после подключения.</span><button class="text-button" data-action="open">Выбрать папку →</button></div>';}
function overview() {
  const active = state.tasks.find(t => t.id === state.activeTaskId && t.status !== 'done');
  return `${pageTitle('ПАМЯТЬ ПРОЕКТА','У каждой игры — своя опора.','Замысел, стиль и следующая задача. В одном месте.', '<span class="badge">◈ GODOT</span>')}${demoBanner()}
  <section class="hero"><div class="hero-content"><div class="eyebrow">СЕЙЧАС В ФОКУСЕ</div><h2>${escapeHtml(state.goal || 'С чего начнём вашу игру?')}</h2><p>${active ? escapeHtml(active.title) + ' · задача выбрана для передачи помощнику.' : 'Опишите ближайшую цель и выберите одну задачу для помощника.'}</p><div class="hero-meta"><button class="button small" data-action="goto-context">Подготовить контекст <span>→</span></button><button class="text-button" data-action="goto-tasks">К задачам →</button></div></div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><span>KEEP THE VISION IN ORBIT</span></div></section>
  <div class="overview-stats"><div class="stat"><span class="stat-icon">◐</span><div><strong>${state.brand.status === 'approved' ? 'Стиль утверждён' : 'Стиль в разработке'}</strong><small>${state.references.filter(r=>r.status === 'approved').length} утверждённых эталонов</small></div></div><div class="stat"><span class="stat-icon">☷</span><div><strong>${state.tasks.filter(t=>t.status!=='done').length} задач в работе и очереди</strong><small>${active ? 'Одна выбрана для помощника' : 'Выберите следующую'}</small></div></div><div class="stat"><span class="stat-icon">⌘</span><div><strong>${syncedRevision === revision ? 'Контекст синхронизирован' : 'Контекст ждёт передачи'}</strong><small>Общая памятка для двух агентов</small></div></div></div>
  <div class="grid-two"><section class="card"><div class="card-header"><h2><span class="index">01 /</span>Паспорт игры</h2><span class="badge muted">ЗАМЫСЕЛ</span></div>${field('Название игры','name','Как называется проект?')}${field('Жанр и формат','genre','Например: roguelike, 2D, PC')}${field('О чём игра','pitch','Что делает игрок и ради чего?',true)}${field('Что должен чувствовать игрок','experience','Какое ощущение объединяет механику и графику?',true)}${field('Ближайшая цель','goal','Один конкретный результат',true)}</section>
  <div><section class="card"><div class="card-header"><h2><span class="index">02 /</span>То, что держит игру вместе</h2></div>${field('Основы игры','pillars','Три главных принципа. По одному на строку.',true,4)}<div class="hint">Это опора для решений помощника: <strong>какой результат подходит именно этой игре.</strong></div></section><section class="card section-gap"><div class="card-header"><h2><span class="index">03 /</span>Чтобы не повторять снова</h2><span class="badge orange">ВАЖНО</span></div>${field('Постоянные замечания','rules','Например: не менять размеры кнопок; использовать существующие иконки.',true,5)}<p class="small">Раздражающую мелочь достаточно записать здесь один раз, затем передать обновлённую памятку агенту.</p></section></div></div>`;
}
function brand() {
  return `${pageTitle('ВИЗУАЛЬНЫЙ ЯЗЫК','Один мир. Один стиль.','Не просто «сделай красиво», а конкретные решения и эталоны.',`<label class="brand-status"><span class="visually-hidden">Статус брендбука</span><select data-field="brand.status"><option value="draft" ${state.brand.status==='draft'?'selected':''}>Брендбук: черновик</option><option value="approved" ${state.brand.status==='approved'?'selected':''}>Брендбук: утверждён</option></select></label>`)}${demoBanner()}
  <section class="card scan-card"><div class="card-header"><div><div class="eyebrow">ИЗ ФАЙЛОВ В ПРАВИЛА</div><h2>${scanning?'Изучаю ваш проект…':'Брендбук из вашей игры'}</h2><p class="small">Цвета, шрифты, оформление и образцы — по тому, что уже есть в проекте. Локально, без API.</p></div><button class="button small" data-action="scan-brand" ${scanning?'disabled':''}>${scanning?'Читаю файлы…':state.brand.analysis?'Пересобрать черновик':'Собрать брендбук из проекта'}</button></div><p class="small-note">Результат остаётся черновиком. При повторном анализе вы выбираете, какие поля заменить. Утверждённые образцы сохраняются.</p></section>
  <div id="brand-review-panel">${brandReviewPanel()}</div>
  ${state.brand.analysis?analysisSummary(state.brand.analysis):''}
  <div class="grid-two"><section class="card"><div class="card-header"><h2>Направление и границы</h2><span class="badge muted">ХАРАКТЕР</span></div>${field('Как выглядит мир игры','brand.direction','Формы, материалы, настроение, плотность деталей…',true,5)}${field('Чего избегаем','brand.avoid','Что точно не подходит этой игре?',true,4)}</section><section class="card"><div class="card-header"><h2>Визуальные константы</h2></div>${field('Палитра и назначение цветов','brand.palette','#HEX — где и для чего использовать',true,5)}${field('Шрифты и размеры','brand.fonts','Название шрифта, путь к файлу, размеры заголовков и текста',true,4)}</section></div>
  <section class="card section-gap"><div class="card-header"><div><h2>Покажите, как должно быть</h2><p class="small">Утверждённый экран полезнее десятка слов про атмосферу.</p></div><button class="button small secondary" data-action="add-reference">+ Добавить образцы</button></div>${state.references.length ? `<div class="reference-grid">${state.references.map(ref=>`<article class="reference"><img data-reference="${escapeHtml(ref.id)}" alt="${escapeHtml(ref.name)}"><div class="reference-info"><div class="reference-name" title="${escapeHtml(ref.name)}">${escapeHtml(ref.name)}</div><div class="reference-controls"><select aria-label="Статус образца ${escapeHtml(ref.name)}" data-ref-status="${escapeHtml(ref.id)}"><option value="draft" ${ref.status==='draft'?'selected':''}>Кандидат</option><option value="approved" ${ref.status==='approved'?'selected':''}>Утверждён</option></select><button class="icon-button" data-action="remove-reference" data-id="${escapeHtml(ref.id)}" aria-label="Убрать ${escapeHtml(ref.name)}">×</button></div></div></article>`).join('')}</div>` : '<div class="empty"><strong>Здесь будет визуальная точка отсчёта</strong>Добавьте меню, кнопку или набор иконок, которые уже нравятся.<br>Образец станет эталоном только после вашего утверждения.</div>'}<p class="small-note">PNG, JPG, WebP · до 20 МБ на изображение. Копии сохраняются в папке игры, чтобы агент мог их открыть. Автоматической оценки сходства пока нет.</p></section>`;
}
function currentBrandReview() {
  return brandAssessment && assessmentFor===OporaBrandReview.reviewSignature(state)?brandAssessment:OporaBrandReview.assessBrandbook(state);
}
function brandReviewPanel() {
  const report=currentBrandReview();
  const renderFinding=finding=>{
    const exists=state.tasks.some(t=>t.brandFindingId===finding.id && t.status!=='done');
    return `<article class="brand-finding ${finding.severity}"><div class="spaced"><h3>${escapeHtml(finding.title)}</h3><span class="badge ${finding.severity==='error'?'orange':'muted'}">${({error:'ПРОБЛЕМА',warning:'УТОЧНИТЬ',note:'НА ЗАМЕТКУ'})[finding.severity]}</span></div><p>${escapeHtml(finding.detail)}</p><div class="hint">${escapeHtml(finding.suggestion)}</div><div class="stack"><button class="text-button" data-action="brand-finding-task" data-id="${escapeHtml(finding.id)}" ${exists?'disabled':''}>${exists?'Задача уже добавлена':'+ Добавить задачу'}</button><button class="text-button" data-action="focus-brand-field" data-field-key="${escapeHtml(finding.field)}">Открыть поле →</button></div></article>`;
  };
  return `<section class="card brand-assessment"><div class="card-header"><div><div class="eyebrow">ЧТО ПОМОЖЕТ АГЕНТУ</div><h2>Разбор брендбука</h2></div><button class="button small secondary" data-action="review-brand" ${reviewBusy?'disabled':''}>${reviewBusy?'Проверяю…':'Проверить брендбук'}</button></div><div class="review-summary"><strong>${report.ready}<span> / ${report.total}</span></strong><div><h3>Пунктов с достаточными данными</h3><p>Полнота записанных правил. Это не оценка красоты игры.</p></div></div><details class="review-checklist"><summary>Какие пункты проверяются</summary><ul>${report.checks.map(c=>`<li><span>${c.status==='pass'?'✓':c.status==='issue'?'!':'?'}</span>${escapeHtml(c.label)}<small>${({pass:'ДАННЫЕ ЕСТЬ',issue:'ЕСТЬ ПРОБЛЕМА',needs_info:'НУЖНО УТОЧНИТЬ'})[c.status]}</small></li>`).join('')}</ul></details>${report.findings.length?`<div class="review-findings">${report.findings.slice(0,3).map(renderFinding).join('')}${report.findings.length>3?`<details><summary>Ещё замечаний: ${report.findings.length-3}</summary>${report.findings.slice(3).map(renderFinding).join('')}</details>`:''}</div>`:'<div class="hint">По этим проверкам проблем не найдено. Посмотрите реальные экраны: согласованность графики и ощущения игрока здесь не оценивались.</div>'}${report.pairs.length?`<details class="contrast-results"><summary>Проверенные текстовые пары · ${report.pairs.length}</summary>${report.pairs.map(p=>`<div class="contrast-result"><div class="color-preview" data-review-fg="${escapeHtml(p.foreground)}" data-review-bg="${escapeHtml(p.background)}">Продолжить игру</div><div><strong>${p.ratio===null?'Нужна подложка':OporaBrandReview.formatBrandRatio(p.ratio)+':1'}</strong><p>${escapeHtml(p.foreground)} на ${escapeHtml(p.background)}</p></div></div>`).join('')}<p class="small-note">Превью использует шрифт приложения, а не игры. ${escapeHtml(report.contrastBasis)}</p></details>`:''}<div class="spaced section-gap"><button class="text-button" data-action="copy-brand-review">Скопировать разбор для агента →</button><span class="small-note">${report.checkedAt?'Файлы проверены: '+escapeHtml(new Date(report.checkedAt).toLocaleTimeString('ru-RU')):'Доступность файлов ещё не проверена'}</span></div><p class="small-note">${escapeHtml(report.scope)} Результат также доступен через MCP: opora_review_brandbook.</p></section>`;
}
function refreshReviewPanel() {
  const panel=$('#brand-review-panel');if(!panel)return;
  const open=[...panel.querySelectorAll('details')].map(el=>el.open);
  panel.innerHTML=brandReviewPanel();
  panel.querySelectorAll('details').forEach((el,index)=>{if(open[index])el.open=true;});
  panel.querySelectorAll('[data-review-fg]').forEach(el=>{el.style.color=el.dataset.reviewFg;el.style.backgroundColor=el.dataset.reviewBg;});
}
function queueBrandReview() {
  clearTimeout(reviewTimer);
  if(root && bridge?.reviewBrandbook && tab==='brand' && !scanning && !applyingBrand && assessmentFor!==OporaBrandReview.reviewSignature(state) && reviewErrorFor!==OporaBrandReview.reviewSignature(state))reviewTimer=setTimeout(()=>reviewBrand().catch(fail),400);
}
async function reviewBrand(force=false) {
  if(reviewBusy)return;
  const project=root,signature=OporaBrandReview.reviewSignature(state);
  if(!force && (assessmentFor===signature || reviewErrorFor===signature))return;
  reviewBusy=true;refreshReviewPanel();
  try {
    const result=root && bridge?.reviewBrandbook?await bridge.reviewBrandbook(structuredClone(state)):OporaBrandReview.assessBrandbook(state);
    if(root===project && signature===OporaBrandReview.reviewSignature(state)){brandAssessment=result;assessmentFor=signature;reviewErrorFor=null;}
  } catch(error) {reviewErrorFor=signature;throw error;} finally {reviewBusy=false;refreshReviewPanel();queueBrandReview();}
}
function analysisSummary(report) {
  const colors=report.colors.length?report.colors:report.imageColors;
  return `<section class="card evidence-card"><div class="card-header"><div><h2>Откуда взялись решения</h2><p class="small">Прочитано файлов: ${escapeHtml(report.stats.textFiles)} · тем: ${escapeHtml(report.stats.themes)} · сцен: ${escapeHtml(report.stats.scenes)}. ${report.stats.limited?'Анализ неполный.':''}</p></div><span class="badge orange">${report.colors.length?'ОБЪЯВЛЕНИЯ В ФАЙЛАХ':'ЦВЕТА ИЗОБРАЖЕНИЙ · ПРИБЛИЗИТЕЛЬНО'}</span></div>${colors.length?`<div class="token-grid">${colors.slice(0,12).map(c=>`<div class="color-token"><span class="color-chip" data-color="${escapeHtml(c.hex)}"></span><div><strong>${escapeHtml(c.hex)}</strong><small>${escapeHtml(c.sources[0]?.file)}${c.sources[0]?.line?':'+c.sources[0].line:''}</small></div></div>`).join('')}</div>`:'<p class="small-note">Цвета не найдены. Можно добавить палитру вручную или выбрать изображения.</p>'}<details><summary>Источники, шрифты и ограничения анализа</summary>${report.fonts.map(f=>`<p class="small-note">Шрифт: <span class="file-tag">res://${escapeHtml(f.file)}</span> ${f.sources.length?'Есть статическая ссылка.':'Применение не подтверждено.'}</p>`).join('')}${colors.map(c=>`<p class="small-note">${escapeHtml(c.hex)}: ${c.sources.map(s=>escapeHtml(s.file)+(s.line?':'+s.line:'')+' · '+escapeHtml(s.property)).join('; ')}</p>`).join('')}<ul class="help-list">${report.warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul></details></section>`;
}
function taskCard(task) {
  const selected = state.activeTaskId === task.id && task.status !== 'done';
  return `<article class="task ${selected?'selected':''}"><div class="task-meta"><span>${selected?'↳ В КОНТЕКСТЕ ПОМОЩНИКА':'ЗАДАЧА'}</span><button class="text-button" data-action="edit-task" data-id="${escapeHtml(task.id)}" aria-label="Изменить задачу ${escapeHtml(task.title)}">⋯</button></div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.acceptance || 'Добавьте критерии готовности.')}</p><select data-task-status="${escapeHtml(task.id)}" aria-label="Статус задачи ${escapeHtml(task.title)}">${[['backlog','В очереди'],['active','В работе'],['done','Готово']].map(([v,t])=>`<option value="${v}" ${task.status===v?'selected':''}>${t}</option>`).join('')}</select><div class="task-footer"><span class="badge ${selected?'':'muted'}">${selected?'ТЕКУЩАЯ':'GODOT'}</span>${task.status!=='done'?`<button class="text-button" data-action="select-task" data-id="${escapeHtml(task.id)}">${selected?'Открыть контекст →':'Выбрать →'}</button>`:'<span class="small-note">Завершена ✓</span>'}</div></article>`;
}
function tasks() {
  return `${pageTitle('ОТ ЗАМЫСЛА К РЕЗУЛЬТАТУ','Следующий понятный шаг.','Одна выбранная задача — меньше решений на усмотрение помощника.','<button class="button" data-action="new-task">+ Новая задача</button>')}${demoBanner()}<div class="board">${[['backlog','В очереди'],['active','В работе'],['done','Готово']].map(([key,label])=>`<section class="column"><div class="column-header"><span class="column-dot ${key}"></span>${label}<span>${state.tasks.filter(t=>t.status===key).length}</span></div>${state.tasks.filter(t=>t.status===key).map(taskCard).join('') || '<div class="empty">Здесь пока нет задач.</div>'}</section>`).join('')}</div><p class="small-note section-gap">Статусы меняете вы. Приложение не наблюдает за терминалами и не считает задачу выполненной по словам агента.</p>`;
}
function context() {
  const synced = syncedRevision === revision;
  return `${pageTitle('ОБЩАЯ ТОЧКА ОТСЧЁТА','Пусть помощники видят целое.','Тот же замысел и те же ограничения — в Claude и Codex.',`<span class="badge ${synced?'':'orange'}">${synced?'✓ ПЕРЕДАНО В ФАЙЛЫ':'ЕСТЬ ЧТО ПЕРЕДАТЬ'}</span>`)}${demoBanner()}<div class="context-layout"><section class="card"><h2>Из приложения — в работу</h2><div class="context-steps"><div class="context-step"><span class="step-number">1</span><div><strong>Выберите задачу</strong>Добавьте проверяемые критерии готовности.</div></div><div class="context-step"><span class="step-number">2</span><div><strong>Обновите памятку</strong>Проверьте файлы перед записью в проект.</div></div><div class="context-step"><span class="step-number">3</span><div><strong>Передайте запрос агенту</strong>Вставьте его в Claude или Codex. Попросите перечитать контекст даже в старом чате.</div></div></div><button class="button full" data-action="preview-sync">Обновить файлы проекта →</button><button class="button secondary full section-gap" data-action="copy-brief">Скопировать запрос</button><hr class="mini-divider"><span class="file-tag">AGENTS.md</span><span class="file-tag">CLAUDE.md</span><span class="file-tag">.opora/CONTEXT.md</span><p class="small-note">Существующие инструкции сохраняются. Перед обновлением создаётся резервная копия.</p><p class="context-note">Файлы помогают удерживать контекст, но не гарантируют, что агент выполнит все правила. Результат нужно просмотреть в Godot.</p></section><section class="card"><div class="card-header"><h2>Что получит помощник</h2><span class="badge muted">ПРЕДПРОСМОТР</span></div><pre id="context-preview" class="code-preview"></pre></section></div>`;
}
function agents() {
  const info=agentConnection;
  const connectionCards=['claude','codex'].map(client=>{
    const configured=info?.status?.[client]?.configured;
    return `<section class="card"><div class="card-header"><h2>${client==='claude'?'Claude Code':'Codex CLI'}</h2><span class="badge ${configured?'':'muted'}">${configured?'НАСТРОЕНО':'НЕ НАСТРОЕНО'}</span></div><p class="small">${client==='claude'?'Настройки этой игры в .mcp.json. Claude может запросить разрешение на проектный MCP-сервер.':'Запись с отдельным именем в настройках Codex пользователя. Остальные серверы сохраняются.'}</p><button class="button secondary" data-action="configure-agent" data-client="${client}" ${!info?'disabled':''}>${configured?'Обновить подключение':'Настроить подключение'}</button>${info?.status?.[client]?.error?`<p class="context-note">${escapeHtml(info.status[client].error)}</p>`:''}</section>`;
  }).join('');
  return `${pageTitle('ОБЩАЯ ПАМЯТЬ БЕЗ КОПИРОВАНИЯ','Помощники подключаются напрямую.','Локальный MCP: контекст, брендбук, задачи и отчёты.', '<button class="button small secondary" data-action="refresh-agents">Обновить данные</button>')}${demoBanner()}<div class="grid-two">${connectionCards}</div><section class="card section-gap"><div class="card-header"><h2>Как начать работу</h2><span class="badge muted">STDIO · БЕЗ ПОРТА</span></div><p class="small">После настройки перезапустите терминальную сессию агента в папке игры. При необходимости подтвердите подключение в самом клиенте. Затем попросите его прочитать Опору и выполнить задачу.</p><div class="hint">${info?`Проект: <strong>${escapeHtml(info.project_name)}</strong><br>Сервер: <span class="file-tag">${escapeHtml(info.server_name)}</span><br>Папка: ${escapeHtml(info.root)}`:agentLoading?'Читаю настройки…':'Подключите папку игры в приложении Windows.'}</div><p class="small-note">«Настроено» означает, что запись сохранена, а не что агент уже установил связь. Сервер читает последние сохранённые данные и работает даже при закрытом окне Опоры. У агентов остаются их обычные требования к авторизации и разрешениям.</p><button class="text-button" data-action="copy-agent-start" ${!info?'disabled':''}>Скопировать первый запрос →</button></section><section class="card section-gap"><div class="card-header"><div><h2>Отчёты агентов</h2><p class="small">Обновляются, пока открыт этот раздел. Завершение задачи подтверждаете вы.</p></div><span class="badge muted">${agentActivity.reports.length}</span></div>${agentActivity.reports.length?`<div class="agent-reports">${agentActivity.reports.map(r=>`<article class="agent-report"><div class="spaced"><h3>${({claude:'Claude Code',codex:'Codex',other:'Агент'})[r.agent]||'Агент'} · ${({in_progress:'В работе',blocked:'Нужна помощь',ready_for_review:'Готово к просмотру'})[r.phase]||'Отчёт'}</h3><small>${escapeHtml(new Date(r.recordedAt).toLocaleString('ru-RU'))}</small></div><p>${escapeHtml(r.summary)}</p>${r.task_id?`<span class="file-tag">${escapeHtml(state.tasks.find(t=>t.id===r.task_id)?.title||r.task_id)}</span>`:''}${r.stale?'<p class="context-note">После этого отчёта контекст проекта изменился.</p>':''}${r.fromDifferentPath?'<p class="context-note">Отчёт был создан в другой папке проекта.</p>':''}${r.checks.length?`<ul class="report-checks">${r.checks.map(c=>`<li><span class="badge ${c.result==='failed'?'orange':'muted'}">${({passed:'ЗАЯВЛЕНО: ПРОШЛО',failed:'ЗАЯВЛЕНО: ОШИБКА',not_run:'НЕ ЗАПУСКАЛОСЬ'})[c.result]}</span> ${escapeHtml(c.name)}${c.evidence?`<p>${escapeHtml(c.evidence)}</p>`:''}</li>`).join('')}</ul>`:''}<p class="small-note">Это отчёт агента. Опора сама не запускала эти проверки.</p></article>`).join('')}</div>`:'<div class="empty"><strong>Здесь появятся результаты работы</strong>Агент может отправить ход работы, блокер или результат на просмотр через opora_report_progress.</div>'}${agentActivity.unreadable?`<p class="context-note">Не удалось прочитать отчётов: ${agentActivity.unreadable}.</p>`:''}</section>`;
}
async function refreshAgents() {
  if(!root || !bridge?.agentInfo || agentLoading)return;
  const project=root;agentLoading=true;
  try {
    await persist();
    const [info,activity]=await Promise.all([bridge.agentInfo(),bridge.agentReports()]);
    if(root!==project)return;
    agentConnection=info;agentActivity=activity;
    if(tab==='agents')render();
  } catch(error) {fail(error);} finally {agentLoading=false;}
}
async function refreshReports() {
  if(tab!=='agents' || !root || !bridge?.agentReports || agentLoading || $('#modal').open)return;
  const project=root;
  try {const activity=await bridge.agentReports();if(root===project && tab==='agents' && JSON.stringify(activity)!==JSON.stringify(agentActivity)){agentActivity=activity;render();}} catch(error) {fail(error);}
}
setInterval(refreshReports,3000);
function configureAgent(client) {
  if(!agentConnection)return;
  pendingAgent=client;
  const file=client==='claude'?agentConnection.claudeFile:agentConnection.codexFile;
  showModal(`<h2 id="modal-title">Подключить ${client==='claude'?'Claude Code':'Codex'}</h2><p>Будет добавлен локальный MCP-сервер для игры «${escapeHtml(agentConnection.project_name)}».</p><p class="small-note">Файл настроек: <span class="file-tag">${escapeHtml(file)}</span></p><p>Остальные подключения сохранятся. Если файл уже существует, перед изменением создаётся локальная резервная копия. Опора не меняет настройки авторизации клиента.</p><details><summary>Что будет запускаться</summary><pre class="code-preview">${escapeHtml(JSON.stringify(agentConnection.spec,null,2))}</pre></details><p class="small-note">Настройка не устанавливает сам Claude Code или Codex. После добавления перезапустите сессию агента. При переносе папки игры или приложения обновите подключение здесь.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Отмена</button><button class="button" data-action="confirm-agent">Добавить подключение</button></div>`);
}
function render() {
  refreshChrome();
  $('#main').innerHTML = ({overview,brand,tasks,context,agents})[tab]();
  if (tab === 'context') updatePreview();
  if (tab === 'brand' && root) loadImages();
  document.querySelectorAll('[data-color]').forEach(el=>{el.style.backgroundColor=el.dataset.color;});
  if(tab==='brand'){refreshReviewPanel();queueBrandReview();}
}
async function updatePreview() {
  const node = $('#context-preview');
  if (!node) return;
  try {node.textContent = OporaContext.contextMarkdown(state);} catch(error) {node.textContent = error.message;}
}
async function loadImages() {
  for (const ref of state.references) {
    const img = document.querySelector(`[data-reference="${CSS.escape(ref.id)}"]`);
    if (!img) continue;
    try {img.src = await bridge.referenceImage(ref.file);} catch {img.alt = `Не удалось загрузить: ${ref.name}`;}
  }
}
function showModal(content) {$('#modal-content').innerHTML = content; $('#modal').showModal();}
function closeModal() {$('#modal').close(); pendingSync = null; pendingBrand = null; pendingAgent=null;updatesOpen=false;}

function renderUpdates() {
  const info=updateState;
  const busy=['checking','downloading','installing'].includes(info.status);
  const labels={idle:'Проверка по запросу',checking:'Проверяю GitHub…',available:'Доступна новая версия', 'up-to-date':'У вас актуальная версия',downloading:'Скачиваю и проверяю файлы…',downloaded:'Обновление скачано и проверено',installing:'Подготавливаю установку и перезапуск…',error:'Обновление не завершено'};
  $('#modal-content').innerHTML=`<h2 id="modal-title">Обновления Опоры</h2><p>Установлена версия <strong>${escapeHtml(info.currentVersion)}</strong>${info.latestVersion?' · на GitHub: '+escapeHtml(info.latestVersion):''}</p><section class="update-state"><h3>${labels[info.status]||'Обновления'}</h3>${info.status==='downloading'?`<progress max="${Number(info.total)||1}" value="${Number(info.received)||0}" aria-label="Скачивание обновления"></progress><p>${Math.round((info.received||0)/1024/1024)} из ${Math.round((info.total||0)/1024/1024)} МБ</p>`:''}${info.error?`<p class="context-note">${escapeHtml(info.error)}</p>`:''}${info.notes?`<p class="update-notes">${escapeHtml(info.notes)}</p>`:''}</section>${!info.supported?'<p class="context-note">Установка с перезапуском доступна в готовом приложении для Windows. Здесь можно проверить версию.</p>':'<p>При установке Опора закроется и перезапустится. Папка игры и ваши данные сохранятся. Предыдущая версия приложения останется в резервной папке рядом с ним.</p>'}${info.previousInstall?.status==='failed'?`<p class="context-note">Предыдущая установка не завершилась: ${escapeHtml(info.previousInstall.error||'проверьте папку приложения')}. Резервная копия: ${escapeHtml(info.previousInstall.backup||'не указана')}.</p>`:''}<p class="small-note">Загрузка идёт из Isedis/basket на GitHub. Проверяются SHA256 частей и всего ZIP. Интернет используется только при проверке и скачивании по вашей команде.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal" ${info.status==='installing'?'disabled':''}>Закрыть</button>${info.status==='available' && info.supported?'<button class="button" data-action="download-update">Скачать обновление</button>':info.status==='downloaded' && info.supported?'<button class="button" data-action="install-update">Установить и перезапустить</button>':`<button class="button" data-action="check-updates" ${busy?'disabled':''}>${busy?'Подождите…':'Проверить обновления'}</button>`}</div>`;
}
async function showUpdates() {
  if(scanning || applyingBrand){toast('Сначала дождитесь подготовки брендбука.');return;}
  if(!bridge?.updateInfo){showModal('<h2 id="modal-title">Обновления — в приложении</h2><p>Браузерное демо не устанавливает обновления. Откройте готовое приложение Windows.</p><div class="modal-actions"><button class="button" data-action="close-modal">Понятно</button></div>');return;}
  updateState=await bridge.updateInfo(); updatesOpen=true;
  if(!$('#modal').open)$('#modal').showModal();
  renderUpdates();
}
bridge?.onUpdateProgress?.(info=>{updateState={...updateState,...info};if(updatesOpen && $('#modal').open)renderUpdates();});

function needsBrandbook() {return !state.brand.analysis && ['direction','palette','fonts','avoid'].every(key=>!state.brand[key].trim());}
function showBrandPreview(report) {
  pendingBrand=report;
  const labels={direction:'Направление и оформление',palette:'Палитра',fonts:'Шрифты и размеры',avoid:'Предлагаемые правила'};
  showModal(`<h2 id="modal-title">Черновик из файлов проекта</h2><p>Выберите поля для обновления. Заполненные поля по умолчанию сохраняются. Изменённый брендбук получит статус «черновик».</p><div class="draft-fields">${Object.entries(labels).map(([key,label])=>`<label class="draft-option"><span><input type="checkbox" data-brand-field="${key}" ${!state.brand[key].trim()?'checked':''}> ${label}${state.brand[key].trim()?' · уже заполнено':''}</span><pre class="code-preview">${escapeHtml(report.draft[key] || 'Данные не найдены; поле будет пустым.')}</pre></label>`).join('')}</div>${report.assets.length?`<h3>Кандидаты в эталоны</h3><p>Добавленные изображения ещё не утверждены. Это файлы из проекта, не снимки запущенных экранов.</p><div class="scan-assets">${report.assets.map(asset=>`<label class="scan-asset">${asset.thumbnail?`<img src="${escapeHtml(asset.thumbnail)}" alt="${escapeHtml(asset.file)}">`:''}<span><input type="checkbox" data-brand-asset="${escapeHtml(asset.file)}" ${state.references.some(r=>r.source===asset.file)?'':'checked'}> ${escapeHtml(asset.file)}</span></label>`).join('')}</div>`:''}<ul class="help-list">${report.warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul><div class="modal-actions"><button class="button secondary" data-action="close-modal">Оставить как есть</button><button class="button" data-action="apply-brand">Применить выбранное</button></div>`);
}
async function applyBrand(report, fields, assets) {
  const before=revision;
  applyingBrand=true;
  try {
    const next=await bridge.applyBrandbook({id:report.id,state:structuredClone(state),fields,assets});
    if(revision!==before) {showBrandPreview(report);toast('Пока готовился черновик, данные изменились. Проверьте выбранные поля.');return;}
    state=next; changed(); await persist();
    closeModal(); tab='brand'; render();
    toast('Черновик брендбука создан. Проверьте источники и выберите эталоны.');
  } finally {applyingBrand=false;}
}
async function scanBrand(automatic=false) {
  if(!root || !bridge?.scanBrandbook){toast('Подключите проект в приложении Windows. Анализ файлов в браузерном демо недоступен.',true);return;}
  if(scanning || applyingBrand)return;
  scanning=true; tab='brand'; render();
  try {
    const report=await bridge.scanBrandbook();
    if(automatic && needsBrandbook())await applyBrand(report,['direction','palette','fonts','avoid'],report.assets.map(a=>a.file));
    else showBrandPreview(report);
  } finally {scanning=false;if(tab==='brand')render();}
}
function editTask(taskId) {
  const task = state.tasks.find(t=>t.id===taskId);
  showModal(`<h2 id="modal-title">${task?'Изменить задачу':'Новая задача'}</h2><p>Опишите результат так, чтобы помощнику не пришлось додумывать за вас.</p><form id="task-form" data-id="${escapeHtml(task?.id || '')}"><label class="field"><span>Что нужно сделать</span><input name="title" required maxlength="180" value="${escapeHtml(task?.title || '')}" placeholder="Например: привести кнопки меню к эталону"></label><label class="field"><span>Как понять, что готово</span><textarea name="acceptance" rows="5" required placeholder="Какие элементы изменить, на какой образец опираться и что проверить?">${escapeHtml(task?.acceptance || '')}</textarea></label><div class="modal-actions">${task?`<button type="button" class="button secondary danger" data-action="delete-task" data-id="${escapeHtml(task.id)}">Удалить</button>`:''}<button type="button" class="button secondary" data-action="close-modal">Отмена</button><button class="button" type="submit">Сохранить задачу</button></div></form>`);
}
async function openProject() {
  if(scanning || applyingBrand){toast('Дождитесь завершения работы с брендбуком.');return;}
  if (!bridge) {showModal('<h2 id="modal-title">Подключение — в приложении Windows</h2><p>Сейчас открыт браузерный демонстрационный режим. Он позволяет проверить интерфейс, но не читает папки компьютера.</p><p>Запустите Opora.exe и выберите папку, в которой лежит project.godot. Игра останется на месте; переносить её не нужно.</p><div class="modal-actions"><button class="button" data-action="close-modal">Понятно</button></div>'); return;}
  await persist();
  const project = await bridge.openProject();
  if (!project) return;
  root = project.root;
  brandAssessment=null;assessmentFor=null;reviewErrorFor=null;
  agentConnection=null;agentActivity={reports:[],unreadable:0};
  state = project.state || blankState(project.info.name);
  revision = 0; syncedRevision = -1; failedSave = false;
  tab = 'overview';
  await persist();
  render();
  toast('Проект подключён. Инструкции агентов пока не изменены.');
  if(needsBrandbook() && bridge.scanBrandbook)await scanBrand(true);
}
async function previewSync() {
  if (!root) {toast('Подключите папку игры в приложении Windows. В демо можно скопировать запрос.', true); return;}
  await persist();
  const snapshot = structuredClone(state);
  const files = await bridge.preview(snapshot);
  pendingSync = {state:snapshot, revision};
  showModal(`<h2 id="modal-title">Передать общий контекст</h2><p>Будут обновлены только перечисленные файлы. Код и сцены игры не меняются. В AGENTS.md и CLAUDE.md заменяется только блок Opora; остальное сохраняется.</p>${files.map(f=>`<details><summary>${escapeHtml(f.file)} ${f.existing?'· существующие инструкции сохранятся':''}</summary><pre class="code-preview">${escapeHtml(f.content)}</pre></details>`).join('')}<p>Предыдущие версии сохранятся в <span class="file-tag">.opora/backups/</span>. Данные и эталоны Opora лежат рядом с игрой: учитывайте их при публикации репозитория.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Отмена</button><button class="button" data-action="confirm-sync">Обновить эти файлы</button></div>`);
}

document.addEventListener('input', event => {
  const key = event.target.dataset.field;
  if (!key) return;
  const parts = key.split('.');
  if (parts.length === 2) state[parts[0]][parts[1]] = event.target.value;
  else state[key] = event.target.value;
  changed();
});
document.addEventListener('change', event => {
  const taskId = event.target.dataset.taskStatus;
  if (taskId) {
    const task = state.tasks.find(t=>t.id === taskId);
    task.status = event.target.value;
    if (task.status === 'done' && state.activeTaskId === taskId) state.activeTaskId = null;
    changed(); render();
  }
  const refId = event.target.dataset.refStatus;
  if (refId) {state.references.find(r=>r.id===refId).status = event.target.value; changed();}
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'task-form') return;
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const title = data.get('title').trim();
  const acceptance = data.get('acceptance').trim();
  if (!title || !acceptance) {toast('Добавьте название и критерии готовности.', true); return;}
  const existing = state.tasks.find(t=>t.id === form.dataset.id);
  if (existing) Object.assign(existing,{title,acceptance});
  else state.tasks.push({id:id(),title,acceptance,status:'backlog'});
  changed(); closeModal(); render();
});
document.addEventListener('click', async event => {
  const nav = event.target.closest('[data-tab]');
  if (nav) {tab = nav.dataset.tab; render(); if(tab==='agents')await refreshAgents();return;}
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  try {
    if (action === 'open') {button.disabled = true; try {await openProject();} finally {button.disabled = false;}}
    if (action === 'goto-context') {tab='context'; render();}
    if (action === 'goto-tasks') {tab='tasks'; render();}
    if (action === 'focus-brand-field') {
      const key=button.dataset.fieldKey;
      if(!['palette','fonts','direction','avoid','status','references'].includes(key))return;
      const field=key==='references'?document.querySelector('[data-action="add-reference"]'):document.querySelector(`[data-field="brand.${key}"]`);
      field?.scrollIntoView({behavior:'smooth',block:'center'});field?.focus({preventScroll:true});
    }
    if (action === 'review-brand') await reviewBrand(true);
    if (action === 'brand-finding-task') {
      const finding=currentBrandReview().findings.find(f=>f.id===button.dataset.id);
      if(!finding){toast('Это замечание уже устранено.');return;}
      if(state.tasks.some(t=>t.brandFindingId===finding.id && t.status!=='done'))return;
      state.tasks.push({id:id(),title:'Брендбук: '+finding.title,acceptance:`Проблема: ${finding.detail}\nПредложение: ${finding.suggestion}\nКритерий: ${finding.acceptance}\nПодготовить предложение пользователю; не менять .opora/project.json напрямую и не утверждать стиль самостоятельно.`,status:'backlog',brandFindingId:finding.id});
      changed();refreshReviewPanel();toast('Задача добавлена в очередь. Выберите её в разделе «Задачи».');
    }
    if (action === 'copy-brand-review') {
      const report=currentBrandReview();
      const text=`Разбор брендбука игры «${state.name}».\n${report.scope}\nПунктов с достаточными данными: ${report.ready}/${report.total}.\n\n${report.findings.map(f=>`${f.title}\n${f.detail}\nЧто предложить: ${f.suggestion}`).join('\n\n')}\n\n${report.contrastBasis}\nПредложи изменения на просмотр пользователю. Не утверждай стиль и не меняй .opora/project.json напрямую.`;
      if(bridge)await bridge.copy(text);else await navigator.clipboard.writeText(text);
      toast('Разбор скопирован. Агент также может получить его через MCP.');
    }
    if (action === 'refresh-agents') await refreshAgents();
    if (action === 'configure-agent') configureAgent(button.dataset.client);
    if (action === 'confirm-agent' && pendingAgent) {
      button.disabled=true;
      try {await persist();await bridge.configureAgent(pendingAgent);closeModal();await refreshAgents();toast('Настройки сохранены. Перезапустите сессию агента в папке игры.');} finally {button.disabled=false;}
    }
    if (action === 'copy-agent-start' && agentConnection) {
      await bridge.copy(`Работаем над игрой «${state.name}» в папке ${agentConnection.root}. Используй MCP-сервер ${agentConnection.server_name}: сначала opora_get_project, проверь папку, затем opora_get_context и брендбук. Выполни выбранную задачу. Перед отправкой отчёта используй актуальную revision. Незапущенные проверки отметь not_run. Результат отправь через opora_report_progress со статусом ready_for_review; завершение подтверждает пользователь.`);
      toast('Первый запрос скопирован. Вставьте его в новую сессию агента.');
    }
    if (action === 'updates') await showUpdates();
    if (action === 'check-updates') {button.disabled=true;try {updateState={...updateState,...await bridge.checkUpdates()};if(updatesOpen)renderUpdates();} finally {button.disabled=false;}}
    if (action === 'download-update') {button.disabled=true;try {updateState={...updateState,...await bridge.downloadUpdate()};if(updatesOpen)renderUpdates();} finally {button.disabled=false;}}
    if (action === 'install-update') {
      button.disabled=true;
      try {await persist();await saves;await bridge.installUpdate();} finally {button.disabled=false;}
    }
    if (action === 'scan-brand') await scanBrand();
    if (action === 'apply-brand' && pendingBrand) {
      button.disabled=true;
      try {await applyBrand(pendingBrand,[...document.querySelectorAll('[data-brand-field]:checked')].map(e=>e.dataset.brandField),[...document.querySelectorAll('[data-brand-asset]:checked')].map(e=>e.dataset.brandAsset));} finally {button.disabled=false;}
    }
    if (action === 'new-task') editTask();
    if (action === 'edit-task') editTask(button.dataset.id);
    if (action === 'delete-task') {
      state.tasks = state.tasks.filter(t=>t.id !== button.dataset.id);
      if (state.activeTaskId === button.dataset.id) state.activeTaskId = null;
      changed(); closeModal(); render();
    }
    if (action === 'select-task') {
      if (state.activeTaskId === button.dataset.id) {tab='context'; render(); return;}
      state.activeTaskId = button.dataset.id;
      state.tasks.find(t=>t.id===button.dataset.id).status = 'active';
      changed(); render(); toast('Задача выбрана. Обновите контекст перед передачей агенту.');
    }
    if (action === 'close-modal') closeModal();
    if (action === 'discard-close') bridge?.readyToClose();
    if (action === 'copy-brief') {
      const text = OporaContext.taskBrief(state);
      if (bridge) await bridge.copy(text); else await navigator.clipboard.writeText(text);
      toast('Запрос скопирован. Вставьте его в Claude или Codex.');
    }
    if (action === 'preview-sync') await previewSync();
    if (action === 'confirm-sync' && pendingSync) {
      button.disabled = true;
      try {
        const snapshot = pendingSync;
        const result = await bridge.sync(snapshot.state);
        syncedRevision = snapshot.revision;
        closeModal(); render(); toast(`Контекст записан. Резервная копия: ${result.backup}`);
      } finally {button.disabled = false;}
    }
    if (action === 'add-reference') {
      if (!root) {toast('Сначала подключите папку игры в приложении Windows.',true); return;}
      const refs = await bridge.addReferences();
      state.references.push(...refs);
      if (refs.length) {changed(); render();}
    }
    if (action === 'remove-reference') {
      state.references = state.references.filter(r=>r.id !== button.dataset.id);
      changed(); render(); toast('Образец убран из контекста. Файл оставлен в папке проекта.');
    }
    if (action === 'help') showModal('<h2 id="modal-title">Общая память вашей игры</h2><ol class="help-list"><li>Подключите корень игры Godot. Opora добавит свою папку .opora; код и сцены не меняются.</li><li>Опишите игру и постоянные замечания. Добавьте брендбук и изображения, когда будете готовы. Неутверждённое остаётся черновиком.</li><li>Для прямого подключения откройте «Агенты · MCP», настройте клиент и перезапустите его сессию. Он сможет читать последние сохранённые данные без копирования.</li><li>При работе через файлы выберите задачу с критериями готовности. В разделе «Контекст для ИИ» посмотрите и обновите файлы проекта.</li><li>Скопируйте запрос в Claude Code или Codex, работающий из корня этой игры. В существующем чате тоже попросите перечитать памятку.</li><li>Проверьте результат в Godot. Новое замечание внесите в Opora и снова обновите контекст. Агент не получает обновления автоматически.</li></ol><p>Opora работает без API, не запускает агентов и не проверяет изображения на соответствие стилю. У каждого проекта своя память. Используйте существующую папку игры: отдельный Git worktree для этого не нужен.</p><div class="modal-actions"><button class="button" data-action="close-modal">Понятно</button></div>');
  } catch(error) {fail(error);}
});
window.addEventListener('beforeunload', () => {if (!root) persist();});
$('#modal').addEventListener('cancel', event => {
  if(updatesOpen && updateState?.status==='installing'){event.preventDefault();return;}
  pendingSync = null;pendingBrand=null;pendingAgent=null;updatesOpen=false;
});
async function initialize() {
  if (!bridge?.restoreProject) return;
  try {
    const project = await bridge.restoreProject();
    if (project?.error) {toast(project.error, true); return;}
    if (!project) return;
    root = project.root;
    state = project.state || blankState(project.info.name);
    render(); status('Проект открыт · локальные данные');
    if(needsBrandbook() && bridge.scanBrandbook)await scanBrand(true);
  } catch(error) {fail(error);}
}
bridge?.onCloseRequested?.(async () => {
  if (closing) return;
  closing = true;
  try {await persist(); await saves; bridge.readyToClose();} catch {
    closing = false;
    showModal('<h2 id="modal-title">Изменения не сохранены</h2><p>Проверьте название игры и доступ к её папке. Можно вернуться к работе или закрыть приложение, потеряв последние несохранённые изменения.</p><div class="modal-actions"><button class="button secondary" data-action="discard-close">Закрыть без сохранения</button><button class="button" data-action="close-modal">Продолжить работу</button></div>');
  }
});
render();
initialize();
