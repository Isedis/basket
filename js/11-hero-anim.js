'use strict';
/* ---------- АНИМАЦИЯ ГЕРОЯ: позы атак, выпады, шлейфы оружия, реакция врагов ---------- */
// Чисто визуальный слой: урон, время атак и позиция героя в логике не меняются (баланс и SIM не трогаем).
// Каждая атака — короткий «ролик» HA длиной dur: замах → удар → доводка → возврат. Поза собирается из пиксельных кадров
// (pat16: угол оружия, наклон корпуса lean, присед crouch, ноги legs) + упругость при отрисовке (выпад ox, прыжок oy, сжатие sx/sy).
// Серии: обычные удары чередуются (косой сверху → обратный снизу → добивающий с прыжка), как hero.chain в логике.

const HA = { t0: -9, dur: .3, kind: '', ci: 0, n: 0 };
const ease = x => 1 - (1 - x) * (1 - x) * (1 - x), lerp = (a, b, t) => a + (b - a) * t;
// ключевые кадры: [[время, значение], …] → значение в момент p (кусочно, со сглаживанием)
function kf(K, p) { if (p <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (p <= K[i][0]) { const [t0, v0] = K[i - 1], [t1, v1] = K[i]; return lerp(v0, v1, ease((p - t0) / (t1 - t0 || 1))); } return K[K.length - 1][1]; }

// какой «ролик» у класса: ближний бой по оружию, дальний — бросок/выстрел/каст
const STAFF_CLS = { mage: 1, sham: 1, priest: 1, chrono: 1, necro: 1 };
function haKind(k, w, melee) {
  if (k === 'arch') return 'shoot';
  if (STAFF_CLS[k]) return 'cast';
  if (k === 'alch' || k === 'gamb') return 'throw';
  if (k === 'monk') return 'jab';
  if (!melee) return 'throw';
  if (k === 'bers' && hero.spin > 0) return 'spin';
  if (w === 'dagger' || w === 'rapier') return 'thrust';
  if (w === 'scythe') return 'sweep';
  if (w === 'hammer' || w === 'axe' || w === 'mace') return 'heavy';
  return 'slash';
}
// вызывается в начале атаки героя (heroAttack): запускает ролик, длина — от скорости атаки, но не короче 0.2 с
function haStart(t, d) {
  if (SIM) return;
  const k = cls(), w = H16[k].w.t, melee = d <= MELEE, kind = haKind(k, w, melee), aps = Math.max(.5, D.aps || 1);
  const p = (time - HA.t0) / HA.dur;
  if (p < .35 && HA.kind === kind && kind !== 'spin') return;   // предыдущий удар ещё в замахе — не дёргаем
  HA.kind = kind; HA.t0 = time; HA.n++;
  HA.ci = kind === 'slash' || kind === 'heavy' || kind === 'thrust' || kind === 'jab' || kind === 'sweep' ? hero.chain % 3 : HA.n % 3;
  HA.dur = clamp(1 / aps, .2, kind === 'heavy' ? .46 : kind === 'cast' ? .42 : .38) * (HA.ci === 2 ? 1.25 : 1);
  HA.tx = t.x; HA.ty = t.y;
}
const haOn = () => time - HA.t0 < HA.dur;

// поза героя на этот кадр: { ang, atk, lean, crouch, legs, ox, oy, sx, sy, smear }
let haPoseC = null, haPoseT = -1;
function haPose(k, w) {
  if (haPoseT === time && haPoseC) return haPoseC; haPoseT = time;
  const r = WREST[w] ?? 30, P = { ang: null, atk: false, lean: 0, crouch: 0, legs: null, ox: 0, oy: 0, sx: 1, sy: 1, smear: null, glowTip: 0, fist: 0, flash: 0, rune: 0 };
  // бег: 4 кадра ног по пройденному пути, корпус чуть вперёд, на опорных шагах — присед (покачивание)
  const run = heroFrame === 'walk' || heroFrame === 'walk2', rf = Math.floor((hero.runD || 0) / 2.6) % 4;
  if (run) { P.legs = ['walk', 'walk2', 'walk', 'walk3'][rf]; P.crouch = rf % 2 ? 0 : 1; P.lean = 1; }
  else if (heroFrame === 'breath') { P.crouch = 1; }
  if (!haOn()) {
    if (hero.hurt > 0) { P.lean = -1; P.ox = -1.2; P.sx = .96; P.sy = 1.03; }
    if (w !== 'bow' && w !== 'flask' && w !== 'fist') P.ang = r + Math.sin(time * 2.2) * (run ? 10 : 5);   // оружие покачивается
    return haPoseC = P;
  }
  const p = (time - HA.t0) / HA.dur, ci = HA.ci; P.atk = true;
  switch (HA.kind) {
    case 'slash': case 'heavy': {
      const hv = HA.kind === 'heavy' ? .06 : 0;   // тяжёлое оружие: замах дольше
      if (ci === 2) {   // добивающий: прыжок, оружие над головой, удар в землю, приземление со сжатием
        P.ang = kf([[0, r], [.3 + hv, -15], [.48 + hv, 165], [.75, 150], [1, r]], p);
        P.oy = -kf([[0, 0], [.28 + hv, 7], [.46 + hv, 0], [1, 0]], p); P.legs = p < .46 + hv ? 'jump' : p < .8 ? 'lunge' : P.legs;
        P.lean = Math.round(kf([[0, 0], [.3, -1], [.48, 2], [.8, 1], [1, 0]], p)); P.ox = kf([[0, 0], [.46 + hv, 5], [.8, 4], [1, 0]], p);
        if (p > .46 + hv && p < .62 + hv) { const q = (p - .46 - hv) / .16; P.sx = 1 + .2 * (1 - q); P.sy = 1 - .16 * (1 - q); P.crouch = 1; }
        if (p > .3 + hv && p < .7) P.smear = { a0: -15, a1: P.ang, k: 1.3, al: p < .55 ? 1 : (.7 - p) / .15, gold: 1 };
      } else if (ci === 1) {   // обратный удар снизу вверх
        P.ang = kf([[0, r], [.22 + hv, 160], [.44 + hv, -20], [.7, -30], [1, r]], p);
        P.lean = Math.round(kf([[0, 0], [.22, 1], [.44, 2], [.75, 0], [1, 0]], p)); P.crouch = p > .12 && p < .35 ? 1 : 0;
        P.ox = kf([[0, 0], [.44 + hv, 3.5], [.75, 2.5], [1, 0]], p); P.legs = p > .25 && p < .8 ? 'lunge' : P.legs;
        if (p > .22 + hv && p < .62) P.smear = { a0: 160, a1: P.ang, k: 1, al: p < .48 ? 1 : (.62 - p) / .14 };
      } else {   // косой сверху
        const wu = hv ? -10 : -35; P.ang = kf([[0, r], [.22 + hv, wu], [.44 + hv, 145], [.7, 130], [1, r]], p);
        P.lean = Math.round(kf([[0, 0], [.22, -1], [.44, 2], [.75, 1], [1, 0]], p)); P.crouch = p > .35 && p < .6 ? 1 : 0;
        P.ox = kf([[0, 0], [.22, -1], [.44 + hv, 4], [.75, 3], [1, 0]], p); P.legs = p > .3 && p < .8 ? 'lunge' : P.legs;
        if (p > .22 + hv && p < .62) P.smear = { a0: wu, a1: P.ang, k: 1, al: p < .48 ? 1 : (.62 - p) / .14 };
        if (HA.kind === 'heavy' && p > .44 + hv && p < .56 + hv) { P.sx = 1.1; P.sy = .92; }
      }
      break; }
    case 'thrust': {   // укол: отвести руку → рывок вперёд всем телом → вернуть
      const flurry = ci === 2, q = flurry ? (p * 3) % 1 : p, base = ci === 1 ? 105 : 90;
      P.ang = kf([[0, r], [.25, base - 20], [.42, base], [.75, base], [1, r]], q);
      P.ox = kf([[0, 0], [.25, -1.5], [.42, flurry ? 4 : 6], [.7, 4], [1, 0]], q); P.lean = Math.round(kf([[0, 0], [.25, -1], [.42, 2], [.75, 1], [1, 0]], q));
      P.legs = q > .3 && q < .85 ? 'lunge' : P.legs; P.crouch = q > .35 && q < .6 ? 1 : 0;
      if (q > .3 && q < .6) P.smear = { line: 1, a0: base, al: q < .45 ? 1 : (.6 - q) / .15 };
      break; }
    case 'sweep': {   // коса: широкий горизонтальный взмах почти по кругу
      P.ang = kf([[0, r], [.25, -75], [.55, 175], [.75, 165], [1, r]], p); P.lean = Math.round(kf([[0, 0], [.25, -1], [.55, 2], [1, 0]], p));
      P.ox = kf([[0, 0], [.55, 3], [1, 0]], p); P.legs = p > .3 && p < .85 ? 'lunge' : P.legs; P.crouch = p > .4 && p < .7 ? 1 : 0;
      if (p > .25 && p < .72) P.smear = { a0: -75, a1: P.ang, k: 1.2, al: p < .58 ? 1 : (.72 - p) / .14 };
      break; }
    case 'spin': {   // вихрь берсерка: два оборота, присед, круговой шлейф
      P.ang = (p * 720) % 360; P.crouch = 1; P.sx = 1.06; P.sy = .95; P.legs = 'lunge';
      P.smear = { a0: P.ang - 160, a1: P.ang, k: 1.1, al: Math.min(1, (1 - p) * 3) }; break; }
    case 'cast': {   // посох: подъём вперёд-вверх, свечение на навершии, руны под ногами, вспышка выстрела
      P.ang = kf([[0, r], [.45, 62], [.55, 82], [.8, 70], [1, r]], p); P.lean = Math.round(kf([[0, 0], [.45, -1], [.55, 1], [1, 0]], p));
      P.glowTip = p < .5 ? p / .5 : Math.max(0, 1 - (p - .5) / .3); P.flash = p > .48 && p < .62 ? 1 - (p - .48) / .14 : 0; P.rune = Math.min(1, p * 3) * (1 - Math.max(0, (p - .7) / .3));
      P.ox = kf([[0, 0], [.5, 0], [.58, -1], [1, 0]], p); if (p > .5 && p < .6) { P.sx = .96; P.sy = 1.04; }
      break; }
    case 'shoot': {   // лук: натяжение (тетива назад, корпус назад) → выстрел с отдачей
      P.atk = p < .55; P.lean = Math.round(kf([[0, 0], [.5, -1], [.6, 0], [1, 0]], p)); P.crouch = p > .2 && p < .55 ? 1 : 0;
      P.ox = kf([[0, 0], [.55, 0], [.62, -2], [1, 0]], p); P.flash = p > .55 && p < .68 ? 1 - (p - .55) / .13 : 0; P.legs = p > .1 && p < .7 ? 'lunge' : P.legs;
      break; }
    case 'throw': {   // бросок: рука назад → резкий выброс вперёд
      P.ang = w === 'bow' || w === 'flask' || w === 'fist' ? null : kf([[0, r], [.35, -60], [.5, 120], [.75, 100], [1, r]], p);
      P.lean = Math.round(kf([[0, 0], [.35, -1], [.5, 2], [.8, 0], [1, 0]], p)); P.crouch = p > .2 && p < .45 ? 1 : 0;
      P.ox = kf([[0, 0], [.35, -1], [.5, 2.5], [1, 0]], p); P.legs = p > .3 && p < .8 ? 'lunge' : P.legs; P.fist = w === 'flask' && p > .38 && p < .6 ? 1 : 0;
      if (P.ang != null && p > .35 && p < .62) P.smear = { a0: -60, a1: P.ang, k: .8, al: (.62 - p) / .27 };
      break; }
    case 'jab': {   // кулаки: правый, левый, апперкот с подскоком
      const up = ci === 2; P.fist = kf([[0, 0], [.25, 0], [.42, 1], [.65, 1], [1, 0]], p) * (ci === 1 ? -1 : 1);
      P.lean = Math.round(kf([[0, 0], [.25, -1], [.42, 2], [.75, 1], [1, 0]], p)); P.ox = kf([[0, 0], [.42, up ? 2 : 3.5], [.75, 2], [1, 0]], p);
      P.legs = p > .3 && p < .8 ? 'lunge' : P.legs; if (up) P.oy = -kf([[0, 0], [.4, 0], [.55, 4], [.8, 0], [1, 0]], p); P.up = up;
      break; }
  }
  if (P.ang != null) P.ang = Math.round(P.ang / 15) * 15;
  return haPoseC = P;
}

/* шлейф оружия на чётком слое: сплошная дуга из пикселей героя, яркая у острия, гаснет к хвосту */
function haWeaponLen(k) { const w = H16[k].w, tier = Math.min(4, shownForm(k)); return (w.h || 0) + (w.b || 0) + 1 + Math.min(3, tier - 1) + (w.t === 'staff' || w.t === 'scythe' ? 0 : w.t === 'hammer' || w.t === 'axe' || w.t === 'mace' ? 2 : 0); }
function haSmear(px0, py0, hk, sm, k) {
  const len = haWeaponLen(k), cc = CL().c, tier = shownForm(k), edge = sm.gold ? '#ffe08a' : tier >= 4 ? cc : '#d8ecff';
  fctx.save();
  if (sm.line) {   // укол: прямой след вперёд
    const th = sm.a0 * Math.PI / 180, dx = Math.sin(th), dy = -Math.cos(th);
    for (let t = 2; t <= len + 6; t++) { const a = sm.al * (t / (len + 6)); fctx.globalAlpha = .75 * a; fctx.fillStyle = t > len + 2 ? '#ffffff' : edge;
      for (const o of [-1, 0, 1]) fctx.fillRect(Math.round(px0 + (dx * t - dy * o * .8) * hk), Math.round(py0 + (dy * t + dx * o * .8) * hk), hk, hk); }
    fctx.restore(); return; }
  const a0 = sm.a0, a1 = sm.a1, dir = a1 >= a0 ? 1 : -1, span = Math.abs(a1 - a0); if (span < 8) { fctx.restore(); return; }
  // чёткая дуга по пути острия: полоса 1–3 пикселя, у острия белая и толстая, к хвосту тоньше и прозрачнее
  const rOut = len * (sm.k || 1) + 1, step = Math.max(1.5, 50 / rOut);
  for (let a = 0; a <= span; a += step) {
    const u = a / span, th = (a0 + dir * a) * Math.PI / 180, sn = Math.sin(th), cs = -Math.cos(th), wdt = u > .7 ? 3 : 2;
    for (let j = 0; j < wdt; j++) { const rr = rOut - j; fctx.globalAlpha = sm.al * (.4 + .6 * u) * (j ? .75 : 1);
      fctx.fillStyle = j === 0 && u > .55 ? '#ffffff' : edge; fctx.fillRect(Math.round(px0 + sn * rr * hk), Math.round(py0 + cs * rr * hk), hk, hk); }
  }
  fctx.restore();
}

/* следы разрезов и искры на врагах */
let slashes = [];
function haHit(t, crit) {   // из heroStrike: на враге вспыхивает разрез по направлению удара, искры летят от героя
  if (SIM || S.fxLow) return;
  const dx = t.x - hero.x, dy = t.y - hero.y, d = Math.hypot(dx, dy) || 1, ci = HA.ci, base = HA.kind === 'thrust' ? 0 : ci === 1 ? -.9 : ci === 2 ? 1.57 : .8;
  if (slashes.length < 14) slashes.push({ x: t.x, y: t.y - 4 * t.sz, a: Math.atan2(dy, dx) + base, L: 6 + 3 * t.sz + (crit ? 4 : 0), t: 0, c: crit ? '#ffdd33' : CL().c, crit });
  if (parts.length < 450) for (let i = 0; i < (crit ? 7 : 3); i++) { const a = Math.atan2(dy, dx) + (rnd() - .5) * 1.1, v = 40 + rnd() * 50; parts.push({ x: t.x, y: t.y - 4 * t.sz, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, l: .2 + rnd() * .2, c: rnd() < .5 ? '#ffffff' : crit ? '#ffdd33' : CL().c }); }
}
function slashTick(dt) { for (const s of slashes) s.t += dt; slashes = slashes.filter(s => s.t < .16); }
function drawSlashes() {
  for (const s of slashes) { const f = s.t / .16, L = s.L * (f < .3 ? f / .3 : 1), cs = Math.cos(s.a), sn = Math.sin(s.a), off = f > .3 ? (f - .3) / .7 * s.L : 0;
    ctx.globalAlpha = 1 - f * .7;
    for (let i = -L / 2 + off / 2; i <= L / 2; i++) { const x = s.x + cs * i, y = s.y + sn * i; pix(x, y, '#ffffff'); ctx.globalAlpha = (1 - f) * .7; pix(x - sn, y + cs, s.c); ctx.globalAlpha = 1 - f * .7; }
    if (s.crit && f < .4) glow(s.x, s.y, '#ffdd33', 6, .6 * (1 - f / .4)); }
  ctx.globalAlpha = 1;
}

/* бег: путь для кадров ног и пыль из-под ног */
function haRunTick(dt) {
  const mv = Math.hypot(hero.x - (hero.rlx ?? hero.x), hero.y - (hero.rly ?? hero.y)); hero.rlx = hero.x; hero.rly = hero.y;
  hero.runD = (hero.runD || 0) + mv;
  if (!SIM && mv > .25 && time > (hero.dustT || 0)) { hero.dustT = time + .2; puff(hero.x - hero.face * 3, hero.y, 2.2, '#8a7a6a', 1); }
}

/* дополнительные элементы позы на чётком слое: кулак, свечение навершия, руны под ногами, вспышка лука */
function haExtras(P, cx, X, Y, PW, PH, hk, k) {
  const px0 = cx + (5.5 + P.lean) * hk, py0 = Y + (PH - 3.5 + (P.crouch ? 1 : 0)) * hk, cc = CL().c;
  if (P.smear) haSmear(px0, py0, hk, P.smear, k);
  if (P.fist) {   // вытянутый кулак (монах) / рука с колбой (алхимик)
    const ext = Math.abs(P.fist) * 4, fy = py0 + (P.fist < 0 ? -2 : 0) * hk - (P.up ? 3 * Math.abs(P.fist) * hk : 0), fx0 = px0 + ext * hk;
    fctx.fillStyle = '#0c0814'; fctx.fillRect(Math.round(fx0 - hk), Math.round(fy - 2 * hk), 4 * hk, 4 * hk);
    fctx.fillStyle = k === 'alch' ? '#b6ff3c' : '#f0c090'; fctx.fillRect(Math.round(fx0), Math.round(fy - hk), 2 * hk, 2 * hk);
    if (Math.abs(P.fist) > .8 && k === 'monk') { fctx.globalAlpha = .6; fctx.fillStyle = '#ffffff'; for (let i = 1; i <= 3; i++) fctx.fillRect(Math.round(fx0 - i * 2 * hk), Math.round(fy - hk / 2), hk, hk); fctx.globalAlpha = 1; } }
  if (P.glowTip > 0 || P.flash > 0) {   // навершие посоха
    const len = haWeaponLen(k) + 1, th = (P.ang ?? 60) * Math.PI / 180, tx = px0 + Math.sin(th) * len * hk, ty = py0 - Math.cos(th) * len * hk, L = Math.round(1 + 2 * P.glowTip + 4 * P.flash);
    fctx.save(); fctx.globalCompositeOperation = 'lighter';   // искра-крест на навершии: растёт при касте, вспыхивает при выстреле
    for (let i = -L; i <= L; i++) { const a = (1 - Math.abs(i) / (L + 1)) * (.5 + .5 * P.flash); fctx.globalAlpha = a; fctx.fillStyle = Math.abs(i) < 2 ? '#ffffff' : cc;
      fctx.fillRect(Math.round(tx + i * hk - hk / 2), Math.round(ty - hk / 2), hk, hk); if (i) fctx.fillRect(Math.round(tx - hk / 2), Math.round(ty + i * hk - hk / 2), hk, hk); }
    fctx.restore(); }
  if (P.flash > 0 && HA.kind === 'shoot') { const tx = px0 + 3 * hk, ty = py0 - hk; fctx.save(); fctx.globalCompositeOperation = 'lighter'; fctx.globalAlpha = .7 * P.flash; fctx.fillStyle = '#ffffff';
    fctx.fillRect(Math.round(tx), Math.round(ty - hk / 2), Math.round(6 * hk * P.flash), hk); fctx.fillRect(Math.round(tx + 2 * hk), Math.round(ty - 2 * hk), hk, 4 * hk); fctx.restore(); }
}
// руны под ногами при касте (мировые координаты → чёткий слой)
function haRunes(P, k2, sx, sy) {
  if (!P.rune) return; const cx = (hero.x - camX + sx) * k2, cy = (hero.y - camY + sy) * k2, R = 9 * k2, n = 18, cc = CL().c, s = Math.max(1, Math.round(k2 * .6));
  fctx.save(); fctx.globalAlpha = .7 * P.rune;
  for (let i = 0; i < n; i++) { const a = i / n * 6.283 + time * 2; fctx.fillStyle = i % 3 ? cc : '#ffffff'; fctx.fillRect(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R * .4), s, s); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 - time * 3; fctx.fillStyle = '#ffffff'; fctx.fillRect(Math.round(cx + Math.cos(a) * R * .6), Math.round(cy + Math.sin(a) * R * .24), s, s); }
  fctx.restore();
}
