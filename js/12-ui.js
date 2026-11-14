'use strict';
/* ---------- интерфейс ---------- */
const zbarI = $('zbar').firstElementChild, zbarB = $('zbar').lastElementChild;
const hpI = $('hpbar').firstElementChild, shI = $('hpbar').children[1], hpB = $('hpbar').lastElementChild;
const ubarI = $('ubar').firstElementChild;
let dsT = 0;
function updateUI() {
  D.ready = readiness();
  if (time > autoT) { autoT = time + 1; runAuto(); }
  { const can = S.zone < S.meta.best, sb = $('spdb');
    sb.hidden = !can; sb.classList.toggle('on', !!S.fast && can); sb.textContent = S.fast && can ? '×2 ▶▶' : '×2';
    if (can) tip('fast', 'Ускорение ×2', 'Эту зону ты уже проходил: кнопка ×2 справа вверху ускоряет игру, пока не дойдёшь до рекорда (' + S.meta.best + ').');
    if (!can && S.fast) { S.fast = false; feed('Рекорд зоны — скорость снова ×1', '#5cff8a'); } }
  if (time > dsT) { dsT = time + 1; renderDS(); }
  if (S.hpf < .35) tip('ex', 'Мало здоровья', 'При низком HP награды меньше. Броня, регенерация и вампиризм помогают держаться.');
  const b = biomeOf(S.zone);
  $('zname').textContent = b.name; $('zmodl').textContent = zm() ? '◆ ' + zm().n : hazard() ? '◆ ' + hazard().n : curWorld() ? '◆ ' + { heat: 'жар', fly: 'небо', shield: 'щиты', phase: 'тени', grav: 'разломы' }[curWorld().rule] : ''; $('zmodl').style.color = zm() ? zm().c : hazard() ? hazard().c : curWorld() ? curWorld().c : ''; $('znum').textContent = 'Зона ' + S.zone;
  const need = zoneNeed();
  if (bossAlive) { zbarI.style.width = '100%'; zbarI.style.background = '#ff2a2a'; zbarB.textContent = isLegend(S.zone) ? 'ЛЕГЕНДА!' : 'ВОЖАК!'; }
  else if (S.zk >= need) { zbarI.style.width = '100%'; zbarI.style.background = '#ff9a3c'; zbarB.textContent = 'ВОЖАК ИДЁТ!'; }
  else { const zt = zTask(), z = S.zt || {};
    zbarI.style.width = (S.zk / need * 100) + '%'; zbarI.style.background = zt ? ZTASKS[zt].c : '#7a5cff';
    const zkS = Math.floor(S.zk); zbarB.textContent = zt === 'waves' ? 'ВОЛНА ' + Math.min(3, Math.max(1, z.wave || 0)) + '/3' : zt === 'hunt' ? 'ДОБЫЧА ' + Math.min(4, z.prey || 0) + '/4 · ' + zkS + '/' + need : zt === 'totem' ? 'ТОТЕМЫ ' + Math.min(3, z.tot || 0) + '/3 · ' + zkS + '/' + need : zkS + ' / ' + need; }
  hpI.style.width = (S.hpf * 100) + '%';
  shI.style.width = Math.min(100, hero.shield / D.maxHP * 100) + '%';
  hpB.textContent = 'Ур.' + (S.lvl || 1) + ' · HP ' + fmt(hero.hp) + ' / ' + fmt(D.maxHP) + (hero.shield > 0 ? ' +' + fmt(hero.shield) : '');
  $('rank').textContent = 'Ур.' + (S.lvl || 1) + ' · ' + rankName(heroRank());
  { const pb = $('perkb'); pb.hidden = !S.pend || S.meta.autoPerk; pb.textContent = '★ ПЕРК' + (S.pend > 1 ? ' ×' + S.pend : ''); }
  $('kills').textContent = fmt(S.runSouls || 0) + ' душ';
  { const t = threatM(), el = $('thr'); el.textContent = t >= 1.1 ? '☠×' + (t >= 10 ? t.toFixed(0) : t.toFixed(1)) : '';   // угроза: коротко, чтобы влезло название зоны el.style.color = t >= 4 ? '#ff2a4a' : t >= 2 ? '#ff7a44' : '#ffd84a';
    if (t >= 2) tip('threat', 'Угроза растёт', 'Чем дольше живёт герой, тем злее враги — но и душ за них больше. Рискни или переродись.'); }
  const ex = $('ex');
  if (S.hpf < .35) { ex.style.display = 'inline'; ex.textContent = '×' + exMult().toFixed(2); } else ex.style.display = 'none';
  // статы
  $('scount').textContent = stats.length;
  if (synNew.length) {
    for (const [i, was] of synNew.slice(-2)) { if (was) feed('Синергия ' + SYN[i].n + ' ур. ' + sy(i), '#ff44ff'); else toast('СИНЕРГИЯ ОТКРЫТА: ' + SYN[i].n, EFF[SYN[i].a].n + ' + ' + EFF[SYN[i].b].n + ' · ' + SYN[i].d); }
    sfx.syn(); flashT = Math.max(flashT, .1); synNew = [];
  }
  $('ycount').textContent = SYN.filter((y, i) => sy(i)).length + '/' + SYN.length;
  if (tab === 'Y') renderSyn();
  if (tab === 'D') renderSouls();
  $('dcount').textContent = fmt(S.meta.souls) + (S.runSouls ? ' +' + fmt(S.runSouls) : '');
  const canBuy = TN.some(nd => tOpen(nd) && TL(nd.id) < nMax(nd) && S.meta.souls >= tCost(nd, TL(nd.id)));
  $('treeb').classList.toggle('has', canBuy && $('tree').hidden);
  $('nCls').classList.toggle('has', (pPts(cls()) > 0 || relPending(cls()) > 0) && $('ctree').hidden);
  $('nSouls').classList.toggle('has', !!S.meta.guard && tab !== 'D');
  { const cc = G().chests, n = cc.c + cc.r + cc.e, bd = $('gbadge'); bd.hidden = !n; bd.textContent = n; }
  const nk = unlockKills(stats.length), pk = unlockKills(stats.length - 1);
  $('snext').textContent = stats.length >= NE * 30 || nk - S.kills <= 0 && EFF.every((x, i) => groups[i]) ? 'все эффекты открыты' : 'новый стат через ' + fmt(Math.max(0, nk - S.kills)) + ' уб.';
  ubarI.style.width = clamp((S.kills - pk) / (nk - pk) * 100, 0, 100) + '%';
  const now = performance.now();
  const gfl = [], gcnt = [];
  for (const s of stats) {
    if (s.shown !== s.v) { s.valEl.textContent = fmt(s.v); s.shown = s.v; }
    const fl = now - s.at < 400;
    if (fl !== !!s.fl) { s.fl = fl; s.el.classList.toggle('fl', fl); }
    if (fl) gfl[s.e] = true; gcnt[s.e] = (gcnt[s.e] || 0) + 1;
  }
  const fav = biomeOf(S.zone).fav;
  { const ab = $('altarbox'), top3 = groups.filter(g => g && gcnt[g.e]).sort((a, b) => D.T[b.e] - D.T[a.e]).slice(0, 3);
    const ah = `<div class="altop">${top3.map(g => { const f = F(g.e); return `<div style="--ec:${EFF[g.e].c}"><img src="${effIconURL(g.e)}"><span style="min-width:0"><b>${EFF[g.e].n}</b><small>форма ${f ? (f <= 4 ? roman(f) : f) : '—'}</small></span></div>`; }).join('')}</div><button class="btn" id="altb">АЛТАРЬ СИЛЫ</button>`;
    if (ab.dataset.h !== ah) { ab.dataset.h = ah; ab.innerHTML = ah; $('altb').onclick = openAltar; }
    slist.style.display = S.showList ? '' : 'none'; }
  { const act = groups.filter(g => g && gcnt[g.e]), ord = act.slice().sort((a, b) => D.T[b.e] - D.T[a.e]), top = new Set(ord.slice(0, 6));
    const hideN = S.allStats ? 0 : act.length - top.size, lockN = groups.filter(g => g && !gcnt[g.e]).length;
    for (const g of groups) if (g) { const hid = !S.allStats && !top.has(g); if (g.el.hidden !== hid) g.el.hidden = hid; }
    const sm = $('smore'); sm.hidden = tab !== 'S' || (hideN + lockN === 0 && !S.allStats);
    sm.hidden = tab !== 'S'; sm.textContent = !S.showList ? '▾ список эффектов' : S.allStats ? '▴ скрыть список' : '▾ остальные статы: ' + hideN + (lockN ? ' · ' + lockN + ' закрыто' : ''); }
  for (const g of groups) if (g) {
    const e = g.e;
    g.nm.innerHTML = EFF[e].n + (D.spec === e ? ' <s>★</s>' : '') + (fav.includes(e) ? ' <u>×2</u>' : '');
    { const th = thrL(EFF[e].k), fh = formName(e, F(e)) + (th ? ` <span style="color:#ffe08a">${pxImg('star', '#ffe08a', 6)}${th}</span>` : ''); if (g.fm.innerHTML !== fh) g.fm.innerHTML = fh; }
    const locked = !gcnt[e]; g.el.classList.toggle('lock', locked);
    if (locked) { g.fm.textContent = EFF[e].d; g.cnt.innerHTML = pxImg('lock', '#8a83a6', 8); g.val.textContent = 'через ' + fmt(Math.max(0, unlockKills(e) - S.kills)) + ' уб.'; }
    else { g.cnt.textContent = '×' + gcnt[e]; g.val.textContent = fmt(D.T[e]); }
    { const f = locked ? 0 : F(e), fc = 'f' + Math.min(4, f); if (g.fcls !== fc) { if (g.fcls) g.el.classList.remove(g.fcls); g.el.classList.add(fc); g.fcls = fc; }
      const tt = locked ? '' : !f ? '—' : f <= 4 ? roman(f) : String(f); if (g.tier.textContent !== tt) g.tier.textContent = tt;
      const w = locked ? 0 : Math.round(formProg(e) * 100); if (g.bw !== w) { g.bw = w; g.bar.style.width = w + '%'; }
      if (!locked && (!g.fxT || now - g.fxT > 600)) { g.fxT = now; const tx = effVal(e); if (g.fx.textContent !== tx) g.fx.textContent = tx; } else if (locked && g.fx.textContent) g.fx.textContent = ''; }
    { const fa = (g.flUntil || 0) > now; if (fa !== !!g.fl) { g.fl = fa; g.el.classList.toggle('fl', fa); } }   // вспышка карточки — только при новой форме
  }
  if (formNew.length) {
    for (const [e, f] of formNew.slice(-3)) feed('Форма ' + EFF[e].n + ': ' + formName(e, f), EFF[e].c);
    for (const [e] of formNew) if (groups[e]) groups[e].flUntil = performance.now() + 1500;
    sfx.evo(); formNew = [];
    tip('form', 'Формы эффектов', 'Сильный стат меняет форму и получает новую механику. Тапни группу в панели — увидишь подробности.');
  }
  if (D.spec !== lastSpec) { if (lastSpec !== undefined && D.spec >= 0) { toast('СПЕЦИАЛИЗАЦИЯ: ' + SPEC[D.spec].toUpperCase(), EFF[D.spec].n + ' ×1.5'); sfx.syn(); } lastSpec = D.spec; }
  if (infoRef) renderInfo();
  const cells = (
    `<span>Удар <b>${fmt(D.hit * furyM())}</b></span><span>Ат/с <b>${D.aps.toFixed(2)}</b></span><span>Крит <b>${pct(D.crit)}</b></span><span>КритУ <b>×${fmt(D.critM)}</b></span>` +
    `<span>Броня <b>${pct(D.armor)}</b></span><span>Увор <b>${pct(D.dodge)}</b></span><span>Вамп <b>${pct(D.vamp)}</b></span><span>Награ <b>×${fmt(zs() * D.gainMult)}</b></span>` +
    `<span>HP <b>${fmt(D.maxHP)}</b></span><span>Рег/с <b>${fmt(D.maxHP * D.regen)}</b></span><span>Урон/с <b>${fmt(D.hit * D.aps * (1 + D.crit * (D.critM - 1)))}</b></span><span>Уб/с <b>${S.kps.toFixed(1)}</b></span>` +
    `<span>Бег <b>${D.move.toFixed(0)}</b></span><span>Дальн <b>${clsReach().toFixed(0)}</b></span><span>Цели <b>${1 + (D.cleave || 0)}</b></span><span>Золото <b>${pct(D.rare)}</b></span>` +
    [['Кровь', pct(D.bleed || 0), D.bleed], ['Холод', pct(D.frost || 0), D.frost], ['Казнь', pct(D.exec || 0), D.exec], ['Рикош', D.bounce || 0, D.bounce],
     ['Притяж', pct(D.grav || 0), D.grav], ['Духи', D.spirits || 0, D.spirits], ['Алчн', '+' + (D.greed || 0), D.greed], ['Барьер', pct(D.barrier || 0), D.barrier],
     ['Детон', pct(D.det || 0), D.det], ['Похищ', pct(D.leech || 0), D.leech], ['Раж', pct(D.rageK || 0), D.rageK], ['Сверхкр', pct(D.scrit || 0), D.scrit],
     ['Охотн', '×' + (D.hunt || 1).toFixed(1), D.hunt > 1.01], ['Энерг', '×' + (D.energy || 1).toFixed(1), D.energy > 1.01], ['Страх', pct(D.fear || 0), D.fear], ['Любозн', '×' + (1 + (D.curious || 0)).toFixed(1), D.curious],
     ['Шаг', pct(D.trail || 0), D.trail], ['Сферы', D.orbs || 0, D.orbs], ['Эхо', pct(D.echo || 0), D.echo], ['Метка', pct(D.mark || 0), D.mark],
     ['Орда', '+' + (D.horde || 0), D.horde], ['Скачок', pct(D.blink || 0), D.blink], ['Клад', pct(D.dust || 0), D.dust], ['Землетр', pct(D.quake || 0), D.quake], ['Луч', pct(D.beam || 0), D.beam], ['Двойник', pct(D.clone || 0), D.clone], ['Дыра', pct(D.hole || 0), D.hole], ['Зеркало', pct(D.mirror || 0), D.mirror], ['Вороны', pct(D.crows || 0), D.crows], ['Ритуал', pct(D.ritual || 0), D.ritual]]
      .map(([n, v, on]) => `<span${on > .001 || on === true ? '' : ' style="opacity:.4"'}>${n} <b>${v}</b></span>`).join('')).split('</span>').filter(Boolean).map(x => x + '</span>');
  const dps = D.hit * D.aps * (1 + D.crit * (D.critM - 1)), U = updateUI, tnow = performance.now();
  if (!U.pk) U.pk = { d: dps, h: D.maxHP, k: S.kps, td: 0, th: 0, tk: 0 };
  for (const [key, v, tk] of [['d', dps, 'td'], ['h', D.maxHP, 'th'], ['k', S.kps, 'tk']]) { if (v > U.pk[key] * 1.001) U.pk[tk] = tnow + 2500; U.pk[key] = v; }
  const up = t => tnow < U.pk[t] ? ' <i class="up">▲</i>' : '';
  const tiles = `<div class="tl"><small>УРОН/С</small><b>${fmt(dps)}${up('td')}</b></div><div class="tl"><small>ЗДОРОВЬЕ</small><b>${fmt(D.maxHP)}${up('th')}</b></div><div class="tl"><small>УБИЙСТВ/С</small><b>${S.kps.toFixed(1)}${up('tk')}</b></div>`;
  const sh = tiles + (S.sumFull ? cells.join('') + '<span class="more">▴ свернуть</span>' : '<span class="more">▾ все характеристики (' + cells.length + ')</span>');
  if (sh !== updateUI.sh) { updateUI.sh = sh; $('sum').innerHTML = sh; }
  renderCls();
}
$('sum').onclick = () => { S.sumFull = !S.sumFull; $('dsrc').hidden = !S.sumFull; updateUI(); setTimeout(resize, 50); };
$('dsrc').hidden = !S.sumFull;
$('smore').onclick = () => { if (!S.showList) { S.showList = true; S.allStats = false; } else if (!S.allStats) S.allStats = true; else { S.showList = false; S.allStats = false; } updateUI(); };
$('zbar').onclick = () => { if (!bossAlive && S.zk >= zoneNeed()) { forceBoss = true; bossCd = 0; } };
function applyFx() { $('fxb').textContent = 'Эффекты: ' + (S.fxLow ? 'МИНИМУМ' : 'ВСЕ'); }
$('fxb').onclick = () => { S.fxLow = !S.fxLow; applyFx(); if (S.fxLow) { parts = []; orbs = []; } };
$('spdb').onclick = () => { S.fast = !S.fast; updateUI(); tone(S.fast ? 880 : 440, .08, 'square', .04, S.fast ? 1320 : 330); };
$('mute').onclick = () => { S.mute = !S.mute; $('mute').textContent = 'Звук: ' + (S.mute ? 'ВЫКЛ' : 'ВКЛ'); audio(); };
let tab = 'S', lastSpec;
function setTab(t) { tab = t; $('slist').hidden = t !== 'S'; $('ylist').hidden = t !== 'Y'; $('tabD').classList.toggle('on', t === 'D'); if (t === 'D') renderSouls(); $('tabS').classList.toggle('on', t === 'S'); $('tabY').classList.toggle('on', t === 'Y'); if (t === 'Y') renderSyn(); }
$('tabD').onclick = () => setTab('D'); $('tabS').onclick = () => setTab('S'); $('tabY').onclick = () => setTab('Y');
function renderSyn() {
  const R = D.R || {}; let h = '';
  SYN.forEach((y, i) => {
    const l = sy(i), A = EFF[y.a], B = EFF[y.b];
    if (l) h += `<div class="syn"><div class="r"><span style="color:${A.c}">${y.n}</span><span style="color:#a58bff">ур. ${l}</span></div><div class="sd"><span style="color:${A.c}">${A.n}</span> + <span style="color:${B.c}">${B.n}</span> · ${y.d}</div></div>`;
    else {
      const ka = (R[A.k] || 0) >= SYN_TH / 4, kb = (R[B.k] || 0) >= SYN_TH / 4;
      h += `<div class="syn lk"><div class="r"><span>???</span><span>скрыто</span></div><div class="sd">${ka ? A.n : '?'} + ${kb ? B.n : '?'} · прокачай оба</div></div>`;
    }
  });
  $('ylist').innerHTML = h;
}
$('ptog').onclick = () => { S.panelSmall = !S.panelSmall; if (S.panelSmall) S.panelBig = false; applyPanel(); };
$('pbig').onclick = () => { S.panelBig = !S.panelBig; if (S.panelBig) S.panelSmall = false; applyPanel(); };
function applyPanel() { $('panel').classList.toggle('big', !!S.panelBig); $('pbig').textContent = S.panelBig ? '⤡' : '⤢'; $('panel').classList.toggle('small', S.panelSmall); $('ptog').textContent = S.panelSmall ? '▲' : '▼'; setTimeout(resize, 220); }

/* ---------- автоматика прокачки ---------- */
const AUTO = {
  tal: { n: 'Авто-таланты', d: 'души сами тратятся на лучшие узлы (кроме развилок)' },
  chest: { n: 'Авто-сундуки', d: 'сундуки открываются сразу, лучшее надевается, хлам — в пыль' },
  up: { n: 'Авто-улучшение', d: 'пыль сама тратится на улучшение надетых вещей' },
  reb: { n: 'Второй шанс', d: 'раз за забег смертельный удар оставляет герою 50% HP' },
};
const au = k => { if (!S.meta.auto) S.meta.auto = { tal: true, chest: true, up: true, reb: false }; return S.meta.auto[k] && autoOpen(k); };
function renderAuto() {
  au('chest');
  const ah = Object.keys(AUTO).map(k => { const nd = TN.find(n => n.auto === k);
    if (!autoOpen(k)) return `<div class="aut" data-t="${nd.id}" style="opacity:.6"><i style="background:#3a3450"></i><div>${pxImg('lock', '#8a83a6', 8)}${AUTO[k].n}<small>открывается в дереве талантов · ${nd.fixed} душ (тап — открыть дерево)</small></div></div>`;
    return `<div class="aut${au(k) ? ' on' : ''}" data-a="${k}"><i></i><div>${AUTO[k].n}<small>${AUTO[k].d}</small></div></div>`; }).join('');
  if (ah !== renderAuto.a) { renderAuto.a = ah; $('autobox').innerHTML = ah; }
  const C = CL(), seen = S.meta.seen || {};
  const ch = `<div class="cls cur"><div><b style="color:${C.c}">${C.n}</b>${C.d}<small>ульта «${ULTS[cls()][0]}»: ${ULTS[cls()][1]}</small><small>стиль боя: ${CSTY[cls()][sty()][0]} — ${CSTY[cls()][sty()][1]}</small><small>мастерство ${clsLv()} · пробуждение «${AWK[cls()][0]}»: ${awake() ? 'активно ★' : 'ветка ' + ctSpent(cls()) + '/' + CT_TOTAL}</small><small>ветвь «${BRANCHES[C.br].n}» · мастерство ×${clsPow().toFixed(2)} — очки в этой ветви дерева усиливают класс</small></div></div>` +
    CLS_KEYS.map(k => { const c = CLASSES[k], kn = seen[k]; return `<div class="cls${k === cls() ? ' on' : ''}${kn ? '' : ' unk'}" data-c="${k}"><div><b style="color:${kn ? c.c : '#777'}">${kn ? c.n : '???'}</b><small>${BRANCHES[c.br].n}${kn ? ' · жизней: ' + kn + ' · ур. ' + clsLv(k) + ' · ветка ' + ctSpent(k) + '/' + CT_TOTAL + (ctPts(k) ? ' · +' + ctPts(k) + ' очк.' : '') + (awake(k) ? ' ★' : '') : ''}</small></div></div>`; }).join('');
  if (ch !== renderAuto.c) { renderAuto.c = ch; $('clsbox').innerHTML = ch; }
}
$('autobox').onclick = e => { const lk = e.target.closest('[data-t]'); if (lk) { tSel = +lk.dataset.t; openTree(); return; } const el = e.target.closest('[data-a]'); if (!el) return; au(el.dataset.a); S.meta.auto[el.dataset.a] = !S.meta.auto[el.dataset.a]; renderAuto(); save(); };
$('clsbox').onclick = e => { const el = e.target.closest('[data-c]'); if (!el) return; const c = CLASSES[el.dataset.c]; if (!(S.meta.seen || {})[el.dataset.c]) { toast('???', 'класс ещё не выпадал · ветвь «' + BRANCHES[c.br].n + '»'); return; } openCT(el.dataset.c); };
$('clsc').onclick = () => { S.meta.clsOpen = !S.meta.clsOpen; renderCls.h = ''; renderCls(); };
$('clsopen').onclick = () => openClassTab();
$('perkb').onclick = () => openPerks();
const SHK_N = ['ВЫКЛ', 'СЛАБАЯ', 'ПОЛНАЯ'];
const applyShk = () => { $('shkb').textContent = 'Тряска: ' + SHK_N[S.meta.shk ?? 1]; };
$('shkb').onclick = () => { S.meta.shk = ((S.meta.shk ?? 1) + 1) % 3; applyShk(); shake = 10; save(); };
const AUTOS = [['apb', 'autoPerk', 'Перки'], ['aub', 'autoUlt', 'Ульта'], ['atb', 'autoTal', 'Таланты'], ['acb', 'autoPath', 'Ветка класса']];
const applyAp = () => { const M = S.meta; AUTOS.forEach(([id, k, n]) => $(id).textContent = n + ': ' + (M[k] ? 'АВТО' : 'ВРУЧНУЮ'));
  $('aall').textContent = 'АВТОИГРА: ' + (AUTOS.every(a => M[a[1]]) ? 'ВКЛ' : AUTOS.some(a => M[a[1]]) ? 'ЧАСТИЧНО' : 'ВЫКЛ'); };
function autoKick() { if (S.meta.autoPerk) lifeXP(0); autoPathSpend(); }
AUTOS.slice(1).forEach(([id, k]) => $(id).onclick = () => { S.meta[k] = !S.meta[k]; applyAp(); autoKick(); save(); });
$('aall').onclick = () => { const on = !AUTOS.every(a => S.meta[a[1]]); AUTOS.forEach(a => S.meta[a[1]] = on); applyAp(); autoKick(); save();
  toast(on ? 'АВТОИГРА ВКЛЮЧЕНА' : 'АВТОИГРА ВЫКЛЮЧЕНА', on ? 'перки, ульта, таланты и путь класса — сами' : 'всё снова вручную'); };
// авто-путь: тратит очки всех классов. Порядок: основные узлы всех ступеней (открывают следующую ступень и облик) → сигнатуры S/T → малые узлы по цепочке.
// Внутри группы — узел с наименьшим уровнем, развилку выбирает случайно
const MIDS = Array.from({ length: 10 }, (_, i) => 'M' + i);
function autoPathPick(k) {
  for (const g of [0, 1, 2]) for (let t = 1; t <= 4; t++) { const grp = g === 0 ? (t < 4 ? PIDS : PIDS4).slice().sort(() => rnd() - .5) : g === 1 ? ['S', 'T'] : MIDS;
    let best = null; for (const id of grp) if (pCanBuy(k, t, id) && (!best || pL(k, t, id) < pL(k, t, best))) best = id;
    if (best) return [t, best]; }
  return null;
}
function autoPathSpend() {
  if (!S.meta.autoPath) return;
  let any = 0;
  for (const k of CLS_KEYS) { let n = 0; if (k !== cls() && !(S.meta.cl && S.meta.cl[k])) continue;
    while (pPts(k) > 0 && n++ < 300) { const b = autoPathPick(k); if (!b) break; pBuy(k, b[0], b[1], true); any++; } }
  if (any) { calcPath(); D.dirty = true; save(); if (ctK && !$('ctree').hidden) renderCT(); }
}
$('apb').onclick = () => { S.meta.autoPerk = !S.meta.autoPerk; applyAp(); autoKick(); save(); };
$('perkbox').onclick = e => { const b = e.target.closest('[data-pk]'); if (!b) return; if (b.dataset.pk) { takePerk(b.dataset.pk); if (S.pend) openPerks(); else $('perkbox').hidden = true; } else $('perkbox').hidden = true; };
let endConfirm = 0;
$('endb').onclick = () => { if (deathT > 0) return; uiTap && uiTap(); go('fight'); heroDeath(true); };   // с первого нажатия, мимо воскрешений
$('ascbox').onclick = e => { if (e.target.id === 'skyb') { openSky(); return; } const b = e.target.closest('[data-asc]'); if (b) { ascBuy(b.dataset.asc); return; }
  if (e.target.id === 'ascb' && S.meta.guard) { if (performance.now() > ascConfirm) { ascConfirm = performance.now() + 3000; renderAsc.h = ''; renderAsc(); return; } ascConfirm = 0; ascend(); renderAsc.h = ''; renderAsc(); } };
$('ctbody').onclick = e => { const b = e.target.closest('[data-n]'); if (b && ctBuy(ctK, b.dataset.n)) { renderCT(); burst(hero.x, hero.y - 4, CLASSES[ctK].c, 10, 30); if (ctFull(ctK) && ctK === cls()) renderCls(); } };
function renderCls() {
  const C = CL(), c0 = S.cst || [0, 0], fp = ctPts(cls());
  const attrLine = `<div class="cs ca">` + ATTRS.map((A, j) => `<span style="color:${A.c}">${j === mainAttr() ? '◆' : ''}${A.n.slice(0, 3)} <b style="color:#e9e4ff">×${attrMul(j).toFixed(2)}</b></span>`).join('') + `</div>`;
  if (!S.meta.clsOpen) {
    const h = `<div class="cs"><span><b style="color:${C.c}">${C.n.toUpperCase()}</b> <b style="color:#e9e4ff">ур.${clsLv()}</b> <b style="color:#ffe08a">◆${relLv(cls())}</b></span><em>${fp ? '<b style="color:#5cff8a">очков пути: ' + fp + '</b> · ' : ''}${pxImg('star', '#ffe08a', 7)}${thrTotal()} · подробнее ▾</em></div>` + attrLine;
    if (h !== renderCls.h) { renderCls.h = h; $('clsc').innerHTML = h; }
    return renderClsAwk(C);
  }
  const h = `<div class="cs"><span><b style="color:${C.c}">${C.n.toUpperCase()}</b></span><em>мастерство ×${clsPow().toFixed(2)} · ${BRANCHES[C.br].n}</em></div>` + `<div class="cs"><span style="color:${C.c}">Мастерство ${clsLv()}</span><em>${fmt(cm(cls()).xp)} / ${fmt(cxpNeed(clsLv()))} опыта · +${clsLv() * 4}% урона и HP</em></div>` +
    `<div class="cs"><span style="color:${C.c}">Ульта</span><em>${(aw() ? '★ ' : '') + ULTS[cls()][0]}${aw() ? ' ×2' : ''}</em></div>` +
    `<div class="cs"><span style="color:${C.c}">Стиль: ${CSTY[cls()][sty()][0]}</span><em>${CSTY[cls()][sty()][1]}</em></div>` +
    `<div class="cs"><span style="color:${ctPts(cls()) ? '#5cff8a' : C.c}">Путь ${ctSpent(cls())}/${pTotal()}</span><em>${ctPts(cls()) ? '<b style="color:#5cff8a">свободных очков: ' + ctPts(cls()) + ' — тапни карточку</b>' : 'тапни карточку — ветка класса'}</em></div>` +
    `<div class="cs"><span style="color:${aw() ? C.c : '#777'}">${aw() ? '★ ' : pxImg('lock', '#777', 8)}${AWK[cls()][0]}</span><em>${aw() ? AWK[cls()][1] : 'пробуждение: заполни ветку класса'}</em></div>` +
    `<div class="cs"><span style="color:#e9e4ff">Атрибуты</span><em>пороги ${pxImg('star', '#ffe08a', 7)}${thrTotal()}</em></div>` + ATTRS.map((A, j) => `<div class="cs"><span style="color:${A.c}">${j === mainAttr() ? '◆ ' : ''}${A.n} <b style="color:#e9e4ff">${fmt(Math.floor((S.attr && S.attr[j]) || 0))}</b></span><em>${A.e.slice(0, 2).map(k => EFF[EI[k]].n.toLowerCase()).join(', ')}… ×${attrMul(j).toFixed(2)}</em></div>`).join('') +
    C.st.map(([n, f], j) => `<div class="cs"><span style="color:${C.c}">${n} <b style="color:#e9e4ff">${fmt(c0[j])}</b></span><em>${f(cq(j))}</em></div>`).join('');
  if (h !== renderCls.h) { renderCls.h = h; $('clsc').innerHTML = h + '<div class="cs"><span></span><em>свернуть ▴</em></div>'; }
  renderClsAwk(C);
}
function renderClsAwk(C) {
  if (aw()) { const M = S.meta; if (!M.awk) M.awk = {}; if (!M.awk[cls()]) { M.awk[cls()] = 1; toast('ПРОБУЖДЕНИЕ: ' + C.n.toUpperCase() + '!', AWK[cls()][0] + ' · ульта ×2 · новый облик', 3500); awakenFx(); } }
}
function clsReveal() {
  const el = cardEl(); el.hidden = false; el.style.borderColor = ''; let n = 0, rk = CLS_KEYS[0];
  const C = CL(), k = cls(), tr = tierOf(clsLv());
  el.innerHTML = `<span style="font-size:8px;color:var(--dim)">НОВЫЙ КЛАСС</span><canvas id="crc" width="120" height="120"></canvas><span id="crn"></span><small id="crs"></small>`;
  runCard($('crc'), 'roll', () => rk);
  clearInterval(clsReveal.iv);
  const iv = clsReveal.iv = setInterval(() => {
    if (!$('crn') || !$('crs')) { clearInterval(iv); return; }   // карточку уже заменили (новая смерть)
    n++;
    if (n < 18) { rk = CLS_KEYS[Math.floor(rnd() * CLS_KEYS.length)]; $('crn').innerHTML = `<span style="color:${CLASSES[rk].c}">${CLASSES[rk].n}</span>`; tone(600 + n * 40, .03, 'square', .02); return; }
    clearInterval(iv); rk = k; runCard($('crc'), 'show', () => k);
    $('crn').innerHTML = `<span style="color:${C.c}">${C.n.toUpperCase()}</span>`;
    const LL = S.meta.lastLife, canT = TN.some(nd => tOpen(nd) && TL(nd.id) < nMax(nd) && S.meta.souls >= tCost(nd, TL(nd.id)));
    $('crs').innerHTML = (LL ? `<div class="ll">ПРОШЛАЯ ЖИЗНЬ: зона <b>${LL.z}</b>${LL.rec ? ' <b style="color:#5cff8a">рекорд!</b>' : ''} · <b style="color:#ff44ff">+${fmt(LL.s)} душ</b></div>` : '') +
      `${C.d}<br><br><span style="color:${C.c}">Стиль: ${CSTY[k][sty()][0]}</span> · <span style="color:${C.c}">Ульта «${ULTS[k][0]}»</span><br>` +
      `<div class="cbtns">${canT && !S.meta.autoTal ? `<button class="btn" id="crT" style="background:#5a2a7a">ПОТРАТИТЬ ДУШИ (${fmt(S.meta.souls)})</button>` : ''}<button class="btn" id="crG" style="background:#1f5a34">В БОЙ ▶</button></div>`;
    if ($('crT')) $('crT').onclick = e => { e.stopPropagation(); el.hidden = true; $('treeb').click(); };
    $('crG').onclick = e => { e.stopPropagation(); el.hidden = true; };
    [523, 659, 784, 1047].forEach((f, i) => tone(f, .15, 'triangle', .05, 0, i * .07));
    clearTimeout(clsReveal.to); clsReveal.to = setTimeout(() => { el.hidden = true; }, 9000);
  }, 70);
}
let autoT = 0;
function runAuto() {
  const g = G();
  if (au('chest')) {
    let n = 0, best = null;
    for (const t of ['w', 'e', 'r', 'c']) while ((g.chests[t] || 0) > 0 && n < 50) { g.chests[t]--; const r = rollRar(t), sl = Object.keys(SLOTS)[Math.floor(rnd() * 4)], it = makeItem(sl, r, ilvlNow()); if (t === 'w') it.set = Math.max(0, worldIdx(Math.max(S.zone, 51))); addItem(it); n++; if (!best || it.rar > best.rar) best = it; }
    if (n) { for (const it of g.inv) g.dust += dustOf(it); g.inv = [];
      feed('Открыто сундуков: ' + n + ' · лучшее: ' + best.name, RAR[best.rar].c); if (best.rar >= 4) toast('ЛЕГЕНДАРНЫЙ ПРЕДМЕТ!', best.name); gearChanged(); }
  }
  if (au('up')) {
    let n = 0;
    while (n < 100) { let cheap = null; for (const sl in g.eq) { const it = g.eq[sl]; if (it && (!cheap || upCost(it) < upCost(cheap))) cheap = it; } if (!cheap || g.dust < upCost(cheap)) break; g.dust -= upCost(cheap); cheap.up++; n++; }
    if (n) { feed('Улучшено вещей: +' + n, '#9fd8ff'); gearChanged(); }
  }
  if (au('tal')) {
    let n = 0;
    while (n < 300) {
      calcRec();
      let pick = TN.find(nd => tRec.has(nd.id) && nd.alt == null && canBuy(nd));
      if (!pick) { let c = null; for (const nd of TN) if (nd.alt == null && canBuy(nd) && brActive(nd.br) && (!c || tCost(nd, TL(nd.id)) < tCost(c, TL(c.id)))) c = nd; pick = c; }
      if (!pick) { for (const nd of TN) if (nd.alt == null && canBuy(nd) && (!pick || tCost(nd, TL(nd.id)) < tCost(pick, TL(pick.id)))) pick = nd; }
      if (!pick) break;
      if (pick.br >= 0 && !brActive(pick.br)) S.meta.act.push(pick.br);
      S.meta.souls -= tCost(pick, TL(pick.id)); S.meta.nodes[pick.id] = TL(pick.id) + 1; n++; calcTal();
    }
    if (n) { feed('Таланты: куплено уровней ' + n, '#ff44ff'); D.dirty = true; save(); }
    totAuto();   // дерево вкачано — лишние души в тотем
  }

}

/* ---------- перерождение ---------- */
function renderSouls() {
  renderAuto(); renderAsc();
  { const T = S.meta.totem; $('totb').textContent = 'ТОТЕМ ДУШ' + (T && T.n ? ' · пропиток ' + fmt(T.n) : ''); }
  const M = S.meta, g = S.runSouls || 0;
  $('dsouls').textContent = fmt(M.souls); $('dreb').textContent = M.rebirths; $('dbest').textContent = Math.max(M.best, S.zone);
  $('dfore').innerHTML = 'Души этого забега: <span style="color:#ff44ff">+' + fmt(g) + '</span><br><span class="k" style="color:var(--dim)">души забега зачислятся, когда герой падёт · вожак этой зоны даст ~' + fmt(Math.floor(bossSouls(S.zone) * soulMul())) + '</span>';
}
function rebirth(fromAsc) {
  const g = S.runSouls || 0, M = S.meta; deathT = 0;
  M.lastLife = { z: S.zone, s: g, k: S.kills, c: S.cls, rec: S.zone > M.best };
  M.souls += g; M.total += g; M.soulsCyc = (M.soulsCyc || 0) + g; M.rebirths++; M.best = Math.max(M.best, S.zone);
  const keepF = Math.min(.5, .03 * ksL(7, 1) + .05 * ascL('legacy')), keptVals = keepF ? stats.map(st => Math.min(st.v * keepF, Math.pow(st.v, .5 + keepF))) : [];   // быстрый старт, но не пробивает предел души
  const keep = { cls: S.cls, fast: S.fast, meta: M, mute: S.mute, fxLow: S.fxLow, open: S.open, tips: S.tips, bestCombo: S.bestCombo, panelSmall: S.panelSmall, kps: S.kps };
  S = Object.assign(freshS(), keep);
  stats = []; groups.length = 0; slist.innerHTML = ''; infoRef = null; infoEl.hidden = true;
  if (skyOn('sk_perks')) S.pend = 2;
  rollClass(); holy = []; pals = []; clones = []; holes = []; crows = []; EV = null; $('perkbox').hidden = true; ultQ = []; ufx = []; ultBan = null; ultCd = 0; US = null; hero.lift = 0; hero.stopT = 0; hero.psnT = 0; hero.slowT = 0; hero.pool = 0; hero.pr = .04; hero.iframe = 1.5; mobs = []; parts = []; orbs = []; texts = []; rings = []; clouds = []; bolts = []; ghosts = []; feedArr = [];
  bossAlive = false; bossCd = 0; combo = 0; ult = 0; synNew = []; formNew = []; D.spec = -1; lastSpec = undefined; hero.shield = 0;
  for (let i = 0; i < 3; i++) { const st = makeStat(i); stats.push(st); addStatRow(st, false); }
  stats[0].v = 2; stats[1].v = 3; stats[2].v = 1;
  if (keepF) { S.vals = keptVals; for (let i = 0; i < 3; i++) stats[i].v = Math.max(stats[i].v, keptVals[i] || 0); }
  { const sz = Math.min(Math.floor(10 * ascL('path') + 1e-6) + Math.min(20, 10 * (M.asc || 0)) + (trHas('compass') ? 3 : 0), Math.max(1, M.best - 5)); S.fastTo = sz > 1 ? sz : 0; }
  if (M.autoTal) bestBuy(true);
  calcTal(); checkUnlocks(true); for (let e = 0; e < NE; e++) groupOf(e); recalc();
  if (S.fastTo) { fastStart(S.fastTo); S.fastTo = 0; for (let e = 0; e < NE; e++) groupOf(e); recalc(); }
  hero.hp = D.maxHP; hero.x = AW / 2; hero.y = AH / 2;
  buildGround(); save(); updateUI(); renderSouls();
  flashT = .5; slowT = .6; shake = 10;
  if (fromAsc) toast('ВОЗНЕСЕНИЕ #' + M.asc, 'стена теперь на 100-й зоне · дерево Вознесения во вкладке ДУШИ', 4000);
  else toast('ПЕРЕРОЖДЕНИЕ #' + M.rebirths, '+' + fmt(g) + ' душ · открой дерево талантов', 2400);
  clsReveal();
  [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone(f, .2, 'triangle', .05, 0, i * .08));
}

