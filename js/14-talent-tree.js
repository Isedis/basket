'use strict';
/* ---------- экран дерева талантов ---------- */
const tree = $('tree'), tcv = $('tcv'), tctx = tcv.getContext('2d'), tview = $('tview');
const cam = { x: 0, y: 0, z: 1.6 }; let tSel = 0, tW = 0, tH = 0, tDPR = 1, tRec = new Set(), tParts = [], tSparks = [], tRaf = 0;
$('tbtn').onclick = () => openTree();
$('treeb').onclick = () => { showSheet('none'); $('gear').hidden = true; navOn('treeb'); openTree(); };
$('tclose').onclick = () => { tree.hidden = true; navOn('nFight'); };
$('tzi').onclick = () => { cam.z = Math.min(5, cam.z * 1.3); drawTree(); };
$('tzo').onclick = () => { cam.z = Math.max(.35, cam.z / 1.3); drawTree(); };
$('tfit').onclick = () => fitTree();
function openTree() { tip('dbl', 'Двойной тап', 'Тапни узел дважды подряд — сразу купишь уровень. Работает в талантах, ветке класса и на Небосводе.'); tree.hidden = false; setTMode(S.meta.tMode || tMode); sizeTree(); calcRec(); renderHint(); renderTInfo(); if (!openTree.fit) { openTree.fit = 1; fitTree(); } drawTree(); }
function sizeTree() {
  tDPR = Math.min(3, window.devicePixelRatio || 1); tW = tview.clientWidth; tH = tview.clientHeight;
  tcv.width = Math.round(tW * tDPR); tcv.height = Math.round(tH * tDPR); tcv.style.width = tW + 'px'; tcv.style.height = tH + 'px';
}
// пиксельные иконки 5×5
const ICONS = {
  sword: ['....#', '...#.', '#.#..', '.#...', '#.#..'], shield: ['#####', '#...#', '#...#', '.#.#.', '..#..'],
  heart: ['.#.#.', '#####', '#####', '.###.', '..#..'], flame: ['..#..', '.##..', '.###.', '#####', '.###.'],
  bolt: ['..##.', '.##..', '####.', '..##.', '.##..'], drop: ['..#..', '.###.', '.###.', '#####', '.###.'],
  clover: ['##.##', '##.##', '..#..', '##.##', '##.##'], hand: ['.#.#.', '.#.#.', '####.', '####.', '.##..'],
  book: ['####.', '#..#.', '####.', '#..#.', '####.'], skull: ['.###.', '#.#.#', '#####', '.###.', '.#.#.'],
  star: ['..#..', '#####', '.###.', '.#.#.', '#...#'], wing: ['#....', '##...', '###..', '####.', '#####'],
  eye: ['.....', '.###.', '#.#.#', '.###.', '.....'], clock: ['.###.', '#.#.#', '#.###', '#...#', '.###.'],
  crown: ['#.#.#', '#####', '#####', '#####', '.....'], spike: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
  fist: ['.###.', '#####', '#####', '.####', '..##.'], cond: ['..#..', '..#..', '..#..', '.....', '..#..'],
  swap: ['.#...', '#####', '.#.#.', '#####', '...#.'],
  gear: ['.#.#.', '#####', '##.##', '#####', '.#.#.'],
};
const ICON_OF = { hit: 'sword', e_dmg: 'sword', e_critd: 'sword', e_crit: 'eye', e_power: 'fist', e_fury: 'fist', hp: 'heart', e_armor: 'shield', e_regen: 'heart', e_dodge: 'wing',
  e_vamp: 'drop', e_thorns: 'spike', e_fire: 'flame', e_shock: 'bolt', e_poison: 'drop', e_range: 'sword', e_cleave: 'sword', e_aspd: 'wing', e_move: 'wing',
  crowd: 'skull', spawn: 'clock', combo_t: 'clock', combo_m: 'star', e_luck: 'clover', rare: 'clover', elite: 'crown', gain: 'crown', e_wis: 'book',
  tap: 'hand', weak: 'eye', ultc: 'star', ultd: 'star', boss_t: 'clock', bossdmg: 'skull', unlock: 'book', evo: 'book', form: 'book', offline: 'clock',
  soul: 'skull', legacy: 'skull' };
const iconOf = k => k.startsWith('auto') ? 'gear' : k.startsWith('ks') ? 'star' : k.startsWith('c_') ? 'cond' : k.startsWith('x_') ? 'swap' : ICON_OF[k] || 'star';
const nodeSize = nd => nd.id === 0 ? 16 : nd.max ? 14 : nd.alt != null ? 11 : 10;
const toScr = (x, y) => [(x - cam.x) * cam.z + tW / 2, (y - cam.y) * cam.z + tH / 2];
const nodeCol = nd => nd.auto ? '#4fd6e8' : nd.br >= 0 ? BRANCHES[nd.br].c : '#ff44ff';
const labelPos = bi => { const nd = TN[BRANCHES[bi].main[12]]; return [nd.x * 1.13, nd.y * 1.13]; };
const nodeBlocked = nd => nd.alt != null && TL(nd.alt) > 0;
function canBuy(nd) {
  const l = TL(nd.id);
  return tOpen(nd) && !nodeBlocked(nd) && l < nMax(nd) && S.meta.souls >= tCost(nd, l) && (brActive(nd.br) || (S.meta.act || []).length < 3);
}
// совет: какие узлы помогут прямо сейчас
const REC = {
  dmg: ['hit', 'e_dmg', 'e_crit', 'e_critd', 'e_power', 'bossdmg', 'weak', 'tap', 'x_glass', 'x_exec', 'c_boss', 'c_combo', 'e_fire', 'e_shock'],
  surv: ['hp', 'e_armor', 'e_regen', 'e_vamp', 'e_dodge', 'x_tank', 'x_regen', 'c_lowhp', 'boss_t'],
  grow: ['gain', 'e_wis', 'e_luck', 'rare', 'unlock', 'legacy', 'soul', 'x_greed', 'c_crowd', 'c_legend', 'evo'],
};
function calcRec() {
  const walled = S.zk >= zoneNeed() && (D.ready || 0) < 1;
  D.lim = walled ? ((D.rKill || 0) < (D.rSurv || 0) ? 'dmg' : 'surv') : 'grow';
  const kinds = REC[D.lim];
  tRec = new Set(TN.filter(nd => canBuy(nd) && kinds.includes(nd.k)).sort((a, b) => tCost(a, TL(a.id)) - tCost(b, TL(b.id))).slice(0, 3).map(nd => nd.id));
}
function renderHint() {
  const act = (S.meta.act || []).map(bi => `<b style="color:${BRANCHES[bi].c}">${BRANCHES[bi].n}</b>`).join(', ') || 'нет';
  const tip = D.lim === 'dmg' ? 'упираешься в урон вожака — узлы с <b style="color:#5cff8a">!</b> добавят урона'
    : D.lim === 'surv' ? 'вожак убивает героя — узлы с <b style="color:#5cff8a">!</b> добавят живучести'
    : 'стены нет — узлы с <b style="color:#5cff8a">!</b> ускорят рост';
  $('thint').innerHTML = `Совет: ${tip}` +
    (TAL.constel ? `<br>Созвездий: <b style="color:#ffe08a">${TAL.constel}</b> · награды ×${Math.pow(1.25, TAL.constel).toFixed(2)}` : '');
}
/* ---------- дерево: режим списка, фильтры, наборы ---------- */
let tMode = 'list', tFilt = 'rec', tBr = -1;
const nodeType = nd => nd.id === 0 ? 'КОРЕНЬ' : nd.auto ? 'АВТОМАТИКА' : nd.k.startsWith('ks') ? 'КЛЮЧЕВОЙ' : nd.nt ? 'ОСОБЫЙ' : nd.alt != null ? 'ВЫБОР' : '';
const nodeDesc = (nd, l) => { const ks = nd.k.startsWith('ks'), bm = nd.br >= 0 && TB[nd.br] && !ks && !nd.nt ? TB[nd.br].bm : 1; return TK[nd.k][2](nd.v * l * bm); };
const icCacheT = {};
function nodeIconURL(nd, col) {
  const k = iconOf(nd.k) + col; if (icCacheT[k]) return icCacheT[k];
  const c = document.createElement('canvas'); c.width = c.height = 7; const x = c.getContext('2d'); x.fillStyle = col;
  ICONS[iconOf(nd.k)].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') x.fillRect(i + 1, j + 1, 1, 1); }));
  return icCacheT[k] = c.toDataURL();
}
function setTMode(m) { tMode = m; S.meta.tMode = m; $('thint').hidden = m !== 'map'; $('tview').hidden = m !== 'map'; $('tinfo').hidden = m !== 'map'; $('tlist').hidden = m !== 'list'; renderTBar(); if (m === 'list') renderTList(); else { sizeTree(); drawTree(); } }
function renderTBar() {
  const F = [['rec', '★ Что качать'], ['buy', 'Доступно'], ['special', 'Особые'], ['sets', 'Наборы'], ['all', 'Все']];
  let h = `<div class="trow"><button class="tch${tMode === 'map' ? ' on' : ''}" data-m="map">КАРТА</button><button class="tch${tMode === 'list' ? ' on' : ''}" data-m="list">СПИСОК</button><span class="tsp"></span><button class="tch" data-best="1">★ ЛУЧШЕЕ ЗА ДУШИ</button></div>`;
  if (tMode === 'list') {
    h += `<div class="trow">${F.map(([k, n]) => `<button class="tch${tFilt === k ? ' on' : ''}" data-f="${k}">${n}${k === 'buy' ? ' (' + TN.filter(canBuy).length + ')' : ''}</button>`).join('')}</div>`;
    if (tFilt !== 'sets') h += `<div class="trow"><button class="tch${tBr < 0 ? ' on' : ''}" data-b="-1">Все ветви</button>${BRANCHES.map((b, bi) => `<button class="tch${tBr === bi ? ' on' : ''}" data-b="${bi}" style="--bc:${b.c}">${b.n}</button>`).join('')}</div>`;
  }
  $('tbar').innerHTML = h;
}
function setsHTML() {
  return '<div class="tsets">' + Object.keys(TAGS).map(t => { const n = TSET[t] || 0, tier = setT(t), c = TAGS[t], need = [0, 1, 2].map(i => setNeed(t, i));
    const nxt = tier < 3 ? need[tier] : need[2], pc = Math.min(100, n / need[2] * 100);
    return `<div class="tset${tier ? ' on' : ''}" style="--tc:${c}"><b>${t}</b><span>${n} / ${nxt}${tier === 3 ? ' ★' : ''}</span><i><u style="width:${pc}%"></u>${need.map(v => `<s style="left:${v / need[2] * 100}%"></s>`).join('')}</i>` +
      SET_FX[t].map((d, i) => `<small class="${tier > i ? 'got' : ''}">${need[i]}: ${d}</small>`).join('') + '</div>'; }).join('') + '</div>';
}
function renderTList() {
  if (tMode !== 'list') return;
  renderTBar();
  if (tFilt === 'sets') { $('tlist').innerHTML = `<div class="tlh">Наборы: узлы одной темы из любых ветвей. Набрал порог — тема усиливается, на 2-м пороге появляется механика и аура героя.</div>` + setsHTML(); return; }
  calcRec();
  $('tsouls').textContent = fmt(S.meta.souls);
  let L = TN.filter(nd => (nd.id !== 0 || canBuy(nd)) && (tBr < 0 || nd.br === tBr || nd.id === 0));
  if (tFilt === 'buy') L = L.filter(canBuy);
  if (tFilt === 'rec') L = L.filter(nd => tRec.has(nd.id) || canBuy(nd));
  if (tFilt === 'special') L = L.filter(nd => nd.nt || nd.k.startsWith('ks') || nd.alt != null || nd.auto);
  if (tFilt === 'rec') L.sort((a, b) => (canBuy(b) - canBuy(a)) || (tRec.has(b.id) - tRec.has(a.id)) || (tCost(a, TL(a.id)) - tCost(b, TL(b.id))));
  else L.sort((a, b) => (canBuy(b) - canBuy(a)) || (a.br - b.br) || (a.d - b.d) || (a.id - b.id));
  const cards = L.slice(0, tFilt === 'rec' ? 30 : 120).map(nd => {
    const l = TL(nd.id), mx = nMax(nd), col = nodeCol(nd), buy = canBuy(nd), tp = nodeType(nd), tag = tagOf(nd), blocked = nodeBlocked(nd), open = tOpen(nd);
    const why = blocked ? 'выбран «' + TN[nd.alt].n + '»' : !open ? 'сначала «' + TN[nd.p].n + '»' : l >= mx ? 'максимум' : S.meta.souls < tCost(nd, l) ? 'не хватает душ' : '';
    return `<div class="tcard${buy ? ' can' : ''}${l ? ' own' : ''}${blocked ? ' blk' : ''}" style="--nc:${col}">` +
      `<img src="${nodeIconURL(nd, l ? '#000' : col)}" style="background:${l ? col : '#1a1528'}">` +
      `<div class="tcm"><b>${nd.n}</b>${tp ? `<em>${tp}</em>` : ''}${tag ? `<em style="color:${TAGS[tag]}">${tag}</em>` : ''}${nd.br >= 0 ? `<em style="color:${BRANCHES[nd.br].c}">${BRANCHES[nd.br].n}</em>` : ''}` +
      `<small>${l ? 'сейчас: ' + nodeDesc(nd, l) : nodeDesc(nd, 1)}${l && l < mx ? '<br>след.: ' + nodeDesc(nd, l + 1) : ''}${nd.alt != null && !blocked ? '<br>или «' + TN[nd.alt].n + '»' : ''}</small></div>` +
      `<div class="tcb"><span>${l}/${mx}</span>${buy ? `<button class="btn" data-b1="${nd.id}">+1 · ${fmt(tCost(nd, l))}</button><button class="btn" data-bm="${nd.id}">МАКС</button>` : `<small>${why}</small>`}<button class="tgo" data-go="${nd.id}">на карте</button></div></div>`;
  }).join('');
  $('tlist').innerHTML = (tFilt === 'rec' ? `<div class="tlh">Сверху — лучшее для твоего героя сейчас.</div>` : '') + (L.length ? cards : '<div class="tlh">Здесь пусто. ' + (tFilt !== 'all' ? 'Пока не на что тратить души — переродись и возвращайся.' : '') + '</div>');
}
$('tbar').onclick = e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.m) setTMode(t.dataset.m);
  if (t.dataset.f) { tFilt = t.dataset.f; renderTList(); }
  if (t.dataset.b) { tBr = +t.dataset.b; renderTList(); }
  if (t.dataset.best) bestBuy();
};
$('tlist').onclick = e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.b1) buyNode(TN[+t.dataset.b1], false);
  if (t.dataset.bm) buyNode(TN[+t.dataset.bm], true);
  if (t.dataset.go) { tSel = +t.dataset.go; const nd = TN[tSel]; cam.x = nd.x; cam.y = nd.y; cam.z = Math.max(cam.z, 1.6); setTMode('map'); renderTInfo(); }
};
// разовая раздача душ по советам (как авто-таланты)
function bestBuy(quiet) {
  let n = 0;
  const okN = nd => nd.alt == null || quiet;   // авто-таланты выбирают развилку сами, ручная кнопка — нет
  while (n < (quiet ? 3000 : 300)) { calcRec(); let pick = TN.find(nd => tRec.has(nd.id) && okN(nd) && canBuy(nd));
    if (!pick) { let c = null; for (const nd of TN) if (okN(nd) && canBuy(nd) && (!c || tCost(nd, TL(nd.id)) < tCost(c, TL(c.id)))) c = nd; pick = c; }
    if (!pick) break; S.meta.souls -= tCost(pick, TL(pick.id)); S.meta.nodes[pick.id] = TL(pick.id) + 1; n++; calcTal(); }
  if (quiet) { if (n) feed('Авто-таланты: куплено уровней ' + n, '#ff44ff'); return; }
  if (n) { toast('КУПЛЕНО УРОВНЕЙ: ' + n, 'развилки «или-или» выбирай сам'); tone(523, .1, 'triangle', .04); tone(784, .15, 'triangle', .04, 0, .08); } else toast('Нечего купить', 'не хватает душ');
  refreshTree();
}
function fitTree() {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const nd of TN) { x0 = Math.min(x0, nd.x); x1 = Math.max(x1, nd.x); y0 = Math.min(y0, nd.y); y1 = Math.max(y1, nd.y); }
  cam.x = (x0 + x1) / 2; cam.y = (y0 + y1) / 2; cam.z = Math.min(tW / (x1 - x0 + 60), tH / (y1 - y0 + 60)); drawTree();
}

/* ---------- красивая карта дерева ---------- */
const TSTARS = []; { let sd = 7; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 260; i++) TSTARS.push({ x: (R() - .5) * 900, y: (R() - .5) * 900, s: R() < .15 ? 2 : 1, p: R() * 6.28 }); }
function nodeShape(c, nd, x, y, r) {
  c.beginPath();
  if (nd.id === 0) c.arc(x, y, r, 0, 6.2832);
  else if (nd.k.startsWith('ks')) { for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832 - 1.5708, rr = i % 2 ? r * .55 : r * 1.15; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
  else if (nd.nt) { c.moveTo(x, y - r * 1.2); c.lineTo(x + r * 1.2, y); c.lineTo(x, y + r * 1.2); c.lineTo(x - r * 1.2, y); c.closePath(); }
  else if (nd.alt != null) { for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
  else if (nd.auto) { const q = r * .85; c.rect(x - q, y - q, q * 2, q * 2); }
  else c.arc(x, y, r, 0, 6.2832);
}
// кэш готовых картинок узлов: форма + свечение + иконка рисуются один раз на размер/цвет/состояние
const nodeCache = new Map();
function nodeImg(nd, r, col, st, tagc) {
  const shp = nd.id === 0 ? 'o' : nd.k.startsWith('ks') ? 's' : nd.nt ? 'd' : nd.alt != null ? 'h' : nd.auto ? 'q' : 'c', ic = iconOf(nd.k);
  const R = Math.max(2, Math.round(r * tDPR)), key = shp + ic + col + st + (tagc || '') + R;
  let cv2 = nodeCache.get(key); if (cv2) return cv2;
  if (nodeCache.size > 700) nodeCache.clear();
  const pad = Math.ceil(R * 2.7) + 6, S2 = pad * 2; cv2 = document.createElement('canvas'); cv2.width = cv2.height = S2; const c = cv2.getContext('2d'), x = pad, y = pad, own = st === 'own';
  const fake = { id: nd.id, k: nd.k, nt: nd.nt, alt: nd.alt, auto: nd.auto };
  if (own) { const gr = c.createRadialGradient(x, y, 0, x, y, R * 2.6); gr.addColorStop(0, col + (shp === 's' || shp === 'd' ? '88' : '55')); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.fillRect(0, 0, S2, S2); }
  nodeShape(c, fake, x, y, R + 1.5 * tDPR); c.fillStyle = '#000'; c.fill();
  if (own) { const fg = c.createRadialGradient(x - R * .3, y - R * .3, 0, x, y, R * 1.2); fg.addColorStop(0, shade(col, .45)); fg.addColorStop(1, shade(col, -.25)); c.fillStyle = fg; }
  else c.fillStyle = st === 'open' ? '#1e1830' : '#100c1a';
  nodeShape(c, fake, x, y, R); c.fill();
  c.lineWidth = Math.max(1, R / 8); c.strokeStyle = own ? shade(col, .5) : st === 'open' ? shade(col, -.2) : '#2a2440'; nodeShape(c, fake, x, y, R); c.stroke();
  if (tagc) { c.strokeStyle = tagc; c.globalAlpha = .8; c.lineWidth = 1.5 * tDPR; nodeShape(c, fake, x, y, R + 3.5 * tDPR); c.stroke(); c.globalAlpha = 1; }
  const icn = ICONS[ic], ps = Math.floor(R * 1.2 / 5);
  if (ps >= 1) { c.fillStyle = own ? 'rgba(0,0,0,.75)' : st === 'open' ? col : shade(col, -.55); const ox = Math.round(x - 2.5 * ps), oy = Math.round(y - 2.5 * ps); for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (icn[j][i] === '#') c.fillRect(ox + i * ps, oy + j * ps, ps, ps); }
  cv2.pad = pad; nodeCache.set(key, cv2); return cv2;
}
// фон (градиент, туманности, кольца) кэшируется, пока камера стоит
const tbg = document.createElement('canvas'); let tbgKey = '';
function drawTreeBg(c) {
  const key = [Math.round(cam.x), Math.round(cam.y), cam.z.toFixed(3), tW, tH].join();
  if (key !== tbgKey) {
    tbgKey = key; tbg.width = Math.round(tW * tDPR); tbg.height = Math.round(tH * tDPR); const b = tbg.getContext('2d'); b.setTransform(tDPR, 0, 0, tDPR, 0, 0);
    const [cx0, cy0] = toScr(0, 0);
    const g = b.createRadialGradient(cx0, cy0, 0, cx0, cy0, Math.max(tW, tH) * .9); g.addColorStop(0, '#1c1233'); g.addColorStop(.5, '#0e0a1c'); g.addColorStop(1, '#05040a'); b.fillStyle = g; b.fillRect(0, 0, tW, tH);
    BRANCHES.forEach(br => { const [ca, sa] = br.dir, [nx, ny] = toScr(ca * 190, sa * 190), rr = 170 * cam.z; const gg = b.createRadialGradient(nx, ny, 0, nx, ny, rr); gg.addColorStop(0, br.c + '30'); gg.addColorStop(1, br.c + '00'); b.fillStyle = gg; b.fillRect(nx - rr, ny - rr, rr * 2, rr * 2); });
    b.globalAlpha = .12; b.strokeStyle = '#8a7acc'; b.lineWidth = 1; b.beginPath(); for (let i = 1; i <= 13; i++) { b.moveTo(cx0 + (26 * i + 14) * cam.z, cy0); b.arc(cx0, cy0, (26 * i + 14) * cam.z, 0, 6.2832); } b.stroke(); b.globalAlpha = 1;
  }
  c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(tbg, 0, 0); c.setTransform(tDPR, 0, 0, tDPR, 0, 0);
}
let tReq = 0;
const reqTree = () => { if (!tReq) tReq = requestAnimationFrame(() => { tReq = 0; drawTree(); }); };
function drawTree() {
  if (tree.hidden || tMode !== 'map') return;
  const c = tctx, now = performance.now(), T = now / 1000, far = cam.z < .9;
  drawTreeBg(c);
  // звёзды (вдали — без мерцания)
  c.fillStyle = '#ffffff';
  for (const st of TSTARS) { const [x, y] = toScr(st.x * .9 + cam.x * .25, st.y * .9 + cam.y * .25); if (x < 0 || y < 0 || x > tW || y > tH) continue; c.globalAlpha = far ? .5 : .35 + .35 * Math.sin(T * 1.3 + st.p); c.fillRect(Math.round(x), Math.round(y), st.s, st.s); }
  c.globalAlpha = 1;
  // связи: группами, одним проходом на стиль
  const grp = new Map(), glow = new Map(), dots = [];
  const add = (m, key, x1, y1, x2, y2) => { let p = m.get(key); if (!p) m.set(key, p = new Path2D()); p.moveTo(x1, y1); p.lineTo(x2, y2); };
  for (const nd of TN) if (nd.p >= 0) {
    const pn = TN[nd.p], [x1, y1] = toScr(pn.x, pn.y), [x2, y2] = toScr(nd.x, nd.y);
    if (Math.max(x1, x2) < 0 || Math.min(x1, x2) > tW || Math.max(y1, y2) < 0 || Math.min(y1, y2) > tH) continue;
    const col = nodeCol(nd), own = TL(nd.id) > 0, avail = TL(pn.id) > 0, dash = nd.alt != null ? 1 : 0;
    add(grp, (own ? 'o' : avail ? 'a' : 'l') + dash + (own ? col : avail ? shade(col, -.35) : '#3a3260'), x1, y1, x2, y2);
    if (own) { if (!far) add(glow, col, x1, y1, x2, y2); if (!far) dots.push([x1, y1, x2, y2, nd.id]); }
  }
  const lw = Math.min(1.5, Math.max(.7, cam.z / 1.4));
  c.globalAlpha = .25; c.lineWidth = 6 * Math.min(1.5, cam.z); for (const [col, p] of glow) { c.strokeStyle = col; c.stroke(p); }
  for (const [key, p] of grp) { const kind = key[0], dash = key[1] === '1'; c.globalAlpha = kind === 'o' ? 1 : kind === 'a' ? .55 : .25; c.strokeStyle = key.slice(2); c.lineWidth = (kind === 'o' ? 2.5 : 1.5) * lw; if (dash) c.setLineDash([4, 4]); c.stroke(p); if (dash) c.setLineDash([]); }
  c.globalAlpha = 1; c.fillStyle = '#ffffff';
  for (const [x1, y1, x2, y2, id] of dots) { const f = (T * .6 + id * .37) % 1; c.fillRect(Math.round(x1 + (x2 - x1) * f) - 1, Math.round(y1 + (y2 - y1) * f) - 1, 2, 2); }
  for (const sp of tSparks) { const a = TN[sp.a], b = TN[sp.b], t = sp.t; const [x, y] = toScr(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); c.fillStyle = sp.c; c.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); }
  // узлы из кэша картинок
  const pulse = .55 + .45 * Math.sin(T * 3), txt = [];
  c.setTransform(1, 0, 0, 1, 0, 0);
  for (const nd of TN) {
    const [x, y] = toScr(nd.x, nd.y), r = nodeSize(nd) * cam.z * (nd.nt ? .62 : .55); if (x < -30 || y < -30 || x > tW + 30 || y > tH + 30) continue;
    const col = nodeCol(nd), l = TL(nd.id), open = tOpen(nd), blocked = nodeBlocked(nd), tag = tagOf(nd);
    const st = l || nd.id === 0 ? 'own' : open && !blocked ? 'open' : 'lock';
    const im = nodeImg(nd, r, col, st, tag && (nd.nt || nd.alt != null) && !far ? TAGS[tag] : '');
    c.drawImage(im, Math.round(x * tDPR - im.pad), Math.round(y * tDPR - im.pad));
    if (canBuy(nd) || blocked || nd.id === tSel || tRec.has(nd.id) || (l && cam.z > .9) || ((nd.nt || nd.k.startsWith('ks')) && cam.z > 1.3) || nd.id === 0) txt.push([nd, x, y, r, l, col, blocked]);
  }
  c.setTransform(tDPR, 0, 0, tDPR, 0, 0);
  // поверх: подсветка доступных, выбор, совет, уровни, названия
  for (const [nd, x, y, r, l, col, blocked] of txt) {
    if (canBuy(nd)) { c.globalAlpha = far ? .9 : pulse; c.strokeStyle = '#5cff8a'; c.lineWidth = 2; nodeShape(c, nd, x, y, r + 5); c.stroke(); c.globalAlpha = 1; }
    if (nd.id === 0 && !far) { c.strokeStyle = '#ff88ff'; c.lineWidth = 2; c.setLineDash([4, 6]); c.lineDashOffset = -T * 20; c.beginPath(); c.arc(x, y, r + 7, 0, 6.2832); c.stroke(); c.setLineDash([]); }
    if (blocked) { c.strokeStyle = '#ff4f6d'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - r * .7, y - r * .7); c.lineTo(x + r * .7, y + r * .7); c.moveTo(x + r * .7, y - r * .7); c.lineTo(x - r * .7, y + r * .7); c.stroke(); }
    if (nd.id === tSel) { c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.setLineDash([5, 4]); c.lineDashOffset = T * 15; c.beginPath(); c.arc(x, y, r + 9, 0, 6.2832); c.stroke(); c.setLineDash([]); }
    if (tRec.has(nd.id)) { c.font = `${Math.max(8, Math.round(6 * cam.z))}px "Press Start 2P", monospace`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText('!', x, y - r - 5); c.fillStyle = '#5cff8a'; c.fillText('!', x, y - r - 5); }
    if (l && cam.z > .9) { c.font = `${Math.max(7, Math.round(5 * cam.z))}px "Press Start 2P", monospace`; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(l, x, y + r + 4); c.fillStyle = '#fff'; c.fillText(l, x, y + r + 4); }
    if ((nd.nt || nd.k.startsWith('ks')) && cam.z > 1.3) { c.font = `${Math.max(6, Math.round(3.4 * cam.z))}px "Press Start 2P", monospace`; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = '#000'; const ty = y + r + (l ? 6 + 5 * cam.z : 4); c.strokeText(nd.n, x, ty); c.fillStyle = l ? '#ffffff' : '#a59fc0'; c.fillText(nd.n, x, ty); }
  }
  for (const p of tParts) { const [x, y] = toScr(p.x, p.y); c.globalAlpha = Math.max(0, p.l * 2); c.fillStyle = p.c; c.fillRect(Math.round(x), Math.round(y), 3, 3); }
  c.globalAlpha = 1;
  // подписи ветвей
  BRANCHES.forEach((b, bi) => {
    const [lx, ly] = labelPos(bi), [x, y] = toScr(lx, ly), tb = TB[bi] || {};
    c.font = `${Math.max(7, Math.round(4.5 * cam.z))}px "Press Start 2P", monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const t1 = b.n + (tb.full ? ' ★' : ''), t2 = (tb.pts || 0) + ' очк. · ×' + (tb.bm || 1).toFixed(2) + (tb.ms ? ' · рубеж ' + tb.ms : '');
    c.lineWidth = 4; c.strokeStyle = '#000'; c.fillStyle = tb.full ? '#ffe08a' : b.c; c.strokeText(t1, x, y); c.fillText(t1, x, y);
    if (far && cam.z < .55) return;
    c.font = `${Math.max(6, Math.round(3.3 * cam.z))}px "Press Start 2P", monospace`; c.fillStyle = '#e9e4ff'; const dy = Math.max(10, 6 * cam.z);
    c.strokeText(t2, x, y + dy); c.fillText(t2, x, y + dy);
    const t3 = CLS_KEYS.filter(k => CLASSES[k].br === bi).map(k => (k === cls() ? '► ' : '') + CLASSES[k].n).join(' · ');
    c.fillStyle = CL().br === bi ? CL().c : '#a59fc0'; c.strokeText(t3, x, y + 2 * dy); c.fillText(t3, x, y + 2 * dy);
  });
  $('tsouls').textContent = fmt(S.meta.souls);
}

function renderTInfo() {
  const nd = TN[tSel], l = TL(nd.id), open = tOpen(nd), col = nodeCol(nd);
  const maxed = l >= nMax(nd), cost = tCost(nd, l), d = TK[nd.k][2], ks = nd.k.startsWith('ks');
  const bm = nd.br >= 0 && TB[nd.br] ? TB[nd.br].bm : 1, mul = ks || nd.nt ? 1 : bm;
  const tb = nd.br >= 0 ? TB[nd.br] : null;
  let warn = '';
  if (!open) warn = `Сначала изучи «${TN[nd.p].n}»`;
  else if (nodeBlocked(nd)) warn = `Выбран «${TN[nd.alt].n}». Поменять можно в начале новой жизни`;
  else if (!brActive(nd.br) && (S.meta.act || []).length >= 3) warn = 'Уже активны 3 ветви. Сменить набор можно в начале жизни';
  $('tinfo').innerHTML = `<h3 style="color:${col}">${nd.n}${ks ? ' ★' : ''}${nd.alt != null ? ' <span style="color:#f2c94c">⇄ ВЫБОР</span>' : ''}</h3>` +
    `<span class="k">${tb ? `Ветвь «${BRANCHES[nd.br].n}»: ${tb.pts} очк. · сила ×${bm.toFixed(2)} · ${tb.have}/${tb.n} узлов${tb.full ? ' · созвездие ✦' : ''}<br>Классы ветви: ${CLS_KEYS.filter(k => CLASSES[k].br === nd.br).map(k => CLASSES[k].n).join(', ')} · мастерство +2% за очко` : nd.auto ? 'Автоматика · ' + AUTO[nd.auto].d : 'Корень дерева'} · ур. ${l}/${nMax(nd)}</span><br>` +
    (nd.alt != null ? `<span class="k">или «${TN[nd.alt].n}» — только один из двух</span><br>` : '') +
    `<span class="k">Сейчас:</span> ${l ? d(nd.v * l * mul) : '—'}<br>` +
    (maxed ? '<span class="k">Максимальный уровень</span>' : `<span class="k">След.:</span> ${d(nd.v * (l + 1) * mul)}<br>`) +
    (warn ? `<span style="color:#ff6b6b">${warn}</span>` : '') +
    `<div class="row2"><button class="btn" id="tb1">+1 · ${fmt(cost)} душ</button><button class="btn" id="tbm">МАКС</button>` +
    (nd.alt != null && l > 0 && startOfLife() ? '<button class="btn" id="tbr" style="background:#5a3a2a">СБРОС</button>' : '') + '</div>';
  const ok = canBuy(nd) && !maxed;
  $('tb1').disabled = !ok; $('tbm').disabled = !ok;
  $('tb1').onclick = () => buyNode(nd, false); $('tbm').onclick = () => buyNode(nd, true);
  if ($('tbr')) $('tbr').onclick = () => { let back = 0; for (let i = 0; i < TL(nd.id); i++) back += tCost(nd, i); S.meta.souls += back; S.meta.nodes[nd.id] = 0; refreshTree(); feed('Выбор сброшен: +' + fmt(back) + ' душ', '#ff44ff'); };
}
function refreshTree() { calcTal(); D.dirty = true; save(); calcRec(); renderHint(); renderTInfo(); drawTree(); renderTList(); }
function buyNode(nd, all) {
  if (!canBuy(nd)) return;
  if (nd.br >= 0 && !brActive(nd.br)) S.meta.act.push(nd.br);
  const before = TB.map(b => b ? [b.ms, b.full] : [0, false]);
  let n = 0;
  while (canBuy(nd) && TL(nd.id) < nMax(nd)) {
    S.meta.souls -= tCost(nd, TL(nd.id)); S.meta.nodes[nd.id] = TL(nd.id) + 1; n++;
    if (!all || n > 500) break;
  }
  if (!n) return;
  calcTal();
  // анимация: искры к детям, частицы, звук ступени
  for (let i = 0; i < 18; i++) { const a = rnd() * 6.28, v = 20 + rnd() * 40; tParts.push({ x: nd.x, y: nd.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: .5 + rnd() * .3, c: rnd() < .5 ? nodeCol(nd) : '#ffffff' }); }
  for (const ch of TN) if (ch.p === nd.id) tSparks.push({ a: nd.id, b: ch.id, t: 0, c: nodeCol(nd) });
  const lv = Math.min(24, TL(nd.id)); tone(330 * Math.pow(2, lv / 12), .08, 'square', .045); tone(495 * Math.pow(2, lv / 12), .12, 'triangle', .04, 0, .06);
  // рубежи и созвездия
  TB.forEach((b, bi) => {
    if (!b) return;
    if (b.ms > before[bi][0]) { toast('РУБЕЖ ВЕТВИ «' + BRANCHES[bi].n.toUpperCase() + '»', b.pts + ' очков · вся ветвь ×' + b.bm.toFixed(2)); [523, 659, 784].forEach((f, i) => tone(f, .15, 'square', .04, 0, i * .08)); }
    if (b.full && !before[bi][1]) {
      toast('СОЗВЕЗДИЕ «' + BRANCHES[bi].n.toUpperCase() + '»!', 'ветвь заполнена: сила ×1.5 и все награды ×1.25');
      for (const n2 of TN) if (n2.br === bi) for (let i = 0; i < 3; i++) tParts.push({ x: n2.x, y: n2.y, vx: (rnd() - .5) * 30, vy: (rnd() - .5) * 30, l: 1 + rnd(), c: '#ffe08a' });
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .25, 'triangle', .05, 0, i * .1));
    }
  });
  if (nd.auto) { toast('АВТОМАТИКА ОТКРЫТА', AUTO[nd.auto].n + ' — включается во вкладке ДУШИ'); if (S.meta.auto) S.meta.auto[nd.auto] = true; }
  refreshTree(); tAnim();
}
function tAnim() {
  if (tRaf) return;
  let last = performance.now();
  const step = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    for (const p of tParts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .9; p.vy *= .9; p.l -= dt; }
    tParts = tParts.filter(p => p.l > 0);
    for (const sp of tSparks) sp.t += dt * 2.2; tSparks = tSparks.filter(sp => sp.t < 1);
    drawTree();
    if (!tree.hidden && (tParts.length || tSparks.length)) tRaf = requestAnimationFrame(step); else tRaf = 0;
  };
  tRaf = requestAnimationFrame(step);
}
function toggleBranch(bi) {
  if (!startOfLife()) { toast('Сменить ветви можно в начале жизни', 'после перерождения, на 1-й зоне'); return; }
  const a = S.meta.act;
  if (a.includes(bi)) a.splice(a.indexOf(bi), 1);
  else if (a.length < 3) a.push(bi); else { toast('Активны уже 3 ветви', 'сначала выключи одну из них'); return; }
  refreshTree();
}
// управление: перетаскивание, щипок, тап по узлу или названию ветви
const tPtr = new Map(); let tMoved = 0, tPinch = 0;
tview.addEventListener('pointerdown', e => { tview.setPointerCapture(e.pointerId); tPtr.set(e.pointerId, { x: e.clientX, y: e.clientY }); tMoved = 0; if (tPtr.size === 2) { const [a, b] = [...tPtr.values()]; tPinch = Math.hypot(a.x - b.x, a.y - b.y); } });
tview.addEventListener('pointermove', e => {
  const p = tPtr.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; tMoved += Math.abs(dx) + Math.abs(dy);
  if (tPtr.size === 1) { cam.x -= dx / cam.z; cam.y -= dy / cam.z; }
  else if (tPtr.size === 2) { const [a, b] = [...tPtr.values()], dd = Math.hypot(a.x - b.x, a.y - b.y); if (tPinch) cam.z = clamp(cam.z * dd / tPinch, .35, 5); tPinch = dd; }
  reqTree();
});
const tUp = e => {
  const had = tPtr.has(e.pointerId); tPtr.delete(e.pointerId); if (tPtr.size < 2) tPinch = 0;
  if (!had || tMoved > 8 || tPtr.size) return;
  const r = tview.getBoundingClientRect(), sx = e.clientX - r.left, sy2 = e.clientY - r.top;
  const wx = (sx - tW / 2) / cam.z + cam.x, wy = (sy2 - tH / 2) / cam.z + cam.y;
  let best = -1, bd = 1e9; for (const nd of TN) { const d = Math.hypot(nd.x - wx, nd.y - wy); if (d < bd) { bd = d; best = nd.id; } }
  if (best >= 0 && bd < nodeSize(TN[best]) * .9 + 6 / cam.z) { const twice = dbl('t' + best); tSel = best; if (twice) buyNode(TN[best], false); renderTInfo(); drawTree(); }
};
tview.addEventListener('pointerup', tUp); tview.addEventListener('pointercancel', e => { tPtr.delete(e.pointerId); tPinch = 0; });
tview.addEventListener('wheel', e => { e.preventDefault(); cam.z = clamp(cam.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), .35, 5); reqTree(); }, { passive: false });
setInterval(() => { if (!tree.hidden && !tRaf && tMode === 'map' && !tPtr.size && cam.z >= .9) reqTree(); }, 80);   // анимация звёзд и огоньков; вдали почти статично
window.addEventListener('resize', () => { if (!tree.hidden) { sizeTree(); drawTree(); } });

