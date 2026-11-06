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
let savedProject=structuredClone(state);
let approvedBrand=null;
let pendingExternalRender=false;
let brandConflict=null;
let saving=0;
let remoteLoading=false;
let root = null;
let tab = 'overview';
let renderedTab=null;
let renderedRoot;
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
const claudeTerminal=window.OporaClaudeTerminal.create({bridge,getRoot:()=>root,prepare:async()=>{await persist();await saves;},onError:fail,notify:toast,getPrompt:async()=>{
  await persist();await saves;
  const packet=await bridge.workContext({});
  return `Работаем над игрой «${packet.name}» в ${packet.root}. Вызови opora_get_work_context${packet.task?` с task_id=${packet.task.id}`:''}, проверь путь и действующие решения. ${packet.task?`Выполни выбранную задачу «${packet.task.title}», соблюдая критерии и брендбук.`:'Помоги выбрать следующий шаг; пока не меняй файлы.'} Перед правками прочитай исходники. Не утверждай стиль и не принимай результат за пользователя. В конце запиши отчёт через MCP Опоры.`;
}});
const projectMapView=window.OporaProjectMap.create({getRoot:()=>root,bridge,notify:toast,onError:fail});
const visualFeedbackView=window.OporaVisualFeedback.create({getRoot:()=>root,bridge,notify:toast,onError:fail,createTask:(shot,note)=>{
  if(state.tasks.some(t=>t.feedbackNoteId===note.id&&t.status!=='done')){toast('Задача для этого замечания уже есть.');return;}
  state.tasks.push({id:id(),title:(note.kind==='keep'?'Сохранить: ':'Исправить: ')+note.text.slice(0,140),acceptance:`${note.text}\nСнимок: «${shot.title}».\n${note.scene?'Сцена/файл: '+note.scene+'\n':''}Сохранить понравившиеся решения. Приложить результат для сравнения в разделе «Замечания». Получить подтверждение пользователя.`,status:'backlog',feedbackNoteId:note.id,feedbackShotId:shot.id});changed();toast('Замечание добавлено в задачи.');
}});

function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').className = 'toast visible' + (error ? ' error' : '');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), error ? 11000 : 5500);
}
function fail(error) {console.error(error); toast(error.message || String(error), true);}
function status(text) {$('#save-status').textContent = text;$('#save-status').title=text;}
function persist() {
  clearTimeout(timer);
  timer = null;
  if (!root) {
    try {localStorage.setItem('opora-demo', JSON.stringify(state)); failedSave = false; status('Демо · сохранено');} catch {failedSave = true; toast('Не удалось сохранить демо в браузере.', true);}
    return Promise.resolve();
  }
  const project=root;
  saves = saves.catch(() => {}).then(async () => {
    if(project!==root)return;
    if(brandConflict)throw new Error('BRAND_CONFLICT: Сначала сравните версии брендбука.');
    const snapshot=structuredClone(state),saveRevision=revision;
    saving++;
    try {
      const result=await bridge.save(snapshot,structuredClone(savedProject.brand),structuredClone(savedProject),approvedBrand&&structuredClone(approvedBrand));
      if(project!==root)return;
      const remote=result?.brand ? result : snapshot;
      const merged=OporaContext.mergeProject(snapshot,state,remote);
      if(merged.conflicts.length){setBrandConflict(remote,snapshot);throw new Error('BRAND_CONFLICT: Поле изменилось во время сохранения.');}
      state=merged.state;savedProject=structuredClone(remote);refreshBrandFields();
      if(saveRevision===revision && result?.updatedAt)state.updatedAt=result.updatedAt;
      failedSave=false;if(saveRevision===revision)status('Сохранено');
    }finally{saving--;}
  }).catch(async error => {
    if(project!==root)throw error;
    failedSave=true;status('Не сохранено · ошибка');
    if(String(error.message).includes('BRAND_CONFLICT')){
      if(!brandConflict && bridge.projectSnapshot){const current=await bridge.projectSnapshot();if(current?.root===project)setBrandConflict(current.state);}
      toast('Данные изменены параллельно. Нажмите «Сравнить версии».',true);
    }else fail(error);
    throw error;
  });
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
  $('#header-route').textContent=({overview:'/desk',tasks:'/tasks',brand:'/brand',agents:'/agents',context:'/context',map:'/map',feedback:'/feedback'})[tab];
  $('#side-mode').textContent = root ? 'Godot / локально' : 'Демо';
  $('#header-name').title = root || 'Демонстрационный проект';
  $('#task-count').textContent = state.tasks.filter(t => t.status !== 'done').length;
  $('#footer-status').textContent = root ? '[LOCAL]' : '[DEMO]';
  $('#terminal-brand').textContent=state.brand.status==='approved'?'СТИЛЬ: УТВЕРЖДЁН':'СТИЛЬ: ЧЕРНОВИК';
  const active=state.tasks.find(t=>t.id===state.activeTaskId && t.status!=='done');
  $('#side-active-task').textContent=active?.title || 'Нет выбранной задачи';
  $('#side-active-task').title=active?.title || '';
  document.querySelectorAll('[data-tab]').forEach(button => {
    const active=button.dataset.tab===tab;
    button.classList.toggle('active',active);
    if(button.closest('nav')) {if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  });
}
function field(label, key, placeholder = '', multiline = false, rows = 3) {
  const value = key.split('.').reduce((obj,k) => obj[k], state);
  return `<label class="field"><span>${escapeHtml(label)}</span>${multiline ? `<textarea rows="${rows}" data-field="${key}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>` : `<input data-field="${key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`}</label>`;
}
function pageTitle(eyebrow, title, subtitle, action = '') {return `<div class="page-title"><div><h1><span class="page-prompt" aria-hidden="true">&gt;</span>${title}</h1>${subtitle?`<p class="subtitle">${subtitle}</p>`:''}</div>${action}</div>`;}

function demoBanner() {return root?'':'<div class="demo-banner"><span><strong>ДЕМО</strong> / Тихая орбита</span><button class="text-button" data-action="open">Выбрать папку игры →</button></div>';}

async function showWorkContext(){
  if(!root||!bridge?.workContext){toast('Откройте папку игры в приложении.');return;}
  await persist();const project=root,packet=await bridge.workContext({});if(project!==root)return;
  showModal(`<h2 id="modal-title">Контекст задачи</h2><p>${escapeHtml(packet.task?.title||'Задача не выбрана')}</p><div class="source-stats"><span>Замечания / ${packet.feedback.total}</span><span>Файлы / ${packet.source_snapshot.files}</span><span>Стиль / ${packet.brand.status==='approved'?'утверждён':'черновик'}</span></div>${packet.warnings.map(w=>`<p class="context-note">${escapeHtml(w)}</p>`).join('')}<section class="card"><h3>Решения и замечания</h3>${packet.feedback.notes.map(n=>`<p><strong>${n.kind==='keep'?'Сохранить':'Исправить'}</strong> / ${escapeHtml(n.text)}<br><small>${escapeHtml(n.scope==='project'?'Весь проект':n.scene||'Область снимка')} / ${n.status==='accepted'?'принято':n.status==='ready'?'на проверке':'открыто'}</small></p>`).join('')||'<p>Связанные замечания не найдены.</p>'}</section><p class="small">Паспорт, выбранная задача, относящиеся к ней решения, ссылки на снимки и связи файлов доступны агенту одним запросом. Подробности читаются отдельно.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Закрыть</button><button class="button" data-action="copy-work">Скопировать для агента</button></div>`);
}
async function copyWorkContext(){
  await persist();const project=root,packet=await bridge.workContext({});if(project!==root)return;
  await bridge.copy(`Работаем с игрой ${packet.name}: ${packet.root}.\nВызови opora_get_work_context${packet.task?` с task_id=${packet.task.id}`:''}, проверь путь проекта. Этот запрос собирает задачу, действующие решения и версии кода/замечаний. Изображения прочитай через opora_get_feedback_image, исходники — перед правкой. Не считай принятый снимок завершением всей задачи. После потери истории получи полный пакет заново.\n\n${JSON.stringify(packet,null,2)}`);
  toast('Контекст задачи скопирован.');
}

function overview() {
  const active=state.tasks.find(t=>t.id===state.activeTaskId && t.status!=='done');
  const queue=state.tasks.filter(t=>t.status!=='done' && t.id!==active?.id);
  return `${pageTitle('[01] / ПРОЕКТ','Рабочий стол','', '<div class="stack"><button class="button small secondary" data-action="copy-project-agent">Заполнить через агента</button><button class="button small secondary" data-action="new-task">+ Задача</button></div>')}${demoBanner()}
  <div class="project-status"><button data-action="goto-brand"><span class="status-dot"></span>Стиль: ${state.brand.status==='approved'?'утверждён':'черновик'}</button><span>${state.references.filter(r=>r.status==='approved').length} эталонов</span><button data-action="goto-context">${syncedRevision===revision?'Файлы обновлены':'Контекст: есть изменения'} →</button></div>
  <div class="desk-grid"><section class="card focus-task"><div class="card-header"><h2>В работе</h2><span class="badge">${active?'ВЫБРАНА':'НЕТ ЗАДАЧИ'}</span></div><h2 class="focus-title">${escapeHtml(active?.title || 'Выберите следующий шаг')}</h2>${active?`<div class="acceptance"><span class="section-label">ГОТОВО, ЕСЛИ</span><p>${escapeHtml(active.acceptance || 'Добавьте критерии готовности.')}</p></div>`:'<p class="small">Создайте задачу с понятным результатом.</p>'}<div class="stack">${active?'<button class="button" data-action="copy-brief">Скопировать запрос</button>':'<button class="button" data-action="new-task">+ Новая задача</button>'}<button class="button secondary" data-action="goto-agents">Агенты →</button><button class="text-button" data-action="work-context">Контекст задачи</button></div></section>
  <section class="card queue-card"><div class="card-header"><h2>Следом</h2><button class="text-button" data-action="goto-tasks">Все / ${queue.length} →</button></div>${queue.length?queue.slice(0,4).map(t=>`<div class="queue-item"><div><span class="section-label">${t.status==='active'?'В РАБОТЕ':'ОЧЕРЕДЬ'}</span><strong>${escapeHtml(t.title)}</strong></div><button class="text-button" data-action="select-task" data-id="${escapeHtml(t.id)}">В работу →</button></div>`).join(''):'<div class="empty">Очередь пуста.<br><button class="text-button" data-action="new-task">Добавить задачу →</button></div>'}</section></div>
  <div class="grid-two section-gap"><section class="card"><div class="card-header"><h2>Проект</h2><span class="badge muted">GODOT</span></div><div class="field-row">${field('Название','name','Название игры')}${field('Жанр','genre','Roguelike / idle / …')}</div>${field('Замысел','pitch','Что делает игрок и ради чего?',true,3)}${field('Цель итерации','goal','Один конкретный результат',true,2)}<details class="extra-fields"><summary>Ощущение и принципы</summary>${field('Ощущение игрока','experience','Настроение и характер игры',true,2)}${field('Принципы игры','pillars','По одному принципу на строку',true,3)}</details></section><section class="card"><div class="card-header"><h2>Постоянные правила</h2><button class="text-button" data-action="goto-brand">Брендбук →</button></div>${field('Что агент должен сохранять','rules','Компоненты, размеры, эффекты и другие принятые решения',true,7)}<div class="compact-hint">Сохраняются автоматически. Доступны обоим агентам.</div></section></div>`;
}

function brand() {
  return `${pageTitle('[03] / СТИЛЬ','Брендбук','',`<div class="stack brand-toolbar"><button class="button small secondary" data-action="copy-brand-agent">Заполнить через агента</button><button class="button small secondary" data-action="scan-brand" ${scanning?'disabled':''}>${scanning?'Читаю файлы…':state.brand.analysis?'Пересобрать черновик':'Собрать из проекта'}</button><label class="brand-status"><span class="visually-hidden">Статус брендбука</span><select data-field="brand.status"><option value="draft" ${state.brand.status==='draft'?'selected':''}>Черновик</option><option value="approved" ${state.brand.status==='approved'?'selected':''}>Утверждён</option></select></label></div>`)}${demoBanner()}<p id="agent-brand-note" class="compact-hint agent-brand-note" ${state.brand.agentDraft?'':'hidden'}>${state.brand.agentDraft?`Последнее изменение через MCP: ${escapeHtml(state.brand.agentDraft.agent)} / ${escapeHtml(state.brand.agentDraft.summary)}`:''}</p>
  <div class="brand-workspace"><section class="card brand-fields"><div class="card-header"><h2>Правила стиля</h2></div>${field('Направление','brand.direction','Настроение, формы, материалы',true,3)}${field('Палитра и роли','brand.palette','#FFFFFF — текст\n#151E21 — фон',true,5)}${field('Шрифты и размеры','brand.fonts','Семейство, заголовки, основной текст',true,4)}${field('Ограничения','brand.avoid','Что не использовать',true,3)}</section><aside class="brand-inspector"><div id="brand-review-panel">${brandReviewPanel()}</div></aside></div>
  <section class="card section-gap"><div class="card-header"><h2>Эталоны <span class="inline-count">/ ${state.references.length}</span></h2><button class="button small secondary" data-action="add-reference">+ Добавить образцы</button></div>${state.references.length?`<div class="reference-grid">${state.references.map(ref=>`<article class="reference"><img data-reference="${escapeHtml(ref.id)}" alt="${escapeHtml(ref.name)}"><div class="reference-info"><div class="reference-name" title="${escapeHtml(ref.name)}">${escapeHtml(ref.name)}</div><div class="reference-controls"><select aria-label="Статус образца ${escapeHtml(ref.name)}" data-ref-status="${escapeHtml(ref.id)}"><option value="draft" ${ref.status==='draft'?'selected':''}>Кандидат</option><option value="approved" ${ref.status==='approved'?'selected':''}>Утверждён</option></select><button class="icon-button" data-action="remove-reference" data-id="${escapeHtml(ref.id)}" aria-label="Убрать ${escapeHtml(ref.name)}">×</button></div></div></article>`).join('')}</div>`:'<div class="empty">Добавьте экран или компонент, на который должен опираться агент.</div>'}<details class="technical-note"><summary>Форматы и ограничения</summary><p>PNG / JPG / WebP, до 20 МБ. Для MCP — до 8 МиБ. Новые образцы добавляются кандидатами; утверждайте их после просмотра.</p></details></section>${state.brand.analysis?`<details class="source-drawer section-gap"><summary>Источники анализа / ${state.brand.analysis.stats.textFiles} файлов</summary>${analysisSummary(state.brand.analysis)}</details>`:''}`;
}

function currentBrandReview() {
  return brandAssessment && assessmentFor===OporaBrandReview.reviewSignature(state)?brandAssessment:OporaBrandReview.assessBrandbook(state);
}
function brandReviewPanel() {
  const report=currentBrandReview();
  const renderFinding=(finding,index)=>{
    const exists=state.tasks.some(t=>t.brandFindingId===finding.id && t.status!=='done');
    return `<details class="brand-finding ${finding.severity}" data-review-section="finding-${escapeHtml(finding.id)}" ${index===0?'open':''}><summary><span class="finding-mark">${finding.severity==='error'?'!':finding.severity==='warning'?'?':'/'}</span><h3>${escapeHtml(finding.title)}</h3></summary><div class="finding-body"><p>${escapeHtml(finding.detail)}</p><div class="hint">${escapeHtml(finding.suggestion)}</div><div class="stack"><button class="text-button" data-action="focus-brand-field" data-field-key="${escapeHtml(finding.field)}">К полю →</button><button class="text-button" data-action="brand-finding-task" data-id="${escapeHtml(finding.id)}" ${exists?'disabled':''}>${exists?'В задачах':'+ Добавить задачу'}</button></div></div></details>`;
  };
  return `<section class="card brand-assessment"><div class="card-header"><h2>Разбор</h2><button class="text-button" data-action="review-brand" aria-label="Проверить брендбук" ${reviewBusy?'disabled':''}>${reviewBusy?'Проверяю…':'Проверить →'}</button></div><div class="review-summary"><strong>${report.ready}<span>/${report.total}</span></strong><div>Готовность правил<small>Без художественной оценки</small></div></div><div class="review-findings">${report.findings.length?report.findings.slice(0,3).map(renderFinding).join(''):'<p class="compact-hint">Проблем по этим проверкам нет.</p>'}${report.findings.length>3?`<details class="more-findings" data-review-section="more"><summary>Ещё / ${report.findings.length-3}</summary>${report.findings.slice(3).map((f,i)=>renderFinding(f,i+3)).join('')}</details>`:''}</div><details class="review-checklist" data-review-section="checks"><summary>Пункты проверки</summary><ul>${report.checks.map(c=>`<li><span>${c.status==='pass'?'[+]':c.status==='issue'?'[!]':'[?]'}</span>${escapeHtml(c.label)}</li>`).join('')}</ul></details>${report.pairs.length?`<details class="contrast-results" data-review-section="pairs"><summary>Цветовые пары / ${report.pairs.length}</summary>${report.pairs.map(p=>`<div class="contrast-result"><div class="color-preview" data-review-fg="${escapeHtml(p.foreground)}" data-review-bg="${escapeHtml(p.background)}">Текст</div><div><strong>${p.ratio===null?'Нет подложки':OporaBrandReview.formatBrandRatio(p.ratio)+':1'}</strong><p>${escapeHtml(p.foreground)} / ${escapeHtml(p.background)}${p.excluded?' · неактивно':''}</p></div></div>`).join('')}</details>`:''}<div class="review-footer"><button class="text-button" data-action="copy-brand-review">Скопировать разбор →</button><small>${report.checkedAt?escapeHtml(new Date(report.checkedAt).toLocaleTimeString('ru-RU')):'Файлы не проверены'}</small></div><details class="technical-note" data-review-section="scope"><summary>Об оценке</summary><p>${escapeHtml(report.scope)}</p><p>${escapeHtml(report.contrastBasis)}</p><p>Превью использует шрифт Опоры. Через MCP: opora_review_brandbook.</p></details></section>`;
}

function refreshReviewPanel() {
  const panel=$('#brand-review-panel');if(!panel)return;
  const open=new Map([...panel.querySelectorAll('details[data-review-section]')].map(el=>[el.dataset.reviewSection,el.open]));
  panel.innerHTML=brandReviewPanel();
  panel.querySelectorAll('details[data-review-section]').forEach(el=>{if(open.has(el.dataset.reviewSection))el.open=open.get(el.dataset.reviewSection);});
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
  return `<section class="card evidence-card"><div class="source-stats"><span>Файлы / ${escapeHtml(report.stats.textFiles)}</span><span>Темы / ${escapeHtml(report.stats.themes)}</span><span>Сцены / ${escapeHtml(report.stats.scenes)}</span><span>${report.colors.length?'Цвета из кода':'Цвета изображений ≈'}</span></div>${colors.length?`<div class="token-grid">${colors.slice(0,12).map(c=>`<div class="color-token"><span class="color-chip" data-color="${escapeHtml(c.hex)}"></span><div><strong>${escapeHtml(c.hex)}</strong><small>${escapeHtml(c.sources[0]?.file)}${c.sources[0]?.line?':'+c.sources[0].line:''}</small></div></div>`).join('')}</div>`:''}<details class="technical-note"><summary>Файлы и ограничения</summary>${report.fonts.map(f=>`<p>Шрифт: <span class="file-tag">res://${escapeHtml(f.file)}</span></p>`).join('')}${colors.map(c=>`<p>${escapeHtml(c.hex)}: ${c.sources.map(s=>escapeHtml(s.file)+(s.line?':'+s.line:'')+' · '+escapeHtml(s.property)).join('; ')}</p>`).join('')}<ul>${report.warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul></details></section>`;
}

function taskCard(task) {
  const selected=state.activeTaskId===task.id && task.status!=='done';
  return `<article class="task ${selected?'selected':''}"><div class="task-meta"><span>${selected?'[>] ТЕКУЩАЯ':'/ GODOT'}</span><button class="icon-button" data-action="edit-task" data-id="${escapeHtml(task.id)}" aria-label="Изменить задачу ${escapeHtml(task.title)}">···</button></div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.acceptance || 'Добавьте критерии готовности.')}</p><div class="task-controls"><select data-task-status="${escapeHtml(task.id)}" aria-label="Статус задачи ${escapeHtml(task.title)}">${[['backlog','В очереди'],['active','В работе'],['done','Готово']].map(([v,t])=>`<option value="${v}" ${task.status===v?'selected':''}>${t}</option>`).join('')}</select>${task.status!=='done'?`<button class="text-button" data-action="select-task" data-id="${escapeHtml(task.id)}">${selected?'Контекст →':'В работу →'}</button>`:'<span class="small-note">[+]</span>'}</div></article>`;
}

function tasks() {
  return `${pageTitle('[02] / РАБОТА','Задачи','','<button class="button" data-action="new-task">+ Новая задача</button>')}${demoBanner()}<div class="board">${[['backlog','В очереди'],['active','В работе'],['done','Готово']].map(([key,label])=>`<section class="column"><div class="column-header"><span>${label}</span><span>${state.tasks.filter(t=>t.status===key).length}</span></div>${state.tasks.filter(t=>t.status===key).map(taskCard).join('') || '<div class="empty">Нет задач</div>'}</section>`).join('')}</div>`;
}

function context() {
  const synced=syncedRevision===revision;
  const active=state.tasks.find(t=>t.id===state.activeTaskId && t.status!=='done');
  return `${pageTitle('[05] / ПЕРЕДАЧА','Контекст','',`<span class="badge ${synced?'':'orange'}">${synced?'ФАЙЛЫ ОБНОВЛЕНЫ':'ЕСТЬ ИЗМЕНЕНИЯ'}</span>`)}${demoBanner()}<section class="handoff-bar"><div><span class="section-label">ВЫБРАННАЯ ЗАДАЧА</span><strong>${escapeHtml(active?.title || 'Задача не выбрана')}</strong></div><div class="stack"><button class="button" data-action="copy-brief">Скопировать запрос</button><button class="button secondary" data-action="preview-sync">Обновить файлы проекта</button></div></section><section class="card"><div class="card-header"><h2>Памятка для агента</h2><button class="text-button" data-action="goto-agents">Подключение →</button></div><pre id="context-preview" class="code-preview"></pre><details class="technical-note"><summary>Как передать контекст</summary><p>Подключённый MCP-агент читает сохранённые данные напрямую. По запросу он заполняет брендбук через opora_update_brandbook; предложения сохраняются черновиком. Для ручной передачи скопируйте запрос в его терминал или обновите файлы проекта.</p><p><span class="file-tag">AGENTS.md</span><span class="file-tag">CLAUDE.md</span><span class="file-tag">.opora/CONTEXT.md</span></p><p>Существующие инструкции сохраняются, перед записью создаётся резервная копия. В старой сессии попросите агента перечитать контекст.</p></details></section>`;
}

function agents() {
  const info=agentConnection;
  const cards=['claude','codex'].map(client=>{
    const configured=info?.status?.[client]?.configured;
    return `<section class="card connection-card"><div class="card-header"><h2>${client==='claude'?'Claude Code':'Codex CLI'}</h2><span class="badge ${configured?'':'muted'}">${configured?'НАСТРОЕНО':'НЕ НАСТРОЕНО'}</span></div><p class="small">${client==='claude'?'Настройки этого проекта':'Настройки пользователя'}</p>${client==='claude'?'<button class="button" data-action="claude-open">Открыть в Опоре</button> ':''}<button class="button secondary" data-action="configure-agent" data-client="${client}" ${!info?'disabled':''}>${configured?'Обновить подключение':'Настроить подключение'}</button>${configured?`<button class="text-button" data-action="disconnect-agent" data-client="${client}">Отключить для этой игры</button>`:''}${info?.status?.[client]?.error?`<p class="context-note">${escapeHtml(info.status[client].error)}</p>`:''}</section>`;
  }).join('');
  const reportCard=(r,index)=>`<details class="agent-report" ${index===0?'open':''}><summary><span class="report-phase">${({in_progress:'В работе',blocked:'Блокер',ready_for_review:'На просмотр'})[r.phase]||'Отчёт'}</span><strong>${({claude:'Claude',codex:'Codex',other:'Агент'})[r.agent]||'Агент'}</strong><small>${escapeHtml(new Date(r.recordedAt).toLocaleString('ru-RU'))}</small></summary><div class="report-body"><p>${escapeHtml(r.summary)}</p>${r.task_id?`<span class="file-tag">${escapeHtml(state.tasks.find(t=>t.id===r.task_id)?.title||r.task_id)}</span>`:''}${r.stale_context?'<p class="context-note">Контекст после отчёта изменился.</p>':''}${r.stale_code?'<p class="context-note">Код изменился после отчёта.</p>':''}${r.stale_feedback?'<p class="context-note">Замечания изменились после отчёта.</p>':''}${r.source_unknown?'<p class="small">Версия кода этого старого отчёта неизвестна.</p>':''}${r.fromDifferentPath?'<p class="context-note">Отчёт из другой папки проекта.</p>':''}${r.checks.length?`<ul class="report-checks">${r.checks.map(c=>`<li><span>${({passed:'[+] Агент: прошло',failed:'[!] Агент: ошибка',not_run:'[—] Не запускалось'})[c.result]}</span> ${escapeHtml(c.name)}${c.evidence?`<p>${escapeHtml(c.evidence)}</p>`:''}</li>`).join('')}</ul>`:''}<small>Проверки заявлены агентом. Завершение подтверждаете вы.</small></div></details>`;
  return `${pageTitle('[04] / АГЕНТЫ','Подключения','', '<button class="button small secondary" data-action="refresh-agents">Обновить данные</button>')}${demoBanner()}<div class="grid-two">${cards}</div><section class="card session-card section-gap"><div class="session-actions"><div><h2>Начать сессию</h2><p class="small">Claude можно открыть в Опоре; Codex — в папке игры.</p></div><button class="button" data-action="copy-agent-start" ${!info?'disabled':''}>Скопировать первый запрос</button></div><details class="technical-note"><summary>Настройки MCP</summary>${info?`<p>Сервер: <span class="file-tag">${escapeHtml(info.server_name)}</span></p><p>Проект: ${escapeHtml(info.root)}</p>`:'<p>Подключите проект в приложении Windows.</p>'}<p>«Настроено» означает сохранённую запись, а не подтверждённое соединение. При запросе клиента подтвердите сервер. Авторизация модели остаётся в Claude / Codex. Локальный stdio-сервер работает и при закрытой Опоре.</p></details></section><section class="card section-gap"><div class="card-header"><h2>Отчёты <span class="inline-count">/ ${agentActivity.reports.length}</span></h2><span class="section-label">ОБНОВЛЯЮТСЯ АВТОМАТИЧЕСКИ</span></div>${agentActivity.reports.length?`<div class="agent-reports">${agentActivity.reports.map(reportCard).join('')}</div>`:'<div class="empty">Отчётов пока нет.</div>'}${agentActivity.unreadable?`<p class="context-note">Не прочитано отчётов: ${agentActivity.unreadable}.</p>`:''}</section>`;
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
  const routeChanged=renderedTab!==tab || renderedRoot!==root;
  refreshChrome();
  claudeTerminal.projectChanged();
  $('#main').innerHTML = tab==='feedback'?'<div id="visual-feedback-view"></div>':tab==='map'?'<div id="project-map-view"></div>':({overview,brand,tasks,context,agents})[tab]();
  if(tab==='map')projectMapView.mount($('#project-map-view'));
  if(tab==='feedback')visualFeedbackView.mount($('#visual-feedback-view'));
  if(routeChanged)$('#main').scrollTop=0;
  renderedTab=tab;renderedRoot=root;
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
function showModal(content) {$('#modal').classList.remove('command-dialog');$('#modal-content').innerHTML = content; $('#modal').showModal();}
function closeModal() {$('#modal').close();$('#modal').classList.remove('command-dialog'); pendingSync = null; pendingBrand = null; pendingAgent=null;updatesOpen=false;}

function renderUpdates() {
  const info=updateState;
  const busy=['checking','downloading','installing'].includes(info.status);
  const labels={idle:'Проверка по запросу',checking:'Проверяю GitHub…',available:'Доступна новая версия', 'up-to-date':'У вас актуальная версия',downloading:'Скачиваю и проверяю файлы…',downloaded:'Обновление скачано и проверено',installing:'Подготавливаю установку и перезапуск…',error:'Обновление не завершено'};
  $('#modal-content').innerHTML=`<h2 id="modal-title">Обновления Опоры</h2><p>Установлена версия <strong>${escapeHtml(info.currentVersion)}</strong>${info.latestVersion?' · на GitHub: '+escapeHtml(info.latestVersion):''}</p><section class="update-state"><h3>${labels[info.status]||'Обновления'}</h3>${info.status==='installing'&&info.installPhase?`<p role="status">${escapeHtml(info.installPhase)}</p><p class="small-note">Проверка файлов на медленном диске может занять несколько минут. Не закрывайте программу.</p>`:''}${info.status==='available'?`<p>Загрузка: ${(Number(info.total||0)/1024/1024).toFixed(1)} МБ · ${info.packageKind==='app'?'только приложение':'полная сборка'}</p>`:''}${info.status==='downloading'?`<progress max="${Number(info.total)||1}" value="${Number(info.received)||0}" aria-label="Скачивание обновления"></progress><p>${Math.round((info.received||0)/1024/1024)} из ${Math.round((info.total||0)/1024/1024)} МБ</p>`:''}${info.error?`<p class="context-note">${escapeHtml(info.error)}</p>`:''}${info.notes?`<p class="update-notes">${escapeHtml(info.notes)}</p>`:''}</section>${!info.supported?'<p class="context-note">Установка с перезапуском доступна в готовом приложении для Windows. Здесь можно проверить версию.</p>':'<p>Опора сохранит данные и перезапустится сама. Claude и MCP продолжат работу; предыдущая версия сохранится для отката.</p>'}${['failed','needs_attention'].includes(info.previousInstall?.status)?`<p class="context-note">Обновление не подтверждено: ${escapeHtml(info.previousInstall.error||'проверьте журнал установки')}<br>Этап: ${escapeHtml(info.previousInstall.phase||'не указан')}</p>`:info.previousInstall?.status==='installed'&&info.previousInstall.version===info.currentVersion&&info.status!=='error'?`<p class="small-note">Подтверждён запуск ${escapeHtml(info.previousInstall.version)}.</p>`:''}<details class="technical-note"><summary>Папка и диагностика</summary><p>Запущенная копия: ${escapeHtml(info.installDirectory||'путь недоступен')}</p>${info.previousInstall?.log?`<p>Журнал: ${escapeHtml(info.previousInstall.log)}</p>`:''}${info.previousInstall?.backup?`<p>Резервная копия: ${escapeHtml(info.previousInstall.backup)}</p>`:''}<button class="text-button" data-action="copy-update-diagnostics">Скопировать диагностику</button></details><p class="small-note">Загрузка идёт из Isedis/basket на GitHub. Проверяются SHA256 частей и всего ZIP. Интернет используется только при проверке и скачивании по вашей команде.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal" ${info.transaction?'disabled':''}>Закрыть</button>${info.supported?`<button class="button" data-action="install-update" ${busy?'disabled':''}>${busy?'Подождите…':info.status==='available'?'Обновить':info.status==='downloaded'?'Установить и перезапустить':'Проверить и обновить'}</button>`:`<button class="button" data-action="check-updates" ${busy?'disabled':''}>${busy?'Подождите…':'Проверить обновления'}</button>`}</div>`;
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
    toast('Черновик готов.');
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
  showModal(`<h2 id="modal-title">${task?'Изменить задачу':'Новая задача'}</h2><form id="task-form" data-id="${escapeHtml(task?.id || '')}"><label class="field"><span>Что нужно сделать</span><input name="title" required maxlength="180" value="${escapeHtml(task?.title || '')}" placeholder="Например: привести кнопки меню к эталону"></label><label class="field"><span>Как понять, что готово</span><textarea name="acceptance" rows="5" required placeholder="Какие элементы изменить, на какой образец опираться и что проверить?">${escapeHtml(task?.acceptance || '')}</textarea></label><div class="modal-actions">${task?`<button type="button" class="button secondary danger" data-action="delete-task" data-id="${escapeHtml(task.id)}">Удалить</button>`:''}<button type="button" class="button secondary" data-action="close-modal">Отмена</button><button class="button" type="submit">Сохранить задачу</button></div></form>`);
}
async function openProject() {
  if(scanning || applyingBrand){toast('Дождитесь завершения работы с брендбуком.');return;}
  if (!bridge) {showModal('<h2 id="modal-title">Подключение — в приложении Windows</h2><p>Сейчас открыт браузерный демонстрационный режим. Он позволяет проверить интерфейс, но не читает папки компьютера.</p><p>Запустите Opora.exe и выберите папку, в которой лежит project.godot. Игра останется на месте; переносить её не нужно.</p><div class="modal-actions"><button class="button" data-action="close-modal">Понятно</button></div>'); return;}
  await persist();
  await visualFeedbackView.whenIdle();
  const project = await bridge.openProject();
  if (!project) return;
  root = project.root;
  brandAssessment=null;assessmentFor=null;reviewErrorFor=null;
  agentConnection=null;agentActivity={reports:[],unreadable:0};
  state = project.state || blankState(project.info.name);
  savedProject=structuredClone(state);approvedBrand=null;brandConflict=null;$('#brand-conflict').hidden=true;
  revision = 0; syncedRevision = -1; failedSave = false;
  tab = 'overview';
  await persist();
  render();
  toast('Проект открыт.');
  if(needsBrandbook() && bridge.scanBrandbook)await scanBrand(true);
}
async function previewSync() {
  if (!root) {toast('Подключите папку игры в приложении Windows. В демо можно скопировать запрос.', true); return;}
  await persist();
  const snapshot = structuredClone(state);
  const previewRevision=revision;
  const previewRoot=root;
  const files = await bridge.preview(snapshot);
  if(previewRevision!==revision || previewRoot!==root){toast('Контекст изменился. Откройте предпросмотр ещё раз.');return;}
  pendingSync = {state:snapshot, revision:previewRevision};
  showModal(`<h2 id="modal-title">Передать общий контекст</h2><p>Будут обновлены только перечисленные файлы. Код и сцены игры не меняются. В AGENTS.md и CLAUDE.md заменяется только блок Opora; остальное сохраняется.</p>${files.map(f=>`<details><summary>${escapeHtml(f.file)} ${f.existing?'· существующие инструкции сохранятся':''}</summary><pre class="code-preview">${escapeHtml(f.content)}</pre></details>`).join('')}<p>Предыдущие версии сохранятся в <span class="file-tag">.opora/backups/</span>. Данные и эталоны Opora лежат рядом с игрой: учитывайте их при публикации репозитория.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Отмена</button><button class="button" data-action="confirm-sync">Обновить эти файлы</button></div>`);
}

document.addEventListener('input', event => {
  if(event.target.id==='command-search'){commandIndex=0;renderCommands();return;}
  const key = event.target.dataset.field;
  if (!key) return;
  if(key.startsWith('brand.')&&key!=='brand.status'){state.brand.status='draft';delete state.brand.approval;approvedBrand=null;const select=document.querySelector('[data-field="brand.status"]');if(select)select.value='draft';}
  if(key==='brand.status')approvedBrand=event.target.value==='approved'?structuredClone(state.brand):null;
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
  const command=event.target.closest('[data-command]');
  if(command){await executeCommand(command.dataset.command);return;}
  const nav = event.target.closest('[data-tab]');
  if (nav) {tab = nav.dataset.tab; render(); if(tab==='agents')await refreshAgents();return;}
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  try {
    if (action === 'disconnect-agent'){await bridge.disconnectAgent(button.dataset.client);await refreshAgents();toast('Подключение убрано. Перезапустите сессию агента.');}
    if (action === 'claude-open') await claudeTerminal.open();
    if (action === 'commands') showCommands();
    if (action === 'work-context') await showWorkContext();
    if (action === 'copy-work') await copyWorkContext();
    if (action === 'brand-conflict') await showBrandConflict();
    if (action === 'brand-use-agent') await resolveBrandConflict(true);
    if (action === 'brand-keep-mine') await resolveBrandConflict(false);
    if (action === 'open') {button.disabled = true; try {await openProject();} finally {button.disabled = false;}}
    if (action === 'goto-context') {tab='context'; render();}
    if (action === 'goto-tasks') {tab='tasks'; render();}
    if (action === 'goto-brand') {tab='brand';render();}
    if (action === 'goto-agents') {tab='agents';render();await refreshAgents();}
    if (action === 'focus-brand-field') {
      const key=button.dataset.fieldKey;
      if(!['palette','fonts','direction','avoid','status','references'].includes(key))return;
      const field=key==='references'?document.querySelector('[data-action="add-reference"]'):document.querySelector(`[data-field="brand.${key}"]`);
      field?.scrollIntoView({behavior:'auto',block:'center'});field?.focus({preventScroll:true});
    }
    if (action === 'review-brand') await reviewBrand(true);
    if (action === 'brand-finding-task') {
      const finding=currentBrandReview().findings.find(f=>f.id===button.dataset.id);
      if(!finding){toast('Это замечание уже устранено.');return;}
      if(state.tasks.some(t=>t.brandFindingId===finding.id && t.status!=='done'))return;
      state.tasks.push({id:id(),title:'Брендбук: '+finding.title,acceptance:`Проблема: ${finding.detail}\nПредложение: ${finding.suggestion}\nКритерий: ${finding.acceptance}\nПодготовить предложение пользователю; не менять .opora/project.json напрямую и не утверждать стиль самостоятельно.`,status:'backlog',brandFindingId:finding.id});
      changed();refreshReviewPanel();toast('Задача добавлена в очередь.');
    }
    if (action === 'copy-brand-review') {
      const report=currentBrandReview();
      const text=`Разбор брендбука игры «${state.name}».\n${report.scope}\nПунктов с достаточными данными: ${report.ready}/${report.total}.\n\n${report.findings.map(f=>`${f.title}\n${f.detail}\nЧто предложить: ${f.suggestion}`).join('\n\n')}\n\n${report.contrastBasis}\nПредложи изменения на просмотр пользователю. Не утверждай стиль и не меняй .opora/project.json напрямую.`;
      if(bridge)await bridge.copy(text);else await navigator.clipboard.writeText(text);
      toast('Разбор скопирован.');
    }
    if (action === 'refresh-agents') await refreshAgents();
    if (action === 'configure-agent') configureAgent(button.dataset.client);
    if (action === 'confirm-agent' && pendingAgent) {
      button.disabled=true;
      try {await persist();await bridge.configureAgent(pendingAgent);closeModal();await refreshAgents();toast('Настроено. Перезапустите сессию агента.');} finally {button.disabled=false;}
    }
    if (action === 'copy-brand-agent') await copyBrandAgentPrompt();
    if (action === 'copy-project-agent') await copyBrandAgentPrompt(true);
    if (action === 'copy-agent-start' && agentConnection) {
      await bridge.copy(`Работаем над игрой «${state.name}» в папке ${agentConnection.root}. Используй MCP-сервер ${agentConnection.server_name}: начни с opora_get_work_context и проверь папку. Используй связанные замечания и решения; подробные инструменты вызывай по необходимости. Выполни выбранную задачу. Перед отправкой отчёта используй актуальную revision. Незапущенные проверки отметь not_run. Результат отправь через opora_report_progress со статусом ready_for_review; завершение подтверждает пользователь.`);
      toast('Первый запрос скопирован. Вставьте его в новую сессию агента.');
    }
    if (action === 'copy-update-diagnostics') {
      const diagnostics=bridge.updateDiagnostics?await bridge.updateDiagnostics():{previousInstall:updateState.previousInstall};
      await bridge.copy(JSON.stringify({currentVersion:updateState.currentVersion,latestVersion:updateState.latestVersion,installDirectory:updateState.installDirectory,error:updateState.error,...diagnostics},null,2));
      toast('Диагностика скопирована.');
    }
    if (action === 'updates') await showUpdates();
    if (action === 'check-updates') {button.disabled=true;try {updateState={...updateState,...await bridge.checkUpdates()};if(updatesOpen)renderUpdates();} finally {button.disabled=false;}}
    if (action === 'download-update') {button.disabled=true;try {updateState={...updateState,...await bridge.downloadUpdate()};if(updatesOpen)renderUpdates();} finally {button.disabled=false;}}
    if (action === 'install-update') {
      button.disabled=true;
      try {await visualFeedbackView.whenIdle();await persist();await saves;await bridge.installUpdate();} finally {button.disabled=false;}
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
      changed(); render(); toast('Задача выбрана.');
    }
    if (action === 'close-modal') closeModal();
    if (action === 'discard-close') bridge?.readyToClose();
    if (action === 'copy-brief') await copyBrief();
    if (action === 'preview-sync') await previewSync();
    if (action === 'confirm-sync' && pendingSync) {
      button.disabled = true;
      try {
        const snapshot = pendingSync;
        if(snapshot.revision!==revision)throw new Error('Контекст изменился. Обновите предпросмотр перед записью.');
        const result = await bridge.sync(snapshot.state,snapshot.state.brand,snapshot.state);
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
      changed(); render(); toast('Образец убран. Копия файла сохранена.');
    }
    if (action === 'help') showHelp();
  } catch(error) {fail(error);}
});
window.addEventListener('beforeunload', () => {if (!root) persist();});
$('#modal').addEventListener('cancel', event => {
  if(updatesOpen && (updateState?.transaction||updateState?.status==='installing')){event.preventDefault();return;}
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
  savedProject=structuredClone(state);approvedBrand=null;brandConflict=null;$('#brand-conflict').hidden=true;
    render(); status('Проект открыт · локальные данные');
    if(needsBrandbook() && bridge.scanBrandbook)await scanBrand(true);
  } catch(error) {fail(error);}
}
bridge?.onCloseRequested?.(async () => {
  if (closing) return;
  closing = true;
  try {await visualFeedbackView.whenIdle(); await persist(); await saves; bridge.readyToClose();} catch {
    closing = false;
    showModal('<h2 id="modal-title">Изменения не сохранены</h2><p>Проверьте название игры и доступ к её папке. Можно вернуться к работе или закрыть приложение, потеряв последние несохранённые изменения.</p><div class="modal-actions"><button class="button secondary" data-action="discard-close">Закрыть без сохранения</button><button class="button" data-action="close-modal">Продолжить работу</button></div>');
  }
});
render();
initialize().then(()=>bridge?.workspaceReady?.());

function showHelp() {
  showModal('<h2 id="modal-title">Справка</h2><ol class="help-list"><li>Откройте папку игры с project.godot.</li><li>Выберите задачу и задайте критерии готовности.</li><li>Настройте Claude / Codex в разделе «Агенты» или скопируйте запрос.</li><li>Зафиксируйте стиль и эталоны в «Брендбуке».</li><li>Проверьте результат в Godot; замечания добавьте в правила.</li></ol><details class="technical-note" open><summary>Клавиши</summary><p>Ctrl+K — команды<br>Ctrl+1…5 — разделы<br>Ctrl+N — новая задача<br>Ctrl+S — сохранить<br>Ctrl+Enter — сохранить задачу / скопировать контекст<br>F1 — справка</p></details><details class="technical-note"><summary>Данные и проверки</summary><p>Данные игры хранятся в .opora. Инструкции для агентов обновляются по кнопке; MCP читает сохранённые данные напрямую. Перед изменением инструкций создаётся резервная копия.</p><p>Разбор брендбука проверяет записанные правила. Он не оценивает художественное качество изображений и не запускает игру. Результат и отчёты агента проверяйте в Godot.</p></details><div class="modal-actions"><button class="button" data-action="close-modal">Закрыть</button></div>');
}
document.addEventListener('keydown',async event=>{
  if(event.target.closest('#claude-dock'))return;
  const modifier=(event.ctrlKey||event.metaKey) && !event.altKey;
  if($('#modal').open && $('#command-search')) {
    if(modifier && event.code==='KeyK'){event.preventDefault();closeModal();}
    else if(event.target.id==='command-search' && ['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const count=filteredCommands().length;if(count){commandIndex=(commandIndex+(event.key==='ArrowDown'?1:-1)+count)%count;renderCommands();}}
    else if(event.target.id==='command-search' && event.key==='Enter'){event.preventDefault();const command=filteredCommands()[commandIndex];if(command)await executeCommand(command.id);}
    return;
  }
  if($('#modal').open) {
    if(modifier && event.code==='KeyK'){event.preventDefault();return;}
    if(modifier && event.key==='Enter' && $('#task-form')){event.preventDefault();$('#task-form').requestSubmit();}
    return;
  }
  try {
    if(modifier && event.code==='KeyK'){event.preventDefault();showCommands();}
    else if(modifier && /^[1-7]$/.test(event.key)) {
      event.preventDefault();tab=['overview','tasks','brand','agents','context','map','feedback'][Number(event.key)-1];render();if(tab==='agents')await refreshAgents();
    } else if(modifier && event.code==='KeyN') {event.preventDefault();tab='tasks';render();editTask();}
    else if(modifier && event.code==='KeyS') {event.preventDefault();await persist();}
    else if(modifier && event.key==='Enter' && tab==='context') {event.preventDefault();document.querySelector('[data-action="copy-brief"]')?.click();}
    else if(event.key==='F1') {event.preventDefault();showHelp();}
  } catch(error) {fail(error);}
});

async function copyBrief() {
  if(root&&bridge?.workContext)return copyWorkContext();
  const text=OporaContext.taskBrief(state);
  if(bridge)await bridge.copy(text);else await navigator.clipboard.writeText(text);
  toast('Запрос скопирован.');
}
function refreshBrandFields() {
  document.querySelectorAll('[data-field]').forEach(el=>{
    const value=el.dataset.field.split('.').reduce((value,key)=>value[key],state);
    if(el.value===value)return;
    const start=el.selectionStart,end=el.selectionEnd;
    el.value=value;
    if(document.activeElement===el && typeof start==='number')el.setSelectionRange(Math.min(start,value.length),Math.min(end,value.length));
  });
  const note=$('#agent-brand-note');if(note){note.hidden=!state.brand.agentDraft;note.textContent=state.brand.agentDraft?'Последнее изменение через MCP: '+state.brand.agentDraft.agent+' / '+state.brand.agentDraft.summary:'';}
  pendingExternalRender=true;
  if(!document.activeElement?.matches('input,textarea,select') && !$('#modal').open){render();pendingExternalRender=false;}
  refreshChrome();if(tab==='brand'){refreshReviewPanel();queueBrandReview();}
}
function setBrandConflict(remote,base=savedProject) {
  brandConflict={remote:structuredClone(remote),base:structuredClone(base)};
  $('#brand-conflict').hidden=false;
}
async function refreshExternalBrand() {
  if(document.activeElement?.matches('input,textarea,select') || !root || !bridge?.projectSnapshot || remoteLoading || saving || timer || failedSave || brandConflict || scanning || applyingBrand || $('#modal').open)return;
  const project=root;remoteLoading=true;
  try {
    const current=await bridge.projectSnapshot();
    if(root!==project || current?.root!==project || !current.state || saving || timer || $('#modal').open)return;
    if(JSON.stringify(current.state)===JSON.stringify(savedProject))return;
    const merged=OporaContext.mergeProject(savedProject,state,current.state);
    if(merged.conflicts.length){setBrandConflict(current.state);return;}
    state=merged.state;savedProject=structuredClone(current.state);revision++;
    refreshBrandFields();if(tab==='context')updatePreview();
    toast('Данные обновлены из Опоры.');
  }catch(error){status('Не удалось прочитать изменения брендбука');}
  finally{remoteLoading=false;}
}
setInterval(refreshExternalBrand,2000);
async function showBrandConflict() {
  if(!brandConflict)return;
  const current=await bridge.projectSnapshot();if(current?.root!==root)return;
  brandConflict.remote=current.state;
  const values=value=>value;
  showModal(`<h2 id="modal-title">Две версии проекта</h2><p>Правки в одном поле разошлись. Выберите предпочтение для спорных полей. Непересекающиеся правки будут объединены.</p><div class="grid-two"><section><h3>В этом окне</h3><pre class="code-preview">${escapeHtml(JSON.stringify(values(state),null,2))}</pre></section><section><h3>Сохранено в Опоре</h3><pre class="code-preview">${escapeHtml(JSON.stringify(values(brandConflict.remote),null,2))}</pre></section></div><div class="modal-actions"><button class="button secondary" data-action="close-modal">Позже</button><button class="button secondary" data-action="brand-keep-mine">Сохранить мою версию</button><button class="button" data-action="brand-use-agent">Принять сохранённую версию</button></div>`);
}
async function resolveBrandConflict(useRemote) {
  if(!brandConflict)return;
  // Keep the compared version as the baseline; a newer agent edit still conflicts.
  const remote=brandConflict.remote;
  state=OporaContext.mergeProject(brandConflict.base,state,remote,useRemote).state;
  savedProject=structuredClone(remote);brandConflict=null;failedSave=false;$('#brand-conflict').hidden=true;
  closeModal();refreshBrandFields();changed();await persist();
}
let commandIndex=0;
const appCommands=[
  ...[['overview','Рабочий стол','desk overview проект'],['tasks','Задачи','tasks очередь'],['brand','Брендбук','brand style стиль'],['agents','Агенты','agents mcp claude codex'],['context','Контекст','context памятка'],['map','Карта проекта','map files сцены скрипты связи'],['feedback','Замечания на снимках','feedback screenshots снимки замечания проверка']].map(([target,label,aliases],i)=>({id:target,label,aliases,hint:'Раздел',key:`Ctrl ${i+1}`,run:async()=>{tab=target;render();$('#main').scrollTop=0;if(tab==='agents')await refreshAgents();}})),
  {id:'new-task',label:'Новая задача',aliases:'new task создать добавить',hint:'Задачи',key:'Ctrl N',run:()=>{tab='tasks';render();editTask();}},
  {id:'copy',label:'Скопировать запрос',aliases:'copy brief копировать контекст',hint:'Для агента',key:'',run:copyBrief},
  {id:'review',label:'Проверить брендбук',aliases:'review audit разбор оценка',hint:'Стиль',key:'',run:async()=>{tab='brand';render();await reviewBrand(true);}},
  {id:'open',label:'Открыть проект',aliases:'open project папка переключить',hint:'Проект',key:'',run:openProject},
  {id:'save',label:'Сохранить проект',aliases:'save сохранить',hint:'Данные',key:'Ctrl S',run:persist},
  {id:'updates',label:'Обновления',aliases:'update version версия',hint:'Приложение',key:'',run:showUpdates},
  {id:'help',label:'Справка',aliases:'help клавиши помощь',hint:'Приложение',key:'F1',run:showHelp}
];
function filteredCommands() {
  const terms=($('#command-search')?.value || '').toLocaleLowerCase('ru-RU').replace(/^[/\s>:]+/,'').trim().split(/\s+/).filter(Boolean);
  return appCommands.filter(command=>terms.every(term=>(command.label+' '+command.aliases).toLocaleLowerCase('ru-RU').includes(term)));
}
function renderCommands() {
  const input=$('#command-search');if(!input)return;
  const commands=filteredCommands();commandIndex=Math.min(commandIndex,Math.max(0,commands.length-1));
  $('#command-results').innerHTML=commands.map((command,i)=>`<li class="command-option" id="command-${command.id}" role="option" aria-selected="${i===commandIndex}" data-command="${command.id}" title="${command.hint}"><span class="command-marker" aria-hidden="true">${i===commandIndex?'>':' '}</span><span class="command-label">${command.label}</span><kbd>${command.key}</kbd></li>`).join('');
  $('#command-empty').hidden=commands.length>0;
  $('#command-count').textContent=String(commands.length).padStart(2,'0');
  if(commands.length){input.setAttribute('aria-activedescendant','command-'+commands[commandIndex].id);$('#command-'+commands[commandIndex].id).scrollIntoView({block:'nearest'});}
  else input.removeAttribute('aria-activedescendant');
}
function showCommands() {
  if($('#modal').open)return;
  if(scanning || applyingBrand){toast('Дождитесь подготовки брендбука.');return;}
  commandIndex=0;
  showModal('<div class="command-heading"><h2 id="modal-title">Команды</h2><span><span id="command-count">00</span> / действий</span></div><label class="command-prompt"><span aria-hidden="true">&gt;</span><input id="command-search" role="combobox" aria-label="Найти команду" aria-controls="command-results" aria-expanded="true" aria-autocomplete="list" placeholder="Найти команду или раздел…" autocomplete="off" spellcheck="false"></label><ul id="command-results" role="listbox" aria-label="Действия Опоры"></ul><p id="command-empty" class="command-empty" role="status" hidden>Действие не найдено</p><div class="command-footer"><span>↑↓ выбрать <span aria-hidden="true">/</span> Enter выполнить <span aria-hidden="true">/</span> Esc закрыть</span><button class="text-button" data-action="close-modal">Закрыть</button></div>');
  $('#modal').classList.add('command-dialog');
  renderCommands();$('#command-search').focus();
}
async function executeCommand(commandId) {
  const command=appCommands.find(item=>item.id===commandId);if(!command)return;
  closeModal();
  try {await command.run();}catch(error){fail(error);}
}

async function copyBrandAgentPrompt(allData=false) {
  if(!root || !bridge?.agentInfo){toast('Откройте папку игры и настройте MCP в разделе «Агенты».');return;}
  await persist();
  const info=await bridge.agentInfo();
  if(allData){
    await bridge.copy(`Заполни данные проекта «${state.name}» (${info.root}) через MCP ${info.server_name}.
Начни с opora_get_work_context и проверь корень игры. Поля, задачи и снимки читай отдельно, если нужны подробности. Изучи доступные файлы и изображения игры, отделяя факты от предложений.
Используй opora_update_project с актуальными project_id/revision, уникальным request_id, agent, summary и fields. Заполни name, genre, pitch, experience, goal, pillars, rules; brand.direction/palette/fonts/avoid; tasks (id, title, acceptance, backlog/active), active_task_id и reference_files (относительные пути PNG/JPG/WebP внутри игры).
Сохраняй существующие решения и задачи, не выдумывай факты и просмотренные источники. Неопределённое обозначь как предложение или вопрос. Для изменения существующих задач используй их ID. Эталоны добавляются кандидатами, брендбук — черновиком. Завершение и утверждение оставь пользователю. Не редактируй .opora/project.json напрямую. При STALE_CONTEXT перечитай данные и учти новые правки. После записи вызови opora_review_brandbook и перечисли оставшиеся вопросы.`);
    toast('Запрос скопирован. Вставьте его в подключённого агента.');return;
  }
  await bridge.copy(`Заполни брендбук игры «${state.name}» в ${info.root} через MCP ${info.server_name}.
Начни с opora_get_work_context и проверь папку. Для сокращённых полей используй полное чтение; эталоны доступны отдельными инструментами.
Изучи файлы игры и доступные изображения через свои инструменты и opora_get_reference. Разделяй найденные факты и предлагаемые решения; не выдумывай просмотренные файлы и утверждённые эталоны.
Подготовь direction (направление), palette (HEX и роли цветов, явные пары текста/фона), fonts (семейства, пути и размеры для разных ролей) и avoid (ограничения). Учитывай существующие правила и объясни существенные изменения.
Сохрани через opora_update_brandbook: актуальные project_id и revision, уникальный request_id, agent, краткий summary и fields. Перед записью перечитай контекст, если он изменился. Не редактируй .opora/project.json напрямую. Стиль и эталоны самостоятельно не утверждай.
Вызови opora_review_brandbook и кратко перечисли оставшиеся вопросы пользователю.`);
  toast('Запрос скопирован. Вставьте его в подключённого агента.');
}

document.addEventListener('focusout',()=>setTimeout(()=>{if(pendingExternalRender && !document.activeElement?.matches('input,textarea,select') && !$('#modal').open){render();pendingExternalRender=false;}},0));
