'use strict';
/* ---------- АРЕНА: тайловая земля, передний план с параллаксом, погода, свечения ---------- */
// Земля рисуется попиксельно в ImageData (раз при смене зоны): у каждого биома свой материал —
// трава с тропинками, плиты, песок с рябью, лёд, базальт с лавой, мох, мрамор… Ярко, но темнее врагов.
// Передний план — тёмные силуэты по верхнему и нижнему краю экрана, сдвигаются быстрее камеры (глубина).
// Погода — два слоя частиц (дальний мелкий, ближний крупный) по биому.

const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulC = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
function satC(c, k) { const m = (c[0] + c[1] + c[2]) / 3; return [m + (c[0] - m) * k, m + (c[1] - m) * k, m + (c[2] - m) * k]; }
// шум: хэш по целым координатам, гладкий value noise, клеточный (Вороной)
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, y, s) => vnoise(x / 26, y / 26, s) * .55 + vnoise(x / 11, y / 11, s + 1) * .3 + vnoise(x / 4, y / 4, s + 2) * .15;
let cellK = '', cellP = null, cellN = 0;
function cells(x, y, sz, s) { const k = sz + ':' + s + ':' + AW + 'x' + AH; if (k !== cellK) { cellK = k; cellN = Math.ceil(Math.max(AW, AH) / sz) + 3; cellP = new Float32Array(cellN * cellN * 3);   // точки клеток считаются один раз
    for (let gy = -1; gy < cellN - 1; gy++) for (let gx = -1; gx < cellN - 1; gx++) { const o = ((gy + 1) * cellN + gx + 1) * 3; cellP[o] = (gx + hash2(gx, gy, s)) * sz; cellP[o + 1] = (gy + hash2(gx, gy, s + 7)) * sz; cellP[o + 2] = hash2(gx, gy, s + 3); } }
  const cx = Math.floor(x / sz), cy = Math.floor(y / sz); let d1 = 1e9, d2 = 1e9, id = 0;
  for (let j = 0; j <= 2; j++) for (let i = 0; i <= 2; i++) { const o = ((cy + j) * cellN + cx + i) * 3, dx = x - cellP[o], dy = y - cellP[o + 1], d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = cellP[o + 2]; } else if (d < d2) d2 = d; }
  return [Math.sqrt(d2) - Math.sqrt(d1), id]; }   // [расстояние до шва, номер клетки 0..1]

// материал земли по биому (0..12; миры за 50-й берут родственный)
const GTYPE = ['grass', 'forest', 'swamp', 'sand', 'slabs', 'ice', 'basalt', 'void', 'cave', 'moss', 'temple', 'ash', 'marble'];
function groundPixels(g, bi, b, seed) {
  const T = GTYPE[bi] || 'grass', img = g.createImageData(AW, AH), D8 = img.data;
  const base = satC(hexRgb(b.g[0]), 1.25), dark = satC(hexRgb(b.g[1]), 1.2), lite = satC(hexRgb(b.g[2]), 1.3);
  const dirt = mixC(mulC(base, .7), [120, 84, 52], .5), water = [30, 70, 80], lava = [255, 110, 30], gold = [214, 170, 70];
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const n = fbm(x, y, seed), h = hash2(x, y, seed + 9); let c = base;
    switch (T) {
      case 'grass': case 'forest': {
        const path = Math.abs(fbm(x * .7, y * 1.6, seed + 5) - .5) < .035;   // извилистые тропинки
        if (path || n > .66) c = mixC(dirt, dark, h * .3);
        else { c = mixC(base, n > .5 ? lite : dark, Math.abs(n - .5) * 1.2); if (h < .035) c = lite; else if (h < .07) c = mulC(dark, .9); }
        if (T === 'forest' && h > .985) c = [150, 90, 40];   // опавшие листья
        if (T === 'grass' && h > .993) c = [255, 240, 140];
        break; }
      case 'swamp': { if (n < .38) c = mixC(water, [60, 110, 100], (.38 - n) * 3 + (h < .05 ? .4 : 0)); else { c = mixC(dark, base, n); if (h < .1) c = mixC(c, [90, 120, 50], .5); } break; }
      case 'sand': { const rip = Math.sin(x * .45 + y * .9 + n * 9); c = rip > .82 ? lite : rip < -.86 ? dark : base; if (n > .7) { const [e] = cells(x, y, 9, seed); if (e < 1) c = mulC(dark, .8); } if (h > .992) c = [240, 230, 210]; break; }
      case 'slabs': case 'temple': case 'marble': {
        const tw = T === 'marble' ? 16 : 11, th = T === 'marble' ? 12 : 8, row = Math.floor(y / th), ox = row % 2 ? tw / 2 : 0, tx = Math.floor((x + ox) / tw), lx = (x + ox) % tw, ly = y % th, id = hash2(tx, row, seed + 4);
        c = mixC(base, id > .5 ? lite : dark, Math.abs(id - .5) * .8);
        if (lx === 0 || ly === 0) c = T === 'marble' ? gold : mulC(dark, .55); else if (lx === 1 || ly === 1) c = mixC(c, lite, .35);
        if (T === 'marble' && Math.abs(fbm(x * 2, y * 2, seed + 3) - .5) < .02) c = mulC(c, .88);   // прожилки мрамора
        if (T === 'temple' && n < .33) c = mixC(c, water, .65);   // вода в провалах
        if ((T === 'slabs' || T === 'temple') && (lx === 0 || ly === 0) && n > .6) c = [60, 100, 50];   // мох в швах
        if (h < .04) c = mulC(c, .9);
        break; }
      case 'ice': { const [e, id] = cells(x, y, 22, seed); c = mixC(base, lite, id * .6); if (e < 1.2) c = mixC(dark, [80, 120, 150], .4); if ((x + y + Math.floor(id * 40)) % 23 === 0 && e > 3) c = [240, 250, 255]; if (n > .64) c = mixC([235, 245, 252], c, h * .25); break; }
      case 'basalt': case 'ash': { const [e, id] = cells(x, y, 13, seed); c = mulC(mixC(dark, base, id * .7), T === 'basalt' ? .62 : .9); if (e < 1.1) c = T === 'basalt' ? (n > .45 ? mixC(lava, [255, 210, 80], n > .65 ? .5 : 0) : [90, 30, 20]) : mulC(dark, .5); else if (T === 'basalt' && e < 2 && n > .55) c = mixC(c, lava, .25); if (h < .05) c = mulC(c, 1.15); break; }
      case 'void': { c = mixC(dark, base, n); const [e] = cells(x, y, 20, seed); if (e < .8) c = mixC(c, [140, 90, 255], .45); if (h > .993) c = [230, 210, 255]; break; }
      case 'cave': { const [e, id] = cells(x, y, 7, seed); c = mixC(dark, base, id * .8 + .1); if (e < .9) c = mulC(dark, .6); if (h > .994) c = lite; if (n > .7 && h > .97) c = [150, 220, 255]; break; }
      case 'moss': { c = mixC(dark, base, n); const sp = vnoise(x / 5, y / 5, seed + 11); if (sp > .82) c = mixC(c, [120, 230, 180], (sp - .82) * 3); if (h < .08) c = mulC(c, .8); break; }
    }
    const i = (y * AW + x) * 4; D8[i] = c[0]; D8[i + 1] = c[1]; D8[i + 2] = c[2]; D8[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

/* передний план: силуэты по краям экрана со смещением быстрее камеры */
let fgC = null, fgK = '';
const FG_KIND = ['grass', 'leaves', 'reeds', 'rocks', 'stal', 'ice', 'stal', 'void', 'crys', 'shroom', 'vines', 'rocks', 'cloud'];
function buildFg(bi, b) {
  const kind = FG_KIND[bi] || 'grass', SW = 512, SH = 26, c = document.createElement('canvas'); c.width = SW; c.height = SH * 2; const g = c.getContext('2d');
  const dk = 'rgb(' + mulC(hexRgb(b.g[1]), .32).map(Math.round).join(',') + ')', md = 'rgb(' + mulC(hexRgb(b.g[1]), .5).map(Math.round).join(',') + ')';
  let s = bi * 131 + 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // верх (0..SH) свисает вниз, низ (SH..2SH) растёт вверх; сначала сплошная кромка из пятен разной высоты
  const topK = ['leaves', 'stal', 'vines', 'crys', 'ice', 'void'].includes(kind), botK = kind !== 'cloud';
  for (let x = -10; x < SW + 10; x += 5 + Math.floor(r() * 8)) {
    if (topK) { g.fillStyle = r() < .6 ? dk : md; g.beginPath(); g.ellipse(x, 0, 6 + r() * 10, (kind === 'leaves' || kind === 'vines' ? 5 : 2) + r() * 6, 0, 0, 6.283); g.fill(); }
    if (botK) { g.fillStyle = r() < .6 ? dk : md; g.beginPath(); g.ellipse(x, 2 * SH, 6 + r() * 10, 2 + r() * 5, 0, 0, 6.283); g.fill(); }
  }
  for (let x = 0; x < SW; x += 2 + Math.floor(r() * 4)) {
    const top = kind === 'leaves' || kind === 'stal' || kind === 'vines' || kind === 'crys' || kind === 'ice' || kind === 'void' || kind === 'cloud';
    const L = 6 + r() * (top ? 16 : 8), w = 1 + Math.floor(r() * 3), col = r() < .5 ? dk : md;
    g.fillStyle = col;
    if (top) {   // свисающее сверху
      if (kind === 'leaves' || kind === 'vines') { for (let k = 0; k < L; k++) g.fillRect(x + Math.round(Math.sin(k * .6 + x) * 1.5), k, kind === 'leaves' ? w + 1 : 1, 1); if (kind === 'leaves') { g.beginPath(); g.ellipse(x + 1, L * .4, 4 + r() * 4, 3 + r() * 2, 0, 0, 6.283); g.fill(); } }
      else if (kind === 'cloud') { g.beginPath(); g.ellipse(x, 2, 8 + r() * 10, 3 + r() * 4, 0, 0, 6.283); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill(); }
      else { for (let k = 0; k < L; k++) { const ww = Math.max(1, Math.round(w * (1 - k / L) * 2)); g.fillRect(x - (ww >> 1), k, ww, 1); } if (kind === 'crys' || kind === 'ice') { g.fillStyle = kind === 'ice' ? 'rgba(200,240,255,.35)' : 'rgba(170,140,255,.4)'; g.fillRect(x, 0, 1, Math.round(L * .7)); } }
    }
    // низ: трава, камыш, камни, грибы
    const B = 2 * SH; g.fillStyle = r() < .5 ? dk : md;
    if (kind === 'grass' || kind === 'leaves' || kind === 'reeds' || kind === 'vines') { const hh = 5 + r() * (kind === 'reeds' ? 16 : 10); for (let k = 0; k < hh; k++) g.fillRect(x + Math.round(Math.sin(k * .5 + x) * (k / hh) * 2.5), B - 1 - k, k < hh * .6 ? 2 : 1, 1); if (kind === 'reeds' && r() < .4) g.fillRect(x - 1, B - hh - 2, 3, 3); }
    else if (kind === 'shroom') { if (r() < .35) { const hh = 4 + r() * 8; g.fillRect(x, B - hh, 2, hh); g.beginPath(); g.ellipse(x + 1, B - hh, 4 + r() * 3, 2.5, 0, 0, 6.283); g.fill(); } }
    else if (r() < .4) { g.beginPath(); g.ellipse(x, B, 3 + r() * 7, 2 + r() * 4, 0, 0, 6.283); g.fill(); }
  }
  return c;
}
function drawFg() {
  if (SIM || S.fxLow) return;
  const b = biomeOf(S.zone), bi = b.world != null ? [6, 5, 4, 7, 12][b.world % 5] : b.bi, key = bi + ':' + S.zone;
  if (fgK !== key) { fgK = key; fgC = buildFg(bi, b); }
  const SW = fgC.width, SH = fgC.height / 2, px = -((camX * 1.35) % SW + SW) % SW, py = Math.round((camY / Math.max(1, AH - H) - .5) * 6);   // параллакс: быстрее камеры
  const hy = hero.y - camY, fadeT = hy < SH + 6 ? .35 : 1, fadeB = hy > H - SH - 4 ? .35 : 1;
  for (let x = px; x < W; x += SW) {
    ctx.globalAlpha = .9 * fadeT; ctx.drawImage(fgC, 0, 0, SW, SH, Math.round(x), Math.min(0, py) - 2, SW, SH);
    ctx.globalAlpha = .9 * fadeB; ctx.drawImage(fgC, 0, SH, SW, SH, Math.round(x), H - SH + Math.max(0, py) + 1, SW, SH);
  }
  ctx.globalAlpha = 1;
}

/* свечения: ступенчатые пиксельные ореолы, рисуются сложением цвета */
const glowC = new Map();
function glowSpr(c, r) { const k = c + r; let s = glowC.get(k); if (s) return s; s = document.createElement('canvas'); s.width = s.height = r * 2 + 1; const g = s.getContext('2d'), [R, G, B] = hexRgb(c.length === 7 ? c : '#ffffff');
  for (let y = 0; y <= r * 2; y++) for (let x = 0; x <= r * 2; x++) { const d = Math.hypot(x - r, y - r) / r; if (d > 1) continue; const a = d < .3 ? .4 : d < .6 ? .2 : .07; g.fillStyle = `rgba(${R},${G},${B},${a})`; g.fillRect(x, y, 1, 1); }
  glowC.set(k, s); return s; }
function glow(x, y, c, r, a = 1) { if (SIM || S.fxLow) return; const s = glowSpr(c, Math.max(2, Math.round(r))); const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = op; }

/* дым и пыль: мягкие клубы от взрывов и смертей */
let smoke = [];
function puff(x, y, r, c = '#3a3440', n = 3) { if (SIM || S.fxLow) return; for (let i = 0; i < n && smoke.length < 40; i++) smoke.push({ x: x + (rnd() - .5) * r, y: y + (rnd() - .5) * r * .5, r: r * (.35 + rnd() * .35), vx: (rnd() - .5) * 10, vy: -6 - rnd() * 8, t: 0, l: .7 + rnd() * .5, c }); }
function smokeTick(dt) { for (const p of smoke) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 6; } smoke = smoke.filter(p => p.t < p.l); }
function drawSmoke() { for (const p of smoke) { ctx.globalAlpha = .22 * (1 - p.t / p.l); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(Math.round(p.x), Math.round(p.y), Math.max(1, p.r), 0, 6.283); ctx.fill(); } ctx.globalAlpha = 1; }

/* погода: два слоя частиц по биому */
const WEATHER = ['petals', 'leaves', 'fog', 'sand', 'fog', 'snow', 'embers', 'motes', 'glints', 'spores', 'rain', 'ash', 'clouds'];
let fogC = null;
function drawWeather() {
  if (S.fxLow) return;
  const b = biomeOf(S.zone), bi = b.world != null ? [6, 5, 4, 7, 12][b.world % 5] : b.bi, kind = WEATHER[bi] || 'motes', N = Math.round(34 * W * H / (130 * 200));
  if (kind === 'fog' || kind === 'clouds') {   // большие полупрозрачные клубы тумана/облаков
    if (!fogC) { fogC = document.createElement('canvas'); fogC.width = 64; fogC.height = 32; const g = fogC.getContext('2d'), gr = g.createRadialGradient(32, 16, 2, 32, 16, 30); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 32); }
    const n = Math.round(N / 5); ctx.globalAlpha = kind === 'fog' ? .18 : .28;
    for (let i = 0; i < n; i++) { const x = ((i * 97.3 + time * (4 + i % 3)) % (W + 80)) - 40, y = (i * 53.1) % H; ctx.drawImage(fogC, Math.round(x - camX * .15 % 40), Math.round(y), 64 + (i % 3) * 20, 32 + (i % 2) * 10); }
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < N; i++) {
    const near = i % 4 === 0, ph = i * 7.31, sp = near ? 1.8 : 1, par = near ? 1.4 : .8;   // ближние крупнее, быстрее и сильнее смещаются с камерой
    let x, y, c, a = .7, sz = near ? 2 : 1, dx = 0;
    const ox = -camX * (par - 1), oy = -camY * (par - 1);
    switch (kind) {
      case 'snow': case 'ash': y = (i * 41.7 + time * (kind === 'snow' ? 12 : 6) * sp) % (H + 6) - 3; x = i * 53.3 + Math.sin(time * .8 + ph) * 6; c = kind === 'snow' ? '#ffffff' : '#9a8c84'; a = near ? .85 : .55; break;
      case 'rain': y = (i * 41.7 + time * 140 * sp) % (H + 10) - 5; x = i * 53.3 - y * .25; c = '#9fd0ff'; a = .4; dx = 1; break;
      case 'embers': y = H + 3 - (i * 41.7 + time * 16 * sp) % (H + 6); x = i * 53.3 + Math.sin(time * 1.6 + ph) * 4; c = i % 3 ? '#ff7a2a' : '#ffd84a'; a = .8; break;
      case 'leaves': case 'petals': y = (i * 41.7 + time * 9 * sp) % (H + 6) - 3; x = i * 53.3 + Math.sin(time * 1.4 + ph) * 10; c = kind === 'leaves' ? (i % 3 ? '#a8742a' : '#6a9a3a') : (i % 3 ? '#ffb0d0' : '#fff2a0'); a = .85; dx = Math.sin(time * 3 + ph) > 0 ? 1 : 0; break;
      case 'sand': x = (i * 53.3 + time * 60 * sp) % (W + 20) - 10; y = i * 37.9 + Math.sin(time + ph) * 3; c = '#e8d0a0'; a = .5; dx = 2; break;
      case 'spores': case 'motes': case 'glints': case 'fog': case 'clouds': default: {
        x = i * 53.3 + Math.sin(time * .5 + ph) * 12 + time * 2; y = i * 37.9 + Math.cos(time * .4 + ph) * 8; const bl = .5 + .5 * Math.sin(time * 2.2 + ph);
        c = kind === 'spores' ? '#b8f0a0' : kind === 'glints' ? '#c8f0ff' : kind === 'motes' ? '#c8a8ff' : kind === 'fog' ? '#d8ffb0' : '#ffffff'; a = kind === 'glints' ? bl * bl : bl * .8; break; }
    }
    x = ((x + ox) % W + W) % W; y = ((y + oy) % H + H) % H;
    ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), sz + dx, sz);
    if (near && (kind === 'embers' || kind === 'spores' || kind === 'motes' || kind === 'glints')) glow(x, y, c, 3, .5);
  }
  ctx.globalAlpha = 1;
}
