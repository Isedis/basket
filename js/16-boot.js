'use strict';
/* ---------- навигация: 4 раздела, вкладки сверху, один экран за раз ---------- */
// БОЙ · ГЕРОЙ (статы, алтарь, вещи, класс) · ПРОКАЧКА (таланты, ветка, тотем, небосвод) · МЕНЮ (жизнь, автоматика, настройки).
// Все экраны — на весь экран между строкой зоны/HP и нижним меню; кнопок «Закрыть» нет. Вкладки открываются постепенно.
const UI_SEC = {
  hero: [['stats', 'Статы'], ['altar', 'Алтарь'], ['gear', 'Вещи'], ['cls', 'Класс'], ['raid', 'Рейд']],
  up: [['tal', 'Таланты'], ['branch', 'Ветка'], ['totem', 'Тотем'], ['sky', 'Небосвод'], ['army', 'Армия']],
};
const UI_NAME = { stats: 'Статы', altar: 'Алтарь силы', gear: 'Вещи', cls: 'Класс', tal: 'Таланты', branch: 'Ветка класса', totem: 'Тотем душ', sky: 'Небосвод', army: 'Армия духов', raid: 'Рейд-босс' };
function uiOpen(sub) {
  const M = S.meta, cl = M.cl || {};
  switch (sub) {
    case 'stats': case 'cls': return true;
    case 'altar': return stats.length >= 4 || (M.best || 0) >= 6;
    case 'gear': { const g = G(), c = g.chests || {}; return (M.best || 0) >= 4 || (c.c || 0) + (c.r || 0) + (c.e || 0) + (c.w || 0) > 0 || Object.values(g.eq || {}).some(Boolean); }
    case 'tal': return (M.rebirths || 0) >= 1;
    case 'branch': return Object.values(cl).some(c => c.lv >= 1);
    case 'totem': return !!(M.totem && M.totem.n) || !TN.some(nd => nd.alt == null && tOpen(nd) && !nodeBlocked(nd) && TL(nd.id) < nMax(nd)) && (M.rebirths || 0) >= 1;
    case 'sky': return (M.asc || 0) > 0 || !!M.sparks;
    case 'army': return armyOn();
    case 'raid': return raidOpen();
  }
  return false;
}
let uiSec = 'fight';
const uiSub = { hero: 'stats', up: 'tal' };
// закрыть всё, что может лежать поверх
function uiHideAll() {
  $('panel').classList.remove('open'); $('settings').classList.remove('open');
  for (const id of ['tree', 'gear', 'ctree', 'totem', 'army', 'raid', 'altar', 'sky', 'opening']) { const e = $(id); if (e) e.hidden = true; }
  const c = $('croll'); if (c) c.hidden = true; const pi = $('info'); if (pi) pi.hidden = true;
}
function uiTap() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} sfx.tap(); }
// компьютер: широкий экран — бой слева всегда виден, справа панель раздела (body.wide)
const isWide = () => document.body.classList.contains('wide');
let uiLast = 'hero';
function uiWide() {
  const w = innerWidth >= 900 && innerWidth >= innerHeight * 1.15, was = isWide();
  document.body.classList.toggle('wide', w);
  document.documentElement.style.setProperty('--sidew', Math.round(Math.max(380, Math.min(560, innerWidth * .34))) + 'px');
  if (w !== was) { setTimeout(resize, 30); if (w && uiSec === 'fight') setTimeout(() => { if (isWide() && uiSec === 'fight') go(uiLast); }, 300); }
}
function go(sec, sub) {
  if (sec === 'fight' && isWide()) { if (uiSec !== 'fight') return; sec = uiLast; }   // бой и так на экране: панель не закрываем
  if (sec !== 'fight') uiLast = sec;
  if (sec === 'fight') { uiHideAll(); uiSec = 'fight'; $('subnav').hidden = true; navOn('nFight'); setTimeout(resize, 30); return; }
  if (sec === 'menu') { uiHideAll(); uiSec = 'menu'; $('subnav').hidden = true; navOn('nMenu'); $('settings').classList.add('open'); renderSouls(); return; }
  const list = UI_SEC[sec].filter(([k]) => uiOpen(k)); if (!list.length) return;
  if (!sub || !list.some(([k]) => k === sub)) sub = list.some(([k]) => k === uiSub[sec]) ? uiSub[sec] : list[0][0];
  uiHideAll(); uiSec = sec; uiSub[sec] = sub; (S.meta.uiNew || {})[sub] && delete S.meta.uiNew[sub];
  renderSubnav(); navOn(sec === 'hero' ? 'nHero' : 'nUp');
  switch (sub) {
    case 'stats': $('panel').classList.add('open'); setTab('S'); break;
    case 'altar': openAltar(); break;
    case 'gear': $('gear').hidden = false; renderGear(); break;
    case 'cls': ctTab = ctTab === 'tree' ? 'rel' : ctTab; openCT(cls()); break;
    case 'tal': openTree(); break;
    case 'branch': ctTab = 'tree'; openCT(cls()); break;
    case 'totem': openTotem(); break;
    case 'sky': openSky(); break;
    case 'army': openArmy(); break;
    case 'raid': openRaid(); break;
  }
  navOn(sec === 'hero' ? 'nHero' : 'nUp'); $('subnav').hidden = false;
  // карты получают размер только после раскладки экрана — пересчитываем размер и масштаб чуть позже
  setTimeout(() => { try {
    if (sub === 'tal') { const small = !uiFit.tal; sizeTree(); if (small) { fitTree(); uiFit.tal = 1; } drawTree(); }
    if (sub === 'sky') { sizeSky(); if (!uiFit.sky) { skyFit(); uiFit.sky = 1; } reqSky(); }
    if (sub === 'altar') sizeAltar(); if (sub === 'totem') sizeTotem(); if (sub === 'army') sizeArmy();
  } catch (e) {} }, 80);
}
const uiFit = {};
function renderSubnav() {
  const sec = uiSec, el = $('subnav'); if (!UI_SEC[sec]) return; const nw = S.meta.uiNew || {};
  const h = UI_SEC[sec].filter(([k]) => uiOpen(k)).map(([k, n]) => `<button class="sn${uiSub[sec] === k ? ' on' : ''}" data-sub="${k}">${n}${nw[k] ? '<b class="dot"></b>' : ''}</button>`).join('');
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
// старые вызовы («показать шторку», «подсветить кнопку») — через новые разделы
function navOn(id) {
  if (id === 'nFight' && isWide()) return;   // компьютер: бой и так виден, панель с вкладками не трогаем
  const m = { nFight: 'nFight', nStats: 'nHero', nCls: 'nHero', gearb: 'nHero', treeb: 'nUp', nSouls: 'nMenu', nSet: 'nMenu', nHero: 'nHero', nUp: 'nUp', nMenu: 'nMenu' }[id] || '';
  for (const b of document.querySelectorAll('#nav .nb')) b.classList.toggle('on', b.id === m);
  if (m === 'nFight' && uiSec !== 'fight') { uiSec = 'fight'; $('subnav').hidden = true; }
}
function showSheet(name) {
  if (name === 'none') { $('panel').classList.remove('open'); $('settings').classList.remove('open'); return; }
  if (name === 'stats') return go('hero', 'stats');
  if (name === 'souls' || name === 'set') return go('menu');
  go('fight');
}
$('nFight').onclick = () => { uiTap(); go('fight'); };
$('nHero').onclick = () => { uiTap(); go('hero'); };
$('nUp').onclick = () => { uiTap(); go('up'); };
$('nMenu').onclick = () => { uiTap(); go('menu'); };
$('subnav').onclick = e => { const b = e.target.closest('[data-sub]'); if (!b) return; uiTap(); go(uiSec, b.dataset.sub); };
// раздел ПРОКАЧКА появляется после первой смерти; новые вкладки — с пометкой и сообщением
function uiTick() {
  const M = S.meta; if (!M.uiSeen) { M.uiSeen = {}; for (const s of [...UI_SEC.hero, ...UI_SEC.up]) if (uiOpen(s[0])) M.uiSeen[s[0]] = 1; }   // старые сохранения: всё уже открытое не помечаем
  if (!M.uiNew) M.uiNew = {};
  for (const [k] of [...UI_SEC.hero, ...UI_SEC.up]) if (!M.uiSeen[k] && uiOpen(k)) { M.uiSeen[k] = 1; M.uiNew[k] = 1; toast('ОТКРЫТ РАЗДЕЛ: ' + UI_NAME[k].toUpperCase(), (UI_SEC.hero.some(s => s[0] === k) ? 'Герой' : 'Прокачка') + ' → ' + UI_NAME[k]); }
  $('nUp').hidden = !UI_SEC.up.some(([k]) => uiOpen(k));
  const nw = M.uiNew;
  $('nHero').classList.toggle('has', ['stats', 'altar', 'gear', 'cls', 'raid'].some(k => nw[k]) || $('nCls').classList.contains('has') || !$('gbadge').hidden);
  $('nUp').classList.toggle('has', ['tal', 'branch', 'totem', 'sky', 'army'].some(k => nw[k]) || $('treeb').classList.contains('has'));
  $('nMenu').classList.toggle('has', $('nSouls').classList.contains('has'));
  if (uiSec !== 'fight' && uiSec !== 'menu') renderSubnav();
  // карточка класса не висит вечно: прячется через 6 с
  { const c = $('croll'); if (c && !c.hidden) { c._t = c._t || performance.now(); if (performance.now() - c._t > 6000) { c.hidden = true; c._t = 0; } } else if (c) c._t = 0; }
}
setInterval(uiTick, 700);
// перенос блока «Жизнь» (души, завершить жизнь, вознесение, автоматика) в МЕНЮ
{ const d = $('dlist'), s = $('lifebox'); if (d && s) { s.appendChild(d); d.hidden = false; d.classList.add('menulife'); }
  for (const id of ['tbtn', 'totb', 'clsopen']) { const e = $(id); if (e) e.hidden = true; } const tb = $('tabD'); if (tb) tb.hidden = true; }
// верх экранов: строка зоны/HP остаётся видна, вкладки раздела — под ней
function uiLayout() { const h = $('hud').getBoundingClientRect().height; document.documentElement.style.setProperty('--hudh', Math.round(h) + 'px'); }
addEventListener('resize', () => { uiWide(); uiLayout(); }); uiWide(); setTimeout(uiLayout, 50); setInterval(uiLayout, 2000);

/* ---------- обновление игры ---------- */
// берём свежую страницу в обход кэша и сравниваем номер сборки
async function latestBuild() {
  const r = await fetch(location.pathname + '?check=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('http ' + r.status);
  const m = (await r.text()).match(/const BUILD = '(\d+)'/);
  return m ? m[1] : null;
}
async function checkUpdate(manual) {
  const b = $('updb');
  try {
    const nb = await latestBuild();
    if (nb && nb !== BUILD) {
      b.classList.add('new');
      if (manual) { toast('ОБНОВЛЕНИЕ', 'сохраняю прогресс и загружаю новую версию…', 1500); save(true); setTimeout(() => location.replace(location.pathname + '?v=' + nb), 600); }
      else feed('Есть обновление игры — нажми ⟳', '#5cff8a');
    } else if (manual) toast('У ВАС ПОСЛЕДНЯЯ ВЕРСИЯ', 'сборка ' + BUILD + ' · свежее обновление появляется на сайте через 1–2 мин', 3200);
  } catch (e) { if (manual) toast('НЕ УДАЛОСЬ ПРОВЕРИТЬ', 'нет связи с сайтом — попробуй позже'); }
}
$('updb').onclick = () => checkUpdate(true);
setInterval(() => { if (!document.hidden) checkUpdate(false); }, 5 * 60 * 1000);
if (location.search.includes('v=')) try { history.replaceState(null, '', location.pathname); } catch (e) {}

/* ---------- сохранение и офлайн-прогресс ---------- */
// сохранение: в браузер (быстро) и в облако артефакта — личная ячейка игрока, переживает перезапуск
let cloud = null, cloudJson = null, cloudT = 0;
let wiped = false;
function save(force) {
  if (!booted || wiped || (SIM && !force)) return;   // в симуляции сохраняет только явный save(true)
  S.vals = stats.map(s => s.v); S.lv = stats.map(s => s.lvl); S.t = Date.now(); S.hpf = hero.hp / D.maxHP;
  const json = JSON.stringify(S);
  try { localStorage.setItem(SAVE_KEY, json); } catch (e) {}
  cloudSave(json, force === true);
}
async function cloudSave(json, force) {
  if (!cloud || cloud.busy || json === cloud.last) return;
  if (!force && Date.now() < cloudT) return;
  cloudT = Date.now() + 15000; cloud.busy = true;
  try { await cloud.ref.set({ json, t: S.t }); cloud.last = json; } catch (e) { if (e && e.code === 'unavailable') cloudT = Date.now() + 5000; }
  cloud.busy = false;
}
async function cloudLoad() {
  try {
    if (typeof window.claude !== 'object' || !window.claude || typeof window.claude.use !== 'function') return;
    const db = await window.claude.use('db'), user = await window.claude.use('user');
    if (!db || !user) return;
    const id = await user.id(); if (!id) return;
    const ref = db.doc('data/users/' + id + '/save');
    cloud = { ref, busy: false, last: '' };
    const snap = await ref.get();
    const d = snap.exists ? snap.data() : null;
    if (d && typeof d.json === 'string') {
      let local = null; try { local = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
      if (!local || (d.t || 0) > (local.t || 0)) cloudJson = d.json;
      cloud.last = d.json;
    }
  } catch (e) {}
}
function load() {
  try { const raw = cloudJson || localStorage.getItem(SAVE_KEY); const d = JSON.parse(raw); if (d && d.vals) S = Object.assign(S, d); } catch (e) {}
}
const offCapH = v => Math.min(24, 4 * (1 + 5 * v));
function offline(sec) {
  if (sec < 20) return;
  // баланс офлайна: лимит по времени, первый час эффективнее, дальше слабее
  const capH = offCapH(ta('offline')), used = Math.min(sec, capH * 3600);
  const effHi = .5 + .5 * sat(ta('offline'), 1), effLo = effHi * .6;
  const kills = Math.floor(Math.max(.1, S.kps) * (Math.min(used, 3600) * effHi + Math.max(0, used - 3600) * effLo));
  const t0 = performance.now();
  if (kills < 1) return;
  const z0 = S.zone, s0 = stats.length, k0 = S.kills;
  let left = kills, it = 0, evos = 0;
  mobs = []; bossAlive = false;
  while (left > 0 && it < 200000 && performance.now() - t0 < 2500) {
    if (it++ % 10 === 0) recalc();
    let k;
    if (S.zk >= zoneNeed()) {
      recalc();
      if (readiness() >= 1) { addSouls(bossSouls(S.zone)); S.zone++; S.zk = 0; S.ztask = null; S.zt = null; continue; }
      k = Math.min(left, 150);          // стена: герой фармит, пока не станет готов
    } else k = Math.max(1, Math.min(left, zoneNeed() - S.zk));
    const g = k * zs() * D.gainMult * 3.5 * (1 + D.rare * 7) * 1.3 * (1 + ta('gain')) * (S.zone < S.meta.best * .5 ? 1 + ta('legacy') : 1) * (1 + ta('x_greed')) * Math.pow(1.25, TAL.constel || 0);
    const picks = Math.min(stats.length, 12);
    for (let p = 0; p < picks; p++) { const s = pickStat(); s.v += g / picks * (.6 + rnd() * .8); evos += tryEvolve(s, true); }
    clsGain(g * .15); attrGain(k * (1 + S.zone * .1) * .5); if (rnd() < k / 60000) trDrop(hero.x, hero.y); relGain(k * (1 + S.zone / 5) * .6); S.kills += k; S.zk = Math.min(zoneNeed(), S.zk + k); left -= k;
    checkUnlocks(true);
  }
  recalc(); buildGround();
  const nsyn = synNew.length; synNew = [];
  const nform = formNew.length; formNew = [];
  const zc = Math.min(20, S.zone - z0); if (zc > 0) G().chests.c += zc;
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  $('mt').textContent = 'ПОКА ТЕБЯ НЕ БЫЛО';
  const uh = Math.floor(used / 3600), um = Math.floor(used % 3600 / 60);
  $('mp').innerHTML = `Прошло: ${h ? h + 'ч ' : ''}${m}м${sec > used ? '<br><span style="color:var(--dim)">учтено ' + (uh ? uh + 'ч ' : '') + um + 'м · лимит офлайна ' + capH.toFixed(1) + 'ч (растёт талантом «Сон воина»)</span>' : ''}<br>Герой дрался дальше:<br><br>+${fmt(S.kills - k0)} убийств<br>` +
    `Зона ${z0} → <span style="color:#f2c94c">${S.zone}</span><br>Новых статов: <span style="color:#5cff8a">${stats.length - s0}</span><br>Эволюций: <span style="color:#bb88ff">${evos}</span>${nform ? '<br>Новых форм: <span style="color:#ffdd44">' + nform + '</span>' : ''}${S.zone > z0 ? '<br>Сундуков: <span style="color:#a0703a">+' + Math.min(20, S.zone - z0) + '</span>' : ''}${nsyn ? '<br>Синергий: <span style="color:#ff44ff">+' + nsyn + '</span>' : ''}`;
  $('modal').hidden = false;
}
$('mok').onclick = () => { $('modal').hidden = true; $('mbox').classList.remove('legend'); $('mok').textContent = 'В БОЙ!'; audio(); };
const sw = c => `<span class="sw" style="background:${c}"></span>`;
$('helpb').onclick = () => {
  $('mbox').classList.add('legend');
  $('mt').textContent = 'ЧТО НА ЭКРАНЕ';
  $('mp').innerHTML =
    '<b style="color:#ff3322">КРАСНОЕ = ОПАСНО</b><br>' +
    sw('#ff2222') + 'Красная зона — вожак сейчас ударит. Тапни по герою: рывок. Увернулся — ×3 урона на 3с<br>' +
    sw('#ff3322') + 'Красные стрелы — выстрелы лучников<br>' +
    sw('#ff3322') + 'Красная рамка экрана — по герою прошёл сильный удар<br><br>' +
    '<b style="color:#f2c94c">ЗНАЧКИ НАД ВРАГАМИ</b><br>' +
    Object.values(ROLES).map(r => sw(r.c) + r.n).join('<br>') + '<br>' +
    'Ряд цветных точек — особенности (' + AFF.map(a => `<span style="color:${a.c}">${a.n.toLowerCase()}</span>`).join(', ') + ')<br>' +
    sw('#ffd84a') + 'Золотой враг — ×8 наград<br>' + sw('#ffee66') + 'Мигающая жёлтая точка — слабое место, тапай: ×12 урона<br><br>' +
    '<b style="color:#5cff8a">ГЕРОЙ</b><br>Белое кольцо под ногами — это герой<br>Удары идут сериями 1-2-3, третий — финишер с волной<br>' +
    'Подписи у эффектов («Огненное кольцо», «Метеор»…) — это твои таланты и формы<br>Полоска «Урон» в панели — откуда идёт урон<br><br>' +
    '<b style="color:#ff88ff">ВНИЗУ ЭКРАНА</b><br>' + sw('#a04cc0') + 'Полоса ульты: заполнена — тапни куда угодно<br>' +
    'Слева — лента событий, справа — комбо (множитель наград)<br><br>' +
    '<b style="color:#f2c94c">ВВЕРХУ</b><br>Шкала зоны: убийства до вожака. Заполнилась — через короткую передышку приходит вожак (тап по шкале — сразу). Если долго не можешь заполнить, вожак придёт сам';
  $('mok').textContent = 'ПОНЯТНО'; $('modal').hidden = false;
};

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); save(true); }
  else if (hiddenAt && booted) { offline((Date.now() - hiddenAt) / 1000); hiddenAt = 0; last = performance.now(); }
});
window.addEventListener('pagehide', () => save(true));
// полный сброс: двойное подтверждение, стираем сохранение и начинаем с нуля
let resetConfirm = 0;
$('resetb').onclick = async () => {
  if (performance.now() > resetConfirm) { resetConfirm = performance.now() + 4000; $('resetb').textContent = 'ТОЧНО? ВСЁ БУДЕТ УДАЛЕНО — ТАПНИ ЕЩЁ'; setTimeout(() => { if (!wiped) $('resetb').textContent = '✕ Сбросить игру'; }, 4000); return; }
  wiped = true; $('resetb').textContent = 'Сброс...';
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  try { if (cloud) await cloud.ref.delete(); } catch (e) {}
  location.replace(location.pathname + '?v=' + Date.now());
};
window.addEventListener('resize', () => setTimeout(resize, 50));

/* ---------- старт: сначала ждём облачное сохранение (не дольше 4 с) ---------- */
let last = performance.now(), booted = false;
Promise.race([cloudLoad(), new Promise(r => setTimeout(r, 4000))]).then(boot, boot);
function boot() {
if (booted) return; booted = true;
load();
if (!S.meta) S.meta = freshS().meta;
if (!S.meta.gear) S.meta.gear = freshGear();
ntMigrate();
if (!S.meta.pathMig) { S.meta.pathMig = 1; let had = 0; for (const k in (S.meta.cl || {})) { if (S.meta.cl[k].ct && Object.keys(S.meta.cl[k].ct).length) had = 1; S.meta.cl[k].ct = {}; } if (had) setTimeout(() => toast('ПУТЬ КЛАССА', 'ветки классов переделаны · очки мастерства возвращены', 4000), 2500); }
skyMigrate(); calcSky(); skyInit(); altarInit(); totemInit(); armyInit(); raidInit(); onbInit();
if (!CLASSES[S.cls]) rollClass(); else { if (S.cstyle == null) S.cstyle = rnd() < .5 ? 0 : 1; if (!S.meta.seen) S.meta.seen = {}; S.meta.seen[S.cls] = S.meta.seen[S.cls] || 1; }
calcTal();
for (let i = 0; i < 3; i++) { const s = makeStat(i); if (S.vals[i] !== undefined) s.v = S.vals[i]; if (S.lv && S.lv[i]) setLvl(s, S.lv[i]); stats.push(s); addStatRow(s, false); }
if (!S.vals.length) { stats[0].v = 2; stats[1].v = 3; stats[2].v = 1; }
checkUnlocks(true);
for (let e = 0; e < NE; e++) groupOf(e);
recalc();
hero.hp = D.maxHP * clamp(S.hpf || 1, .3, 1);
$('mute').textContent = 'Звук: ' + (S.mute ? 'ВЫКЛ' : 'ВКЛ'); applyFx(); $('buildl').textContent = 'Сборка ' + BUILD + ' · прогресс сохраняется автоматически';
$('panel').classList.toggle('small', !!S.panelSmall); $('panel').classList.toggle('big', !!S.panelBig); $('pbig').textContent = S.panelBig ? '⤡' : '⤢'; $('ptog').textContent = S.panelSmall ? '▲' : '▼';
applyNavIcons(); applyAp(); applyShk();
resize();
hero.x = AW / 2; hero.y = AH / 2; camFX = clamp(hero.x - W / 2, 0, AW - W); camFY = clamp(hero.y - H / 2, 0, AH - H); camX = Math.round(camFX); camY = Math.round(camFY);
const away = (Date.now() - (S.t || Date.now())) / 1000;
if (S.kills > 0 && away > 20) offline(away);
else if (S.kills === 0) { $('mt').textContent = 'БЕСКОНЕЧНАЯ ДРАКА'; $('mp').innerHTML = 'Герой дерётся сам.<br>Каждое убийство даёт статы.<br>Статы бесконечны.<br><br><span style="color:#fff8a0">Тапай по врагам</span> — бей молнией с неба!<br><br>Держи <span style="color:#ffdd44">комбо</span>, качай пары статов ради <span style="color:#ff44ff">синергий</span>.<br><br><span style="color:#8a83a6">Низкое HP = меньше наград.</span>'; $('modal').hidden = false; }
document.fonts && document.fonts.ready.then(() => updateUI());
last = performance.now();
requestAnimationFrame(frame);
}

function frame(now) {
  const real = Math.min(.05, (now - last) / 1000); last = now;
  slowT -= real; flashT -= real;
  requestAnimationFrame(frame);   // следующий кадр заказываем первым: ошибка в кадре не останавливает бой
  try {
    const us = ultFrame(real) * evFrame(real);
    if (hitStop > 0) hitStop -= real; else { const d = (slowT > 0 ? real * .3 : real) * us; update(d); if (S.fast && S.zone < S.meta.best) update(d); }
    render();
    // авто-качество: если кадры стабильно медленные (< ~38 к/с несколько секунд) — упрощаем эффекты сами
    frame.ema = (frame.ema ?? 16) * .97 + real * 1000 * .03;
    if (!S.fxLow && !document.hidden && frame.ema > 26) { frame.slow = (frame.slow || 0) + real; if (frame.slow > 4) { S.fxLow = true; S.fxAuto = true; parts = []; orbs = []; applyFx(); resize(); feed('Эффекты упрощены для плавности (Меню → Настройки)', '#9fd8ff'); } } else frame.slow = 0;
  } catch (e) { frameErr(e); }
}
function frameErr(e) {
  console.error(e); US = null; EV = null; hitStop = 0; slowT = 0;   // сбрасываем «замораживающие» состояния
  if (!frameErr.t || performance.now() - frameErr.t > 5000) { frameErr.t = performance.now();
    try { feed('Ошибка: ' + String(e && e.message || e).slice(0, 60), '#ff5544'); } catch (_) {} }
}
