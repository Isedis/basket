'use strict';
/* ---------- ГЕРОИ 32×32: генератор персонажа с объёмной светотенью ---------- */
// Персонаж собирается из объёмных форм (шары, капсулы, многоугольники) в сетке 64×60. Каждая форма знает свой материал
// и считает освещённость по нормали (свет сверху-слева-спереди). Потом освещённость квантуется в 4–5 тонов рампы материала,
// края получают цветной контур (тёмный тон материала) и внешнюю тёмную обводку. Детали (глаза, руны, швы) — точечно.
// Поза: угол оружия ang (0 вверх, +90 вперёд, ±180 вниз), lean (наклон, в пикселях 16-сетки ×2), crouch, кадр ног legs.
// Рука держит оружие и поворачивается вместе с ним — в ударе видно, как рука замахивается.
// Облики I–IV: разное снаряжение (I — простое, II — наплечники и пояс, III — плащ/мантия и золотая отделка, IV — легендарное с сиянием).

const G32W = 64, G32H = 60, G32X = 16, G32Y = 25;   // тело в координатах 0..31, ступни на y=31 → в сетке (16..47, 25..56)
const LIGHT = (() => { const v = [-.45, -.7, .55], n = Math.hypot(...v); return v.map(x => x / n); })();
function hex2hsl(h) { let [r, g, b] = hexRgb(h).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; } return [hh, s, l]; }
function hsl2rgbHex(h, s, l) { h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1); const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255); }
// рампа: [глубокая тень, тень, основа, свет, блик]; тени уходят в холодный оттенок, свет — в тёплый
const rampC = new Map();
function ramp(hex, metal) { const k = hex + (metal ? 'm' : ''); let r = rampC.get(k); if (r) return r; const [h, s, l] = hex2hsl(hex), cool = h > 60 && h < 250 ? 1 : -1;
  r = [hsl2rgbHex(h + 18 * cool, s * .9 + .1, l * .38), hsl2rgbHex(h + 9 * cool, s * .95 + .05, l * .68), hex, hsl2rgbHex(h - 8 * cool, s * .95, l + (1 - l) * (metal ? .45 : .3)), hsl2rgbHex(h - 12 * cool, s * .6, l + (1 - l) * (metal ? .85 : .6))];
  rampC.set(k, r); return r; }

// холст-сетка
function G32() { const n = G32W * G32H; return { m: new Int16Array(n).fill(-1), l: new Float32Array(n), raw: new Array(n), mats: [] }; }
function gMat(g, hex, metal) { let i = g.mats.findIndex(q => q.hex === hex && q.metal === !!metal); if (i < 0) { g.mats.push({ hex, metal: !!metal, r: ramp(hex, metal) }); i = g.mats.length - 1; } return i; }
function gPut(g, x, y, mi, lv) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= G32W || y >= G32H) return; const i = y * G32W + x; g.m[i] = mi; g.l[i] = lv; g.raw[i] = undefined; }
function gRaw(g, x, y, c) { x = Math.round(x + G32X); y = Math.round(y + G32Y); if (x < 0 || y < 0 || x >= G32W || y >= G32H) return; const i = y * G32W + x; if (g.m[i] < 0) g.m[i] = 0; g.raw[i] = c; }
const ldot = (nx, ny, nz) => nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
// шар/эллипсоид
function gEll(g, cx, cy, rx, ry, hex, o = {}) { const mi = gMat(g, hex, o.metal); cx += G32X; cy += G32Y;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + .5 - cx) / (rx + .5), ny = (y + .5 - cy) / (ry + .5), d = nx * nx + ny * ny; if (d > 1) continue; if (o.clip && !o.clip(x - G32X, y - G32Y)) continue;
    gPut(g, x, y, mi, ldot(nx, ny, Math.sqrt(1 - d)) + (o.b || 0)); } }
// капсула (конечности, рукояти)
function gCap(g, x1, y1, x2, y2, r, hex, o = {}) { const mi = gMat(g, hex, o.metal); x1 += G32X; y1 += G32Y; x2 += G32X; y2 += G32Y; const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  for (let y = Math.floor(Math.min(y1, y2) - r - 1); y <= Math.ceil(Math.max(y1, y2) + r + 1); y++) for (let x = Math.floor(Math.min(x1, x2) - r - 1); x <= Math.ceil(Math.max(x1, x2) + r + 1); x++) {
    const px = x + .5, py = y + .5, t = clamp(((px - x1) * dx + (py - y1) * dy) / L2, 0, 1), qx = x1 + dx * t, qy = y1 + dy * t, nx = (px - qx) / (r + .3), ny = (py - qy) / (r + .3), d = nx * nx + ny * ny;
    if (d > 1) continue; gPut(g, x, y, mi, ldot(nx, ny, Math.sqrt(1 - d)) + (o.b || 0)); } }
// многоугольник: свет по горизонтали как у цилиндра (торс, юбка, плащ)
function gPoly(g, pts, hex, o = {}) { const mi = gMat(g, hex, o.metal); const P = pts.map(([x, y]) => [x + G32X, y + G32Y]);
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys)), cx = (x0 + x1) / 2, hw = (x1 - x0) / 2 + .5;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { let ins = false; const px = x + .5, py = y + .5;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins; }
    if (!ins) continue; const nx = (px - cx) / hw * (o.flat ? .4 : .85), ny = (o.ny ?? -.15) + (py - y0) / (y1 - y0 + 1) * (o.grad ?? .5); gPut(g, x, y, mi, ldot(nx, ny, Math.sqrt(Math.max(.05, 1 - nx * nx))) + (o.b || 0)); } }
// готовый холст: тона по освещённости, цветной контур, внешняя обводка
function gRender(g) {
  const c = document.createElement('canvas'); c.width = G32W; c.height = G32H; const x = c.getContext('2d'), img = x.createImageData(G32W, G32H), D = img.data, col = new Array(G32W * G32H);
  for (let i = 0; i < G32W * G32H; i++) { if (g.m[i] < 0) continue; if (g.raw[i]) { col[i] = g.raw[i]; continue; } const M = g.mats[g.m[i]], lv = g.l[i];
    const q = lv > (M.metal ? .9 : 2) ? 4 : lv > .7 ? 3 : lv > .34 ? 2 : lv > .02 ? 1 : 0; col[i] = M.r[q]; }
  const opq = i => i >= 0 && g.m[i] >= 0;
  for (let y = 0; y < G32H; y++) for (let xx = 0; xx < G32W; xx++) { const i = y * G32W + xx; if (g.m[i] < 0 || g.raw[i]) continue;
    const edge = !opq(xx > 0 ? i - 1 : -1) || !opq(xx < G32W - 1 ? i + 1 : -1) || !opq(y > 0 ? i - G32W : -1) || !opq(y < G32H - 1 ? i + G32W : -1);
    if (edge) { const M = g.mats[g.m[i]]; col[i] = (!opq(y < G32H - 1 ? i + G32W : -1) || !opq(xx < G32W - 1 ? i + 1 : -1)) ? M.r[0] : M.r[1]; } }
  for (let y = 0; y < G32H; y++) for (let xx = 0; xx < G32W; xx++) { const i = y * G32W + xx; let c2 = col[i], a = 255;
    if (!c2) { const n = opq(xx > 0 ? i - 1 : -1) || opq(xx < G32W - 1 ? i + 1 : -1) || opq(y > 0 ? i - G32W : -1) || opq(y < G32H - 1 ? i + G32W : -1); if (!n) continue; c2 = '#100a18'; }
    const [r, gg, b] = hexRgb(c2); D[i * 4] = r; D[i * 4 + 1] = gg; D[i * 4 + 2] = b; D[i * 4 + 3] = a; }
  x.putImageData(img, 0, 0); return c;
}

/* ---------- классы: материалы и части ---------- */
// head: шлем/капюшон/шляпа…; body: plate/robe/leather/gi/bare/cloak; legs: pants/robe; cols — цвета; extra — особые детали
const C32 = {
  war:    { skin: '#e8b48a', hair: '#7a4a2a', beard: 1, head: 'helm', body: 'plate', legs: 'pants', metal: '#a8b0c0', cloth: '#b03a3a', cloth2: '#5a3a2a', w: 'sword' },
  bers:   { skin: '#d89a70', hair: '#e8742a', beard: 2, head: 'horns', body: 'bare', legs: 'pants', metal: '#8a8a90', cloth: '#6a4a2a', cloth2: '#8a2a1a', fur: '#9a7a5a', w: 'axe' },
  pal:    { skin: '#f0c8a0', hair: '#e8c060', head: 'winghelm', body: 'plate', legs: 'pants', metal: '#e8e0c8', cloth: '#f4f0e0', cloth2: '#c8a040', w: 'hammer', emblem: 'cross' },
  guard:  { skin: '#d8a880', hair: '#4a3a2a', head: 'greathelm', body: 'plate', legs: 'pants', metal: '#7a8a9a', cloth: '#2a4a7a', cloth2: '#3a3a44', w: 'mace', shield: 1 },
  mage:   { skin: '#f0c8a0', hair: '#f4f4f4', beard: 3, head: 'wizhat', body: 'robe', legs: 'robe', metal: '#c8a040', cloth: '#7a3ac8', cloth2: '#4a2a8a', w: 'staff' },
  sham:   { skin: '#b07a50', hair: '#2a1a14', head: 'antler', body: 'leather', legs: 'pants', metal: '#8a7a5a', cloth: '#3a7a8a', cloth2: '#8a5a3a', fur: '#a08060', w: 'staff', paint: '#5ad0ff' },
  arch:   { skin: '#e8b48a', hair: '#8a5a2a', head: 'hood', body: 'leather', legs: 'pants', metal: '#9a8a6a', cloth: '#3a9a4a', cloth2: '#6a4a2a', w: 'bow', quiver: 1 },
  assa:   { skin: '#c89a78', hair: '#1a1420', head: 'maskhood', body: 'leather', legs: 'pants', metal: '#6a6a7a', cloth: '#3a3450', cloth2: '#20182c', w: 'dagger', eyes: '#ff4a6a' },
  gamb:   { skin: '#f0c8a0', hair: '#3a2418', head: 'tophat', body: 'coat', legs: 'pants', metal: '#c8a040', cloth: '#8a1a3a', cloth2: '#2a2030', w: 'rapier' },
  alch:   { skin: '#e8b48a', hair: '#c04a20', head: 'goggles', body: 'apron', legs: 'pants', metal: '#b08a40', cloth: '#5a7a3a', cloth2: '#7a5a3a', w: 'flask' },
  priest: { skin: '#f0d0b0', hair: '#e8d8a8', head: 'mitre', body: 'robe', legs: 'robe', metal: '#e0c060', cloth: '#f4f0e8', cloth2: '#c8a040', w: 'staff', emblem: 'cross' },
  monk:   { skin: '#e0a878', hair: '#2a1a14', head: 'bald', body: 'gi', legs: 'pants', metal: '#8a6a3a', cloth: '#e8822a', cloth2: '#8a3a1a', w: 'fist' },
  chrono: { skin: '#e8c8a8', hair: '#f0f0f0', head: 'clockhood', body: 'robe', legs: 'robe', metal: '#c8a040', cloth: '#2a5ab8', cloth2: '#1a2a6a', w: 'staff' },
  rune:   { skin: '#c8b0a0', hair: '#7ac0ff', head: 'circlet', body: 'plate', legs: 'pants', metal: '#5a6a8a', cloth: '#2a3a6a', cloth2: '#3a2a5a', w: 'runeblade', runes: '#7ad8ff' },
  necro:  { skin: '#a8b8a0', hair: '#1a2a1a', head: 'skullhood', body: 'robe', legs: 'robe', metal: '#c8c8b0', cloth: '#2a3a2a', cloth2: '#1a201a', w: 'staff', eyes: '#7affb0' },
  reap:   { skin: '#1a1020', hair: '#1a1020', head: 'reaphood', body: 'cloak', legs: 'robe', metal: '#c0c0d0', cloth: '#241a30', cloth2: '#14101c', w: 'scythe', eyes: '#ff44ff' },
};
// поза → точки скелета (в координатах тела 0..31)
function skel(P) {
  const l = P.lean || 0, c = P.crouch ? 2 : 0, L = l * 1.5;
  const S = { l, c, hx: 17 + L * 1.4, hy: 8 + c, tx: 16 + L * .7, ty0: 14 + c, ty1: 23 + c, hip: 23 + c };
  S.shF = [20 + L * .8, 15.5 + c]; S.shB = [12.5 + L * .8, 15.5 + c];
  const FEET = { idle: [[13, 31], [19, 31]], walk: [[10, 31], [22, 31]], walk2: [[14, 29], [18, 31]], walk3: [[13, 31], [20, 29]], lunge: [[9, 31], [23, 31]], jump: [[13, 28], [19, 27]] };
  S.feet = FEET[P.legs || 'idle'] || FEET.idle;
  return S;
}
const WREST32 = { sword: 35, axe: 150, hammer: 160, mace: 30, staff: 6, dagger: 70, rapier: 60, runeblade: 35, scythe: 10, bow: 0, flask: 0, fist: 0 };
// рука: угол руки зависит от оружия; в покое рука опущена, оружие поднято
const SHOULDER = {};   // тяжёлое оружие в покое лежит на плече
function armAng(P, w) { if (P.armA != null) return P.armA; if (!P.atk && SHOULDER[w]) return 35; if (!P.atk && P.ang == null) return w === 'bow' ? 120 : 165; if (!P.atk) return w === 'staff' ? 175 : 160; return P.ang; }

function drawHero32(k, form, P) {
  const C = C32[k] || C32.war, t = clamp(form, 1, 4), g = G32(), S = skel(P), w = C.w, cc = (CLASSES[k] || {}).c || '#ffd84a';
  const gold = '#e8b830', trim = t >= 3 ? gold : C.cloth2, metal = t >= 4 ? shade(cc, -.05) : t >= 3 ? C.metal : C.metal, armor = t >= 4 && C.body === 'plate' ? metal : C.metal;
  const robe = C.legs === 'robe', [fb, ff] = S.feet, hipB = [14.5 + S.l * .4, S.hip], hipF = [18 + S.l * .4, S.hip];
  // --- задний план: плащ, колчан, задняя рука и нога ---
  if (t >= 3 && !robe && C.body !== 'cloak' || C.body === 'cloak') { const cy0 = S.ty0, sway = P.legs && P.legs !== 'idle' ? -2 : 0;   // плащ за спиной
    const capeC = C.body === 'cloak' ? C.cloth : t >= 4 ? shade(cc, -.35) : C.cloth; gPoly(g, [[S.tx - 4.5, cy0 - .5], [S.tx + 2, cy0 - .5], [S.tx, 30], [S.tx - 6 + sway, 31], [S.tx - 10 + sway * 1.5, 29.5]], capeC, { b: -.2 }); }
  if (C.quiver) { gCap(g, S.tx - 5, S.ty0 + 1, S.tx - 2, S.ty0 + 8, 1.6, C.cloth2); for (let i = 0; i < 3; i++) gRaw(g, S.tx - 5 + i, S.ty0 - 1 - (i % 2), i === 1 ? '#ffffff' : '#c8c8c8'); }
  const aB = (P.armB != null ? P.armB : P.legs && P.legs !== 'idle' && !P.atk ? 180 + 30 * (P.legs === 'walk' ? 1 : -1) : 190) * Math.PI / 180, hB = [S.shB[0] + Math.sin(aB) * 6, S.shB[1] - Math.cos(aB) * 6];
  const sleeve = C.body === 'bare' || C.body === 'gi' ? C.skin : C.body === 'plate' ? armor : C.cloth;
  gCap(g, S.shB[0], S.shB[1], hB[0], hB[1], 1.7, sleeve, { metal: C.body === 'plate', b: -.3 }); gEll(g, hB[0], hB[1], 1.4, 1.4, C.skin, { b: -.3 });
  if (C.shield) { gEll(g, hB[0] - 1, hB[1] - 1, 4.2, 5.2, t >= 3 ? gold : armor, { metal: 1, b: -.1 }); gEll(g, hB[0] - .5, hB[1] - 1, 2.8, 3.8, C.cloth); gRaw(g, hB[0] - .5, hB[1] - 1, t >= 3 ? '#ffffff' : gold); }
  // ноги (задняя темнее)
  const boot = t >= 2 ? (C.body === 'plate' ? armor : C.cloth2) : '#4a3424', pants = C.body === 'gi' ? C.cloth : C.cloth2;
  const leg = (h, f, back) => { const kx = (h[0] + f[0]) / 2 + (P.crouch ? 1.5 : .6), ky = (h[1] + f[1]) / 2; gCap(g, h[0], h[1], kx, ky, 1.9, pants, { b: back ? -.3 : 0 }); gCap(g, kx, ky, f[0], f[1] - 1.5, 1.8, boot, { metal: boot === armor, b: back ? -.3 : 0 }); gEll(g, f[0] + 1, f[1] - .8, 2.2, 1.3, boot, { metal: boot === armor, b: back ? -.3 : 0 }); };
  if (!robe) leg(hipB, fb, true);
  // оружие за спиной (замах назад)
  const wa = P.ang != null ? P.ang : WREST32[w] ?? 30, aA = armAng(P, w), back = wa < -20 && wa > -200, aR = aA * Math.PI / 180, hand = [S.shF[0] + Math.sin(aR) * 6, S.shF[1] - Math.cos(aR) * 6];
  if (back) weapon32(g, C, k, t, hand, P, cc);
  // --- торс ---
  const tx = S.tx, y0 = S.ty0, y1 = S.ty1;
  if (robe) { const sw = P.legs === 'walk' || P.legs === 'lunge' ? 2 : 0; gPoly(g, [[tx - 4.5, y0], [tx + 4.5, y0], [tx + 7 + sw, 31], [tx - 7 - sw, 31]], C.cloth, { grad: .7 });   // мантия до пола
    gPoly(g, [[tx - 1, y0 + 2], [tx + 1.5, y0 + 2], [tx + 2.5, 31], [tx - 1.5, 31]], t >= 3 ? gold : C.cloth2, { flat: 1 });
    for (const f of [fb, ff]) gEll(g, f[0] + 1, 31.2, 2, 1, '#3a2a24'); }
  else if (C.body === 'bare') { gEll(g, tx, (y0 + y1) / 2, 5.2, 5.4, C.skin); gCap(g, tx - 4, y1 - 1, tx + 4, y1 - 1, 1.6, C.cloth); for (let i = -2; i <= 2; i += 2) gRaw(g, tx + i, y0 + 4 + Math.abs(i) / 2, shade(C.skin, -.25)); }
  else { const body = C.body === 'plate' ? armor : C.cloth; gPoly(g, [[tx - 5, y0], [tx + 5, y0], [tx + 4.5, y1], [tx - 4.5, y1]], body, { metal: C.body === 'plate' });
    if (C.body === 'plate') { gPoly(g, [[tx - 3, y0 + 1], [tx + 3, y0 + 1], [tx + 2, y0 + 6], [tx - 2, y0 + 6]], body, { metal: 1, b: .15 }); gPoly(g, [[tx - 3.5, y1 - 2], [tx + 3.5, y1 - 2], [tx + 4, y1 + 2], [tx - 4, y1 + 2]], C.cloth, {}); }
    if (C.body === 'coat') { gPoly(g, [[tx + 1, y0], [tx + 5, y0], [tx + 5.5, y1 + 3], [tx + 2, y1 + 3]], C.cloth, { b: .05 }); gPoly(g, [[tx - 1, y0], [tx + 1, y0], [tx + .5, y1], [tx - .5, y1]], '#e8e0d0', { flat: 1 }); }
    if (C.body === 'apron') gPoly(g, [[tx - 3.5, y0 + 3], [tx + 3.5, y0 + 3], [tx + 4, y1 + 3], [tx - 4, y1 + 3]], '#c8a878', { flat: 1 });
    if (C.body === 'gi') { gPoly(g, [[tx - 1, y0], [tx + 1, y0], [tx + 3, y0 + 5], [tx + 1, y0 + 5]], C.skin, { flat: 1 }); }
    if (C.body === 'leather' || C.body === 'cloak') gCap(g, tx - 4.5, y0 + 1, tx + 4.5, y1 - 2, .9, C.cloth2); }
  // пояс, эмблема, наплечники, отделка
  if (!robe && C.body !== 'bare') { gCap(g, tx - 4.5, y1 - 1, tx + 4.5, y1 - 1, 1.1, C.body === 'gi' ? C.cloth2 : '#5a3a24'); gRaw(g, tx + 1, y1 - 1, t >= 2 ? gold : '#c8a878'); gRaw(g, tx + 2, y1 - 1, t >= 2 ? '#fff2a8' : '#a08860'); }
  if (C.emblem && !robe) { gRaw(g, tx + 1, y0 + 3, gold); gRaw(g, tx + 1, y0 + 4, gold); gRaw(g, tx + 1, y0 + 5, gold); gRaw(g, tx, y0 + 4, gold); gRaw(g, tx + 2, y0 + 4, gold); }
  if (C.emblem && robe) { for (let i = 0; i < 4; i++) gRaw(g, tx + .5, y0 + 4 + i, gold); gRaw(g, tx - .5, y0 + 5, gold); gRaw(g, tx + 1.5, y0 + 5, gold); }
  if (C.runes) for (let i = 0; i < 3; i++) gRaw(g, tx - 2 + i * 2, y0 + 3 + (i % 2) * 3, t >= 3 ? '#ffffff' : C.runes);
  if (C.paint) { gRaw(g, tx - 2, y0 + 3, C.paint); gRaw(g, tx - 1, y0 + 4, C.paint); gRaw(g, tx + 2, y0 + 3, C.paint); gRaw(g, tx + 1, y0 + 4, C.paint); }
  if (C.fur && t >= 1) gEll(g, tx - 1, y0, 6, 2.2, C.fur, { b: .1 });
  if (t >= 2 && (C.body === 'plate' || C.body === 'leather' || C.body === 'coat')) { gEll(g, S.shB[0] - .5, S.shB[1] - .5, 3, 2.4, C.body === 'plate' ? armor : C.cloth2, { metal: C.body === 'plate', b: -.15 }); }
  if (t >= 3 && !robe && C.body !== 'bare') { gCap(g, tx - 4.8, y0, tx + 4.8, y0, .6, gold, { metal: 1 }); }
  if (t >= 3 && robe) { gCap(g, tx - 5, y0 + .5, tx + 5, y0 + .5, 1.2, gold, { metal: 1 }); }
  // передняя нога
  if (!robe) leg(hipF, ff, false);
  // --- голова ---
  drawHead32(g, C, k, t, S, cc, P);
  // передний наплечник поверх головы-шеи
  if (t >= 2 && (C.body === 'plate' || C.body === 'leather' || C.body === 'coat' || C.body === 'gi')) gEll(g, S.shF[0], S.shF[1] - .5, 3.2, 2.5, C.body === 'plate' ? armor : C.body === 'gi' ? C.cloth2 : C.cloth2, { metal: C.body === 'plate' });
  if (t >= 4 && C.body === 'plate') { gRaw(g, S.shF[0], S.shF[1] - 2, '#ffffff'); gRaw(g, S.shF[0] + 1, S.shF[1] - 1, cc); }
  // передняя рука и оружие
  const sleeveF = C.body === 'bare' || C.body === 'gi' ? C.skin : C.body === 'plate' ? armor : C.cloth;
  if (w !== 'bow' || P.atk) { gCap(g, S.shF[0], S.shF[1], hand[0], hand[1], 1.8, sleeveF, { metal: C.body === 'plate' }); }
  if (!back) weapon32(g, C, k, t, hand, P, cc);
  if (w === 'bow' && !P.atk) gCap(g, S.shF[0], S.shF[1], hand[0], hand[1], 1.8, sleeveF);
  gEll(g, hand[0], hand[1], 1.5, 1.5, C.skin);
  if (w === 'fist') { gEll(g, hand[0] + .5, hand[1], 2.3, 2.1, C.skin); gCap(g, hand[0] - 1.5, hand[1], hand[0] - .2, hand[1], 1.3, '#f4ecd8'); gEll(g, hB[0] + .3, hB[1], 2, 1.9, C.skin, { b: -.2 }); }
  return gRender(g);
}

function drawHead32(g, C, k, t, S, cc, P) {
  const hx = S.hx, hy = S.hy, eyes = C.eyes, ec = t >= 4 && eyes ? '#ffffff' : eyes;
  const hood = /hood/.test(C.head);
  // задняя часть причёски/капюшона
  if (hood) gEll(g, hx - 1, hy - .5, 7.6, 7.4, C.head === 'skullhood' ? C.cloth : C.cloth, { b: -.05 });
  if (C.head === 'reaphood') { gEll(g, hx - 1, hy, 8, 8, C.cloth, { b: -.1 }); gEll(g, hx + 1.5, hy + 1, 4.6, 5, '#06040a', { b: -2 }); gRaw(g, hx + 1, hy + 1, eyes); gRaw(g, hx + 3.5, hy + 1, eyes); if (t >= 3) { gRaw(g, hx + 1, hy, '#ffffff'); gRaw(g, hx + 3.5, hy, '#ffffff'); } return; }
  gEll(g, hx, hy, 6.4, 6, C.skin);   // голова-лицо (3/4 вправо)
  if (!hood && C.head !== 'greathelm') { const bald = C.head === 'bald';   // волосы: макушка и затылок, лицо открыто
    if (!bald) gEll(g, hx - .8, hy - 1.2, 6.9, 6.2, C.hair, { clip: (x, y) => y < hy - 2.2 + Math.max(0, hx - 2 - x) * .9 || x < hx - 3.6 });
    gEll(g, hx - 3.2, hy + 1, 1.3, 1.7, C.skin, { b: -.15 }); }   // ухо
  // глаза: передний крупный со бликом, задний узкий; брови, рот, румянец
  const ey = hy - .2, ex1 = hx + 2.6, ex2 = hx - .6;
  if (C.head !== 'greathelm') {
    const ecol = ec || '#1a1020';
    for (let i = 0; i < 3; i++) { gRaw(g, ex1, ey + i, ecol); gRaw(g, ex1 + 1, ey + i, ecol); gRaw(g, ex2, ey + i, ecol); }
    if (!eyes) { gRaw(g, ex1 + 1, ey, '#ffffff'); gRaw(g, ex1, ey + 2, '#3a3050'); } else if (t >= 3) { gRaw(g, ex1 + 1, ey, '#ffffff'); }
    if (!hood && C.head !== 'bald') { const bc = shade(C.hair === '#f4f4f4' || C.hair === '#f0f0f0' ? '#c8c8c8' : C.hair, -.25); gRaw(g, ex1, ey - 1.6, bc); gRaw(g, ex1 + 1, ey - 1.6, bc); gRaw(g, ex2, ey - 1.6, bc); }
    if (!C.beard && !/mask|skull/.test(C.head)) { gRaw(g, hx + 2.2, hy + 3.4, shade(C.skin, -.4)); gRaw(g, hx + 3.2, hy + 3.4, shade(C.skin, -.4)); }
    if (!eyes) { gRaw(g, ex1 + 2.2, hy + 2.2, '#f2957f'); gRaw(g, ex2 - 1, hy + 2.2, '#f2957f'); }
  }
  // борода
  if (C.beard === 1) { gEll(g, hx + 1.5, hy + 4.8, 4.4, 2.6, C.hair, { clip: (x, y) => y > hy + 3.3 }); gRaw(g, hx + 2.5, hy + 3.6, shade(C.skin, -.45)); }
  if (C.beard === 2) { gEll(g, hx + 1.5, hy + 5, 4.6, 3, C.hair, { clip: (x, y) => y > hy + 3.3 }); gCap(g, hx + 2, hy + 6.5, hx + 2.5, hy + 10, 1.2, C.hair); gRaw(g, hx + 2.5, hy + 3.6, shade(C.skin, -.45)); }
  if (C.beard === 3) { gPoly(g, [[hx - 1.5, hy + 3.2], [hx + 5.5, hy + 3.2], [hx + 3, hy + 13], [hx + .5, hy + 11]], C.hair, { b: .1 }); gCap(g, hx + .5, hy + 3, hx + 4.5, hy + 3, .6, C.hair); }
  // головной убор
  switch (C.head) {
    case 'helm': gEll(g, hx - .5, hy - 1.5, 7, 5.6, C.metal, { metal: 1, clip: (x, y) => y < hy - 1.5 || x < hx - 3.4 }); gCap(g, hx + 3.6, hy - 2, hx + 3.6, hy + 1.5, .7, C.metal, { metal: 1 });
      if (t >= 2) gCap(g, hx - 6.5, hy - 1, hx + 6.5, hy - 1, .8, t >= 3 ? '#e8b830' : C.metal, { metal: 1 });
      if (t >= 3) { gCap(g, hx - 1, hy - 7, hx - 6, hy - 9 + (P.legs && P.legs !== 'idle' ? 1 : 0), 1.3, C.cloth); }   // плюмаж
      if (t >= 4) { for (let i = -2; i <= 2; i += 2) gCap(g, hx + i, hy - 7, hx + i, hy - 10 + Math.abs(i) * .5, .6, '#ffd84a', { metal: 1 }); } break;   // корона
    case 'horns': gEll(g, hx - .5, hy - 2, 6.9, 5, C.metal, { metal: 1, clip: (x, y) => y < hy - 2 || x < hx - 3.6 }); const hl = t >= 3 ? 7 : 5;
      gCap(g, hx - 5, hy - 3, hx - 7.5, hy - 3 - hl, 1.2, '#e8e0c8'); gCap(g, hx + 4.5, hy - 3, hx + 7, hy - 3 - hl, 1.2, '#e8e0c8'); if (t >= 4) { gRaw(g, hx - 7.5, hy - 4 - hl, cc); gRaw(g, hx + 7, hy - 4 - hl, cc); } break;
    case 'winghelm': gEll(g, hx - .5, hy - 1.5, 7, 5.6, C.metal, { metal: 1, clip: (x, y) => y < hy - 1.5 || x < hx - 3.4 }); { const wl = t >= 3 ? 7 : 5; for (let i = 0; i < 4; i++) gCap(g, hx - 5, hy - 3 + i * 1.2, hx - 6 - wl + i * 1.2, hy - 7 - i * .6, .8, '#ffffff', { b: .2 }); }
      if (t >= 4) { for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; gRaw(g, hx + Math.cos(a) * 5, hy - 11 + Math.sin(a) * 1.4, '#ffe08a'); } } break;
    case 'greathelm': gEll(g, hx, hy - .5, 6.8, 6.8, C.metal, { metal: 1 }); gCap(g, hx + .5, hy + .5, hx + 6, hy + .5, .5, '#0c0814'); if (t >= 2) gRaw(g, hx + 3, hy + .5, t >= 4 ? cc : '#ffd84a');
      if (t >= 3) gCap(g, hx - 1, hy - 7, hx - 1, hy - 10, 1.4, C.cloth); if (t >= 4) gCap(g, hx - 1, hy - 10, hx - 4, hy - 12, 1, C.cloth); break;
    case 'wizhat': gEll(g, hx - .5, hy - 3.5, 8.5, 1.8, C.cloth, {}); gPoly(g, [[hx - 5, hy - 4], [hx + 4.5, hy - 4], [hx - 3 + (t >= 3 ? -2 : 0), hy - 15 - (t >= 3 ? 2 : 0)]], C.cloth, { grad: .3 });
      gCap(g, hx - 5, hy - 4.5, hx + 4.5, hy - 4.5, .7, t >= 2 ? '#e8b830' : C.cloth2); if (t >= 2) { gRaw(g, hx - 1, hy - 9, '#fff2a8'); gRaw(g, hx + 1, hy - 7, '#fff2a8'); } if (t >= 4) gRaw(g, hx - 5, hy - 17, cc); break;
    case 'antler': gEll(g, hx - .8, hy - 2.5, 7, 4.5, C.fur, { clip: (x, y) => y < hy - 2 || x < hx - 3.5 }); for (const s of [-1, 1]) { gCap(g, hx + s * 3, hy - 5, hx + s * 6, hy - 10, .8, '#e0d0b0'); gCap(g, hx + s * 5, hy - 8, hx + s * 8, hy - 9, .7, '#e0d0b0'); if (t >= 3) gCap(g, hx + s * 4, hy - 7, hx + s * 2, hy - 11, .6, '#e0d0b0'); }
      gRaw(g, hx + 4, hy + 1.5, C.paint); gRaw(g, hx - 1.6, hy + 1.5, C.paint); break;
    case 'hood': gEll(g, hx - .5, hy - 1.5, 7.2, 6.4, C.cloth, { clip: (x, y) => y < hy - 1 || x < hx - 3.5 }); gCap(g, hx - 6, hy - 3, hx - 9, hy + 1, 1.4, C.cloth, { b: -.2 }); if (t >= 3) gCap(g, hx - 6, hy - 1.5, hx + 6, hy - 3, .5, '#e8b830'); break;
    case 'maskhood': gEll(g, hx - .5, hy - 1.5, 7.2, 6.4, C.cloth, { clip: (x, y) => y < hy - 1 || x < hx - 3.5 }); gEll(g, hx + 1.5, hy + 3.5, 5, 2.8, C.cloth2, { clip: (x, y) => y > hy + 1.5 }); if (t >= 3) gCap(g, hx - 2, hy + 2, hx + 6, hy + 2, .4, cc); break;
    case 'tophat': gEll(g, hx, hy - 4, 8, 1.6, C.cloth2); gPoly(g, [[hx - 4, hy - 4], [hx + 4, hy - 4], [hx + 3.5, hy - 12], [hx - 3.5, hy - 12]], C.cloth2, { grad: .3 }); gCap(g, hx - 4, hy - 5.5, hx + 4, hy - 5.5, .7, C.cloth);
      if (t >= 3) { gRaw(g, hx + 2, hy - 6, '#ffffff'); gRaw(g, hx + 2, hy - 7, '#ff3a5a'); } if (t >= 4) for (let i = 0; i < 3; i++) gRaw(g, hx - 2 + i * 2, hy - 13, '#ffd84a'); break;
    case 'goggles': gCap(g, hx - 6, hy - 1.5, hx + 6, hy - 1.5, .7, '#4a3424'); gEll(g, hx + 3, hy - 1.5, 1.8, 1.6, C.metal, { metal: 1 }); gRaw(g, hx + 3, hy - 1.5, '#9ae0ff'); gEll(g, hx - .5, hy - 1.5, 1.6, 1.5, C.metal, { metal: 1 }); gRaw(g, hx - .5, hy - 1.5, '#9ae0ff');
      if (t >= 3) gRaw(g, hx + 3, hy - 2.5, '#ffffff'); break;
    case 'mitre': gEll(g, hx - .5, hy - 2.5, 6.6, 4, C.cloth, { clip: (x, y) => y < hy - 2 }); gPoly(g, [[hx - 4, hy - 4], [hx + 3.5, hy - 4], [hx + 2.5, hy - 10], [hx - .5, hy - 12.5], [hx - 3, hy - 10]], C.cloth, { grad: .4 }); for (let i = 0; i < 5; i++) gRaw(g, hx - .3, hy - 4.5 - i * 1.5, '#e8b830'); gRaw(g, hx - 1.3, hy - 8, '#e8b830'); gRaw(g, hx + .7, hy - 8, '#e8b830'); gCap(g, hx - 4.5, hy - 3.5, hx + 4, hy - 3.5, .6, '#e8b830', { metal: 1 });
      if (t >= 4) for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; gRaw(g, hx + Math.cos(a) * 5.5, hy - 17 + Math.sin(a) * 1.5, '#ffe08a'); } break;
    case 'bald': gCap(g, hx - 6, hy - 2.8, hx + 6, hy - 2.8, .8, t >= 3 ? '#e8b830' : '#c83a2a'); gCap(g, hx - 6, hy - 2.5, hx - 9, hy + .5, .6, t >= 3 ? '#e8b830' : '#c83a2a'); gRaw(g, hx - 2, hy - 4.5, '#ffffff'); break;
    case 'clockhood': gEll(g, hx - .5, hy - 1.5, 7.2, 6.4, C.cloth, { clip: (x, y) => y < hy - 1 || x < hx - 3.5 }); { const r = t >= 3 ? 3 : 2.2; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; gRaw(g, hx - 1 + Math.cos(a) * r, hy - 4 + Math.sin(a) * r, '#e8b830'); } gRaw(g, hx - 1, hy - 5, '#ffffff'); gRaw(g, hx, hy - 4, '#ffffff'); } break;
    case 'circlet': gCap(g, hx - 6, hy - 2.5, hx + 6, hy - 2.5, .6, C.metal, { metal: 1 }); gRaw(g, hx + 3, hy - 3, C.runes); if (t >= 3) { gRaw(g, hx, hy - 3, C.runes); gRaw(g, hx - 3, hy - 3, C.runes); } if (t >= 4) for (let i = 0; i < 3; i++) gCap(g, hx - 2 + i * 2, hy - 4, hx - 2 + i * 2, hy - 7 - (i % 2) * 2, .5, C.runes); break;
    case 'skullhood': gEll(g, hx - .5, hy - 1.5, 7.2, 6.6, C.cloth, { clip: (x, y) => y < hy - 1 || x < hx - 3.5 }); gEll(g, hx + 1.8, hy + .8, 3.6, 3.6, '#e8e8d8', {}); gRaw(g, hx + 1, hy + .5, '#0c0814'); gRaw(g, hx + 3.4, hy + .5, '#0c0814'); gRaw(g, hx + 1, hy + 1, eyes); gRaw(g, hx + 3.4, hy + 1, eyes);
      for (let i = 0; i < 3; i++) gRaw(g, hx + 1 + i, hy + 3.5, '#0c0814'); if (t >= 4) for (let i = 0; i < 3; i++) gCap(g, hx - 3 + i * 3, hy - 8, hx - 3 + i * 3 + 1, hy - 11, .7, '#7affb0', { b: .5 }); break;
  }
}

// оружие от руки по углу ang; ступень облика меняет размер и материал (IV — клинок цвета класса)
function weapon32(g, C, k, t, hand, P, cc) {
  const w = C.w, ang = P.ang != null ? P.ang : WREST32[w] ?? 30, th = ang * Math.PI / 180, dx = Math.sin(th), dy = -Math.cos(th), nx = Math.cos(th), ny = Math.sin(th), [hx, hy] = hand;
  const at = (d, o) => [hx + dx * d + nx * o, hy + dy * d + ny * o], ln = (d0, d1, r, col, o = {}) => { const [a, b] = at(d0, 0), [c, d] = at(d1, 0); gCap(g, a, b, c, d, r, col, o); };
  const steel = t >= 4 ? cc : t >= 3 ? '#e8eef8' : '#c8d0dc', grip = t >= 2 ? '#3a2418' : '#6a4a2a', gold = '#e8b830';
  switch (w) {
    case 'sword': case 'runeblade': { const L = 12 + t; ln(-2, 2, .9, grip); ln(2, 2, 2.6 + (t >= 3 ? .8 : 0), gold, { metal: 1 }); gCap(g, ...at(2, -2.6 - (t >= 3 ? .8 : 0)), ...at(2, 2.6 + (t >= 3 ? .8 : 0)), .8, gold, { metal: 1 });
      ln(3, 3 + L, 1.3, w === 'runeblade' ? '#5a7ab8' : steel, { metal: 1 }); const [ex, ey] = at(3 + L + 1, 0); gRaw(g, ex - G32X + G32X, ey, '#ffffff');
      if (w === 'runeblade') for (let i = 0; i < 3; i++) { const [rx, ry] = at(5 + i * 3, 0); gRaw(g, rx, ry, C.runes); }
      if (t >= 4) for (let i = 0; i < 4; i++) { const [rx, ry] = at(5 + i * 3, .6); gRaw(g, rx, ry, '#ffffff'); } break; }
    case 'axe': { const L = 11 + t, bw = 3.5 + t * .4; ln(-2, L, 1, grip); gPoly(g, [at(L - 4.5, .8), at(L + .5, .8), at(L + 2, bw), at(L - 1.5, bw + 1), at(L - 6, bw)], steel, { metal: 1 }); const [ex, ey] = at(L - 2, bw + .6); gRaw(g, ex, ey, '#ffffff');
      if (t >= 3) gPoly(g, [at(L - 3.5, -.8), at(L, -.8), at(L + 1, -bw * .7), at(L - 4.5, -bw * .7)], steel, { metal: 1 }); break; }
    case 'hammer': { const L = 10 + t, hw = 3 + t * .4, hh = 2.2 + t * .2; ln(-2, L + 1, 1, grip); gPoly(g, [at(L - hh, -hw), at(L + hh, -hw), at(L + hh, hw), at(L - hh, hw)], t >= 3 ? gold : steel, { metal: 1 }); gPoly(g, [at(L - hh - .2, -hw - .6), at(L + hh + .2, -hw - .6), at(L + hh + .2, -hw + .8), at(L - hh - .2, -hw + .8)], t >= 3 ? '#fff2a8' : '#e8eef8', { metal: 1 });
      if (t >= 4) { const [cx2, cy2] = at(L, 0); gRaw(g, cx2, cy2, cc); } break; }
    case 'mace': { const L = 8 + t; ln(-1, L, 1, grip); const [mx, my] = at(L + 1, 0); gEll(g, mx, my, 2.4 + t * .2, 2.4 + t * .2, steel, { metal: 1 }); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; gRaw(g, mx + Math.cos(a) * 3.3, my + Math.sin(a) * 3.3, '#e8e8f0'); } break; }
    case 'staff': { const L = 15 + t; ln(-6, L, .9, t >= 3 ? '#5a3a24' : '#7a5a34'); const [sx2, sy2] = at(L + 2, 0);
      if (k === 'mage') { gEll(g, sx2, sy2, 2.2 + t * .25, 2.2 + t * .25, cc, { b: .2 }); gRaw(g, sx2 - .5, sy2 - .8, '#ffffff'); }
      else if (k === 'sham') { for (const s of [-1, 1]) gCap(g, ...at(L - 1, 0), ...at(L + 3, s * 2.5), .7, '#e0d0b0'); gRaw(g, sx2, sy2, '#5ad0ff'); }
      else if (k === 'priest') { ln(L, L + 5, .8, gold, { metal: 1 }); gCap(g, ...at(L + 3, -2.2), ...at(L + 3, 2.2), .8, gold, { metal: 1 }); }
      else if (k === 'chrono') { for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; gRaw(g, sx2 + Math.cos(a) * (2.6 + t * .3), sy2 + Math.sin(a) * (2.6 + t * .3), gold); } gRaw(g, sx2, sy2, '#ffffff'); gRaw(g, sx2 + 1, sy2 - 1, '#ffffff'); }
      else if (k === 'necro') { gEll(g, sx2, sy2, 2.3, 2.1, '#e8e8d8'); gRaw(g, sx2 - .8, sy2, '#7affb0'); gRaw(g, sx2 + .8, sy2, '#7affb0'); } break; }
    case 'dagger': { ln(-1, 1, .8, grip); gCap(g, ...at(1.5, -1.6), ...at(1.5, 1.6), .6, gold, { metal: 1 }); ln(2, 7 + t, 1, steel, { metal: 1 }); if (k === 'assa') { const [ex, ey] = at(8 + t, 0); gRaw(g, ex, ey, '#ffffff'); } break; }
    case 'rapier': { ln(-1, 1, .8, grip); const [gx, gy] = at(1.5, 0); gEll(g, gx, gy, 1.8, 1.8, gold, { metal: 1 }); ln(2, 15 + t, .55, steel, { metal: 1 }); break; }
    case 'scythe': { const L = 16 + t; ln(-6, L, .9, '#3a2a24'); for (let i = 0; i <= 9 + t; i++) { const [bx, by] = at(L + 1 - i * i / (14 + t * 2), -i); gCap(g, bx, by, bx, by + .6, .8 + (i < 4 ? .5 : 0), t >= 3 ? '#e8e8f8' : '#b0b0c0', { metal: 1 }); }
      if (t >= 4) { const [bx, by] = at(L, -10); gRaw(g, bx, by, cc); } break; }
    case 'bow': { const pull = P.atk ? 3 : 0, R = 7 + t * .6; for (let i = -R; i <= R; i += .5) { const c2 = 3 - (i * i) / (R * R) * 3; gPut(g, hx + c2 + G32X + 1, hy + i + G32Y, gMat(g, t >= 3 ? '#8a5a2a' : '#7a5a34'), .5 + i / R * -.3); }
      for (let i = -R + 1; i <= R - 1; i += .5) gRaw(g, hx + 1 - pull * (1 - Math.abs(i) / R), hy + i, '#e8e8e8'); if (pull) { gCap(g, hx - pull, hy - .5, hx + 9, hy - .5, .3, '#c8a878'); gRaw(g, hx + 9, hy - .5, '#ffffff'); } break; }
    case 'flask': { const [fx, fy] = [hx + .5, hy - 2.5]; gEll(g, fx, fy, 2, 2.2, '#b6ff3c', { b: .1 }); gCap(g, fx, fy - 2, fx, fy - 3.5, .6, '#c8a878'); gRaw(g, fx - .6, fy - .8, '#ffffff'); break; }
    case 'fist': break;
  }
}

/* ---------- кэш кадров и вывод ---------- */
const HSC32 = .66;   // пиксель героя 32×32 в пикселях мира (герой ≈ 21 px мира ростом)
const G32FX = G32X + 16, G32FY = G32Y + 32;   // точка опоры (между ступнями) в сетке
// рука, держащая оружие, в координатах сетки — для шлейфов и вспышек
function hand32(k, P) { const C = C32[k] || C32.war, S = skel(P), a = armAng(P, C.w) * Math.PI / 180; return [G32X + S.shF[0] + Math.sin(a) * 6, G32Y + S.shF[1] - Math.cos(a) * 6]; }
const WLEN32 = { sword: 16, runeblade: 16, axe: 13, hammer: 12, mace: 12, staff: 17, dagger: 8, rapier: 16, scythe: 17, bow: 6, flask: 4, fist: 3 };
const wlen32 = (k, t) => (WLEN32[(C32[k] || C32.war).w] || 8) + t;
const h32C = new Map();
function hero32(k, form, P) {
  const key = k + form + '|' + (P.ang == null ? 'n' : P.ang) + (P.atk ? 'a' : '') + (P.lean || 0) + (P.crouch ? 'c' : '') + (P.legs || 'i') + (P.armB ?? '') + (P.armA ?? '');
  let c = h32C.get(key); if (c) return c; if (h32C.size > 900) h32C.clear(); c = drawHero32(k, form, P); h32C.set(key, c); return c; }
const sil32C = new WeakMap();
function sil32(cv, col) { let m = sil32C.get(cv); if (!m) sil32C.set(cv, m = {}); if (m[col]) return m[col]; const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return m[col] = c; }
// портрет для интерфейса: облик в стойке, обрезанный по содержимому
const port32C = new Map();
function heroPortrait(k, form) { const key = k + form; let c = port32C.get(key); if (c) return c; const src = hero32(k, form, { ang: null, atk: false, lean: 0, crouch: 0, legs: null });
  const x = src.getContext('2d'), d = x.getImageData(0, 0, src.width, src.height).data; let x0 = src.width, x1 = 0, y0 = src.height, y1 = 0;
  for (let y = 0; y < src.height; y++) for (let xx = 0; xx < src.width; xx++) if (d[(y * src.width + xx) * 4 + 3]) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cx = (G32X + 16), half = Math.max(cx - x0, x1 - cx) + 1; c = document.createElement('canvas'); c.width = half * 2; c.height = y1 - y0 + 1; c.getContext('2d').drawImage(src, cx - half, y0, half * 2, y1 - y0 + 1, 0, 0, half * 2, y1 - y0 + 1);
  port32C.set(key, c); return c; }
