'use strict';
/* ---------- ТОТЕМ ДУШ: бесконечная пропитка душами → случайные вечные прибавки к базовым статам ---------- */
// Куда девать души, когда дерево талантов вкачано. Каждая пропитка дороже предыдущей (×1.04),
// даёт случайный стат с редкостью: обычная ×1, редкая ×3, эпическая ×10, легендарная ×50 (гарантирована раз в 100 пропиток).
const TOT_ST = [
  { k: 'dmg',   n: 'урона',          c: '#ff6b6b', v: .02 },
  { k: 'hp',    n: 'здоровья',       c: '#5cff8a', v: .02 },
  { k: 'aps',   n: 'скорости атаки', c: '#ffd84a', v: .006 },
  { k: 'crit',  n: 'шанса крита',    c: '#ff9a3c', v: .002 },
  { k: 'critd', n: 'силы крита',     c: '#ff4f6d', v: .03 },
  { k: 'armor', n: 'брони',          c: '#8fb0d0', v: .003 },
  { k: 'regen', n: 'регенерации',    c: '#7affd8', v: .002 },
  { k: 'vamp',  n: 'вампиризма',     c: '#dd2244', v: .0005 },
  { k: 'dodge', n: 'уворота',        c: '#88ddff', v: .002 },
  { k: 'gain',  n: 'добычи статов',  c: '#c06bff', v: .02 },
];
const TOT_R = [['обычная', '#c9ced6', 1, .70], ['редкая', '#4fd6e8', 3, .22], ['эпическая', '#a26bff', 10, .07], ['легендарная', '#ffd84a', 50, .01]];
const TOT_PITY = 100;
function TT() { const M = S.meta; if (!M.totem) M.totem = { n: 0, b: {}, pity: 0, rc: [0, 0, 0, 0], log: [] }; return M.totem; }
const totCost = n => Math.max(10, Math.round(bossSouls(Math.max(10, S.meta.best || 1)) * .55 * soulMul0() * 2 * Math.pow(1.04, n)));
// вечные прибавки (вызывается из recalc)
function totemMods() {
  const T = S.meta && S.meta.totem; if (!T) return; const b = T.b;
  if (b.dmg) D.hit *= 1 + b.dmg; if (b.hp) D.maxHP *= 1 + b.hp; if (b.aps) D.aps *= 1 + b.aps;
  if (b.crit) D.crit = Math.min(.95, D.crit + b.crit); if (b.critd) D.critM *= 1 + b.critd;
  if (b.armor) D.armor = Math.min(.95, 1 - (1 - D.armor) * Math.exp(-b.armor)); if (b.dodge) D.dodge = Math.min(.9, 1 - (1 - D.dodge) * Math.exp(-b.dodge));
  if (b.regen) D.regen += b.regen; if (b.vamp) D.vamp += b.vamp; if (b.gain) D.gainMult *= 1 + b.gain;
}
// одна пропитка; возвращает результат или null, если не хватает душ
function totInfuse1() {
  const T = TT(), c = totCost(T.n); if (S.meta.souls < c) return null;
  S.meta.souls -= c; T.n++; T.pity++;
  let r = 0; if (T.pity >= TOT_PITY) r = 3; else { const x = rnd(); let a = 0; for (let i = TOT_R.length - 1; i >= 0; i--) { a += TOT_R[i][3]; if (x < a) { r = i; break; } } }
  if (r === 3) T.pity = 0;
  const st = TOT_ST[Math.floor(rnd() * TOT_ST.length)], v = st.v * TOT_R[r][2];
  T.b[st.k] = (T.b[st.k] || 0) + v; T.rc[r]++;
  const res = { k: st.k, v, r }; T.log.unshift(res); if (T.log.length > 8) T.log.length = 8; return res;
}
function totInfuse(max, quiet) {
  let n = 0, best = null; const got = [];
  while (n < max) { const r = totInfuse1(); if (!r) break; n++; got.push(r); if (!best || r.r > best.r) best = r; }
  if (!n) { if (!quiet) toast('НЕ ХВАТАЕТ ДУШ', 'пропитка стоит ' + fmt(totCost(TT().n))); return 0; }
  D.dirty = true; recalc(); save(true);
  if (!quiet) { totFx(got, best); if (best.r >= 2) tone(best.r === 3 ? 1568 : 1175, .3, 'triangle', .05, 0); [523, 659, 784].forEach((f, i) => tone(f, .08, 'square', .03, 0, i * .05)); }
  else if (best.r === 3) feed('Тотем душ: легендарная пропитка! +' + totVal(best), '#ffd84a');
  return n;
}
const totVal = r => { const st = TOT_ST.find(s => s.k === r.k); return pct(r.v) + ' ' + st.n; };
// автоматика: когда в дереве талантов нечего качать — все души в тотем
function totAuto() {
  const left = TN.some(nd => nd.alt == null && tOpen(nd) && !nodeBlocked(nd) && TL(nd.id) < nMax(nd) && (brActive(nd.br) || (S.meta.act || []).length < 3));
  if (left) return; const n = totInfuse(1e4, true); if (n) feed('Тотем душ: пропиток ' + n, '#ff44ff');
}

/* ---------- экран тотема ---------- */
let totRaf = 0, totW = 0, totH = 0, totDPR = 1, totParts = [], totFlash = null;
function openTotem() {
  showSheet('none'); $('totem').hidden = false; renderTotemInfo(); sizeTotem();
  tip('totem', 'Тотем душ', 'Лишние души — в тотем: каждая пропитка навсегда даёт случайный стат. Редкие пропитки сильнее, легендарная — раз в 100 пропиток гарантированно.');
  if (!totRaf) { const loop = () => { if ($('totem').hidden) { totRaf = 0; return; } drawTotem(); totRaf = requestAnimationFrame(loop); }; totRaf = requestAnimationFrame(loop); }
}
function sizeTotem() { const v = $('totview'), r = v.getBoundingClientRect(); totDPR = Math.min(2, devicePixelRatio || 1); totW = r.width; totH = r.height; const c = $('totcv'); c.width = Math.round(totW * totDPR); c.height = Math.round(totH * totDPR); c.style.width = totW + 'px'; c.style.height = totH + 'px'; }
function totFx(got, best) {
  for (let i = 0; i < Math.min(60, 12 + got.length * 4); i++) { const a = rnd() * 6.283, d = .55 + rnd() * .4; totParts.push({ a, d, t: -rnd() * .5, c: rnd() < .7 ? '#ff44ff' : '#ffffff' }); }
  totFlash = { t: 0, c: TOT_R[best.r][1], txt: got.length === 1 ? '+' + totVal(best) : got.length + ' пропиток · лучшая: ' + TOT_R[best.r][0], r: best.r };
  renderTotemInfo();
}
// пиксельный тотем: ярусы-лица растут с числом пропиток, глаза горят цветом лучшей редкости
function drawTotem() {
  { const r = $('totview').getBoundingClientRect(); if (Math.abs(r.width - totW) > 1 || Math.abs(r.height - totH) > 1) sizeTotem(); }   // панель снизу меняет высоту — подстраиваемся
  const c = $('totcv'), x = c.getContext('2d'), T = TT(), W = totW, H = totH, now = performance.now() / 1000;
  x.setTransform(totDPR, 0, 0, totDPR, 0, 0); x.imageSmoothingEnabled = false;
  const g = x.createRadialGradient(W / 2, H * .62, 10, W / 2, H * .62, Math.max(W, H) * .7); g.addColorStop(0, '#1a0e2e'); g.addColorStop(1, '#030209'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { const sx = (i * 97.3) % W, sy = (i * 53.7 + now * 4 * (1 + i % 3)) % H; x.globalAlpha = .25 + .25 * Math.sin(now * 2 + i); x.fillStyle = i % 5 ? '#6a4a9a' : '#ff44ff'; x.fillRect(Math.round(sx), Math.round(H - sy), 2, 2); }
  x.globalAlpha = 1;
  const segs = Math.max(2, Math.min(10, Math.floor(((H - 30) / 2 - 30) / 13), 2 + Math.floor(Math.sqrt(T.n) / 1.6))), topR = T.rc[3] ? 3 : T.rc[2] ? 2 : T.rc[1] ? 1 : 0, eye = TOT_R[topR][1];
  const P = Math.max(2, Math.min(7, Math.floor(Math.min(W / 34, (H - 30) / (segs * 13 + 30))))), cx = Math.round(W / 2), base = Math.round(H - 12);
  const R = (gx, gy, w, h, col) => { x.fillStyle = col; x.fillRect(cx + gx * P, base + gy * P, w * P, h * P); };
  // свечение вокруг
  const glow = Math.min(1, .15 + T.n / 300); x.globalAlpha = glow * (.5 + .2 * Math.sin(now * 2)); const gg = x.createRadialGradient(cx, base - segs * 6.5 * P, 4, cx, base - segs * 6.5 * P, segs * 9 * P); gg.addColorStop(0, eye + 'aa'); gg.addColorStop(1, eye + '00'); x.fillStyle = gg; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
  // постамент
  R(-14, -4, 28, 4, '#2a2238'); R(-12, -6, 24, 2, '#3a3050'); R(-14, -4, 28, 1, '#4a3e64');
  // ярусы
  for (let i = 0; i < segs; i++) {
    const y = -6 - (i + 1) * 13, w = i === segs - 1 ? 16 : 18 - (i % 2) * 2, h = 12, hx = -w / 2, stone = i % 2 ? '#4a3a5e' : '#54426a', dark = '#2e2440', hi = '#6e5a8a';
    R(hx - 1, y, w + 2, h + 1, '#140c1e'); R(hx, y, w, h, stone); R(hx, y, w, 1, hi); R(hx, y + h - 1, w, 1, dark); R(hx, y, 1, h, hi); R(hx + w - 1, y, 1, h, dark);
    // лицо: брови, глаза, рот; на каждом третьем — крылья-уши
    const lit = .6 + .4 * Math.sin(now * 3 + i), ec = i === segs - 1 || T.n >= (i + 1) * 15 ? eye : '#8a6aaa';
    R(-6, y + 3, 4, 1, dark); R(2, y + 3, 4, 1, dark);
    x.globalAlpha = lit; R(-5, y + 4, 3, 2, ec); R(2, y + 4, 3, 2, ec); x.globalAlpha = 1;
    R(-4, y + 8, 8, 2, dark); for (let t = -3; t <= 3; t += 2) R(t, y + 8, 1, 1, '#e8e0f0');
    if (i % 3 === 1) { R(hx - 4, y + 2, 4, 3, stone); R(hx - 5, y + 1, 2, 2, ec); R(hx + w, y + 2, 4, 3, stone); R(hx + w + 3, y + 1, 2, 2, ec); }
    // руны по бокам светятся
    x.globalAlpha = .5 + .5 * Math.sin(now * 2 + i * 1.7); R(hx + 1, y + 6, 1, 2, '#ff44ff'); R(hx + w - 2, y + 6, 1, 2, '#ff44ff'); x.globalAlpha = 1;
  }
  const top = -6 - segs * 13;
  // венец: рога / корона / пламя по числу пропиток
  if (T.n >= 50) { R(-9, top - 4, 2, 4, '#c9a24a'); R(7, top - 4, 2, 4, '#c9a24a'); R(-10, top - 6, 2, 2, '#ffd84a'); R(8, top - 6, 2, 2, '#ffd84a'); }
  if (T.n >= 200) { for (let k = -6; k <= 4; k += 2) R(k, top - 3 - (k % 4 === 0 ? 2 : 0), 2, 3 + (k % 4 === 0 ? 2 : 0), '#ffd84a'); }
  { const fl = Math.min(8, 2 + Math.floor(T.n / 40)); for (let k = 0; k < fl; k++) { x.globalAlpha = .5 + .5 * Math.sin(now * 9 + k); R(-1 + Math.round(Math.sin(now * 5 + k) * 2), top - 4 - k * 2, 2, 2, k < 2 ? eye : '#ff44ff'); } x.globalAlpha = 1; }
  // души втекают при пропитке
  const tx = cx, ty = base + (top + segs * 6) * P;
  for (const p of totParts) { p.t += 1 / 60; if (p.t < 0) continue; const k = Math.min(1, p.t / .9), rr = (1 - k) * Math.max(W, H) * p.d * .6, a = p.a + k * 4;
    x.globalAlpha = 1 - k * .5; x.fillStyle = p.c; x.fillRect(Math.round(tx + Math.cos(a) * rr), Math.round(ty + Math.sin(a) * rr * .8), 3, 3); }
  totParts = totParts.filter(p => p.t < .9); x.globalAlpha = 1;
  // вспышка и надпись результата
  if (totFlash) { const f = totFlash; f.t += 1 / 60; const a = Math.max(0, 1 - f.t / 1.6);
    if (f.r >= 2 && f.t < .4) { x.globalAlpha = (.4 - f.t) * (f.r === 3 ? 1.2 : .7); x.fillStyle = f.c; x.fillRect(0, 0, W, H); }
    x.globalAlpha = a; x.font = '11px "Press Start 2P", monospace'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#000'; x.fillStyle = f.c;
    const yy = Math.max(18, base + (top - 10) * P - f.t * 20); x.strokeText(f.txt, W / 2, yy); x.fillText(f.txt, W / 2, yy); x.globalAlpha = 1; if (f.t > 1.6) totFlash = null; }
}
function renderTotemInfo() {
  const T = TT(), c = totCost(T.n), can = Math.floor(S.meta.souls / c);
  $('totsum').innerHTML = `<div><small>ПРОПИТОК</small><b>${fmt(T.n)}</b></div><div><small>ДУШИ</small><b style="color:#ff44ff">${fmt(S.meta.souls)}</b></div><div><small>ЦЕНА</small><b>${fmt(c)}</b></div><div><small>ДО ЛЕГЕНДЫ</small><b style="color:#ffd84a">${TOT_PITY - T.pity}</b></div>`;
  const tot = TOT_ST.filter(s => T.b[s.k]).map(s => `<span style="color:${s.c}">+${pct(T.b[s.k])} ${s.n}</span>`).join(' · ') || '<span class="k">пока пусто — первая пропитка ждёт</span>';
  const log = T.log.slice(0, 5).map(r => `<span style="color:${TOT_R[r.r][1]}">${TOT_R[r.r][0]}: +${totVal(r)}</span>`).join('<br>');
  $('totinfo').innerHTML = `<div class="totbtns"><button class="btn" data-ti="1"${can ? '' : ' disabled'}>ПРОПИТАТЬ ×1</button><button class="btn" data-ti="10"${can ? '' : ' disabled'}>×10</button><button class="btn" data-ti="all"${can ? '' : ' disabled'}>ВСЁ</button></div>`
    + `<div class="k">Навсегда:</div><div>${tot}</div>` + (log ? `<div class="k" style="margin-top:4px">Последние:</div><div>${log}</div>` : '')
    + `<div class="k" style="margin-top:4px">Шансы: обычная 70% · редкая 22% (×3) · эпическая 7% (×10) · легендарная 1% (×50)</div>`;
}
function totemInit() {
  $('totb').onclick = openTotem;
  $('totclose').onclick = () => { $('totem').hidden = true; renderSouls(); };
  $('totinfo').onclick = e => { const b = e.target.closest('[data-ti]'); if (!b || b.disabled) return; const v = b.dataset.ti; totInfuse(v === 'all' ? 1e5 : +v); renderTotemInfo(); };
  addEventListener('resize', () => { if (!$('totem').hidden) sizeTotem(); });
}
