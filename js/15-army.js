'use strict';
/* ---------- АРМИЯ ДУХОВ (с 8-го вознесения): осада стены 100 ---------- */
// Павшие герои становятся духами-воинами своего класса (сила = 1 + мастерство/15), ещё дух приходит сам раз в 6 мин.
// Армия идёт на стену 100 и копит «пролом» (0..1) в реальном времени, в том числе офлайн (до 12 ч за раз).
// Пролом снимает надбавку стены 100 к силе врагов; на 100% стена падает. Эссенция армии тратится на лагерь (редкие решения).
// Подбор: ARMY_K = 5e6 → ~3 ч при игре и улучшениях, ~4.4 ч офлайн с улучшениями, ~5 ч без улучшений (мастерство классов ~60).
const ARMY_ASC = 8, ARMY_K = 5e6;
const CAMP = [
  { k: 'altar',  n: 'Алтарь призыва',  c: '#c06bff', d: L => 'дух приходит сам раз в ' + (6 / (1 + .3 * L)).toFixed(1) + ' мин' },
  { k: 'forge',  n: 'Кузница духов',   c: '#ff9a3c', d: L => 'сила каждого духа +' + 20 * L + '%' },
  { k: 'drums',  n: 'Барабаны войны',  c: '#ff5a5a', d: L => 'скорость пролома +' + 25 * L + '%' },
  { k: 'banner', n: 'Знамёна классов', c: '#ffd84a', d: L => '+' + 3 * L + '% силы за каждый класс в армии' },
];
const campCost = L => Math.round(80 * Math.pow(2.2, L));
const armyOn = () => (S.meta.asc || 0) >= ARMY_ASC;
function AR() { const M = S.meta; if (!M.army) M.army = { cls: {}, n: 0, P: 0, br: 0, ess: 0, B: { altar: 0, forge: 0, drums: 0, banner: 0 }, last: Date.now(), pt: 0, done: 0 }; return M.army; }
const spiritStr = k => 1 + cm(k).lv / 15;
let armyNew = [];   // новые духи — для сцены
function addSpirit(k, fromDeath) {
  const A = AR(), s = spiritStr(k), c = A.cls[k] || (A.cls[k] = { n: 0, s: 0 }); c.n++; c.s += s; A.n++; A.P += s;
  if (armyNew.length < 20) armyNew.push(k);
  if (fromDeath && !SIM) feed('Дух павшего: ' + CLASSES[k].n + ' вступил в армию (сила ' + s.toFixed(1) + ')', '#9fe8ff');
}
function armyPow() { const A = AR(), kinds = Object.keys(A.cls).length; return A.P * (1 + .2 * A.B.forge) * (1 + .03 * A.B.banner * kinds); }
const armyRate = () => armyPow() * (1 + .25 * AR().B.drums) / ARMY_K;   // доля пролома в секунду
function armyTick(dt) {
  if (!armyOn()) return; const A = AR(); if (A.done) return;
  const iv = 360 / (1 + .3 * A.B.altar); A.pt = (A.pt || 0) + dt;
  while (A.pt >= iv) { A.pt -= iv; const ks = Object.keys(S.meta.seen || {}).filter(k => CLASSES[k]); addSpirit(ks.length ? ks[Math.floor(rnd() * ks.length)] : cls()); }
  A.ess += (.02 + .002 * A.n) * dt;
  A.br = Math.min(1, A.br + armyRate() * dt);
  if (A.br >= 1) { A.done = 1; wallFell(); }
}
// реальное время (и офлайн): догоняем пропущенное кусками по 30 с
function armyCatchUp(quiet) {
  if (SIM || !armyOn()) return; const A = AR(), now = Date.now(); let dt = Math.min(12 * 3600, Math.max(0, (now - (A.last || now)) / 1000)); A.last = now;
  const b0 = A.br, n0 = A.n; while (dt > 0) { const s = Math.min(dt, 30); armyTick(s); dt -= s; }
  if (!quiet && A.br - b0 > .01) toast('АРМИЯ ДУХОВ', 'пока тебя не было: пролом +' + pct(A.br - b0) + (A.n > n0 ? ', новых духов ' + (A.n - n0) : ''), 3500);
  D.dirty = true;
}
// надбавка стены 100 к силе врагов слабеет вместе с проломом (используется в zoneX)
const wallMul = () => S.meta && S.meta.army && (S.meta.asc || 0) >= ARMY_ASC ? 1 - S.meta.army.br : 1;
function wallFell() {
  S.meta.wall100 = 1; D.dirty = true; if (SIM) return;
  toast('СТЕНА 100 ПАЛА!', 'армия духов проломила стену — путь за 100-ю зону открыт', 5000); sfx.unlock && sfx.unlock(); flashT = .3; shake = 14;
}
function campBuy(k) {
  const A = AR(), L = A.B[k], c = campCost(L); if (A.ess < c) return;
  A.ess -= c; A.B[k] = L + 1; uiTap && uiTap(); [523, 659, 784, 1047].forEach((f, i) => tone(f, .1, 'square', .04, 0, i * .06)); save(true); renderArmyInfo();
}
const armyEta = () => { const A = AR(), r = armyRate(); if (A.done) return 'стена пала'; if (r <= 0) return '—'; const s = (1 - A.br) / r, h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return '~' + (h ? h + ' ч ' : '') + m + ' мин'; };

/* ---------- экран армии: сцена осады ---------- */
let armyRaf = 0, arW = 0, arH = 0, arDPR = 1, ghosts2 = [], arHits = [], arT = 0;
function openArmy() {
  showSheet('none'); armyCatchUp(true); $('army').hidden = false; renderArmyInfo(); sizeArmy();
  tip('army', 'Армия духов', 'Павшие герои становятся духами и осаждают стену 100 — даже когда игра закрыта. Эссенция армии улучшает лагерь. На 100% пролома стена падает.');
  if (!armyRaf) { const loop = () => { if ($('army').hidden) { armyRaf = 0; return; } drawArmy(); armyRaf = requestAnimationFrame(loop); }; armyRaf = requestAnimationFrame(loop); }
}
function sizeArmy() { const v = $('arview'), r = v.getBoundingClientRect(); arDPR = Math.min(2, devicePixelRatio || 1); arW = r.width; arH = r.height; const c = $('arcv'); c.width = Math.round(arW * arDPR); c.height = Math.round(arH * arDPR); c.style.width = arW + 'px'; c.style.height = arH + 'px'; }
// призрачный спрайт класса
const ghostC = {}; const ghostSpr = k => { if (ghostC[k]) return ghostC[k]; const pc = heroPortrait(k, 1), c = document.createElement('canvas'); c.width = pc.width; c.height = pc.height; const x = c.getContext('2d'); x.drawImage(pc, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = .65; x.fillStyle = '#7ad8ff'; x.fillRect(0, 0, c.width, c.height); return ghostC[k] = c; };
function drawArmy() {
  { const r = $('arview').getBoundingClientRect(); if (Math.abs(r.width - arW) > 1 || Math.abs(r.height - arH) > 1) sizeArmy(); }
  const c = $('arcv'), x = c.getContext('2d'), A = AR(), W = arW, H = arH, t = performance.now() / 1000, dt = Math.min(.05, arT ? t - arT : 1 / 60); arT = t; if (W < 10 || H < 10) return;
  x.setTransform(arDPR, 0, 0, arDPR, 0, 0); x.imageSmoothingEnabled = false;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0618'); g.addColorStop(1, '#1e1030'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { x.globalAlpha = .3 + .3 * Math.sin(t + i); x.fillStyle = '#c8b8ff'; x.fillRect((i * 97.3) % W, (i * 41.1) % (H * .55), 1.5, 1.5); } x.globalAlpha = 1;
  const gy = Math.round(H * .78), P = Math.max(2, Math.floor(Math.min(W, H) / 70));
  x.fillStyle = '#1a1226'; x.fillRect(0, gy, W, H - gy); x.fillStyle = '#2a1e3a'; x.fillRect(0, gy, W, 3);
  // стена справа: каменные блоки, трещины и проломы по мере пролома
  const wx = Math.round(W * .74), ww = W - wx, bh = 4 * P, bw = 8 * P, rows = Math.ceil((gy - H * .18) / bh), br = A.br;
  let seed = 7; const sr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < rows; r++) for (let cx = 0; cx * bw < ww + bw; cx++) { const bx = wx + cx * bw - (r % 2 ? bw / 2 : 0), by = gy - (r + 1) * bh, gone = sr() < br * br * .9 && r < rows - 1 && r > 0;
    if (bx + bw < wx) continue; if (gone) continue; x.fillStyle = (r + cx) % 3 ? '#4a4258' : '#544a64'; x.fillRect(Math.max(wx, bx), by, bw - P / 2, bh - P / 2); x.fillStyle = '#6a6080'; x.fillRect(Math.max(wx, bx), by, bw - P / 2, P / 2); }
  x.fillStyle = '#2a2236'; x.fillRect(wx - P, gy - rows * bh - 2 * P, ww + P, 2 * P);
  for (let i = 0; i < Math.floor(br * 18); i++) { seed = 100 + i; let cx2 = wx + sr() * ww * .5, cy2 = gy - sr() * rows * bh; x.fillStyle = '#120c1a'; for (let s = 0; s < 6; s++) { x.fillRect(Math.round(cx2), Math.round(cy2), P, P); cx2 += (sr() - .3) * 3 * P; cy2 += (sr() - .5) * 3 * P; } }
  if (A.done) { x.fillStyle = '#ffd84a'; x.globalAlpha = .15 + .1 * Math.sin(t * 2); x.fillRect(wx, gy - rows * bh, ww, rows * bh); x.globalAlpha = 1; }
  // лагерь слева: четыре постройки с уровнями
  CAMP.forEach((b, i) => { const L = A.B[b.k], bx = 6 + i * (W * .14), by = gy - 7 * P; x.fillStyle = '#2a1e10'; x.fillRect(bx, by, 6 * P, 7 * P); x.fillStyle = b.c; x.globalAlpha = L ? .6 + .4 * Math.sin(t * 3 + i) : .25; x.fillRect(bx + P, by + P, 4 * P, 3 * P); x.globalAlpha = 1;
    x.fillStyle = '#ffe08a'; x.font = Math.max(8, P * 3) + 'px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillText(L, bx + 3 * P, by - P); });
  // духи: идут к стене, бьют, отходят
  const kinds = Object.keys(A.cls); const want = Math.min(26, A.n);
  while (ghosts2.length < want) { const k = armyNew.shift() || kinds[Math.floor(Math.random() * kinds.length)] || cls(); ghosts2.push({ k, x: -20 - Math.random() * 60, y: gy - Math.random() * 10 * P, ph: Math.random() * 6, sp: .6 + Math.random() * .6, st: 0 }); }
  for (const s of ghosts2) { const tgt = wx - 4 * P - (s.ph * 7) % (6 * P);
    if (s.st === 0) { s.x += s.sp * 40 * P * dt; if (s.x >= tgt) { s.st = 1; s.tt = 0; } } else { s.tt += dt; if (s.tt > .35 && s.tt - dt <= .35 && !A.done && arHits.length < 30) arHits.push({ x: wx + Math.random() * 3 * P, y: s.y - 6 * P + Math.random() * 4 * P, t: 0 }); if (s.tt > .9) { s.st = 0; s.x -= 10 * P * Math.random(); } }
    const spr = ghostSpr(s.k), sc = P * .45, bob = s.st ? -Math.round(Math.max(0, Math.sin(s.tt * 9)) * 2 * P) : Math.round(Math.sin(t * 8 + s.ph) * P * .5);
    x.globalAlpha = .55 + .25 * Math.sin(t * 4 + s.ph); x.drawImage(spr, Math.round(s.x + (s.st ? Math.sin(s.tt * 9) * 2 * P : 0)), Math.round(s.y - spr.height * sc + bob), spr.width * sc, spr.height * sc); }
  x.globalAlpha = 1;
  for (const h of arHits) { h.t += dt; x.globalAlpha = 1 - h.t / .4; x.fillStyle = h.t < .1 ? '#ffffff' : '#9fe8ff'; const r = 1 + h.t * 14; x.fillRect(h.x - r, h.y, r * 2, P); x.fillRect(h.x, h.y - r, P, r * 2); }
  arHits = arHits.filter(h => h.t < .4); x.globalAlpha = 1;
  // полоса пролома
  const by2 = 8, bw2 = W - 16; x.fillStyle = '#000'; x.fillRect(8, by2, bw2, 14); x.fillStyle = '#2a1030'; x.fillRect(10, by2 + 2, bw2 - 4, 10);
  const gg = x.createLinearGradient(10, 0, 10 + bw2, 0); gg.addColorStop(0, '#7ad8ff'); gg.addColorStop(1, '#ffd84a'); x.fillStyle = gg; x.fillRect(10, by2 + 2, Math.round((bw2 - 4) * br), 10);
  x.font = '9px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; const tx = 'ПРОЛОМ СТЕНЫ 100: ' + (br * 100).toFixed(1) + '%'; x.strokeText(tx, W / 2, by2 + 11); x.fillText(tx, W / 2, by2 + 11);
}
function renderArmyInfo() {
  if (!$('army') || $('army').hidden) return; const A = AR();
  $('aress').textContent = fmt(Math.floor(A.ess));
  $('arsum').innerHTML = `<div><small>ПРОЛОМ</small><b style="color:#7ad8ff">${(A.br * 100).toFixed(1)}%</b></div><div><small>ДУХОВ</small><b>${fmt(A.n)}</b></div><div><small>СИЛА</small><b style="color:#ffd84a">${fmt(armyPow())}</b></div><div><small>ДО ПАДЕНИЯ</small><b>${armyEta()}</b></div>`;
  const top = Object.entries(A.cls).sort((a, b) => b[1].s - a[1].s).slice(0, 6).map(([k, c]) => `<span style="color:${CLASSES[k].c}">${CLASSES[k].n} ×${c.n}</span>`).join(' · ') || '<span class="k">пока пусто — павшие герои станут духами</span>';
  const camp = CAMP.map(b => { const L = A.B[b.k], c = campCost(L), can = A.ess >= c;
    return `<div class="camp" style="--cc:${b.c}"><div><b>${b.n} <span class="lv">${L}</span></b><small>${L ? b.d(L) : 'не построено'} · далее: ${b.d(L + 1)}</small></div><button class="btn" data-camp="${b.k}"${can ? '' : ' disabled'}>${fmt(c)} эсс.</button></div>`; }).join('');
  $('arinfo').innerHTML = `<div class="k">Лагерь — улучшения за эссенцию (её приносит армия):</div>${camp}<div class="k" style="margin-top:6px">Армия:</div><div>${top}</div>`;
}
function armyInit() {
  $('arinfo').onclick = e => { const b = e.target.closest('[data-camp]'); if (!b || b.disabled) return; campBuy(b.dataset.camp); };
  addEventListener('resize', () => { if (!$('army').hidden) sizeArmy(); });
  armyCatchUp(false);
  setInterval(() => { armyCatchUp(true); if (!$('army').hidden) renderArmyInfo(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) armyCatchUp(false); });
}
