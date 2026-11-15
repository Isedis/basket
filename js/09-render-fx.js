'use strict';
/* ---------- canvas ---------- */
const game = $('game'), cv = $('cv'), ctx = cv.getContext('2d'), fx = $('fx'), fctx = fx.getContext('2d');
let W = 100, H = 120, SC = 4, DPR = 1, AW = 220, AH = 240, camX = 0, camY = 0, camFX = 0, camFY = 0;   // W×H — экран, AW×AH — арена
let ground = null;
function resize() {
  const cw = game.clientWidth, ch = game.clientHeight;
  SC = Math.max(2, Math.floor(cw / 128));   // ~130 пикселей мира по ширине телефона
  W = Math.ceil(cw / SC); H = Math.ceil(ch / SC);
  AW = Math.round(W * 2.2); AH = Math.round(H * 2);
  cv.width = W; cv.height = H; cv.style.width = W * SC + 'px'; cv.style.height = H * SC + 'px';
  DPR = Math.min(S.fxLow ? 1.5 : 2, window.devicePixelRatio || 1);   // чёткий слой не выше 2× плотности: на глаз то же, точек в 2.25 раза меньше
  fx.width = Math.round(W * SC * DPR); fx.height = Math.round(H * SC * DPR);
  fx.style.width = W * SC + 'px'; fx.style.height = H * SC + 'px';
  ctx.imageSmoothingEnabled = false;
  hero.x = clamp(hero.x, 4, AW - 4); hero.y = clamp(hero.y, 6, AH - 2);
  camFX = clamp(hero.x - W / 2, 0, AW - W); camFY = clamp(hero.y - H / 2, 0, AH - H); camX = Math.round(camFX); camY = Math.round(camFY);
  buildGround();
}
/* ---------- сочность ударов: искры попаданий, осколки при смерти, души к счётчику ---------- */
let impacts = [], deaths = [], wisps = [];
function impact(x, y, crit, c) { if (SIM || S.fxLow || impacts.length > 28) return; impacts.push({ x, y, t: 0, crit, c: c || (crit ? '#ffdd33' : '#ffffff'), r: rnd() < .5 }); }
function deathFx(m) {
  if (SIM) return;
  if (S.fxLow) return;
  if (deaths.length < 26) { const dx = m.x - hero.x, dy = m.y - hero.y, d = Math.hypot(dx, dy) || 1, s = 8 * m.sz;
    deaths.push({ spr: mobSprite(m, false), x: m.x, y: m.y, s, t: 0, life: m.boss ? .9 : .45, kx: dx / d, ky: dy / d, v: (m.boss ? 30 : 55) * (.8 + rnd() * .4), spin: (rnd() - .5) * 2, boss: m.boss }); }
  if (wisps.length < 18 && (m.boss || m.rare || rnd() < Math.min(1, 6 / (mobs.length + 1)))) wisps.push({ x: m.x, y: m.y - 4, vx: (rnd() - .5) * 60, vy: -40 - rnd() * 30, t: 0, c: m.rare ? '#ffd84a' : '#d38bff', tr: [] });
}
function juiceTick(dt) {
  for (const p of impacts) p.t += dt; impacts = impacts.filter(p => p.t < (p.crit ? .16 : .1));
  for (const p of deaths) p.t += dt; deaths = deaths.filter(p => p.t < p.life);
  for (const w of wisps) { w.t += dt; const tx = camX + W - 12, ty = camY - 6, dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, w.t * 1.6);
    w.vx += (dx / d * 420 * k - w.vx * (1 - k) * 2) * dt; w.vy += (dy / d * 420 * k) * dt; const sp = Math.hypot(w.vx, w.vy), mx = 120 + 260 * k; if (sp > mx) { w.vx *= mx / sp; w.vy *= mx / sp; }
    w.tr.push([w.x, w.y]); if (w.tr.length > 6) w.tr.shift(); w.x += w.vx * dt; w.y += w.vy * dt; if (d < 6 || w.t > 2) w.done = 1; }
  wisps = wisps.filter(w => !w.done);
}
function drawJuice() {
  // осколки: вспышка → четыре куска разлетаются
  for (const p of deaths) { const k = p.t / p.life, s = p.s, x0 = p.x - s / 2, y0 = p.y - s;
    if (p.t < .05) { ctx.globalAlpha = 1; ctx.drawImage(silMob(p.spr), Math.round(x0), Math.round(y0), s, s); continue; }
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    const h = s / 2, sp = p.v * p.t, g = 90 * p.t * p.t;
    for (let i = 0; i < 4; i++) { const qx = i % 2, qy = i >> 1, ox = (qx ? 1 : -1) * sp * .6 + p.kx * sp * .5, oy = (qy ? .4 : -1) * sp * .5 + p.ky * sp * .3 + g;
      const sh = Math.max(1, Math.round(h * (1 - k * .5)));
      ctx.drawImage(p.spr, qx * 4, qy * 4, 4, 4, Math.round(x0 + qx * h + ox), Math.round(y0 + qy * h + oy), sh, sh); }
    if (p.boss && p.t < .3) { ctx.globalAlpha = .6 * (1 - p.t / .3); const r = 6 + p.t * 120; for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283; pix(p.x + Math.cos(a) * r, p.y - 4 + Math.sin(a) * r * .6, '#ffffff'); } } }
  ctx.globalAlpha = 1;
  // искры попаданий: крест → косой крест
  for (const p of impacts) { const x = Math.round(p.x), y = Math.round(p.y), f = p.t / (p.crit ? .16 : .1), L = p.crit ? 4 : 2;
    ctx.fillStyle = f < .45 ? '#ffffff' : p.c;
    if (f < .45 ? !p.r : p.r) { ctx.fillRect(x - L, y, L * 2 + 1, 1); ctx.fillRect(x, y - L, 1, L * 2 + 1); }
    else for (let i = 1; i <= L; i++) { pix(x - i, y - i, ctx.fillStyle); pix(x + i, y - i, ctx.fillStyle); pix(x - i, y + i, ctx.fillStyle); pix(x + i, y + i, ctx.fillStyle); }
    if (p.crit) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 3, 3); if (f > .3) { ctx.globalAlpha = 1 - f; const r = 3 + f * 7; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; pix(x + Math.cos(a) * r, y + Math.sin(a) * r, p.c); } ctx.globalAlpha = 1; } } }
  // души летят к счётчику
  for (const w of wisps) { w.tr.forEach((q, i) => { ctx.globalAlpha = (i + 1) / w.tr.length * .5; pix(q[0], q[1], w.c); }); ctx.globalAlpha = 1; ctx.fillStyle = w.c; ctx.fillRect(Math.round(w.x) - 1, Math.round(w.y), 3, 1); ctx.fillRect(Math.round(w.x), Math.round(w.y) - 1, 1, 3); pix(w.x, w.y, '#ffffff'); }
}
const silC = new WeakMap();
function silMob(spr) { let c = silC.get(spr); if (c) return c; c = document.createElement('canvas'); c.width = spr.width; c.height = spr.height; const x = c.getContext('2d'); x.drawImage(spr, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); silC.set(spr, c); return c; }

/* ---------- арены: детали зон, виньетка, частицы окружения ---------- */
// a — основной, b — тень, c — блик, d — акцент; рисуются в слой земли
const PROPS = {
  tree:   ["....aaaa....", "..aaaaaaaa..", ".aacaaaaaab.", "aacaaaaaaabb", "aaaaaaaaaabb", ".aaaaaaaabb.", "..abbaabbb..", ".....dd.....", ".....dd.....", "....dddd...."],
  pine:   [".....a.....", "....aaa....", "...acaab...", "....aab....", "..acaaabb..", ".aaaaaabbb.", "....aab....", ".acaaaabbb.", "aaaaaaabbbb", ".....d.....", ".....d....."],
  bush:   [".aaaa..", "acaaab.", "aaaaabb", ".abbbb."],
  flower: [".d.", "dcd", ".a."],
  grass:  ["a.a.a", ".aaa.", "..a.."],
  rock:   ["..aaa.", ".acaab", "aaaabb", ".abbb."],
  boulder:["...aaaa...", ".aacaaab..", "acaaaaabb.", "aaaaaaabbb", ".aaaabbbb."],
  mush:   [".ddddd.", "ddcdddd", "dcddddb", ".bbbbb.", "..aaa..", "..aaa.."],
  bigmush:["...dddddd...", ".ddcddddddd.", "ddcdcddddddb", "dddddddddbbb", ".bbbbbbbbbb.", "....aaaa....", "....aaaa....", "....aaab....", "...aaaabb..."],
  bone:   ["c...c", ".aaa.", "c...c"],
  skull:  [".ccc.", "cbcbc", "ccccc", ".c.c."],
  ribs:   ["c.c.c.c", "c.c.c.c", "ccccccc", ".c.c.c."],
  tomb:   [".aaa.", "acaab", "aadab", "aaaab", "aaaab", "bbbbb"],
  pillar: [".aaaa.", "acaaab", ".caab.", ".caab.", ".caab.", ".caab.", "acaaab", "bbbbbb"],
  broken: [".a....", ".ca.a.", ".caab.", ".caab.", "acaaab", "bbbbbb"],
  crystal:["..c..", ".cda.", ".cda.", "cddab", "cddab", ".bbb."],
  shard:  [".c.", "cda", "cda", "bbb"],
  ice:    ["..c...", ".ca..c", ".caa.a", "caaabb", "aaaabb"],
  lava:   ["..dd...", ".dccd..", "dccccd.", ".dddd.."],
  ember:  [".d.", "dcd", ".d."],
  dtree:  ["a..a..a", ".a.a.a.", "..aaa..", "...a...", "...a...", "..aab..", ".aaabb."],
  reed:   ["d.d", "a.a", "aaa", ".a."],
  puddle: [".bbbbb.", "bccaaab", ".bbbbb."],
  cloud:  ["..cccc...", ".ccccccc.", "cccccccca", ".aaaaaaa."],
  tile:   ["dddd", "d..d", "d..d", "dddd"],
  star:   [".c.", "cdc", ".c."],
  vine:   ["a..", ".a.", ".aa", "a.a", ".a."],
  coral:  ["d.d.d", ".ddd.", "..d..", ".dd.."],
};
// по биомам: [проп, вес, палитра {a,b,c,d}]
const BPROPS = [
  [['tree', 3, { a: '#3f8a3a', b: '#2a5e27', c: '#6ab85a', d: '#6a4a2a' }], ['bush', 4, { a: '#4a9a40', b: '#2f6a2a', c: '#7ac860' }], ['flower', 8, { a: '#3a7a30', c: '#ffffff', d: '#ff8ab0' }], ['flower', 6, { a: '#3a7a30', c: '#fff6a0', d: '#ffd84a' }], ['rock', 2, { a: '#8a8a90', b: '#5a5a62', c: '#b0b0b8' }], ['grass', 8, { a: '#5aa04a' }]],
  [['pine', 5, { a: '#1f4a2a', b: '#143620', c: '#2f6a3a', d: '#4a3020' }], ['mush', 3, { a: '#e8dcc0', b: '#8a2020', c: '#ffffff', d: '#c03030' }], ['bush', 3, { a: '#24502c', b: '#163820', c: '#3a7044' }], ['rock', 2, { a: '#4a5048', b: '#30362f', c: '#6a7068' }], ['grass', 6, { a: '#2f6a36' }]],
  [['reed', 6, { a: '#5a6a2a', d: '#8a6a3a' }], ['puddle', 4, { a: '#3a5a3a', b: '#22301a', c: '#6a8a5a' }], ['dtree', 2, { a: '#3a3020', b: '#241c10' }], ['mush', 2, { a: '#c8c0a0', b: '#4a5a20', c: '#d8ff8a', d: '#8ab030' }], ['grass', 6, { a: '#56663a' }]],
  [['skull', 3, { b: '#3a2a10', c: '#e8e0c8' }], ['bone', 5, { a: '#d8d0b8', c: '#e8e0c8' }], ['ribs', 2, { c: '#d8d0b8' }], ['rock', 3, { a: '#a0804a', b: '#7a6034', c: '#c8a86a' }], ['boulder', 1, { a: '#9a7a44', b: '#6a522a', c: '#c0a060' }]],
  [['tomb', 4, { a: '#6a6a78', b: '#40404a', c: '#9090a0', d: '#2a2a30' }], ['pillar', 2, { a: '#5a5a68', b: '#3a3a44', c: '#8a8a98' }], ['broken', 2, { a: '#5a5a68', b: '#3a3a44', c: '#8a8a98' }], ['skull', 2, { b: '#202028', c: '#c8c8b8' }], ['bone', 3, { a: '#b8b8a8', c: '#d8d8c8' }]],
  [['ice', 5, { a: '#9ad0f0', b: '#6aa0c8', c: '#ffffff' }], ['rock', 3, { a: '#8aa0b0', b: '#607888', c: '#ffffff' }], ['pine', 2, { a: '#2a5a5a', b: '#1a4040', c: '#ffffff', d: '#4a3020' }], ['star', 4, { c: '#ffffff', d: '#c9e8ff' }]],
  [['lava', 4, { c: '#ffd84a', d: '#ff5a1a' }], ['rock', 4, { a: '#3a2020', b: '#200e0e', c: '#6a3030' }], ['boulder', 2, { a: '#2a1616', b: '#160a0a', c: '#5a2a20' }], ['ember', 5, { c: '#ffe08a', d: '#ff6622' }]],
  [['star', 8, { c: '#ffffff', d: '#b06aff' }], ['shard', 4, { a: '#5a3a9a', b: '#2a1a4a', c: '#c8a8ff', d: '#8a5ad8' }], ['crystal', 2, { a: '#4a2a8a', b: '#221040', c: '#d8b8ff', d: '#9a6ae8' }]],
  [['crystal', 5, { a: '#4a7ab8', b: '#2a4a7a', c: '#c8f0ff', d: '#7ac0ff' }], ['shard', 6, { a: '#6a4ab8', b: '#3a2a6a', c: '#f0d8ff', d: '#b08aff' }], ['rock', 3, { a: '#3a4560', b: '#232d40', c: '#5a6a90' }]],
  [['bigmush', 2, { a: '#e0d0c0', b: '#5a2a5a', c: '#ffffff', d: '#b04ac0' }], ['mush', 5, { a: '#e0d0c0', b: '#3a2a5a', c: '#d8ffd8', d: '#5ac0a0' }], ['mush', 4, { a: '#e0d0c0', b: '#5a1a2a', c: '#ffe0e0', d: '#e04a6a' }], ['star', 4, { c: '#d8ffb0', d: '#8ae05a' }]],
  [['pillar', 3, { a: '#3a6a6a', b: '#204040', c: '#5a9a9a' }], ['broken', 3, { a: '#3a6a6a', b: '#204040', c: '#5a9a9a' }], ['coral', 4, { d: '#ff8a8a' }], ['puddle', 3, { a: '#2a6a7a', b: '#173a40', c: '#6ac0d0' }], ['vine', 4, { a: '#2a6a4a' }]],
  [['dtree', 4, { a: '#2a2420', b: '#16120f' }], ['rock', 4, { a: '#4a403a', b: '#2a2420', c: '#6a5a50' }], ['ember', 3, { c: '#ffb070', d: '#a04a20' }], ['bone', 2, { a: '#8a8070', c: '#a8a090' }]],
  [['cloud', 4, { a: '#d8d8e8', c: '#ffffff' }], ['tile', 4, { d: '#e8c060' }], ['pillar', 3, { a: '#f0e8d0', b: '#c8bc98', c: '#ffffff' }], ['star', 4, { c: '#ffffff', d: '#ffd84a' }]],
];
const AMB = ['firefly', 'firefly', 'spore', 'dust', 'dust', 'snow', 'ember', 'spark', 'spark', 'spore', 'bubble', 'ash', 'spark'];
function propsGround(g, bi, sr) {
  const L = BPROPS[bi]; if (!L) return; const tot = L.reduce((a, p) => a + p[1], 0), n = Math.round(AW * AH / 420);
  const placed = [];
  for (let i = 0; i < n; i++) { let r = sr() * tot, e = L[0]; for (const p of L) { r -= p[1]; if (r <= 0) { e = p; break; } }
    const P = PROPS[e[0]], pw = P[0].length, ph = P.length, near = placed.length && sr() < .45 ? placed[placed.length - 1] : null;   // группы: рощи и россыпи
    const x = Math.round(near ? clamp(near[0] + (sr() - .5) * 26, 0, AW - pw) : sr() * (AW - pw)), y = Math.round(near ? clamp(near[1] + (sr() - .5) * 18, 0, AH - ph) : sr() * (AH - ph));
    if (placed.some(q => Math.abs(q[0] - x) < (q[2] + pw) / 2 + 1 && Math.abs(q[1] - y) < (q[3] + ph) / 2 + 1)) continue; placed.push([x, y, pw, ph]);
    const big = ph >= 5; if (big) { g.globalAlpha = .28; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x + pw / 2 + 1, y + ph - .5, pw / 2, 1.5, 0, 0, 6.283); g.fill(); g.globalAlpha = 1; }
    P.forEach((row, j) => [...row].forEach((ch, k) => { const col = e[2][ch]; if (ch !== '.' && col) { g.fillStyle = col; g.fillRect(x + k, y + j, 1, 1); } })); }
}
let vigC = null, vigK = '';
function drawArenaFx() {
  if (S.fxLow) return;
  const b = biomeOf(S.zone), bi = b.world != null ? [6, 5, 4, 7, 12][b.world % 5] : b.bi, kind = AMB[bi] || 'spark';
  for (let i = 0; i < 26; i++) { const ph = i * 7.31, sd = (i * 97.13) % 1;
    let x, y, c, a = .7;
    if (kind === 'snow' || kind === 'ash') { y = ((i * 41.7 + time * (kind === 'snow' ? 9 : 5)) % (H + 6)) - 3; x = ((i * 53.3 + Math.sin(time * .8 + ph) * 5) % W + W) % W; c = kind === 'snow' ? '#ffffff' : '#8a7a70'; a = .6; }
    else if (kind === 'ember' || kind === 'bubble') { y = H + 3 - ((i * 41.7 + time * (kind === 'ember' ? 14 : 8)) % (H + 6)); x = ((i * 53.3 + Math.sin(time * 1.3 + ph) * 3) % W + W) % W; c = kind === 'ember' ? (i % 3 ? '#ff7a2a' : '#ffd84a') : '#9ae0ff'; a = .7; }
    else { x = ((i * 53.3 + Math.sin(time * .5 + ph) * 12 + time * 2) % W + W) % W; y = ((i * 37.9 + Math.cos(time * .4 + ph) * 8) % H + H) % H; const bl = .5 + .5 * Math.sin(time * 2.2 + ph);
      c = kind === 'firefly' ? '#d8ff7a' : kind === 'spore' ? '#b8f0a0' : kind === 'dust' ? '#e8d8a8' : '#ffffff'; a = kind === 'firefly' ? bl : kind === 'spark' ? bl * bl : .45; if (kind === 'spark' && sd > .5) c = b.g[2]; }
    ctx.globalAlpha = a; pix(x, y, c); if (kind === 'firefly' && a > .7) { ctx.globalAlpha = a * .3; pix(x + 1, y, c); pix(x - 1, y, c); pix(x, y + 1, c); pix(x, y - 1, c); } }
  ctx.globalAlpha = 1;
  // виньетка: края темнее, центр (герой) светлее
  const key = W + 'x' + H; if (vigK !== key) { vigK = key; vigC = document.createElement('canvas'); vigC.width = W; vigC.height = H; const v = vigC.getContext('2d'), gr = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.hypot(W, H) * .58);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(4,2,10,.55)'); v.fillStyle = gr; v.fillRect(0, 0, W, H); }
  ctx.drawImage(vigC, 0, 0);
}
function buildGround() {
  if (SIM && ground) return;   // в симуляции фон арены не нужен
  const b = biomeOf(S.zone);
  ground = document.createElement('canvas'); ground.width = AW; ground.height = AH;
  const g = ground.getContext('2d');
  g.fillStyle = b.g[0]; g.fillRect(0, 0, AW, AH);
  let seed = S.zone * 9973;
  const sr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < AW * AH * .12; i++) { g.fillStyle = b.g[1]; g.fillRect(sr() * AW | 0, sr() * AH | 0, 1, 1); }
  for (let i = 0; i < AW * AH * .015; i++) {
    const x = sr() * AW | 0, y = sr() * AH | 0; g.fillStyle = b.g[2];
    g.fillRect(x, y, 1, 1); if (sr() < .5) { g.fillRect(x - 1, y + 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); }
  }
  if (b.world != null) worldGround(g, b.world, sr);
  propsGround(g, b.world != null ? [6, 5, 4, 7, 12][b.world % 5] : b.bi, sr);
  g.fillStyle = 'rgba(8,6,16,.4)'; g.fillRect(0, 0, AW, AH);   // приглушённый фон, чтобы бой читался
  decal = document.createElement('canvas'); decal.width = AW; decal.height = AH;
  for (let i = 0; i < AW * AH * .002; i++) {
    const x = sr() * AW | 0, y = sr() * AH | 0; g.fillStyle = shade(b.g[1], -.3);
    g.fillRect(x, y, 2, 2); g.fillStyle = shade(b.g[2], .2); g.fillRect(x, y, 1, 1);
  }
}

/* ---------- звук (8 бит, генерируется) ---------- */
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); }
const lastSnd = {};
function tone(f, d, type = 'square', vol = .04, f2 = 0, delay = 0, tag = '', gap = 0) {
  if (SIM) return;
  if (S.mute || !AC) return;
  const now = AC.currentTime;
  if (tag) { if (lastSnd[tag] && now - lastSnd[tag] < gap) return; if (now - (lastSnd._any || 0) < .03) return; lastSnd[tag] = now; lastSnd._any = now; }   // боевые звуки: не чаще ~30 в секунду на всех
  const o = AC.createOscillator(), g = AC.createGain(), t = now + delay;
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + .02);
}
const sfx = {
  hit: () => tone(180 + rnd() * 60, .05, 'square', .025, 70, 0, 'hit', .06),
  crit: () => tone(520, .08, 'square', .035, 160, 0, 'crit', .08),
  kill: () => tone(300 + rnd() * 100, .09, 'triangle', .05, 900, 0, 'kill', .05),
  hurt: () => tone(110, .08, 'sawtooth', .025, 60, 0, 'hurt', .15),
  tap: () => tone(900, .07, 'square', .03, 200, 0, 'tap', .05),
  rare: () => [660, 880, 1100, 1320].forEach((f, i) => tone(f, .09, 'square', .035, 0, i * .06)),
  unlock: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .12, 'square', .04, 0, i * .07)),
  boss: () => [196, 185, 175, 165].forEach((f, i) => tone(f, .22, 'sawtooth', .04, 0, i * .18)),
  zone: () => [392, 523, 659, 784, 659, 1047].forEach((f, i) => tone(f, .14, 'square', .045, 0, i * .09)),
  evo: () => [262, 392, 523, 784, 1047, 1568].forEach((f, i) => tone(f, .1, 'triangle', .06, 0, i * .05)),
  syn: () => { [523, 659, 784].forEach(f => tone(f, .5, 'square', .025)); [1047, 1319].forEach((f, i) => tone(f, .3, 'triangle', .04, 0, .25 + i * .1)); },
  combo: () => [880, 1175].forEach((f, i) => tone(f, .07, 'square', .035, 0, i * .05)),
  ultra: () => { tone(1400, .25, 'sawtooth', .05, 60); tone(90, .3, 'square', .05, 40); },
  boom: () => tone(140, .22, 'sawtooth', .05, 35, 0, 'boom', .08),
};

/* ---------- UI-уведомления ---------- */
const toastEl = $('toast');
// баннер сверху: по одному за раз, остальные ждут в очереди
const tq = []; let tBusy = false;
// рядовые сообщения: по центру только первые 2 раза за игру (чтобы понять, что это), дальше — строкой в ленте.
// Исключения: новый рекорд зоны и вожак на рекордной зоне; мастерство — только на рубежах облика
const TOAST_MINOR = /^(ЗОНА |ВОЛНА |ЗАДАЧА|НОВЫЕ ЗЕМЛИ|ВОЖАК|ЛЕГЕНДА: |МАСТЕРСТВО |ДЖЕКПОТ|ПОСЛЕДНИЙ РЫВОК|ГОБЛИН|ОПАСНОСТЬ|ЯРОСТЬ ВОЖАКА|ПРОРЫВ|ОТСТУПЛЕНИЕ)/;
function toastMinor(t) {
  if (!TOAST_MINOR.test(t)) return false;
  if (/^(ЗОНА |ВОЖАК: |ЛЕГЕНДА: |НОВЫЕ ЗЕМЛИ)/.test(t) && S.zone >= (S.meta.best || 0)) return false;
  if (/^МАСТЕРСТВО /.test(t) && TIERS.some(x => t.endsWith(' ' + x[0]))) return false;
  const k = t.replace(/[0-9.,:]+.*$/, '').trim(), C = S.meta.tc || (S.meta.tc = {}); C[k] = (C[k] || 0) + 1; return C[k] > 2;
}
function toast(t, sub, dur = 2400, cls = '') {
  if (cls !== 'tip' && toastMinor(t)) { feed(t.replace(/!$/, '') + (sub ? ' · ' + sub : ''), '#c9c2e8'); return; }
  if (cls === 'tip') tq.unshift({ t, sub, dur, cls }); else { tq.push({ t, sub, dur, cls }); while (tq.length > 3) tq.splice(tq.findIndex(q => q.cls !== 'tip'), 1); }
  if (!tBusy) nextToast();
}
function nextToast() {
  const q = tq.shift(); if (!q) { tBusy = false; return; }
  tBusy = true; toastEl.innerHTML = '';
  const d = document.createElement('div'); d.className = 'tst ' + q.cls; d.style.setProperty('--dur', q.dur + 'ms');
  d.textContent = q.t; if (q.cls === 'tip') d.insertAdjacentHTML('afterbegin', pxImg('bulb', '#f2c94c', 9)); if (q.sub) { const s = document.createElement('small'); s.textContent = q.sub; d.appendChild(s); }
  toastEl.appendChild(d); let done = false; const fin = () => { if (done) return; done = true; d.remove(); nextToast(); };
  d.onclick = fin; setTimeout(fin, q.dur);
}
// подсказки: каждая показывается один раз за всю игру
function tip(key, title, text) {
  if (!S.tips) S.tips = {};
  if (S.tips[key]) return; S.tips[key] = 1;
  toast(title, text + ' (тапни, чтобы закрыть)', 4500, 'tip');
}
// лента событий в левом нижнем углу: прирост, эволюции, формы
let feedArr = [], gainFeedT = 0;
// лента: не чаще строки в секунду, одинаковые строки не повторяются 6 с (иначе сотни строк в минуту)
const feedSeen = new Map(); let feedLast = -9;
function feed(s, c) { const k = String(s).replace(/[0-9.,]+[a-zA-Zа-я]*/g, '#'); if (time - (feedSeen.get(k) ?? -99) < 6 || time - feedLast < 1) return; feedSeen.set(k, time); feedLast = time; if (feedSeen.size > 200) feedSeen.clear();
  feedArr.push({ s, c, t: 0 }); if (feedArr.length > 3) feedArr.shift(); }
const ftWordT = {};
function ftext(x, y, s, c, size = 1, life = .9) {
  if (SIM) return;
  // словесные надписи (не числа): каждая не чаще раза в 6с, чтобы бой не тонул в тексте
  if (!/^[-+0-9×]/.test(s) && size < 1.5) { if (time < (ftWordT[s] || 0)) return; ftWordT[s] = time + 6; }
  if (texts.length > 30) texts.shift();
  texts.push({ x, y, s, c, size, life, t: 0, vx: (rnd() - .5) * 6 });
}
const mvCap = v => 170 * (1 - Math.exp(-v / 170));   // бег быстрый, но глазом видно
function burst(x, y, c, n, sp = 30) {
  if (SIM) return;
  if (S.fxLow) n = Math.ceil(n * .3);
  n = Math.ceil(n * Math.min(1, 150 / (parts.length + 1)));   // чем больше на экране, тем меньше новых искр
  for (let i = 0; i < n; i++) {
    if (parts.length > 500) parts.shift();
    const a = rnd() * Math.PI * 2, v = sp * (.3 + rnd());
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, l: .3 + rnd() * .5, c });
  }
}

