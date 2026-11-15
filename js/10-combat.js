'use strict';
/* ---------- мобы ---------- */
let mobId = 0;
function spawnMob(boss) {
  const b = biomeOf(S.zone);
  const k = Math.floor(rnd() * b.m.length);
  const t = b.m[k], M = MOBS[t];
  const side = Math.floor(rnd() * 4);
  let x, y;
  if (!boss && hordeC() > 0 && rnd() < .85) {   // орда: стая выходит сразу за краем видимого экрана
    const a = packA + (rnd() - .5) * 1.1, c = Math.cos(a), sn = Math.sin(a), m = 6 + rnd() * 10;
    if (Math.abs(c) * H > Math.abs(sn) * W) { x = c > 0 ? camX + W + m : camX - m; y = camY + H / 2 + sn / Math.abs(c) * H / 2 + (rnd() - .5) * 20; }
    else { y = sn > 0 ? camY + H + m : camY - m + 4; x = camX + W / 2 + c / Math.abs(sn) * W / 2 + (rnd() - .5) * 20; }
    x = clamp(x, 2, AW - 2); y = clamp(y, 7, AH - 1);
  } else { const a = rnd() * 6.2832, rr = Math.hypot(W, H) * .55 + 4 + rnd() * 12; x = clamp(hero.x + Math.cos(a) * rr, 2, AW - 2); y = clamp(hero.y + Math.sin(a) * rr, 7, AH - 1); }
  const rare = !boss && (S.forceRare > 0 ? (S.forceRare--, true) : rnd() < D.rare * (S.zmod === 'night' ? 2.5 : S.zmod === 'gold' ? 3 : 1));
  const af = rollAff(boss, ev && ev.type === 'elite' && !boss ? 2 + Math.floor(rnd() * 2) : 0), na = popc(af);
  const hp = zoneHP(S.zone) * (.85 + rnd() * .3) * M.hp * (rare ? 3 : 1) * (boss ? bossMult(S.zone) : 1) * (1 + .6 * na) * (af & 32 ? 3 : 1) * (on('x_greed') ? 1.3 : 1) * (boss ? 1 - (S.siege || 0) : 1) * skyHpM() * Math.sqrt(threatM());
  mobs.push({ t, x, y, h: b.h[k % b.h.length] + (rnd() - .5) * 20, hp, max: hp, rare, boss, sz: boss ? 2 : af & 32 ? 1.5 : 1, af, na,
    sp: 14 * M.s * (S.zone > 50 && skyOn('sk_wslow') ? .75 : 1) * (boss ? .7 : 1) * (af & 2 ? 1.8 : 1) * (.85 + rnd() * .3), dm: M.dm * (boss ? 2 * (isLegend(S.zone) ? 1.5 : 1) : 1) * (rare ? 1.5 : 1),
    cd: 1, fl: 0, kx: 0, ky: 0, psn: 0, psnT: 0, dead: false, id: ++mobId });
  { const nm = mobs[mobs.length - 1]; if (!boss && hordeC() > 0) { nm.hw = spawnMob.hw ?? 1; if (HK > 0) { nm.hp *= HHP; nm.max *= HHP; } nm.sp *= 1 + .4 * hordeC(); }
    if (!boss && S.zmod === 'giant') { nm.hp *= 2; nm.max *= 2; nm.sz *= 1.3; }
    if (!boss && S.zmod === 'swarm') { nm.hp *= .5; nm.max *= .5; }
    if (S.zmod === 'fast') nm.sp *= 1.5;
    if (ev && ev.type === 'moon') { nm.hp *= 1.5; nm.max *= 1.5; }
    if (!boss) { const role = rollRole(); if (role) { nm.role = role; if (!seenRole[role]) { seenRole[role] = 1; nm.lblUntil = time + 4; } if (role === 'bomber') nm.sp *= 1.8; if (role === 'thief') nm.sp *= 1.5; if (role === 'charger') { nm.hp *= 1.4; nm.max *= 1.4; } if (role === 'shield') { nm.hp *= 1.5; nm.max *= 1.5; }
      tip('roles', 'Роли врагов', 'Значок над врагом: жёлтый — лучник, зелёный — шаман (лечит, бей первым), синий — щитоносец, красный — камикадзе, фиолетовый — призыватель. Позже: вор крадёт души (догони — вернёт вдвое), таран бьёт с разбега, паук замедляет паутиной, берсерк звереет от смертей рядом.'); } } }
  if (na && !boss) tip('aff', 'Особые враги', 'Цветные точки над врагом — его особенности: броня, скорость, взрыв, вампиризм. Такие враги дают больше наград.');
  if (!boss) worldMob(mobs[mobs.length - 1]);
  if (!boss && na >= 2 && ksL(5, 0)) { const me = mobs[mobs.length - 1]; me.ws = { ox: 0, oy: -6, t: 0 }; moveWS(me); }
  if (boss) {
    const mm = mobs[mobs.length - 1]; mm.ws = { ox: 0, oy: -6, t: 0 }; moveWS(mm);
    if (S.zone === 50 && !S.meta.guard) makeGuardian(mm);
    worldMob(mm);
    if (S.siege > 0) feed('Осада: вожак уже ранен на ' + pct(S.siege), '#aabbcc');
    bossAlive = true; bossT = BOSS_TIME + ta('boss_t'); S.tries = (S.tries || 0) + 1;
    if (!mm.guard && !mm.titan) toast((isLegend(S.zone) ? 'ЛЕГЕНДА: ' : 'ВОЖАК: ') + M.n.toUpperCase() + '!', (na ? affNames(af) + ' · ' : '') + 'тапай по слабому месту!');
    sfx.boss(); shake = 6;
    tip('weak', 'Слабое место', 'Жёлтая мигающая точка на вожаке — тапай по ней: ×12 урона. У вожака 30 секунд, иначе отступление.');
  }
}
function spawnMini(m) {
  for (let i = 0; i < 2; i++) {
    const hp = m.max * .3;
    mobs.push({ t: m.t, x: m.x + (rnd() - .5) * 6, y: m.y + (rnd() - .5) * 4, h: m.h, hp, max: hp, rare: false, boss: false, sz: .75, af: 0, na: 0, mini: true,
      sp: m.sp * 1.2, dm: m.dm * .4, cd: .8, fl: 0, kx: (rnd() - .5) * 70, ky: (rnd() - .5) * 70, psn: 0, psnT: 0, dead: false });
  }
}
function explode(m) {
  const r = 14 * Math.max(1, m.sz);
  burst(m.x, m.y - 3, '#ff6622', 26, 55); burst(m.x, m.y - 3, '#ffdd44', 12, 40);
  shake = Math.max(shake, 4); sfx.boom();
  for (const o of mobs) if (!o.dead && o !== m && Math.hypot(o.x - m.x, o.y - m.y) < r) hitMob(o, D.hit * 1.5, false, false, '#ff6622');
  if (Math.hypot(hero.x - m.x, hero.y - m.y) < r && rnd() >= D.dodge) {
    const dmg = zoneDmg(S.zone) * m.dm * 1.5 * (1 - D.armor);
    const dd = hurtHero(dmg, false, .15); ftext(hero.x, hero.y - 10, '-' + fmt(dd), '#ff6622', .9, .7);
  }
}
function splat(m) {
  if (SIM) return;
  if (S.fxLow) return;
  const g = decal.getContext('2d'), n = m.boss ? 40 : 8 * m.sz;
  g.fillStyle = shade(m.rare ? '#ffd84a' : hsl2hex(m.h, 55, 48), -.45);
  for (let i = 0; i < n; i++) { g.globalAlpha = .4 + rnd() * .4; g.fillRect(Math.round(m.x + (rnd() - .5) * 9 * m.sz), Math.round(m.y - 1 + (rnd() - .5) * 5 * m.sz), 1, 1); }
  g.globalAlpha = 1;
}
// Орда: если герой сильно перерос зону, врагов на поле становится больше (до +70, за 50-й зоной до +110); награда и прогресс за каждого — меньше
let HK = 0, HHP = 1, hkT = 0, packA = 0, packT = 0;
// HHP — прочность врагов орды: съедает большую часть перевеса, чтобы толпа успевала набегать
function hordeK() { if (S.zone < 12) { HHP = 1; return 0; } const dps = D.hit * D.aps * (1 + D.crit * ((D.critM || 2) - 1)), ov = Math.max(1, dps / (zoneHP(S.zone) * 4)), k = clamp(Math.log10(ov) / 1.5, 0, 1); HHP = ov > 1.6 ? Math.pow(ov / 1.6, k) : 1; return k; }
function hordeC() { return S.zone < 12 ? 0 : Math.max(HK, clamp((S.zone - 12) / 38, 0, 1) * .7); }   // численность: у стены толпа остаётся и давит
function hordeAdd() { return Math.round(hordeC() * (S.zone > 50 ? 190 : 140)); }
function crowd() { return Math.min(45, Math.round(crowd0() * .75 * skyCrowdM())); }   // спокойнее: меньше врагов на поле   // не больше 70 врагов на поле
function crowd0() { return Math.min(4 + Math.floor(S.zone / 2), 36) + Math.floor(ta('crowd')) + Math.floor(ta('x_swarm')) + (S.zmod === 'swarm' ? Math.min(30, 4 + Math.floor(S.zone / 2)) : 0) + (D.horde || 0); }

let deathT = 0;
function heroDeath(force) {   // force — «Завершить жизнь»: без пера феникса и прочих воскрешений
  if (!force && deathT <= 0 && (S.phx || 0) < (trHas('phoenix') ? 1 : 0) + (skyOn('sk_phx') ? 1 : 0)) { S.phx = (S.phx || 0) + 1; hero.hp = D.maxHP * .5; hero.iframe = 2.5; ring(hero.x, hero.y - 4, 26, '#ff9a3c'); burst(hero.x, hero.y - 6, '#ff9a3c', 40, 70); toast('ПЕРО ФЕНИКСА!', 'герой восстал · раз за жизнь', 2200); [392, 523, 784].forEach((f, i) => tone(f, .2, 'triangle', .05, 0, i * .1)); return; }
  hero.hp = 0; if (deathT > 0) return;
  deathT = 1.4; slowT = 1.2; flashT = .3; shake = 12; hero.iframe = 3;
  for (let i = 0; i < 4; i++) burst(hero.x, hero.y - 4, ['#ff3355', '#ffffff', '#ff44ff', CL().c][i], 14, 60);
  const el = cardEl(); el.hidden = false; el.style.borderColor = '#ff3355';
  el.innerHTML = `<span style="color:#ff3355">ГЕРОЙ ПАЛ</span><canvas id="crc" width="120" height="120"></canvas><small>${CL().n} · зона ${S.zone} · ${fmt(S.kills)} убийств<br><span style="color:#ff44ff">+${fmt(S.runSouls || 0)} душ навсегда</span></small>`;
  runCard($('crc'), 'dead', () => cls());
  [523, 392, 262, 131].forEach((f, i) => tone(f, .25, 'square', .05, 0, i * .15));
}
// бой с вожаком без таймера: если видно, что вожака не одолеть (за 40с не убьёшь), он казнит героя — без долгого ожидания
function bossJudge(bm, dt) {
  bm.jt = (bm.jt || 0) + dt;
  // ярость: вместо мгновенной казни вожак свирепеет — урон растёт: +6%/с, и каждую секунду прирост ещё на 0.6%, герой гибнет от нарастающего натиска
  if (bm.fury) { bm.furyT = (bm.furyT || 0) + dt; bm.fury *= Math.pow(1.06 + .006 * bm.furyT, dt); bm.dm = (bm.dm0 ?? (bm.dm0 = bm.dm)) * bm.fury;
    // аура ярости: урон каждую секунду мимо уворота, блока, отражения и неуязвимости, на любом расстоянии (щит поглощает)
    { let a = zoneDmg(S.zone) * bm.dm0 * 1.5 * (bm.fury - .5) * (1 - D.armor) * dt; if (hero.shield > 0) { const k = Math.min(hero.shield, a); hero.shield -= k; a -= k; } hero.pool = (hero.pool || 0) + a; hero.poolT = time; hero.hitT = time;
      bm.auT = (bm.auT || 0) - dt; if (bm.auT <= 0) { bm.auT = 1; ring(bm.x, bm.y - 6, 22 + Math.min(30, bm.furyT), '#ff2222'); bolts.push({ x1: bm.x, y1: bm.y - 8, x2: hero.x, y2: hero.y - 5, l: .12, c: '#ff3322' }); } } if (rnd() < dt * Math.min(20, 3 * bm.fury)) burst(bm.x + (rnd() - .5) * 12, bm.y - 6 - rnd() * 8, rnd() < .5 ? '#ff2222' : '#ff9a3c', 2, 30); }
  if (bm.exec) { bm.exec -= dt; if (bm.exec <= 0) { bm.exec = 0; bm.jt = 0; bm.jhp = bm.hp; if (!bm.dead) { ring(hero.x, hero.y - 3, 22, '#ff2222'); shake = 14; sfx.boom(); hero.iframe = 0; const was = deathT; hurtHero(D.maxHP * 1e3 + hero.shield, true); if (deathT === was && hero.hp > 0) feed('Герой устоял перед казнью!', '#5cff8a'); } } return; }
  if (bm.jhp === undefined) bm.jhp = bm.hp;
  if (bm.jt >= 6) {
    const lost = (bm.jhp - bm.hp) / bm.max, rate = lost / bm.jt, left = bm.hp / bm.max;
    if (rate <= 0 || left / rate > (skyOn('sk_judge') ? 60 : 40)) { if (!bm.fury) { bm.fury = 1; toast('ЯРОСТЬ ВОЖАКА', 'урона не хватает — вожак свирепеет с каждой секундой', 1800); [196, 147, 98].forEach((f, i) => tone(f, .3, 'sawtooth', .06, 0, i * .25)); } bm.jt = 0; bm.jhp = bm.hp; }
    else { bm.jt = 0; bm.jhp = bm.hp; }
  }
}
// плавная смерть («натиск»): весь урон копится в ране (hero.pool) и стекает в HP с ограниченной скоростью hero.pr (доля макс. HP в секунду):
// сначала 8%/с, пока натиск держится — +25% каждые 5 с, когда спадает — скорость падает и рана затягивается. Урон не теряется, но гибель — долгая борьба
function hurtHero(dmg, unblock, cap, quiet) {
  if (!unblock) { dmg = clsBlock(dmg); if (dmg <= 0) return 0; }
  if (!unblock && hero.mirror && dmg > D.maxHP * .01) { mirrorBlock(dmg); return 0; }
  if (!unblock && skyOn('sk_starshield') && hero.hp - dmg < D.maxHP * .3 && time > (hero.ssT || 0)) { hero.ssT = time + 20; hero.iframe = 3; ring(hero.x, hero.y - 4, 16, '#fff6a0'); burst(hero.x, hero.y - 6, '#fff6a0', 16, 40); fxLabel('Звёздный щит', hero.x, hero.y - 18, '#fff6a0'); return 0; }
  if (dmg > D.maxHP * .08) hurtV = Math.min(.6, hurtV + .35);
  if (!unblock) { hero.hitT = time; if (hero.shield > 0) { const a = Math.min(hero.shield, dmg); hero.shield -= a; dmg -= a; burst(hero.x, hero.y - 4, '#9fe8ff', 2, 20); } hero.pool = (hero.pool || 0) + dmg; hero.poolT = time; hero.hurt = .1; ntHurt(); return dmg; }
  if (hero.shield > 0 && !quiet) { const a = Math.min(hero.shield, dmg); hero.shield -= a; dmg -= a; burst(hero.x, hero.y - 4, '#9fe8ff', 2, 20); }
  hero.hp -= dmg; if (!quiet) { hero.hurt = .1; ntHurt(); }
  if (hero.hp <= 0) { hero.pool = 0;
    if (au('reb') && !S.second) { S.second = true; hero.hp = D.maxHP * .5; hero.iframe = 1.5; ftext(hero.x, hero.y - 16, 'ВТОРОЙ ШАНС!', '#ff44ff', 1.2, 1.2); ring(hero.x, hero.y - 4, 20, '#ff44ff'); flashT = .1; }
    else if (aw() && cls() === 'priest' && time > (hero.angT || 0)) { hero.angT = time + 30; hero.hp = D.maxHP; hero.iframe = 1.5; ftext(hero.x, hero.y - 16, 'АНГЕЛ-ХРАНИТЕЛЬ!', '#fff6c0', 1.2, 1.2); ring(hero.x, hero.y - 4, 24, '#fff6c0'); flashT = .15; }
    else if (aw() && cls() === 'chrono' && !S.loop) { S.loop = true; hero.hp = D.maxHP; hero.iframe = 2; ftext(hero.x, hero.y - 16, 'ПЕТЛЯ ВРЕМЕНИ!', '#88aaff', 1.2, 1.2); ring(hero.x, hero.y - 4, 30, '#88aaff'); flashT = .2; for (const m of mobs) if (!m.dead) m.frz = Math.max(m.frz || 0, 1.5); }
    else if (pathRevive()) {}
    else heroDeath();
  }
  return dmg;
}
function ring(x, y, r, c) { if (SIM) return; groundMark(x, y + 2, r, c); if (r >= 24 && smoke.length < 30) puff(x, y, r * .4, '#2e2836', 3); if (r >= 12 && RING_LABEL[c]) fxLabel(RING_LABEL[c], x, y - r * .6 - 4, c); if (S.fxLow && r < 12) return; if (rings.length > 40) rings.shift(); rings.push({ x, y, r: 1, max: r, c, l: .3 }); }
function hitAround(x, y, r, dmg, col, skip) { for (const o of mobs) if (!o.dead && o !== skip && Math.hypot(o.x - x, o.y - y) < r) hitMob(o, dmg, false, false, col); }
function hitMob(m, dmg, crit, show, col) {
  if (!m || m === hero || !Number.isFinite(dmg) && !(dmg > 0)) return;   // защита: героя как врага не бить, NaN-урон не пускать (иначе NaN расползается в статы)
  if (m.dead) return;
  if (m.mark > 0 && D.mark) dmg *= 1 + D.mark;
  if (!col && D.mark > .01) m.mark = 3;
  if (m.af & 128 && rnd() < .3) { if (show && texts.length < 7) ftext(m.x, m.y - 8 * m.sz, 'мимо', '#bb88ff', .8, .5); return; }
  if (m.af & 1) dmg *= .5;
  if (m.ph && !setOn(3, 4)) { if (show && texts.length < 7 && rnd() < .3) ftext(m.x, m.y - 8 * m.sz, 'тень', '#b06aff', .7, .5); return; }   // Бездна: враг в тени
  if (m.shd > 0 && setOn(2, 4)) m.shd = 0;
  if (m.shd > 0) { if (crit) { m.shd = 0; burst(m.x, m.y - 4, '#7ad8ff', 12, 40); fxLabel('Щит пробит', m.x, m.y - 14, '#7ad8ff'); } else { const a = Math.min(m.shd, dmg); m.shd -= a; dmg -= a; if (dmg <= 0) { if (rnd() < .2) burst(m.x, m.y - 4, '#7ad8ff', 2, 15); return; } } }
  if (m.guard) dmg *= guardMul();   // Страж стены: защиту ломают звёзды созвездий
  if (m.pmk > time) dmg *= 1 + (m.pmkV || 0);   // метка пути класса
  if (m.boss) dmg *= (1 + ta('bossdmg')) * (1 + .1 * ntL(5, 2)) * (trHas('skull') ? 1.3 : 1) * (1 + skyV('boss')) * relBossM();
  if (!m.hit1) { m.hit1 = 1; if (skyOn('sk_first')) dmg *= 5; }
  if (m.guard) dmg /= relGuardDiv(); else if (m.na) dmg *= 1 + ta('elite');
  if (m.boss || m.na) dmg *= D.hunt || 1;
  if (m.role !== 'shield' && !m.boss && mobs.some(o => o.role === 'shield' && !o.dead && o !== m && Math.hypot(o.x - m.x, o.y - m.y) < 14)) { dmg *= .6; if (rnd() < .3) pix2.push([m.x, m.y - 6]); }
  if (hero.stopT > 0 && m.stopD !== undefined && m.frz > 0) { m.stopD += dmg; m.fl = .07; burst(m.x, m.y - 3, '#88aaff', 1, 10); return; }   // остановка времени: урон копится
  trackDmg(SRC_BY_COL[col] || 'Удар', Math.min(dmg, Math.max(0, m.hp))); m.hp -= dmg; m.fl = .07;
  if (!col && legOn('frost')) m.slowT = 2;
  if (!col && D.bleed > .01) { m.blT = 4; m.bl = Math.min((m.bl || 0) + D.hit * D.bleed * .25, D.hit * D.bleed); }
  if (!col && D.frost > .01 && rnd() < D.frost) { m.slowT = 1.5; if (!m.boss && rnd() < .15) { m.frz = 1; if (texts.length < 8) fxLabel('Заморозка', m.x, m.y - 12, '#a8e8ff'); } }
  if (D.exec > .01 && !m.boss && m.hp > 0 && m.hp < m.max * D.exec) { trackDmg('Казнь', m.hp); m.hp = 0; bolts.push({ x1: m.x - 5, y1: m.y - 9, x2: m.x + 5, y2: m.y + 1, l: .12, c: '#ffffff' }); fxLabel('Казнь', m.x, m.y - 12, '#f0f0f0');  }
  if (m.af & 1024 && !col && time > (m.rfT || 0)) { m.rfT = time + 1; hurtHero(zoneDmg(S.zone) * m.dm * .4 * (1 - D.armor)); if (texts.length < 7) ftext(hero.x, hero.y - 10, 'отражено', '#ffffff', .7, .6); }
  const dx = m.x - hero.x, dy = m.y - hero.y, d = Math.hypot(dx, dy) || 1;
  const kb = (m.boss ? .4 : m.goblin ? .5 : 2.6) * (hero.kbBoost || 1); m.kx += dx / d * kb * 8; m.ky += dy / d * kb * 8;
  m.sqT = time + (crit ? .14 : .1); m.sqx = dx / d; impact(m.x - dx / d * 2 * m.sz, m.y - 4 * m.sz, crit, col); if (crit && D.aps < 4) hitStop = Math.max(hitStop, .025);
  burst(m.x, m.y - 3 * m.sz, col || (m.rare ? '#ffd84a' : '#fff'), crit ? 5 : 2, 25);
  if (show && (D.aps < 5 || crit) && texts.length < (D.aps < 5 ? 10 : 5) && time > (hitMob.nt || 0)) { if (D.aps >= 5) hitMob.nt = time + .12; ftext(m.x, m.y - 8 * m.sz, fmt(dmg) + (crit ? '!' : ''), col || (crit ? '#ffdd33' : '#e8e8f0'), m.boss ? (crit ? 1.15 : .9) : crit ? .95 : .7, crit ? .8 : .55); }
  if (m.hp <= 0) { m.dead = true; killMob(m); }
}

let killWindow = 0;
function killMob(m) {
  S.kills++; killWindow++;
  zkKill(m); trRoll(m); if (!m.obj) relGain((1 + S.zone / 5) * (m.boss ? 25 : m.rare ? 3 : 1) * (m.hw ?? 1));
  combo++; comboT = comboTime(); comboPop = .15; addUlt(m.boss ? .2 : m.rare ? .05 : .008 * (m.hw ?? 1));
  if (combo > (S.bestCombo || 0)) S.bestCombo = combo;
  if (COMBO_MS.includes(combo) || (combo % 10000 === 0)) { feed('Комбо ' + combo + '! награды ×' + comboM().toFixed(2), '#ffdd44'); sfx.combo(); comboPop = .4; if (combo === 10) tip('combo', 'Комбо', 'Убивай без пауз — растёт множитель наград (вверху справа). Тапы по врагам продлевают комбо.'); }
  splat(m); if (!m.obj) deathFx(m); if (m.boss) { slowT = Math.max(slowT, .5); hitStop = Math.max(hitStop, .1); }
  const c = m.rare ? '#ffd84a' : hsl2hex(m.h, 55, 48);
  burst(m.x, m.y - 3 * m.sz, c, m.boss ? 60 : m.rare ? 25 : 12, m.boss ? 60 : 40);
  if (m.boss || m.rare) shake = Math.max(shake, m.boss ? 8 : 3);
  const cnt = 2 + (D.greed || 0) + Math.floor(rnd() * 3) + (m.rare ? 3 : 0) + (m.boss ? 8 : 0);
  const base = (m.hw ?? 1) * zs() * D.gainMult * exMult() * (m.rare ? 8 * (1 + sy(5)) : 1) * (m.boss ? 25 : 1) * (1 + 1.5 * m.na) * (m.mini ? .5 : 1) * comboM() * (1 + ta('gain')) * (m.na ? 1 + ta('elite') : 1) * (S.zone < S.meta.best * .5 ? 1 + ta('legacy') : 1)
    * (1 + ta('x_greed')) * (on('x_scholar') || on('x_reaper') ? .8 : 1) * (on('x_gamble') && !m.rare ? .8 : 1)
    * (m.rare ? (1 + ta('c_rare')) * (on('x_gamble') ? 1 + ta('x_gamble') : 1) : 1) * (isLegend(S.zone) ? 1 + ta('c_legend') : 1)
    * (mobs.length >= 15 ? 1 + ta('c_crowd') : 1) * Math.pow(1.25, TAL.constel || 0) * evGain() * (zm() ? zm().g : 1);
  const now = performance.now();
  const fav = biomeOf(S.zone).fav, dbl = Math.min(.5, .05 * (F(EI.wis) - 1));
  for (let i = 0; i < cnt; i++) {
    const s = pickStat();
    let amt = base * (.5 + rnd()) * (fav.includes(s.e) ? 2 : 1);
    if (dbl > 0 && rnd() < dbl) amt *= 2;
    if (!SIM && orbs.length < (S.fxLow ? 20 : 120)) { const a = rnd() * 6.28; orbs.push({ x: m.x, y: m.y - 3, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55 - 20, c: EFF[s.e].c, t: 0 }); }
    s.v += amt; s.g = amt; s.at = now; tryEvolve(s);
    if (i === 0 && (m.boss || time > gainFeedT)) { gainFeedT = time + 3; feed('+' + fmt(amt) + ' ' + s.name, EFF[s.e].c); }
  }
  D.dirty = true;
  if (m.rare) { sfx.rare(); if (texts.length < 10 && time > (S.rareTxt || 0)) { S.rareTxt = time + 2.5; ftext(m.x, m.y - 14, 'РЕДКИЙ!', '#ffd84a', 1.1, 1); } tip('rare', 'Золотой враг', 'Редкие золотые враги дают ×8 наград.'); } else sfx.kill();
  if (F(EI.luck) >= 3 && time > (S.jackT || 0) && rnd() < .003 * (F(EI.luck) - 2) * (m.hw ?? 1)) { S.jackT = time + 120;   // не чаще раза в 2 минуты (с ордой убийств сотни в секунду)
    for (const o of mobs) if (!o.dead && !o.boss) o.rare = true;
    toast('ДЖЕКПОТ!', 'все враги стали золотыми'); sfx.rare(); flashT = .1;
  }
  if (F(EI.poison) >= 2 && m.psnT > 0 && clouds.length < 20) fxLabel('Ядовитое облако', m.x, m.y - 12, '#88ee22');
  if (F(EI.poison) >= 2 && m.psnT > 0 && clouds.length < 20) clouds.push({ x: m.x, y: m.y - 2, r: 8 + 2 * Math.min(6, F(EI.poison) - 2), dps: m.psn * .6, t: 3 });
  if (ksL(0, 0) && rnd() < .02 * ksL(0, 0)) { burst(m.x, m.y - 3, '#ff3322', 14, 50); ring(m.x, m.y - 3, 16, '#ff5544'); hitAround(m.x, m.y, 16, D.hit * 3 * ksL(0, 0), '#ff5544', m); }
  if (ksL(0, 1)) { S.ksK = (S.ksK || 0) + 1; if (S.ksK >= ksEvery(ksL(0, 1))) { S.ksK = 0; ftext(hero.x, hero.y - 26, 'БОГ РЕЗНИ!', '#ff5544', 1.3, 1); if (ultCd <= 0) { ult = 1; fireUlt(true); } } }
  if (ksL(4, 0) && rnd() < .005 * ksL(4, 0)) { giveBurst(30 * base); feed('Сундук! Награды как за 30 убийств', '#ffd84a'); burst(m.x, m.y - 3, '#ffd84a', 24, 50); sfx.rare(); }
  if (ksL(4, 1) && m.rare && rnd() < .2 * ksL(4, 1)) { S.forceRare = (S.forceRare || 0) + 5; feed('Любимец богов: ещё 5 золотых!', '#44ffaa'); }
  addSouls(m.boss ? bossSouls(S.zone) : (m.rare ? .05 : .01) * (1 + S.zone / 20) * (m.hw ?? 1), m);
  if (m.boss) { S.siege = 0; if (isLegend(S.zone)) giveChest('r', 'легенда'); else if (rnd() < .4) giveChest('c', 'вожак'); }
  if (ev && ev.type === 'treasure' && !m.boss && rnd() < .04) giveChest('c', 'сокровищница');
  if (D.dust > .01 && rnd() < D.dust) { G().dust += Math.max(1, Math.round((1 + S.zone / 10) * (1 + skyV('dust')))); fxLabel('Пыль', m.x, m.y - 12, '#c9b07a'); }
  if (D.leech > .002) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * D.leech);
  if (D.rageK > .005) { hero.rage = Math.min(5, (hero.rage || 0) + 1); hero.rageT = 2; }
  if (D.det > .01 && !m.boss && rnd() < D.det) { burst(m.x, m.y - 3, '#ff7744', 12, 45); ring(m.x, m.y - 3, 14, '#ff7744'); fxLabel('Детонация', m.x, m.y - 12, '#ff7744'); hitAround(m.x, m.y, 14, D.hit * 1.5, '#ff7744', m); }
  if (legOn('blood')) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .02);
  if (legOn('gold') && rnd() < .004) giveChest('c', 'златой');
  if (legOn('nova') && S.kills % 5 === 0) { ring(m.x, m.y - 3, 18, '#ffffff'); hitAround(m.x, m.y, 18, D.hit * 3, '#ffffff', m); }
  clsKill(m, base); ntKill(m, base); pathKill(m); attrGain((1 + S.zone * .1) * (m.boss ? 10 : m.rare ? 3 : 1) * (m.hw ?? 1)); lifeXP((1 + S.zone * .1) * (m.boss ? 12 : m.rare ? 3 : 1) * (m.hw ?? 1)); clsGain(base * .5); clsXP((1 + S.zone / 5) * (m.boss ? 20 : m.rare ? 3 : 1) * (1 + .25 * ascL('xp')) * (m.hw ?? 1));
  if (m.goblin) { giveChest('r', 'гоблин'); giveBurst(base * 100); toast('ГОБЛИН ПОЙМАН!', 'сундук: награды как за 100 убийств'); burst(m.x, m.y - 3, '#ffd84a', 40, 70); sfx.rare(); flashT = .1; if (ev && ev.type === 'gob') ev.t = 0; }
  if (m.af & 4) explode(m);
  if (m.af & 16) spawnMini(m);
  if (sy(1) && m.psnT > 0) for (const o of mobs) if (!o.dead && o !== m && Math.hypot(o.x - m.x, o.y - m.y) < 16) {
    o.psn = Math.max(o.psn, Math.min(m.psn * (1 + .5 * sy(1)), D.hit * Math.max(D.poison, .1) * 3)); o.psnT = 3;   // без роста по цепочке burst(o.x, o.y - 3, '#88ee22', 2, 15);
  }
  checkUnlocks(false);
  if (m.guard) { S.siege = 0; S.tries = 0; guardianDown(); return; }
  if (m.titan) titanDown(m);
  if (m.boss) worldLoot(m);
  if (m.boss) { bossAlive = false; slowT = .7; flashT = .15; if ((S.tries || 1) > 1) toast('ПРОРЫВ!', 'вожак пал с ' + S.tries + '-й попытки'); S.tries = 0; nextZone(); }
}
function giveBurst(total) {
  const n = Math.min(stats.length, 10);
  for (let i = 0; i < n; i++) { const st = pickStat(); st.v += total / n; st.at = performance.now(); tryEvolve(st); }
  clsGain(total / 20);
  D.dirty = true;
}
function nextZone() {
  const oldB = biomeOf(S.zone).name;
  S.zone++; S.zk = 0; S.wallW = 0; S.prepW = 0;
  { const keys = Object.keys(ZMODS); S.zmod = S.zone >= 5 && !isLegend(S.zone) && rnd() < .4 ? keys[Math.floor(rnd() * keys.length)] : null; }
  rollZTask(); if (zTask()) S.zmod = null; else if (skyOn('nv_night')) S.zmod = 'night';
  S.meta.best = Math.max(S.meta.best, S.zone);
  if (S.zone >= 2) tip('souls', 'Души забега', 'За врагов и вожаков копятся души (✦ вверху справа). Когда герой падёт, он переродится в новом случайном классе, а души останутся навсегда — трать их в дереве талантов.');
  const b = biomeOf(S.zone);
  hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .5);
  recalc(); buildGround();
  sfx.zone(); shake = 10;
  if (S.zone > 50 && (S.zone - 51) % 10 === 0) { const w = curWorld(); setTimeout(() => toast('МИР: ' + w.n.toUpperCase(), w.rd, 4000), 600); }
  toast(b.name !== oldB ? 'НОВЫЕ ЗЕМЛИ!' : 'ЗОНА ' + S.zone, b.name + (b.name !== oldB ? ' · ×2 к: ' + b.fav.map(e => EFF[e].n).join(', ') : ' · награды ×' + fmt(zs())));
  for (let i = 0; i < 40; i++) burst(camX + rnd() * W, camY + rnd() * H, '#f2c94c', 1, 20);
  if (zTask()) toast('ЗАДАЧА: ' + ZTASKS[zTask()].n, ZTASKS[zTask()].d, 3000);
  { const hz = hazard(); if (hz && b.name !== oldB) setTimeout(() => toast('ОПАСНОСТЬ: ' + hz.n.toUpperCase(), hz.d, 3000), 900); }
  if (zm()) { toast('ЗОНА: ' + zm().n.toUpperCase(), zm().d); tip('zmod', 'Особая зона', 'Иногда зона получает модификатор: ночь, гроза, гиганты, рой… Он написан рядом с названием зоны.'); }
}

/* ---------- атака героя ---------- */
// дальность клинка: ближе — бьёт меч, дальше — летит видимая волна клинка
const MELEE = 11;
let waves = [];
function heroAttack(t) {
  const d = Math.hypot(t.x - hero.x, t.y - hero.y) - (t.sz - 1) * 4;
  hero.face = t.x >= hero.x ? 1 : -1;
  haStart(t, d);   // визуальный ролик атаки
  if (clsAttack(t, d)) return;
  if (d <= MELEE) return heroStrike(t, false);
  hero.swing = .13; hero.swType = 0; hero.swDur = .13; hero.swingA = Math.atan2(t.y - hero.y, t.x - hero.x);
  waves.push({ x: hero.x + Math.cos(hero.swingA) * 6, y: hero.y - 4 + Math.sin(hero.swingA) * 6, t, sp: 200, a: hero.swingA, l: 1.2, fin: hero.chain % 3 === 2 });
  fxLabel('Волна клинка', hero.x, hero.y - 16, '#dddd88');
  tone(700, .05, 'triangle', .02, 1400, 0, 'wave', .05);
}
function bounceFrom(src, dmg, left) {
  let best = null, bd = 40;
  for (const o of mobs) { if (o.dead || o === src) continue; const d = Math.hypot(o.x - src.x, o.y - src.y); if (d < bd) { bd = d; best = o; } }
  if (best) waves.push({ x: src.x, y: src.y - 4, t: best, sp: 220, a: 0, l: 1, bounce: true, dmg, left: left - 1 });
}
const WCOL = { fire: '#ff8a3c', dark: '#7affb0', arrow: '#5cff8a', axe: '#ff6644', hammer: '#fff2a8', shield: '#8fb0d0', card: '#44ffaa', flask: '#b6ff3c', time: '#88aaff', scythe: '#ff44ff' };
function updWaves(dt) {
  for (const w of waves) {
    w.l -= dt;
    if (w.t.dead) { w.l = 0; continue; }
    const dx = w.t.x - w.x, dy = w.t.y - 4 * w.t.sz - w.y, d = Math.hypot(dx, dy) || 1;
    w.a = Math.atan2(dy, dx);
    const st = Math.min(d, w.sp * dt); w.x += dx / d * st; w.y += dy / d * st;
    if (d < 4 + 2 * w.t.sz) { w.l = 0; burst(w.x, w.y, w.bounce ? '#ffe08a' : WCOL[w.kind] || '#ffffff', w.kind === 'fire' ? 14 : 4, 30);
      if (w.pv) { hitMob(w.t, w.dmg, false, false, w.c); burst(w.x, w.y, w.c, 4, 25); } else if (w.bounce) { const tg = w.t; hitMob(tg, w.dmg, false, false, '#ffe08a'); fxLabel('Рикошет', tg.x, tg.y - 12, '#ffe08a'); if (w.left > 0) bounceFrom(tg, w.dmg * .8, w.left); } else if (!clsWaveHit(w)) heroStrike(w.t, true); }
  }
  waves = waves.filter(w => w.l > 0);
}
function heroStrike(t, fromWave) {
  const crit = rnd() < D.crit, ultra = crit && rnd() < .04, scrit = crit && rnd() < (D.scrit || 0);
  const ci = hero.chain % 3; hero.chain++; hero.chainT = 1.2; hero.swType = ci; hero.swDur = ci === 2 ? .2 : .13;
  const dmg = [1, 1.15, 2.5][ci] * (hero.counter > 0 ? 3 : 1) * D.hit * (crit ? D.critM * (1 + .2 * sy(2)) : 1) * (.9 + rnd() * .2) * furyM() * (ultra ? 5 : 1) * condDmg(t) * (scrit ? 1 + D.critM * .5 : 1) * clsDM(t);
  if (scrit) fxLabel('Сверхкрит', t.x, t.y - 16, '#ffff66');
  if (crit && sy(2)) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .03 * sy(2));
  if (!fromWave) { hero.swing = hero.swDur; hero.swingA = Math.atan2(t.y - hero.y, t.x - hero.x); hero.face = t.x >= hero.x ? 1 : -1; }
  if (ci === 2) hero.kbBoost = 3.5;
  haHit(t, crit);
  hitMob(t, dmg * (1 + ta('x_focus')) * flyMul(fromWave), crit, true);
  if (D.bounce > 0) bounceFrom(t, dmg * .6, D.bounce);
  if (D.echo > .01) echoes.push({ x: t.x, y: t.y, t: .45, dmg: dmg * D.echo });
  if (D.quake > .02 && hero.atkN % 6 === 5) { ring(hero.x, hero.y - 2, 18, '#b08a5a'); hitAround(hero.x, hero.y, 18, dmg * D.quake * 1.5, '#b08a5a'); shake = Math.max(shake, 3); fxLabel('Землетрясение', hero.x, hero.y - 18, '#b08a5a'); tone(70, .2, 'square', .05, 40, 0, 'quake', .3); }
  if (crit && legOn('storm')) { const o = randMob(); if (o) { bolts.push({ x1: t.x, y1: t.y - 3, x2: o.x, y2: o.y - 3, l: .12, c: '#99eeff' }); hitMob(o, dmg * .5, false, false, '#99eeff'); } }
  if (legOn('echo') && rnd() < .2 && !t.dead) { ghosts.push({ x: hero.x, y: hero.y, l: .25, face: hero.face }); hitMob(t, dmg * .8, crit, true); }
  if (ci === 2) {   // финишер: удар с прыжка, волна, всех разбрасывает
    const wr = cls() === 'war' ? 12 + 12 * cq(1) : 12; ring(t.x, t.y - 2, wr, '#ffffff'); hitAround(t.x, t.y, wr, dmg * (cls() === 'war' ? .4 + 1.6 * cq(1) : .4), '#ffffff', t); hitStop = Math.max(hitStop, .05); shake = Math.max(shake, 3);
    tone(90, .15, 'square', .05, 50);
  }
  hero.kbBoost = 1;
  if (ksL(3, 0) && hero.atkN % 3 === 0) { const rr = D.range * 2 + 4; ring(hero.x, hero.y - 4, rr, '#66ccff'); hitAround(hero.x, hero.y, rr, dmg * .5 * ksL(3, 0), '#66ccff', t); }
  hero.atkN++;
  const fd = F(EI.dmg);
  if (fd >= 2) { ring(t.x, t.y - 3, 5 + Math.min(8, fd), '#ff8877'); if (fd >= 3) hitAround(t.x, t.y, 8 + 2 * Math.min(6, fd - 3), dmg * .25, '#ff8877', t); }
  if (crit && F(EI.crit) >= 3) { fxLabel('Звёздный крит', t.x, t.y - 16, '#ffee66'); burst(t.x, t.y - 4, '#ffee66', 10, 50); hitAround(t.x, t.y, 10 + Math.min(10, F(EI.crit) - 3) * 2, dmg * .3, '#ffee66', t); }
  if (crit && F(EI.critd) >= 1) { const a = rnd() * 3.14, L = 4 + Math.min(10, F(EI.critd) * 2); bolts.push({ x1: t.x - Math.cos(a) * L, y1: t.y - 3 - Math.sin(a) * L, x2: t.x + Math.cos(a) * L, y2: t.y - 3 + Math.sin(a) * L, l: .12, c: '#ff7a00' }); }
  if (!SIM && F(EI.vamp) >= 1 && orbs.length < 160) for (let i = 0; i < Math.min(3, F(EI.vamp)); i++) orbs.push({ x: t.x, y: t.y - 3, vx: (rnd() - .5) * 60, vy: -30 - rnd() * 30, c: '#dd2244', t: 0, v: 1 });
  if (F(EI.cleave) >= 3 && hero.atkN % 4 === 0) {
    const rr = D.range * 1.6 + 4; ring(hero.x, hero.y - 4, rr, '#ff9988');
    hitAround(hero.x, hero.y, rr, dmg * .8, '#ff9988', t);
  }
  if (F(EI.move) >= 3 && rnd() < Math.min(.8, .2 * (F(EI.move) - 2))) {
    const cand = mobs.filter(o => !o.dead && o !== t && Math.hypot(o.x - hero.x, o.y - hero.y) < 40);
    if (cand.length) { const o = cand[Math.floor(rnd() * cand.length)]; fxLabel('Послеобраз', o.x, o.y - 12, '#66ccff'); ghosts.push({ x: o.x - 4 * hero.face, y: o.y, l: .3, face: hero.face }); hitMob(o, dmg * .5, false, false, '#66ccff'); }
  }
  if (ultra) { ftext(t.x, t.y - 18, 'УЛЬТРА!', '#ff44ff', 1.8, 1.1); flashT = .12; slowT = .25; shake = 8; sfx.ultra(); }
  crit ? (sfx.crit(), shake = Math.max(shake, 2)) : sfx.hit();
  if (D.cleave > 0) {
    const others = mobs.filter(m => m !== t && !m.dead && Math.hypot(m.x - hero.x, m.y - hero.y) < D.range + 7)
      .sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y)).slice(0, D.cleave);
    for (const o of others) { hitMob(o, dmg * .6, crit, false); if (sy(1) && D.poison > .02) { o.psn = Math.max(o.psn, D.hit * D.poison * .5); o.psnT = 3; } }
  }
  if (D.fire > .02) {
    for (const o of mobs) if (!o.dead && o !== t && Math.hypot(o.x - t.x, o.y - t.y) < D.fireR) {
      hitMob(o, dmg * D.fire, false, false, '#ff6622');
      if (sy(0) && rnd() < .35 && !o.dead) { fxLabel('Плазма', o.x, o.y - 12, '#d9a0ff'); bolts.push({ x1: t.x, y1: t.y - 3, x2: o.x, y2: o.y - 3, l: .1, c: '#d9a0ff' }); hitMob(o, dmg * .3 * sy(0), false, false, '#d9a0ff'); }
    }
    burst(t.x, t.y - 3, '#ff6622', 4, 30); burst(t.x, t.y - 3, '#ffcc33', 2, 20);
  }
  if (rnd() < D.shock) {
    let from = t; const hitSet = new Set([t]);
    for (let j = 0; j < D.chain; j++) {
      let best = null, bd = 30;
      for (const o of mobs) { if (o.dead || hitSet.has(o)) continue; const d = Math.hypot(o.x - from.x, o.y - from.y); if (d < bd) { bd = d; best = o; } }
      if (!best) break;
      bolts.push({ x1: from.x, y1: from.y - 3, x2: best.x, y2: best.y - 3, l: .12, c: '#99eeff' });
      hitSet.add(best); hitMob(best, dmg * .5, false, false, '#99eeff'); from = best;
    }
  }
  if (D.poison > .02) { t.psn = Math.max(t.psn, D.hit * D.poison); t.psnT = 3; }
  if (D.vamp > 0) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * D.vamp);
  ntHit(t, dmg, crit); pathHit(t, dmg, crit);
}
const flyMul = fromWave => wRule('fly') && !fromWave && !setOn(1, 4) ? .6 : 1;

/* ---------- тап: удар молнии с неба ---------- */
function addUlt(v) {
  if (ult >= 1) return;
  v *= (1 + .2 * perkL('ult')) * constUlt() * (1 + .2 * ctL('U2')) * (setT('Свет') >= 3 ? 1.5 : setT('Свет') >= 2 ? 1.2 : 1);
  if (ultCd > 0) { ult = Math.min(.999, ult + v * (D.energy || 1) * (1 + ta('ultc'))); return; }   // перезарядка: копится, но не больше 99%
  ult = Math.min(1, ult + v * (D.energy || 1) * (1 + ta('ultc')) * (on('x_ultra') ? .5 : 1) * (S.hpf < .5 ? 1 + ta('c_lowhp') : 1) * (cls() === 'priest' ? 1.5 * (1 + 2 * cq(1)) : 1));
  if (ult >= 1) { ultReadyT = 0; tip('ult', 'Ульта готова', 'Полоса внизу экрана заполнена. Тапни в любое место — удар по всем врагам.'); tone(660, .1, 'square', .04); tone(990, .2, 'square', .04, 0, .1); }
}
/* ---------- ульты классов ---------- */
const ULTS = {
  war:   ['Клинковый шторм', 'веер из 16 волн клинка по всему полю'],
  bers:  ['Кровавая буря', '3 секунды бешеного вихря: бьёт всех рядом и лечит'],
  pal:   ['Божий молот', 'огромный молот с неба: урон по площади, полное лечение и щит'],
  guard: ['Несокрушимая стена', 'ударная волна отшвыривает и оглушает всех; 3с неуязвимости'],
  mage:  ['Метеоритный дождь', '14 метеоритов падают на врагов'],
  sham:  ['Великая гроза', 'молнии бьют каждого врага трижды, появляются 3 тотема'],
  arch:  ['Ливень стрел', 'дождь из стрел накрывает всё поле'],
  assa:  ['Танец теней', 'скачет от врага к врагу и бьёт критом в спину'],
  gamb:  ['Флеш-рояль', '5 карт — 5 случайных эффектов, шанс на сундук'],
  alch:  ['Великая реакция', 'кислота под каждым врагом, потом цепь взрывов'],
  priest:['Небесный суд', 'столпы света на всех врагов, лечение и очищение'],
  monk:  ['Сто ладоней', 'шквал ударов по ближайшим врагам'],
  chrono:['Остановка времени', 'время стоит 3с; весь урон в это время вернётся ×2'],
  rune:  ['Рунный круг', 'руны под каждым врагом взрываются каскадом'],
  necro: ['Армия мёртвых', 'поднимает 10 скелетов и бьёт всех тьмой'],
  reap:  ['Великая жатва', 'коса во весь экран; души — на максимум'],
};
let ultQ = [];
const later = (t, fn) => ultQ.push({ t, fn });
function updUltQ(dt) { for (const q of ultQ) { q.t -= dt; if (q.t <= 0 && !q.done) { q.done = true; q.fn(); } } ultQ = ultQ.filter(q => !q.done); }
const live = () => mobs.filter(m => !m.dead);
/* ---------- анимации ульт ---------- */
// ufx: живые объекты-анимации в мире; d(p) рисует, p — прогресс 0..1; hit — что случится в конце
let ufx = [], ultBan = null;
const ULT_CD = 10;   // ульта не чаще раза в 10 секунд
let ultCd = 0;
function fx1(life, d, hit) { ufx.push({ t: 0, life, d, hit }); }
function updUfx(dt) { for (const u of ufx) { u.t += dt; if (u.t >= u.life && !u.done) { u.done = true; if (u.hit) u.hit(); } } ufx = ufx.filter(u => !u.done); if (ultBan) { ultBan.t += dt; if (ultBan.t > 1.6) ultBan = null; } }
function drawUfx() { for (const u of ufx) u.d(Math.min(1, u.t / u.life), u); }
const dot = (x, y, s, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); };
function circ(x, y, r, c, n, sq = .6, rot = 0) { for (let i = 0; i < n; i++) { const a = i / n * 6.283 + rot; pix(x + Math.cos(a) * r, y + Math.sin(a) * r * sq, c); } }
// падающий снаряд: из (x0,y0) в цель, след, потом удар
function dropFx(x0, y0, m, life, col, size, onHit) {
  const tx = m.x, ty = m.y - 3;
  fx1(life, p => { const e = p * p, x = x0 + (tx - x0) * e, y = y0 + (ty - y0) * e; ctx.globalAlpha = .5; for (let j = 1; j < 5; j++) dot(x - (tx - x0) * .04 * j, y - (ty - y0) * .04 * j, Math.max(1, size - j), col); ctx.globalAlpha = 1; dot(x, y, size, '#ffffff'); dot(x, y, Math.max(1, size - 1), col); }, onHit);
}
// заставка ульты: затемнение, полосы, имя класса
function ultIntro(name, col) {
  ultBan = { t: 0, name, col };
  fx1(.5, p => { const r = 6 + p * 40; ctx.globalAlpha = 1 - p; circ(hero.x, hero.y - 4, r, col, 40); circ(hero.x, hero.y - 4, r * .7, '#ffffff', 28); ctx.globalAlpha = 1; });
  fx1(.6, p => { ctx.globalAlpha = (1 - p) * .8; for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 1 ? '#ffffff' : col; ctx.fillRect(Math.round(hero.x) - 1 + i, Math.round(hero.y - 70), 1, 66); } ctx.globalAlpha = 1; });
}
function drawUltBanner(k) {
  if (!ultBan) return;
  const t = ultBan.t, a = t < .15 ? t / .15 : t > 1.2 ? Math.max(0, 1 - (t - 1.2) / .4) : 1;
  const w = fx.width, h = fx.height, bh = h * .07 * a, cy = h * .32;
  fctx.save(); fctx.globalAlpha = a;
  fctx.fillStyle = 'rgba(0,0,0,.65)'; fctx.fillRect(0, 0, w, bh); fctx.fillRect(0, h - bh, w, bh);   // кинополосы
  const slide = (1 - Math.min(1, t / .2)) * w * .6;
  fctx.fillStyle = 'rgba(0,0,0,.55)'; fctx.fillRect(slide, cy - h * .04, w, h * .08);
  fctx.fillStyle = ultBan.col; fctx.fillRect(slide, cy - h * .04, w, 3 * DPR); fctx.fillRect(slide, cy + h * .04 - 3 * DPR, w, 3 * DPR);
  const fs = Math.round(k * 7 / DPR) * DPR; fctx.font = `${fs}px "Press Start 2P", monospace`; fctx.textAlign = 'center'; fctx.textBaseline = 'middle';
  fctx.lineWidth = Math.max(3, fs / 3); fctx.strokeStyle = '#000'; fctx.fillStyle = ultBan.col;
  fctx.strokeText(ultBan.name.toUpperCase(), w / 2 + slide, cy); fctx.fillText(ultBan.name.toUpperCase(), w / 2 + slide, cy);
  fctx.restore(); fctx.textBaseline = 'alphabetic';
}
/* ---------- эпичная подача ульты: заряд → кат-ин → кадр удара → волна ---------- */
const US_CHG = .85;          // сколько длится заряд (реальные секунды)
let US = null;               // идущая ульта
const zc = document.createElement('canvas'), zx = zc.getContext('2d');
function ultStart(dmg) {
  US = { t: 0, k: cls(), dmg, col: CL().c, aw: aw(), fired: false, imp: 0 };
  hero.iframe = Math.max(hero.iframe, 2);
  // нарастающий гул заряда
  tone(110, US_CHG, 'sawtooth', .05, 440); tone(220, US_CHG, 'square', .025, 1320); tone(55, US_CHG + .3, 'triangle', .06, 40);
}
function ultRelease() {
  US.fired = true; US.imp = .09; US.rel = 0;
  ultT = .9; flashT = .25; shake = 16;
  const c = US.col;
  // ударная волна и обломки
  for (let i = 0; i < 4; i++) ring(hero.x, hero.y - 3, 20 + i * 18, i % 2 ? '#ffffff' : c);
  for (let i = 0; i < 70 && parts.length < 600; i++) { const a = rnd() * 6.283, v = 60 + rnd() * 120; parts.push({ x: hero.x, y: hero.y - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .7 - 30, l: .6 + rnd() * .5, c: rnd() < .4 ? '#ffffff' : rnd() < .5 ? c : shade(c, -.4) }); }
  fx1(.7, p => { const r = 6 + p * 90; ctx.globalAlpha = (1 - p) * .9; circ(hero.x, hero.y - 3, r, '#ffffff', 90, .6); circ(hero.x, hero.y - 3, r - 2, c, 90, .6); circ(hero.x, hero.y - 3, r * .6, c, 50, .6); ctx.globalAlpha = 1; });
  // печать класса на земле
  fx1(1.6, p => { const R = 34, a = p < .15 ? p / .15 : (1 - p) / .85; ctx.globalAlpha = .7 * a; circ(hero.x, hero.y, R, c, 60, .55, p * 3); circ(hero.x, hero.y, R - 4, '#ffffff', 40, .55, -p * 4); circ(hero.x, hero.y, R * .45, c, 30, .55, p * 6);
    for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283 + p * 2; for (let j = 0; j < 4; j++) pix(hero.x + Math.cos(an) * (R - 4 + j), hero.y + Math.sin(an) * (R - 4 + j) * .55, j % 2 ? '#ffffff' : c); } ctx.globalAlpha = 1; });
  groundMark(hero.x, hero.y + 2, 30, '#ff9a3c');
  // аккорд удара
  tone(60, .8, 'sawtooth', .07, 25); tone(1800, .5, 'square', .03, 150); [262, 330, 392, 523, 784].forEach((f, i) => tone(f, .5, 'triangle', .04, 0, .05 + i * .04));
  clsUlt(US.dmg);
  if (ntL(5, 1)) hero.shield = Math.max(hero.shield, D.maxHP * .1 * ntL(5, 1));
  if (ctL('U3')) later(.5, () => { ult = Math.max(ult, .3); });
  if (legOn('twin')) { const ud = US.dmg; later(.9, () => { clsUlt(ud); flashT = .15; shake = 10; }); }   // к повтору ульта уже закончилась — урон запоминаем заранее
}
// реальное время: заряд почти останавливает мир
let usReal = 0;
function ultFrame(real, fromUpd) {
  if (!US) return 1;
  if (!fromUpd) usReal = performance.now();
  US.t += real; if (US.imp > 0) US.imp -= real; if (US.fired) US.rel += real;
  if (!US.fired && US.t >= US_CHG) ultRelease();
  if (US.fired && US.rel > 1.2) { US = null; hero.lift = 0; return 1; }
  if (!US.fired) { hero.lift = Math.round(4 * Math.min(1, US.t / .4)); return .05; }
  hero.lift = Math.max(0, Math.round(4 * (1 - US.rel / .25)));
  return US.rel < .35 ? .45 : 1;
}
// заряд в мире: энергия стягивается к герою, столб с неба, круг под ногами
function drawUltCharge() {
  if (!US || US.fired) return;
  const p = Math.min(1, US.t / US_CHG), c = US.col, hx = hero.x, hy = hero.y - 4;
  ctx.fillStyle = 'rgba(5,0,15,' + (.55 * p) + ')'; ctx.fillRect(camX - 6, camY - 6, W + 12, H + 12);
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283 + i * 1.7, ph = (US.t * 2.2 + i * .137) % 1, r = 70 * (1 - ph), L = 6 + 6 * (1 - ph);
    ctx.globalAlpha = .4 + .6 * ph; for (let j = 0; j < L; j++) pix(hx + Math.cos(a) * (r + j), hy + Math.sin(a) * (r + j) * .7, j === 0 ? '#ffffff' : c); }
  ctx.globalAlpha = .5 + .4 * p; const w = 1 + Math.round(4 * p); ctx.fillStyle = c; ctx.fillRect(Math.round(hx - w / 2) - 1, Math.round(camY - 6), w + 2, Math.round(hy - camY + 6)); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(hx - w / 4), Math.round(camY - 6), Math.max(1, w / 2), Math.round(hy - camY + 6));
  ctx.globalAlpha = .9; circ(hx, hero.y, 10 + 14 * p, c, 40, .45, US.t * 6); circ(hx, hero.y, 6 + 8 * p, '#ffffff', 24, .45, -US.t * 8); ctx.globalAlpha = 1;
}
// экранные эффекты: наезд камеры, «манга»-линии, кадр удара
function drawUltScreen(sx, sy) {
  if (!US) return;
  let z = 1;
  if (!US.fired) { const p = Math.min(1, US.t / US_CHG); z = 1 + .45 * p * p; }
  else z = 1 + .2 * Math.max(0, 1 - US.rel / .3);
  const hx = hero.x - camX + sx, hy = hero.y - 4 - camY + sy;
  if (z > 1.002) {
    if (zc.width !== W || zc.height !== H) { zc.width = W; zc.height = H; }
    zx.imageSmoothingEnabled = false; zx.clearRect(0, 0, W, H); zx.drawImage(cv, 0, 0);
    const sw = W / z, sh = H / z, x0 = clamp(hx - sw / 2, 0, W - sw), y0 = clamp(hy - sh / 2, 0, H - sh);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(zc, x0, y0, sw, sh, 0, 0, W, H);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!US.fired) {   // радиальные линии скорости к герою
    const p = Math.min(1, US.t / US_CHG), cx = W / 2, cy = H / 2;
    ctx.globalAlpha = .35 + .4 * p;
    for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283 + Math.floor(US.t * 20) * .37 * (i % 3), R0 = Math.max(W, H) * .75, R1 = R0 * (.55 + .25 * ((i * 7) % 5) / 5);
      for (let r = R1; r < R0; r += 1.5) pix(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i % 4 ? '#ffffff' : US.col); }
    ctx.globalAlpha = 1;
  }
  if (US.imp > 0) {   // кадр удара: белый экран, чёрные силуэты
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);   // кадр удара без белой вспышки
    ctx.setTransform(1, 0, 0, 1, sx - camX, sy - camY);
    for (const m of mobs) if (!m.dead) { const sp = sprite(MOBS[m.t].p, { 1: US.col, 2: US.col, 3: '#fff' }, 'mk' + m.t + US.col), s = m.sz || 1; ctx.drawImage(sp, Math.round(m.x - 4 * s), Math.round(m.y - 8 * s), 8 * s, 8 * s); }
    { const sl = silhouette('#ffffff'); ctx.drawImage(sl, Math.round(hero.x - 4) - sl.ox, Math.round(hero.y - 8 - (hero.lift || 0)) - sl.oy); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
// кат-ин: косая полоса с огромным портретом героя и названием ульты
function drawCutIn(k) {
  if (!US || US.auto) return;
  const t = US.t, w = fx.width, h = fx.height, a = t < .12 ? t / .12 : US.fired ? Math.max(0, 1 - US.rel / .25) : 1;
  if (a <= 0) return;
  const c = US.col, cy = h * .23, bh = h * .19, slide = (1 - Math.min(1, t / .18)) * w;
  fctx.save(); fctx.globalAlpha = a;
  const bars = h * .09 * Math.min(1, t / .15); fctx.fillStyle = '#000'; fctx.fillRect(0, 0, w, bars); fctx.fillRect(0, h - bars, w, bars);   // кинополосы
  fctx.translate(w / 2 - slide, cy); fctx.rotate(-.12);
  fctx.fillStyle = 'rgba(8,4,18,.92)'; fctx.fillRect(-w, -bh / 2, w * 2, bh);
  fctx.fillStyle = c; fctx.fillRect(-w, -bh / 2, w * 2, 4 * DPR); fctx.fillRect(-w, bh / 2 - 4 * DPR, w * 2, 4 * DPR);
  fctx.globalAlpha = a * .25; for (let i = 0; i < 14; i++) { const lx = ((i * 97 + t * 900) % (w * 2)) - w; fctx.fillRect(lx, -bh / 2, 2 * DPR, bh); } fctx.globalAlpha = a;   // полосы скорости
  const spr = hero32(k, formOf(k), { ang: 105, atk: true, lean: 1, crouch: 1, legs: 'lunge' }), sc0 = Math.max(1, Math.floor(bh * 1.05 / spr.height)), csl = sil32(spr, c), CP = { length: spr.height, 0: { length: spr.width } }, sc = sc0;
  fctx.imageSmoothingEnabled = false; const px = -w * .32 + Math.sin(t * 20) * 2 * DPR, pw = spr.width * sc0, ph = spr.height * sc0;
  fctx.globalAlpha = a * .5; fctx.drawImage(csl, px - sc0 * 2, -ph / 2 - sc0, pw, ph); fctx.globalAlpha = a;
  fctx.drawImage(spr, px, -ph / 2, pw, ph);
  const fs = Math.round(bh * .2), name = (US.aw ? '★ ' : '') + ULTS[k][0].toUpperCase();
  fctx.font = `${fs}px "Press Start 2P", monospace`; fctx.textAlign = 'left'; fctx.textBaseline = 'middle'; fctx.lineWidth = Math.max(3, fs / 3); fctx.strokeStyle = '#000';
  const tx = -w * .32 + sc * 9;
  fctx.fillStyle = '#a59fc0'; fctx.font = `${Math.round(fs * .55)}px "Press Start 2P", monospace`; fctx.strokeText(CLASSES[k].n.toUpperCase(), tx, -fs * .9); fctx.fillText(CLASSES[k].n.toUpperCase(), tx, -fs * .9);
  fctx.font = `${fs}px "Press Start 2P", monospace`; fctx.fillStyle = c;
  const mw = w * .62 - sc * 9, tw = fctx.measureText(name).width, k2 = tw > mw ? mw / tw : 1;
  fctx.save(); fctx.translate(tx, fs * .35); fctx.scale(k2, 1); fctx.strokeText(name, 0, 0); fctx.fillText(name, 0, 0); fctx.restore();
  fctx.restore(); fctx.textBaseline = 'alphabetic'; fctx.textAlign = 'center';
}

/* ---------- крупная пиксельная графика для ульт ---------- */
const ART = {
  sword: ["..W..", ".WSW.", ".WSW.", ".WSW.", ".WSW.", ".WSW.", ".WSW.", ".WSW.", ".WSW.", "GGGGG", "..H..", "..H..", "..H..", ".GGG."],
  hammer: ["GGGGGGGGGGG", "GWWWWWWWWWG", "GWYYYYYYYWG", "GWYYYYYYYWG", "GWYYYYYYYWG", "GGGGGGGGGGG", "....HHH....", "....HHH....", "....HHH....", "....HHH....", "....HHH....", "....GGG...."],
  shield: [".SSSSSSS.", "SWWWWWWWS", "SWBBGBBWS", "SWBGGGBWS", "SWBBGBBWS", "SWBBGBBWS", ".SWBBBWS.", ".SWBBBWS.", "..SWBWS..", "...SWS...", "....S...."],
  skull: ["..WWWWWWW..", ".WWWWWWWWW.", "WWWWWWWWWWW", "WWKKWWWKKWW", "WWKKWWWKKWW", "WWWWWKWWWWW", ".WWWWWWWWW.", "..WKWKWKW..", "..WWWWWWW..", "...W.W.W..."],
  palm: [".W.W.W...", ".W.W.W.W.", ".W.W.W.W.", ".WWWWWWW.", ".WWWWWWW.", "WWWWWWWW.", ".WWWWWWW.", "..WWWWW..", "..WWWWW.."],
  flask: ["..WWW..", "...G...", "..GGG..", ".GLLLG.", "GLLLLLG", "GLLBLLG", "GLLLLLG", ".GLLLG.", "..GGG.."],
  card: ["KKKKKKK", "KWWWWWK", "KWWWWWK", "KWWWWWK", "KWWWWWK", "KWWWWWK", "KWWWWWK", "KWWWWWK", "KWWWWWK", "KKKKKKK"],
  arrow: [".W.", "WWW", ".S.", ".S.", ".S.", ".S.", ".S.", ".S.", "GSG", "G.G"],
  clock: [],
};
const artCache = {};
function artCv(name, cols, key) {
  const k = name + (key || JSON.stringify(cols)); if (artCache[k]) return artCache[k];
  const P = ART[name], c = document.createElement('canvas'); c.width = P[0].length; c.height = P.length; const x = c.getContext('2d');
  P.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && cols[ch]) { x.fillStyle = cols[ch]; x.fillRect(i, j, 1, 1); } }));
  return artCache[k] = c;
}
// нарисовать крупный спрайт: центр (x,y), масштаб, поворот, прозрачность, светящаяся обводка
function art(name, cols, x, y, sc = 1, rot = 0, a = 1, glow) {
  const c = artCv(name, cols); ctx.save(); ctx.globalAlpha = a; ctx.translate(Math.round(x), Math.round(y)); if (rot) ctx.rotate(rot); ctx.imageSmoothingEnabled = false;
  if (glow) { const g = artCv(name, Object.fromEntries(Object.keys(cols).map(k => [k, glow])), 'g' + name + glow); ctx.globalAlpha = a * .5; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(g, -c.width * sc / 2 + ox, -c.height * sc / 2 + oy, c.width * sc, c.height * sc); ctx.globalAlpha = a; }
  ctx.drawImage(c, -c.width * sc / 2, -c.height * sc / 2, c.width * sc, c.height * sc); ctx.restore();
}
const tint = (col, a) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(camX - 6, camY - 6, W + 12, H + 12); ctx.globalAlpha = 1; };
function bolt3(x1, y1, x2, y2, c, w = 1) { for (let o = -w; o <= w; o++) bolts.push({ x1: x1 + o, y1, x2: x2 + o, y2, l: .14, c: o ? c : '#ffffff' }); }
const near = n => live().sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y)).slice(0, n);

function clsUlt(dmg) {
  const k = cls(), c = CL().c, hx = hero.x, hy = hero.y;
  switch (k) {
    case 'war': {   // три кольца гигантских мечей по спирали, затем меч с неба
      const S0 = { G: '#ffd84a', W: '#ffffff', S: '#c9ced6', H: '#6a4a2a' };
      for (let r = 0; r < 3; r++) fx1(1.1, p => { const R = 8 + p * (40 + r * 18), n = 8; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + p * (5 + r) * (r % 2 ? -1 : 1) + r; art('sword', S0, hx + Math.cos(a) * R, hy - 4 + Math.sin(a) * R * .7, 1, a + 1.57, 1 - p * .7, '#ffffff'); } });
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; later(.1 + i * .02, () => { let best = null, bd = 1e9; for (const m of live()) { const da = Math.abs(((Math.atan2(m.y - hy, m.x - hx) - a + 9.42) % 6.283) - 3.14); if (da < bd) { bd = da; best = m; } } if (best) waves.push({ x: hx, y: hy - 4, t: best, sp: 260, a, l: 1.5, fin: true, bounce: true, dmg: dmg * .45, left: 0 }); }); }
      const t = near(1)[0] || hero, tx = t.x, ty = t.y;
      fx1(.9, p => { const e = Math.min(1, p / .55), y = ty - 110 + 104 * e * e; art('sword', S0, tx, y - 18, 3, 0, 1, '#ffffff');  },
        () => {});
      later(.5, () => { ring(tx, ty - 2, 50, '#ffffff'); ring(tx, ty - 2, 30, '#c9ced6'); groundMark(tx, ty + 2, 30, '#ffffff'); groundMark(tx, ty + 2, 30, '#ff9a3c'); for (const m of live()) hitMob(m, dmg * (Math.hypot(m.x - tx, m.y - ty) < 50 ? .8 : .2), true, true, '#ffffff'); shake = 16; flashT = .12; sfx.boom(); });
      break; }
    case 'bers': {   // кровавый смерч: спираль, кровавый дождь, финальный взрыв
      fx1(3.2, p => { tint('#3a0000', .25);
        for (let L = 0; L < 5; L++) for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 + time * (10 + L * 2) * (L % 2 ? -1 : 1), R = 8 + L * 5 + Math.sin(time * 6 + L) * 2; const yy = hy - 4 - L * 3; pix(hx + Math.cos(a) * R, yy + Math.sin(a) * R * .45, i % 3 ? '#ff2222' : '#ffffff'); }
        for (let i = 0; i < 4 && parts.length < 600; i++) parts.push({ x: camX + rnd() * W, y: camY, vx: -8, vy: 90 + rnd() * 40, l: 1.2, c: rnd() < .7 ? '#aa0a0a' : '#ff3344' }); });
      for (let i = 0; i < 15; i++) later(.2 + i * .2, () => { hero.spin = .2; hitAround(hx, hy, 30, dmg * .12, '#ff6644'); hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .03); shake = Math.max(shake, 4); tone(140, .08, 'sawtooth', .03, 70); });
      later(3.2, () => { ring(hero.x, hero.y - 3, 60, '#ff2222'); ring(hero.x, hero.y - 3, 40, '#ffffff'); for (const m of live()) hitMob(m, dmg * .6, true, true, '#ff4433'); for (let i = 0; i < 60 && parts.length < 600; i++) { const a = rnd() * 6.283; parts.push({ x: hero.x, y: hero.y - 4, vx: Math.cos(a) * 120, vy: Math.sin(a) * 80, l: .7, c: '#ff2222' }); } shake = 14; flashT = .1; sfx.boom(); });
      break; }
    case 'pal': {   // небеса раскрываются, крылья света, гигантский молот, крест
      const t = live().sort((a, b) => b.hp - a.hp)[0] || hero, tx = t.x, ty = t.y, HC = { G: '#b08a3a', W: '#ffffff', Y: '#ffe08a', H: '#8a6a3a' };
      fx1(1.4, p => { tint('#fff6c0', .08 * (1 - p)); for (let i = 0; i < 7; i++) { const lx = camX + (i + .5) * W / 7 + Math.sin(time + i) * 4; ctx.globalAlpha = .25 * (1 - p); ctx.fillStyle = '#fff6c0'; ctx.fillRect(Math.round(lx), camY - 6, 3, H + 12); } ctx.globalAlpha = 1;
        for (let s = -1; s <= 1; s += 2) for (let f = 0; f < 6; f++) for (let j = 0; j < 10 - f; j++) pix(hero.x + s * (4 + j + f), hero.y - 6 - f * 2 + j * .4 - p * 2, f % 2 ? '#ffffff' : '#ffe08a'); });
      fx1(.6, p => { const e = p * p, y = ty - 120 + 106 * e; art('hammer', HC, tx, y - 14, 3, -.6 + .6 * e, 1, '#ffffff'); ctx.globalAlpha = .5; circ(tx, ty, 26 * (1 - p) + 4, '#ffe08a', 30); ctx.globalAlpha = 1; },
        () => { for (let i = 0; i < 3; i++) later(i * .12, () => ring(tx, ty - 2, 30 + i * 18, i % 2 ? '#ffffff' : '#ffe08a')); burst(tx, ty - 3, '#ffe08a', 70, 100); groundMark(tx, ty + 2, 30, '#ffe08a'); groundMark(tx, ty + 2, 26, '#ffffff');
          for (const m of live()) hitMob(m, dmg * (Math.hypot(m.x - tx, m.y - ty) < 50 ? 1.4 : .5), true, true, '#fff2a8'); hero.hp = D.maxHP; hero.shield = Math.max(hero.shield, D.maxHP * .5); shake = 18; flashT = .2; sfx.boom();
          fx1(1.2, p => { ctx.globalAlpha = 1 - p; ctx.fillStyle = '#fff6c0'; const yy = ty - 8 - p * 20; ctx.fillRect(Math.round(tx) - 2, Math.round(yy - 30), 5, 36); ctx.fillRect(Math.round(tx) - 12, Math.round(yy - 20), 25, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(tx), Math.round(yy - 30), 1, 36); ctx.fillRect(Math.round(tx) - 12, Math.round(yy - 18), 25, 1); ctx.globalAlpha = 1; }); });
      break; }
    case 'guard': {   // гигантский щит врезается в землю, купол из шестиугольников
      hero.iframe = 3; const SC0 = { S: '#5a6a8a', W: '#ffffff', B: '#8fb0d0', G: '#ffd84a' };
      fx1(.35, p => { art('shield', SC0, hero.x + hero.face * 8, hero.y - 60 + 52 * p * p, 3, 0, 1, '#ffffff'); },
        () => { shake = 18; flashT = .15; sfx.boom(); groundMark(hero.x + hero.face * 8, hero.y + 2, 30, '#8fb0d0');
          for (const m of live()) { const dx = m.x - hero.x, dy = m.y - hero.y, d = Math.hypot(dx, dy) || 1; m.kx += dx / d * 300; m.ky += dy / d * 300; if (!m.boss) m.frz = 3; hitMob(m, dmg * .9, true, true, '#8fb0d0'); }
          for (let i = 0; i < 3; i++) ring(hero.x, hero.y - 3, 25 + i * 20, i % 2 ? '#ffffff' : '#8fb0d0'); });
      fx1(3.3, p => { art('shield', SC0, hero.x + hero.face * 8, hero.y - 8, 3, 0, Math.min(1, (1 - p) * 4), '#ffffff');
        const R = 22; ctx.globalAlpha = .55; for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) { const a = i / 10 * 3.1416 + .0 + (j % 2) * .16, rr = R * (1 - j * .22); const px = hero.x + Math.cos(Math.PI + a) * rr, py = hero.y - 2 - Math.abs(Math.sin(a)) * rr * .9; circ(px, py, 2.5, (i + j) % 3 ? '#8fb0d0' : '#ffffff', 6, 1, time * 2); } ctx.globalAlpha = 1; });
      break; }
    case 'mage': {   // небо горит, огромные метеоры с хвостами и дымом, финальный гигант
      fx1(2.2, p => { tint('#ff5a00', .16); for (let i = 0; i < 3 && parts.length < 600; i++) parts.push({ x: camX + rnd() * W, y: camY + H, vx: rnd() * 10 - 5, vy: -40, l: 1, c: rnd() < .5 ? '#ff9a3c' : '#ffdd66', f: 1 }); });
      for (let i = 0; i < 12; i++) later(.1 + i * .12, () => { const all = live(); const m = all[Math.floor(rnd() * all.length)]; if (!m) return; const mx = m.x, my = m.y;
        dropFx(mx + 50, my - 100, m, .35, '#ff7a20', 6, () => { ring(mx, my - 2, 22, '#ff9a3c'); burst(mx, my - 3, '#ff9a3c', 22, 60); burst(mx, my - 3, '#555555', 10, 25); hitAround(mx, my, 22, dmg * .4, '#ff9a3c'); groundMark(mx, my + 2, 22, '#ff9a3c'); shake = Math.max(shake, 6); sfx.boom(); }); });
      later(1.6, () => { const t = live().sort((a, b) => b.hp - a.hp)[0]; if (!t) return; const tx = t.x, ty = t.y;
        fx1(.5, p => { const e = p * p, x = tx + 80 * (1 - e), y = ty - 3 - 150 * (1 - e); ctx.globalAlpha = .5; for (let j = 1; j < 10; j++) dot(x + j * 5, y - j * 9, 14 - j, j % 2 ? '#ff5a00' : '#ffcc33'); ctx.globalAlpha = 1; dot(x, y, 14, '#ff7a20'); dot(x, y, 9, '#ffdd66'); dot(x, y, 4, '#ffffff'); },
          () => { for (let i = 0; i < 3; i++) ring(tx, ty - 2, 30 + i * 22, i % 2 ? '#ffdd66' : '#ff6622'); for (const m of live()) hitMob(m, dmg * (Math.hypot(m.x - tx, m.y - ty) < 60 ? 1.2 : .3), true, true, '#ff9a3c'); groundMark(tx, ty + 2, 30, '#ff9a3c'); groundMark(tx + 12, ty, 24, '#ff6622'); groundMark(tx - 12, ty + 3, 24, '#ff6622'); shake = 20; flashT = .2; sfx.boom(); }); });
      break; }
    case 'sham': {   // грозовой фронт, толстые ветвистые молнии, вспышки
      fx1(1.6, p => { const a = p < .15 ? p / .15 : p > .8 ? (1 - p) / .2 : 1; tint('#05081a', .45 * a); ctx.globalAlpha = .8 * a; for (let i = 0; i < 60; i++) { const x = camX + (i * 23 % (W + 20)) - 10 + Math.sin(time * 1.5 + i) * 4, y = camY + (i * 7 % 14); dot(x, y, 8, i % 4 ? '#1e2236' : '#323a5a'); } ctx.globalAlpha = 1; });
      for (let r = 0; r < 4; r++) later(.2 + r * .3, () => { for (const m of live()) { const x0 = m.x + (rnd() - .5) * 20; let px = x0, py = camY + 8; const steps = 6; for (let s = 1; s <= steps; s++) { const nx = x0 + (m.x - x0) * s / steps + (s < steps ? (rnd() - .5) * 10 : 0), ny = camY + 8 + (m.y - 3 - camY - 8) * s / steps; bolt3(px, py, nx, ny, r % 2 ? '#ffffff' : '#99eeff', 1); if (rnd() < .3) bolts.push({ x1: nx, y1: ny, x2: nx + (rnd() - .5) * 14, y2: ny + 6, l: .1, c: '#ccf6ff' }); px = nx; py = ny; } hitMob(m, dmg * .3, true, r === 3, '#ccf6ff'); groundMark(m.x, m.y + 2, 10, '#99eeff'); } flashT = .12; shake = 8; tone(2000, .15, 'square', .04, 100); tone(60, .4, 'sawtooth', .05, 30, .05); });
      for (let i = 0; i < 3; i++) totems.push({ x: hx + (i - 1) * 14, y: hy + 6, t: 14, cd: .3 });
      break; }
    case 'arch': {   // светящаяся стрела в небо, волны ливня, гигантская стрела в сильнейшего
      const AC = { W: '#ffffff', S: '#5cff8a', G: '#2f8a4f' };
      fx1(.35, p => { art('arrow', AC, hx, hy - 10 - p * 90, 2, 0, 1, '#5cff8a'); });
      fx1(2.2, p => tint('#002a10', .2));
      for (let w = 0; w < 4; w++) for (let i = 0; i < 18; i++) later(.4 + w * .4 + i * .015, () => { const all = live(); const m = all[Math.floor(rnd() * all.length)]; if (!m) return; const x = m.x + (rnd() - .5) * 10;
        fx1(.18, p => art('arrow', AC, x - 6 * (1 - p), m.y - 60 + 56 * p, 1, Math.PI + .1, 1), () => { if (!m.dead) hitMob(m, dmg * .05, false, false, '#5cff8a'); burst(x, m.y - 3, '#5cff8a', 3, 20); }); });
      later(2.2, () => { const t = live().sort((a, b) => b.hp - a.hp)[0]; if (!t) return; fx1(.25, p => art('arrow', AC, t.x, t.y - 100 + 94 * p, 4, Math.PI, 1, '#ffffff'), () => { ring(t.x, t.y - 2, 30, '#5cff8a'); hitMob(t, dmg * 1.5, true, true, '#5cff8a'); groundMark(t.x, t.y + 2, 20, '#ffffff'); shake = 12; flashT = .1; sfx.boom(); }); });
      break; }
    case 'assa': {   // тьма, герой-тень, огромные разрезы, финальный «щелчок» — все враги рассечены
      const tg = near(12);
      fx1(.4 + tg.length * .1 + .5, p => { tint('#0a0014', .6); });
      tg.forEach((m, i) => later(.15 + i * .1, () => { if (m.dead) return; const px0 = hero.x, py0 = hero.y; blinkTo(m, true); bolts.push({ x1: px0, y1: py0 - 4, x2: hero.x, y2: hero.y - 4, l: .3, c: '#9a7aff' }); burst(hero.x, hero.y - 4, '#4a3a6a', 10, 40); tone(1300 + i * 60, .05, 'triangle', .03, 500);
        const mx = m.x, my = m.y - 4, a0 = rnd() * 3.14; fx1(.8, p => { const L = 30 * Math.min(1, p * 6); ctx.globalAlpha = 1 - p * .6; for (let j = -L; j <= L; j++) { pix(mx + Math.cos(a0) * j, my + Math.sin(a0) * j, '#ffffff'); pix(mx + Math.cos(a0) * j, my + Math.sin(a0) * j + 1, '#9a7aff'); } ctx.globalAlpha = 1; }); }));
      later(.3 + tg.length * .1 + .3, () => { flashT = .2; shake = 14; ring(hero.x, hero.y - 3, 40, '#9a7aff'); for (const m of tg) if (!m.dead) { hitMob(m, dmg * 2, true, true, '#9a7aff'); burst(m.x, m.y - 4, '#ffffff', 12, 50); } tone(3000, .05, 'square', .05, 800); tone(80, .3, 'sawtooth', .05, 40, .05); });
      hero.iframe = tg.length * .1 + 1; break; }
    case 'gamb': {   // веер гигантских карт кружится, каждая переворачивается, золотой дождь
      const cards = [0, 1, 2, 3, 4].map(() => Math.floor(rnd() * 5)), SUIT = ['♥', '♦', '♣', '♠', '★'], COL = ['#ff4466', '#ffd84a', '#5cff8a', '#222244', '#44ffaa'];
      fx1(1.8, p => { tint('#001a10', .25); for (let i = 0; i < 5; i++) { const a = -2.4 + i * .45 + Math.sin(time * 2) * .05, R = 26 * Math.min(1, p * 4), x = hero.x + Math.cos(a) * R, y = hero.y - 8 + Math.sin(a) * R; const flip = Math.abs(Math.cos(Math.min(1, Math.max(0, p * 3 - i * .3)) * Math.PI)), w = Math.max(1, 3 * flip);
        ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a + 1.57); ctx.scale(w / 3, 1); ctx.drawImage(artCv('card', { K: '#000', W: i === 4 && cards[i] === 4 ? '#c8ffe8' : '#ffffff' }), -10, -15, 21, 30); ctx.restore();
        if (p * 3 - i * .3 > .5) { ctx.fillStyle = COL[cards[i]]; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); } }
        if (parts.length < 600) parts.push({ x: camX + rnd() * W, y: camY, vx: 0, vy: 60, l: 1.5, c: rnd() < .5 ? '#ffd84a' : '#fff2a0' }); });
      cards.forEach((s, i) => later(.4 + i * .25, () => { const nm = ['♥ ЧЕРВИ', '♦ БУБНЫ', '♣ ТРЕФЫ', '♠ ПИКИ', '★ ДЖОКЕР'][s], col = ['#ff4466', '#ffd84a', '#5cff8a', '#e9e4ff', '#44ffaa'][s];
        ftext(hero.x + (i - 2) * 14, hero.y - 44, nm, col, .9, 1.2); ring(hero.x, hero.y - 3, 26 + i * 6, col);
        if (s === 0) hero.hp = D.maxHP; if (s === 1) { giveBurst(zs() * D.gainMult * 40); if (rnd() < .15) giveChest('c', 'флеш-рояль'); } if (s === 2) for (const m of live()) { m.psn = Math.max(m.psn || 0, D.hit * 3); m.psnT = 4; }
        for (const m of live()) hitMob(m, dmg * (s === 3 ? .6 : s === 4 ? 1 : .25), s >= 3, s === 4, col); tone(1600 + i * 200, .06, 'triangle', .03); if (s === 4) { flashT = .15; shake = 10; } }));
      break; }
    case 'alch': {   // гигантские колбы дугой, ядовитые грибы-взрывы, пузыри по экрану
      const all = live(), FC = { W: '#e6e6e6', G: '#3a6a12', L: '#b6ff3c', B: '#ffffff' };
      fx1(2, p => { tint('#0a2a00', .22); for (let i = 0; i < 5 && parts.length < 600; i++) parts.push({ x: camX + rnd() * W, y: camY + H, vx: 0, vy: -30 - rnd() * 40, l: 1.4, c: rnd() < .5 ? '#b6ff3c' : '#e8ff8a', f: 1 }); });
      all.slice(0, 14).forEach((m, i) => later(.05 + i * .05, () => { if (m.dead) return; const x0 = hero.x, y0 = hero.y - 8, tx = m.x, ty = m.y - 2;
        fx1(.45, p => { const x = x0 + (tx - x0) * p, y = y0 + (ty - y0) * p - Math.sin(p * Math.PI) * 30; art('flask', FC, x, y, 1.5, p * 12, 1); }, () => { if (clouds.length < 40) clouds.push({ x: tx, y: ty + 1, r: 14, dps: D.hit * 2, t: 4, acid: true }); burst(tx, ty, '#b6ff3c', 14, 40); groundMark(tx, ty + 2, 14, '#b6ff3c'); }); }));
      all.forEach((m, i) => later(1 + i * .05, () => { if (m.dead) return; const mx = m.x, my = m.y;
        fx1(.6, p => { const r = 4 + p * 14; ctx.globalAlpha = 1 - p; dot(mx, my - 6 - p * 14, r, '#b6ff3c'); dot(mx, my - 6 - p * 14, r * .6, '#e8ff8a'); ctx.fillStyle = '#7aa02a'; ctx.fillRect(Math.round(mx) - 1, Math.round(my - 6 - p * 14), 3, Math.round(6 + p * 14)); ctx.globalAlpha = 1; });
        ring(mx, my - 2, 16, '#b6ff3c'); hitAround(mx, my, 16, dmg * .5, '#b6ff3c'); tone(500 + i * 20, .05, 'square', .02, 150); shake = Math.max(shake, 4); })); break; }
    case 'priest': {   // небеса: нимб и крылья над героем, широкие столпы, падающие перья
      fx1(1.8, p => { tint('#fff6c0', .1 * (1 - p)); const hy2 = hero.y - 26; ctx.globalAlpha = .9; circ(hero.x, hy2, 10, '#ffe08a', 30, .35, time); circ(hero.x, hy2, 9, '#ffffff', 20, .35, -time);
        for (let s = -1; s <= 1; s += 2) for (let f = 0; f < 8; f++) for (let j = 0; j < 16 - f * 1.5; j++) pix(hero.x + s * (4 + j), hy2 + 4 + f * 2 - j * .5 + Math.sin(time * 6) * (j / 8), f % 2 ? '#ffffff' : '#fff6c0'); ctx.globalAlpha = 1;
        if (parts.length < 600) parts.push({ x: camX + rnd() * W, y: camY, vx: Math.sin(time * 3) * 10, vy: 22, l: 2.5, c: '#ffffff', f: 1 }); });
      live().forEach((m, i) => later(.2 + i * .05, () => { if (m.dead) return; const mx = m.x, my = m.y;
        fx1(.7, p => { const w = Math.round(10 * (1 - p)) + 2; ctx.globalAlpha = 1 - p * .6; ctx.fillStyle = '#fff6c0'; ctx.fillRect(Math.round(mx - w / 2), Math.round(camY - 6), w, Math.round(my - camY + 6)); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(mx - w / 6), Math.round(camY - 6), Math.max(1, Math.round(w / 3)), Math.round(my - camY + 6)); ctx.globalAlpha = 1; circ(mx, my, 12 * (1 - p) + 4, '#ffe08a', 20); });
        groundMark(mx, my + 2, 16, '#fff6c0'); hitMob(m, dmg * 1.1, true, true, '#fff6c0'); tone(880 + i * 30, .1, 'sine', .02, 1760); }));
      hero.hp = D.maxHP; hero.psnT = 0; hero.slowT = 0; break; }
    case 'monk': {   // золотое пламя ауры, огромные ладони-удары, финальная ладонь с неба
      const tg = near(6), PC = { W: '#ffcc66' };
      fx1(2.2, p => { tint('#2a1400', .2); for (let i = 0; i < 4 && parts.length < 600; i++) parts.push({ x: hero.x + (rnd() - .5) * 14, y: hero.y - rnd() * 6, vx: 0, vy: -60, l: .4, c: rnd() < .5 ? '#ffaa55' : '#ffe08a', f: 1 }); });
      for (let i = 0; i < 30; i++) later(.1 + i * .055, () => { const m = tg[i % Math.max(1, tg.length)]; if (!m || m.dead) return; hero.fists = .1; hero.swingA = Math.atan2(m.y - hero.y, m.x - hero.x); hitMob(m, dmg * .14, false, i % 6 === 0, '#ffaa55'); if (i % 3 === 0) tone(300 + i * 10, .03, 'square', .02);
        const px = m.x + (rnd() - .5) * 10, py = m.y - 6 + (rnd() - .5) * 6, rr = (rnd() - .5) * .8; fx1(.3, p => art('palm', PC, px, py, 1.5 + p, rr, 1 - p, '#ffffff')); });
      later(1.9, () => { const t = tg[0]; if (!t) return; const tx = t.x, ty = t.y;
        fx1(.35, p => art('palm', PC, tx, ty - 80 + 72 * p * p, 5, 0, 1, '#ffffff'), () => { for (let i = 0; i < 3; i++) ring(tx, ty - 2, 24 + i * 16, i % 2 ? '#ffffff' : '#ffaa55'); for (const m of live()) hitMob(m, dmg * (Math.hypot(m.x - tx, m.y - ty) < 45 ? 1.2 : .3), true, true, '#ffaa55'); groundMark(tx, ty + 2, 28, '#ffffff'); shake = 18; flashT = .15; sfx.boom(); }); });
      break; }
    case 'chrono': {   // огромный циферблат на весь экран, стрелки назад, мир в синеве, стекло разбивается
      const st = live(); later(.1, () => { hero.stopT = 3; for (const m of st) { m.frz = Math.max(m.frz || 0, 3); m.stopD = 0; } });
      fx1(3.1, p => { const R = Math.min(W, H) * .42, cx = hero.x, cy = hero.y - 4; ctx.globalAlpha = .85;
        circ(cx, cy, R, '#88aaff', 90, .85); circ(cx, cy, R - 3, '#ffffff', 60, .85); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 - 1.57; for (let j = 0; j < (i % 3 ? 3 : 7); j++) pix(cx + Math.cos(a) * (R - 6 - j), cy + Math.sin(a) * (R - 6 - j) * .85, '#ffffff'); }
        const ah = -1.57 - p * 6.283 * 4, am = -1.57 - p * 6.283 * .5; for (let r = 0; r < R - 8; r++) pix(cx + Math.cos(ah) * r, cy + Math.sin(ah) * r * .85, '#ffffff'); for (let r = 0; r < R * .6; r++) { pix(cx + Math.cos(am) * r, cy + Math.sin(am) * r * .85, '#88aaff'); pix(cx + Math.cos(am) * r + 1, cy + Math.sin(am) * r * .85, '#88aaff'); } ctx.globalAlpha = 1; });
      later(3.1, () => { hero.stopT = 0; flashT = .3; shake = 16;
        fx1(.6, p => { ctx.globalAlpha = 1 - p; for (let k2 = 0; k2 < 10; k2++) { let a = k2 / 10 * 6.283, px = hero.x, py = hero.y - 4; for (let s = 0; s < 40; s++) { a += (Math.sin(k2 * 7 + s) * .3); px += Math.cos(a) * 2; py += Math.sin(a) * 1.6; pix(px, py, '#ffffff'); } } ctx.globalAlpha = 1; });
        for (const m of st) { const d0 = m.stopD || 0; m.stopD = undefined; if (!m.dead) { ring(m.x, m.y - 3, 12, '#88aaff'); hitMob(m, dmg * .6 + d0 * 2, true, true, '#88aaff'); } } sfx.boom(); tone(3000, .2, 'triangle', .04, 200); }); break; }
    case 'rune': {   // гигантский многослойный магический круг, руны загораются по очереди, столпы
      const all = live();
      fx1(2.4, p => { const a = p < .15 ? p / .15 : p > .85 ? (1 - p) / .15 : 1, R = 70 * a; tint('#14002a', .3 * a); ctx.globalAlpha = .85;
        circ(hero.x, hero.y, R, '#bb88ff', 120, .55, p * 2); circ(hero.x, hero.y, R * .82, '#e0ccff', 90, .55, -p * 3); circ(hero.x, hero.y, R * .55, '#bb88ff', 60, .55, p * 5); circ(hero.x, hero.y, R * .3, '#ffffff', 30, .55, -p * 7);
        for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283 + p * 2, gx = hero.x + Math.cos(an) * R * .91, gy = hero.y + Math.sin(an) * R * .91 * .55; ctx.fillStyle = i % 2 ? '#ffffff' : '#bb88ff'; ctx.fillRect(Math.round(gx) - 1, Math.round(gy) - 2, 3, 1); ctx.fillRect(Math.round(gx), Math.round(gy) - 2, 1, 5); ctx.fillRect(Math.round(gx) - 1, Math.round(gy) + 1, 3, 1); }
        for (let i = 0; i < 6; i++) { const a1 = i / 6 * 6.283 + p, a2 = (i + 2) / 6 * 6.283 + p; line(hero.x + Math.cos(a1) * R * .55, hero.y + Math.sin(a1) * R * .3, hero.x + Math.cos(a2) * R * .55, hero.y + Math.sin(a2) * R * .3, '#bb88ff'); } ctx.globalAlpha = 1; });
      all.forEach((m, i) => { runes.push({ x: m.x, y: m.y, t: .6 + i * .08, m, r: 18, res: false, big: dmg * .7 });
        later(.6 + i * .08, () => { const mx = m.x, my = m.y; fx1(.5, p => { ctx.globalAlpha = 1 - p; ctx.fillStyle = '#bb88ff'; ctx.fillRect(Math.round(mx) - 2, Math.round(camY - 6), 5, Math.round(my - camY + 6)); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(mx), Math.round(camY - 6), 1, Math.round(my - camY + 6)); ctx.globalAlpha = 1; }); tone(300 + i * 40, .06, 'square', .02, 900); }); });
      break; }
    case 'necro': {   // земля трескается, туман, череп над героем, руки мертвецов, луч тьмы
      const SK = { W: '#d8e8d8', K: '#7affb0' };
      fx1(2, p => { tint('#001a0a', .4); const a = Math.min(1, p * 4); art('skull', SK, hero.x, hero.y - 34 + Math.sin(time * 3) * 2, 2.5 * a, 0, a, '#7affb0'); for (let i = 0; i < 3 && parts.length < 600; i++) { const an = rnd() * 6.28, r = rnd() * 50; parts.push({ x: hero.x + Math.cos(an) * r, y: hero.y + Math.sin(an) * r * .5, vx: 0, vy: -20, l: .8, c: rnd() < .5 ? '#7affb0' : '#1a3a26', f: 1 }); } });
      for (let i = 0; i < 10; i++) later(.2 + i * .07, () => { const a = i / 10 * 6.283, x = hero.x + Math.cos(a) * 18, y = hero.y + Math.sin(a) * 11; groundMark(x, y + 2, 10, '#7affb0');
        fx1(.4, p => { ctx.fillStyle = '#d8e8d8'; const hh = Math.round(6 * p); ctx.fillRect(Math.round(x), Math.round(y - hh), 1, hh); ctx.fillRect(Math.round(x) - 2, Math.round(y - hh), 5, 1); }, () => { allies.push({ x, y, t: 15, cd: .3, face: 1 }); burst(x, y - 3, '#7affb0', 10, 30); }); });
      later(1.1, () => { for (const m of live()) { bolt3(hero.x, hero.y - 34, m.x, m.y - 3, '#7affb0', 1); hitMob(m, dmg * .8, true, true, '#7affb0'); groundMark(m.x, m.y + 2, 10, '#7affb0'); } flashT = .15; shake = 12; tone(70, .6, 'sawtooth', .06, 35); tone(400, .3, 'square', .03, 100); });
      break; }
    case 'reap': {   // гигантская коса трижды проходит по кругу со шлейфом, души высасываются из врагов
      hero.souls = 5 + Math.floor(25 * cq(1)) + (aw() ? 20 : 0);
      fx1(1.6, p => { tint('#14001a', .35); for (const m of live()) if (rnd() < .15 && parts.length < 600) orbs.push({ x: m.x, y: m.y - 4, vx: 0, vy: -30, c: '#ff44ff', t: 0 }); });
      for (let s2 = 0; s2 < 3; s2++) later(.15 + s2 * .35, () => { const a0 = s2 * 2.1, dir = s2 % 2 ? -1 : 1;
        fx1(.35, p => { const R = 70; for (let tr = 0; tr < 5; tr++) { const a = a0 + dir * 6.283 * Math.max(0, p - tr * .03); ctx.globalAlpha = (1 - tr * .2) * (1 - p * .4);
          for (let r = 10; r < R; r++) pix(hero.x + Math.cos(a) * r, hero.y - 4 + Math.sin(a) * r * .7, '#3a2a3a');
          for (let b = 0; b < 26; b++) { const ba = a + dir * b * .045, br = R - b * .9; for (let w = 0; w < 4; w++) pix(hero.x + Math.cos(ba) * (br - w), hero.y - 4 + Math.sin(ba) * (br - w) * .7, w === 0 ? '#ffffff' : tr ? '#ff44ff' : '#c9ced6'); } } ctx.globalAlpha = 1; });
        ring(hero.x, hero.y - 3, 66, '#ff44ff'); for (const m of live()) hitMob(m, dmg * .45, true, s2 === 2, '#ff44ff'); shake = 10; tone(200 - s2 * 30, .15, 'sawtooth', .05, 70); });
      break; }
  }
}

function fireUlt(auto) {
  if (ultCd > 0 || US || skyOn('nv_noult')) return;
  ultCd = skyOn('nv_ultonly') ? 3 : Math.max(3, ULT_CD - (trHas('glass') ? 2 : 0) - relUltCd()); ult = 0;
  const dmg = D.hit * 15 * (1 + ta('ultd')) * (1 + ta('x_ultra')) * (1 + D.crit * (D.critM - 1)) * comboM() * (1 + skyV('ult')) * relUltM() * (1 + (D.ultSig || 0));
  const fd = dmg * (aw() ? 2 : 1) * (1 + .15 * ctL('U1')); ultStart(fd); if (auto) US.auto = true;   // автоульта — без плашки с названием
  if (skyOn('sk_ult2')) later(2.2, () => { if (deathT <= 0) clsUlt(fd * .6); });   // заряд → кат-ин → удар; своя ульта у каждого класса, пробуждённая ×2
}
function onTap(e) {
  audio();
  const r = fx.getBoundingClientRect();
  const x = (e.clientX - r.left) / SC + camX, y = (e.clientY - r.top) / SC + camY;
  if (tapCd > 0) return;
  tapCd = .12;
  const nowT = performance.now() / 1000;
  tapStreak = nowT - lastTap < .45 ? tapStreak + 1 : 0; lastTap = nowT;
  if (Math.hypot(hero.x - x, hero.y - 4 - y) < 9) { heroDash(); return; }
  if (ult >= 1) { fireUlt(); return; }
  // слабое место вожака
  const b = mobs.find(m => m.ws && !m.dead && Math.hypot(m.x + m.ws.ox - x, m.y + m.ws.oy - y) < 6);
  if (b) {
    const d = D.hit * 12 * (1 + ta('weak')) * (skyOn('sk_weak') ? 2 : 1) * (b.boss ? 1 : 1 + ksL(5, 0)) * (1 + D.crit * (D.critM - 1)) * comboM() * condDmg(b);
    hitMob(b, d, true, false, '#ffee66');
    ftext(b.x, b.y - 22, 'СЛАБОЕ МЕСТО! ' + fmt(d), '#ffee66', 1.3, 1);
    burst(b.x + b.ws.ox, b.y + b.ws.oy, '#ffee66', 18, 50); flashT = Math.max(flashT, .06); slowT = Math.max(slowT, .12); shake = Math.max(shake, 5);
    tone(1200, .08, 'square', .05, 500); tone(1800, .12, 'triangle', .04, 0, .05);
    addUlt(.08); if (combo) comboT = comboTime();
    if (!b.dead) moveWS(b);
    return;
  }
  bolts.push({ x1: x + (rnd() - .5) * 10, y1: -2, x2: x, y2: y, l: .14, c: '#fff8a0' });
  burst(x, y, '#fff8a0', 8, 35);
  let hit = false;
  for (const m of mobs) if (!m.dead && Math.hypot(m.x - x, m.y - 3 * m.sz - y) < 9 + 4 * m.sz) {
    const crit = rnd() < D.crit;
    hitMob(m, D.hit * 1.2 * (1 + ta('tap')) * (1 + ta('x_tapper')) * condDmg(m) * (1 + .05 * Math.min(40, tapStreak)) * comboM() * (crit ? D.critM : 1), crit, true, tapStreak >= 10 ? '#ffaa33' : '#fff8a0'); hit = true;
  }
  if (ksL(5, 1)) { for (const m of mobs) if (!m.dead) hitMob(m, D.hit * .2 * ksL(5, 1) * (1 + ta('tap')), false, false, '#fff8a0'); hit = true; }
  sfx.tap();
  if (hit) { shake = Math.max(shake, 1.5); addUlt(.015); if (combo) comboT = Math.min(comboTime(), comboT + .5); }
  if (tapStreak >= 5 && tapStreak % 5 === 0 && texts.length < 30) ftext(x, y - 8, 'ТАП ×' + (1 + .05 * Math.min(40, tapStreak)).toFixed(2), '#ffaa33', .9, .6);
}
fx.addEventListener('pointerdown', e => { e.preventDefault(); onTap(e); });

/* ---------- понятность боя: источники урона, подписи эффектов ---------- */
const SRC_BY_COL = { '#ff6644': 'Вихрь топоров', '#fff2a8': 'Святой молот', '#ffe9a0': 'Святая аура', '#5cff8a': 'Стрелы', '#44ffaa': 'Карты', '#ffaa55': 'Кулаки', '#88aaff': 'Отсрочка', '#bb88ff': 'Руны', '#ff44ff': 'Коса', '#fff6c0': 'Свет', '#ff4466': 'Карты', '#ffd84a': 'Карты', '#228844': 'Карты', '#99ccff': 'Громовой шаг', '#ff8844': 'Сферы', '#ccccff': 'Эхо', '#b08a5a': 'Землетрясение', '#ff7744': 'Детонация', '#7affb0': 'Союзники', '#ffe08a': 'Рикошет', '#7affd8': 'Духи', '#9a7aff': 'Притяжение', '#ff6622': 'Огонь', '#ff9a3c': 'Огонь', '#d9a0ff': 'Плазма', '#99eeff': 'Молния', '#ccf6ff': 'Молния', '#cc9966': 'Шипы', '#ff88ff': 'Ульта',
  '#ff8877': 'Сокрушение', '#66ccff': 'Скорость', '#ff9988': 'Рассечение', '#ff5544': 'Мясник', '#ffffff': 'Финишер', '#ffee66': 'Слабое место', '#fff8a0': 'Тап', '#ffaa33': 'Тап' };
const SRC_COL = { 'Удар': '#e9e4ff', 'Яд': '#88ee22', 'Кровотечение': '#ff3355', 'Казнь': '#f0f0f0' };
for (const c in SRC_BY_COL) SRC_COL[SRC_BY_COL[c]] = SRC_COL[SRC_BY_COL[c]] || c;
const DS = {};
const trackDmg = (src, d) => { if (d > 0 && isFinite(d)) DS[src] = (DS[src] || 0) + d; };
function renderDS() {
  const e = Object.entries(DS).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]), tot = e.reduce((a, x) => a + x[1], 0);
  const bar = $('dsrc').firstElementChild, leg = $('dsrc').lastElementChild;
  if (!tot) { bar.innerHTML = ''; leg.textContent = 'Источники урона появятся в бою'; return; }
  bar.innerHTML = e.map(([k, v]) => `<i style="width:${v / tot * 100}%;background:${SRC_COL[k] || '#888'}"></i>`).join('');
  leg.innerHTML = 'Урон: ' + e.slice(0, 4).map(([k, v]) => `<b style="color:${SRC_COL[k] || '#888'}">${k} ${Math.round(v / tot * 100)}%</b>`).join(' · ');
  for (const k in DS) DS[k] *= .85;
}
// короткая подпись эффекта героя при срабатывании (не чаще раза в 15с на эффект)
const lblT = {};
function fxLabel(key, x, y, c) { if (SIM) return; if (time - (lblT[key] ?? -99) < 15) return; lblT[key] = time; const L = S.meta.lbl || (S.meta.lbl = {}); if ((L[key] = (L[key] || 0) + 1) > 3) return; ftext(x, y, key, c, .85, 1.3); }   // название эффекта показываем первые 3 раза — потом игрок его знает
const RING_LABEL = { '#ff6622': 'Огненное кольцо', '#ff9a3c': 'Метеор', '#cc9966': 'Терновая волна', '#66ccff': 'Вихрь', '#ff9988': 'Вихрь клинков', '#ff5544': 'Мясник', '#aabbcc': 'Второе дыхание' };
let hurtV = 0;
const seenRole = {};

/* ---------- бой: атаки вожаков, роли врагов, события ---------- */
let echoes = [], trailPts = [], pix2 = [], tele = [], proj = [], hitStop = 0, ev = null, evNext = 100;
const EVS = {
  inv: { n: 'НАШЕСТВИЕ', d: 30, g: 3, c: '#ff9a3c', sub: 'втрое больше врагов · награды ×3' },
  gob: { n: 'ЗОЛОТОЙ ГОБЛИН', d: 15, g: 1, c: '#ffd84a', sub: 'он убегает с сундуком — догони и добей тапами!' },
  moon: { n: 'КРОВАВАЯ ЛУНА', d: 40, g: 5, c: '#ff2a4a', sub: 'враги сильнее · награды ×5' },
  treasure: { n: 'СОКРОВИЩНИЦА', d: 25, g: 2, c: '#ffd84a', sub: 'враги роняют сундуки · награды ×2' },
  elite: { n: 'ЭЛИТНЫЙ ПАТРУЛЬ', d: 30, g: 4, c: '#c06bff', sub: 'все враги особые · награды ×4' },
};
const evGain = () => ev ? EVS[ev.type].g : 1;
function startEvent() {
  const types = ['inv', 'gob', 'moon', 'treasure', 'elite'], type = types[Math.floor(rnd() * types.length)];
  ev = { type, t: EVS[type].d };
  toast(EVS[type].n + '!', EVS[type].sub); tone(220, .2, 'square', .05, 440); tone(330, .3, 'square', .05, 660, .15);
  tip('ev', 'События', 'Иногда случаются события: нашествие, золотой гоблин, кровавая луна. Награды в это время намного больше.');
  if (type === 'gob') spawnGoblin();
}
function spawnGoblin() {
  const hp = zoneHP(S.zone) * 35;
  mobs.push({ t: 3, x: clamp(hero.x + (rnd() < .5 ? -1 : 1) * W * .6, 5, AW - 5), y: clamp(hero.y + (rnd() - .5) * H * .5, 10, AH - 3), h: 48, hp, max: hp, rare: true, boss: false, sz: 1.25, af: 0, na: 0, goblin: true,
    sp: 26, dm: 0, cd: 99, fl: 0, kx: 0, ky: 0, psn: 0, psnT: 0, dead: false });
}
// роли обычных врагов
const ROLES = {
  archer: { z: 3, c: '#ffdd44', n: 'Лучник' }, bomber: { z: 4, c: '#ff3322', n: 'Камикадзе' }, shaman: { z: 5, c: '#44ee66', n: 'Шаман' },
  shield: { z: 6, c: '#66aaff', n: 'Щитоносец' }, summoner: { z: 8, c: '#bb66ff', n: 'Призыватель' },
  thief: { z: 7, c: '#ffd84a', n: 'Вор' }, charger: { z: 10, c: '#ff7a00', n: 'Таран' }, webber: { z: 12, c: '#e8e8e8', n: 'Паук' }, berserk: { z: 15, c: '#ff2222', n: 'Берсерк' },
};
function rollRole() {
  if (S.zone < 3 || rnd() > Math.min(.4, .1 + S.zone * .01)) return null;
  const ok = Object.keys(ROLES).filter(r => S.zone >= ROLES[r].z);
  return ok[Math.floor(rnd() * ok.length)];
}
function shooter(m, dt, mdmg) {
  m.rt = (m.rt || 1.5) - dt;
  if (m.role === 'archer' && m.rt <= 0) {
    m.rt = 2.2; const dx = hero.x - m.x, dy = hero.y - 4 - (m.y - 4), d = Math.hypot(dx, dy) || 1;
    proj.push({ x: m.x, y: m.y - 4, vx: dx / d * 48, vy: dy / d * 48, t: 3, dmg: mdmg * m.dm * 1.2 });
  }
  if (m.role === 'shaman' && m.rt <= 0) {
    m.rt = 3; ring(m.x, m.y - 3, 20, '#44ee66'); fxLabel('Шаман лечит', m.x, m.y - 14, '#44ee66');
    for (const o of mobs) if (!o.dead && o !== m && Math.hypot(o.x - m.x, o.y - m.y) < 20) { o.hp = Math.min(o.max, o.hp + o.max * .15); burst(o.x, o.y - 4, '#44ee66', 2, 12); }
  }
  if (m.role === 'webber' && m.rt <= 0) { m.rt = 3.5; const dx = hero.x - m.x, dy = hero.y - 4 - (m.y - 4), d = Math.hypot(dx, dy) || 1; proj.push({ x: m.x, y: m.y - 4, vx: dx / d * 40, vy: dy / d * 40, t: 3, dmg: mdmg * m.dm * .6, web: 1 }); }
  if (m.role === 'summoner' && m.rt <= 0) { m.rt = 5; if (mobs.length < 70) { spawnMini(m); ring(m.x, m.y - 3, 10, '#bb66ff'); } }
}
// атаки вожака с предупреждением
function bossAI(bm, dt) {
  // рывок: вожака не удержать на расстоянии — если он далеко от героя дольше 3 с, прыгает прямо к нему
  { const far = Math.hypot(hero.x - bm.x, hero.y - bm.y) > 34; bm.farT = far ? (bm.farT || 0) + dt : 0;
    if (bm.farT > 3 && !tele.some(t => t.b === bm)) { bm.farT = 0; tele.push({ k: 'c', b: bm, x: hero.x, y: hero.y, r: 16, t: .9, max: .9, dmg: zoneDmg(S.zone) * bm.dm * 3, act: 'jump' }); fxLabel('Рывок вожака', bm.x, bm.y - 18, '#ff6b6b'); } }
  bm.atkT = (bm.atkT === undefined ? 3 : bm.atkT) - dt;
  if (bm.atkT > 0 || tele.some(t => t.b === bm)) return;
  const iv = 5 * (bm.phase === 2 ? .5 : bm.phase === 1 ? .7 : 1); bm.atkT = iv * (.8 + rnd() * .4);
  const types = ['jump', 'dash', 'ring', 'summon', 'meteor', 'cross'], fav = S.zone <= 50 ? BOSS_FAV[Math.floor((S.zone - 1) / ZONES_PER_BIOME)] : null, type = fav && rnd() < .45 ? fav : types[Math.floor(rnd() * types.length)];
  const dmg = zoneDmg(S.zone) * bm.dm * 3;
  tip('tele', 'Красная зона!', 'Вожак готовит удар. Тапни по герою — он отпрыгнет. Увернулся — 3 секунды тройного урона.');
  if (type === 'jump') tele.push({ k: 'c', b: bm, x: hero.x, y: hero.y, r: 16, t: 1.1, max: 1.1, dmg, act: 'jump' });
  else if (type === 'ring') tele.push({ k: 'c', b: bm, x: bm.x, y: bm.y, r: 26, t: 1.2, max: 1.2, dmg, act: 'ring' });
  else if (type === 'dash') { const dx = hero.x - bm.x, dy = hero.y - bm.y, d = Math.hypot(dx, dy) || 1; tele.push({ k: 'l', b: bm, x: bm.x, y: bm.y, x2: clamp(bm.x + dx / d * 80, 4, AW - 4), y2: clamp(bm.y + dy / d * 80, 8, AH - 2), r: 6, t: 1, max: 1, dmg, act: 'dash' }); }
  else if (type === 'meteor') { for (let i = 0; i < (bm.phase ? 7 : 5); i++) { const a = rnd() * 6.28, r = rnd() * 26; tele.push({ k: 'c', b: bm, x: clamp(hero.x + Math.cos(a) * r, 4, AW - 4), y: clamp(hero.y + Math.sin(a) * r * .7, 8, AH - 2), r: 8, t: 1.2 + i * .1, max: 1.2 + i * .1, dmg: dmg * .6, act: 'meteor', nolbl: i > 0 }); } }
  else if (type === 'cross') { tele.push({ k: 'l', b: bm, x: clamp(bm.x - 70, 2, AW - 2), y: bm.y, x2: clamp(bm.x + 70, 2, AW - 2), y2: bm.y, r: 5, t: 1.1, max: 1.1, dmg, act: 'cross' }, { k: 'l', b: bm, x: bm.x, y: clamp(bm.y - 60, 6, AH - 1), x2: bm.x, y2: clamp(bm.y + 60, 6, AH - 1), r: 5, t: 1.1, max: 1.1, dmg, act: 'cross', nolbl: true }); }
  else { ring(bm.x, bm.y - 6, 18, '#bb66ff'); for (let i = 0; i < (bm.phase ? 4 : 3); i++) spawnMob(false); feed('Вожак зовёт подмогу!', '#bb66ff'); }
}
const segDist = (px, py, t) => { const vx = t.x2 - t.x, vy = t.y2 - t.y, l2 = vx * vx + vy * vy || 1, u = clamp(((px - t.x) * vx + (py - t.y) * vy) / l2, 0, 1); return Math.hypot(px - t.x - vx * u, py - t.y - vy * u); };
const inTele = t => t.k === 'c' ? Math.hypot(hero.x - t.x, hero.y - t.y) < t.r : segDist(hero.x, hero.y, t) < t.r;
function updTele(dt) {
  for (const t of tele) {
    if (t.act === 'exec') { t.x = hero.x; t.y = hero.y; t.t -= dt; if (t.t <= 0) t.done = true; continue; }   // казнь: следует за героем, урон наносит сам вожак
    t.t -= dt; if (inTele(t)) t.threat = true;
    if (t.t > 0) continue;
    t.done = true; const b = t.b || { dead: true }; if (!t.b) hzImpact(t);
    if (t.act === 'jump' && !b.dead) { b.x = t.x; b.y = t.y; }
    if (t.act === 'dash' && !b.dead) { b.x = t.x2; b.y = t.y2; for (let i = 0; i < 6; i++) ghosts.push({ x: t.x + (t.x2 - t.x) * i / 6, y: t.y + (t.y2 - t.y) * i / 6, l: .25, face: 1 }); }
    ring(t.k === 'c' ? t.x : t.x2, t.k === 'c' ? t.y : t.y2, t.r + 4, '#ff3322'); shake = Math.max(shake, 5); sfx.boom();
    if (inTele(t) && hero.iframe <= 0) { const d = hurtHero(t.dmg * (1 - D.armor), false, .25); ftext(hero.x, hero.y - 12, '-' + fmt(d), '#ff3322', 1.1, .8); flashT = Math.max(flashT, .05); }
    else if (t.threat && hero.lastDash > time - t.max - .2) { hero.counter = 3; ftext(hero.x, hero.y - 16, 'УВОРОТ! ×3', '#5cff8a', 1.3, 1); hitStop = .08; tone(880, .1, 'square', .05, 1320); }
  }
  tele = tele.filter(t => !t.done && !(t.b && t.b.dead));
}
function heroDash() {
  if (hero.dashCd > 0) return;
  let ax = 0, ay = 0;
  const t = tele.find(t => inTele(t));
  if (t) { if (t.k === 'c') { ax = hero.x - t.x; ay = hero.y - t.y; } else { const vx = t.x2 - t.x, vy = t.y2 - t.y; ax = -vy; ay = vx; if ((hero.x - t.x) * ax + (hero.y - t.y) * ay < 0) { ax = -ax; ay = -ay; } } }
  else { let n = null, nd = 1e9; for (const m of mobs) { const d = Math.hypot(m.x - hero.x, m.y - hero.y); if (d < nd) { nd = d; n = m; } } if (n) { ax = hero.x - n.x; ay = hero.y - n.y; } else ax = 1; }
  const d = Math.hypot(ax, ay) || 1; hero.dvx = ax / d * 150; hero.dvy = ay / d * 150; hero.dashT = .16; hero.iframe = .4; hero.dashCd = .7; hero.lastDash = time;
  for (let i = 0; i < 3; i++) ghosts.push({ x: hero.x, y: hero.y, l: .25 + i * .05, face: hero.face });
  tone(500, .08, 'triangle', .05, 1100);
}
function bossPhase(m) {
  const f = m.hp / m.max;
  if (m.phase !== 2 && f < .2 && m.phase === 1) { m.phase = 2; m.atkT = Math.min(m.atkT || 0, 1); toast('ПОСЛЕДНИЙ РЫВОК!', 'вожак атакует без передышки'); shake = 8; flashT = .1; }
  else if (!m.phase && f < .5) {
    m.phase = 1; m.sp *= 1.4; m.atkT = Math.min(m.atkT || 0, 1.2); toast('ВОЖАК В ЯРОСТИ!', 'быстрее и злее'); shake = 8; flashT = .1; tone(110, .4, 'sawtooth', .05, 60);
    if (m.t === 0 && isLegend(S.zone)) { for (let i = 0; i < 2; i++) spawnMini(m); feed('Король слизней делится!', '#5cff8a'); }
  }
}

/* ---------- механики и визуал эффектов ---------- */
function randMob() { const a = mobs.filter(m => !m.dead); return a.length ? a[Math.floor(rnd() * a.length)] : null; }
function emit(rate, dt, mk) { if (!S.fxLow && parts.length < 500 && rnd() < dt * rate) parts.push(mk()); }

/* ---------- новые эффекты с видимой механикой ---------- */
let clones = [], holes = [], crows = [];
function nfxTick(dt) {
  S.lt = (S.lt || 0) + dt; if (skyOn('nv_noult')) ult = 0;
  if (skyOn('sk_meteor')) { PT.smet = (PT.smet ?? 3) - dt; if (PT.smet <= 0) { const t = mobs.filter(m => !m.dead && !m.obj && Math.hypot(m.x - hero.x, m.y - hero.y) < 80).sort((a, b) => b.hp - a.hp)[0];
    if (t) { PT.smet = 6; bolt3(t.x + 18, t.y - 70, t.x, t.y - 4, '#fff6a0', 1); ring(t.x, t.y - 2, 14, '#fff6a0'); burst(t.x, t.y - 4, '#fff6a0', 14, 50); hitMob(t, D.hit * 40, true, true, '#fff6a0'); fxLabel('Звездопад', t.x, t.y - 16, '#fff6a0'); } } }
  if (bossAlive && skyOn('sk_bossregen')) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .03 * dt);
  const live3 = () => mobs.filter(m => !m.dead && !m.obj);
  if (D.beam > .02) { PT.beam = (PT.beam ?? 3) - dt; if (PT.beam <= 0) { const t = live3().filter(m => Math.hypot(m.x - hero.x, m.y - hero.y) < 70).sort((a, b) => b.hp - a.hp)[0];
    if (t) { PT.beam = 3; bolt3(hero.x, hero.y - 5, t.x, t.y - 4, '#ff3366', 1); hitMob(t, D.hit * (3 + 12 * D.beam), true, true, '#ff3366'); hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * (.02 + .08 * D.beam)); burst(hero.x, hero.y - 5, '#ff3366', 4, 15); fxLabel('Кровавый луч', hero.x, hero.y - 18, '#ff3366'); } } }
  if (D.clone > .02) { PT.clone = (PT.clone ?? 4) - dt; if (PT.clone <= 0 && clones.length < (D.clone > .7 ? 2 : 1)) { PT.clone = 9; clones.push({ x: hero.x - hero.face * 8, y: hero.y, t: 3 + 4 * D.clone, cd: 0, face: hero.face }); burst(hero.x, hero.y - 4, '#8899ff', 10, 30); fxLabel('Двойник', hero.x, hero.y - 18, '#8899ff'); } }
  for (const c of clones) { c.t -= dt; c.cd -= dt; let best = null, bd = 1e9; for (const m of mobs) { if (m.dead || m.obj) continue; const d = Math.hypot(m.x - c.x, m.y - c.y); if (d < bd) { bd = d; best = m; } }
    if (best) { c.face = best.x >= c.x ? 1 : -1; if (bd > 7) { c.x += (best.x - c.x) / bd * 90 * dt; c.y += (best.y - c.y) / bd * 90 * dt; } else if (c.cd <= 0) { c.cd = .35; hitMob(best, D.hit * (.5 + D.clone), false, false, '#8899ff'); } } }
  clones = clones.filter(c => c.t > 0);
  if (D.hole > .02) { PT.hole = (PT.hole ?? 5) - dt; if (PT.hole <= 0) { const L = live3(); if (L.length >= 4) { PT.hole = 8; let best = null, bn = 0;
    for (let i = 0; i < Math.min(12, L.length); i++) { const m = L[Math.floor(rnd() * L.length)], n = L.filter(o => Math.hypot(o.x - m.x, o.y - m.y) < 30).length; if (n > bn) { bn = n; best = m; } }
    if (best) holes.push({ x: best.x, y: best.y, t: 2, max: 2 }); } } }
  for (const h of holes) { h.t -= dt; for (const m of mobs) if (!m.dead && !m.obj && !m.boss) { const d = Math.hypot(h.x - m.x, h.y - m.y); if (d < 38 && d > 2) { m.x += (h.x - m.x) / d * 45 * dt; m.y += (h.y - m.y) / d * 45 * dt; } }
    if (h.t <= 0) { ring(h.x, h.y - 2, 22, '#9a5aff'); burst(h.x, h.y - 2, '#9a5aff', 18, 50); hitAround(h.x, h.y, 24, D.hit * (5 + 25 * D.hole), '#9a5aff'); fxLabel('Чёрная дыра', h.x, h.y - 14, '#9a5aff'); } }
  holes = holes.filter(h => h.t > 0);
  if (D.mirror > .02 && !hero.mirror) { PT.mir = (PT.mir ?? 2) - dt; if (PT.mir <= 0) { PT.mir = Math.max(3, 8 - 5 * D.mirror); hero.mirror = 1; } }
  { const n = D.crows > .02 ? 1 + Math.floor(4 * D.crows) : 0; while (crows.length < n) crows.push({ a: rnd() * 6.28, st: 0, cd: rnd(), x: hero.x, y: hero.y }); if (crows.length > n) crows.length = n;
    crows.forEach((c, i) => { c.a += dt * 2.2; const ox = hero.x + Math.cos(c.a + i * 6.28 / n) * 14, oy = hero.y - 9 + Math.sin(c.a + i * 6.28 / n) * 6;
      if (c.tgt && (c.tgt.dead || c.st <= 0)) c.tgt = null;
      if (c.tgt) { c.st -= dt; const d = Math.hypot(c.tgt.x - c.x, c.tgt.y - 4 - c.y); if (d < 4) { hitMob(c.tgt, D.hit * (1 + 3 * D.crows), false, false, '#7a6aa0'); burst(c.x, c.y, '#3a2a4a', 3, 20); c.tgt = null; } else { c.x += (c.tgt.x - c.x) / d * 160 * dt; c.y += (c.tgt.y - 4 - c.y) / d * 160 * dt; } }
      else { c.x += (ox - c.x) * Math.min(1, dt * 8); c.y += (oy - c.y) * Math.min(1, dt * 8); c.cd -= dt;
        if (c.cd <= 0) { c.cd = 1.2; const t = mobs.filter(m => !m.dead && !m.obj && Math.hypot(m.x - hero.x, m.y - hero.y) < 55); if (t.length) { c.tgt = t[Math.floor(rnd() * t.length)]; c.st = .6; } } } }); }
  if (D.ritual > .02) { PT.rit = (PT.rit ?? 6) - dt; if (PT.rit <= 0 && hero.hp > D.maxHP * .5 && mobs.length) { PT.rit = 10; hero.hp -= hero.hp * .1;
    ring(hero.x, hero.y - 2, 30, '#cc0033'); ring(hero.x, hero.y - 2, 18, '#ff3366'); burst(hero.x, hero.y - 4, '#cc0033', 20, 55); hitAround(hero.x, hero.y, 32, D.hit * (8 + 40 * D.ritual), '#cc0033'); fxLabel('Ритуал', hero.x, hero.y - 18, '#cc0033'); } }
}
function drawNfx() {
  for (const h of holes) { const f = 1 - h.t / h.max, r = 4 + f * 3; ctx.fillStyle = '#05010c'; ctx.globalAlpha = .9; ctx.fillRect(Math.round(h.x - r), Math.round(h.y - r * .6 - 2), Math.round(r * 2), Math.round(r * 1.2));
    ctx.globalAlpha = .8; for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28 + time * 6, rr = r + 3 + Math.sin(i * 1.7 + time * 9) * 1.5; pix(h.x + Math.cos(a) * rr, h.y - 2 + Math.sin(a) * rr * .6, i % 3 ? '#9a5aff' : '#ffffff'); } ctx.globalAlpha = 1; }
  for (const c of clones) heroGhosts.push({ x: c.x, y: c.y, face: c.face, c: '#8899ff', a: Math.min(.6, c.t * .6) });
  for (const c of crows) { const x = Math.round(c.x), y = Math.round(c.y), fl = Math.sin(time * 18 + x) > 0; ctx.fillStyle = '#1a1424'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x - (fl ? 2 : 1), y - (fl ? 1 : 0), 1, 1); ctx.fillRect(x + (fl ? 2 : 1), y - (fl ? 1 : 0), 1, 1); pix(x, y - 1, '#7a6aa0'); }
  if (hero.mirror) { ctx.globalAlpha = .55 + .2 * Math.sin(time * 5); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + time * .8; pix(hero.x + Math.cos(a) * 8, hero.y - 4 + Math.sin(a) * 7, '#bff4ff'); } ctx.globalAlpha = 1; }
}
function mirrorBlock(dmg) {
  hero.mirror = 0; const t = mobs.filter(m => !m.dead && !m.obj).sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y))[0];
  ring(hero.x, hero.y - 4, 12, '#bff4ff'); burst(hero.x, hero.y - 4, '#ffffff', 10, 40); fxLabel('Зеркало', hero.x, hero.y - 18, '#bff4ff');
  if (t) { bolt3(hero.x, hero.y - 5, t.x, t.y - 4, '#bff4ff', 0); hitMob(t, D.hit * (10 + 40 * D.mirror), true, true, '#bff4ff'); }
}
/* ---------- сокровища: редкие находки навсегда ---------- */
const TREAS = [
  { k: 'heart', n: 'Сердце дракона', c: '#ff4433', d: '+25% урона' }, { k: 'eye', n: 'Глаз бури', c: '#99eeff', d: '+10% скорости атаки' },
  { k: 'crown', n: 'Корона гоблина', c: '#ffd84a', d: 'золотые враги ×1.5' }, { k: 'phoenix', n: 'Перо феникса', c: '#ff9a3c', d: 'раз за жизнь спасает от смерти' },
  { k: 'glass', n: 'Песочные часы', c: '#e0c080', d: 'ульта перезаряжается на 2с быстрее' }, { k: 'fang', n: 'Клык волка', c: '#e8e8e8', d: '+5% крита, +25% силы крита' },
  { k: 'tear', n: 'Слеза луны', c: '#bfe0ff', d: '+30% HP, +1% HP/с' }, { k: 'compass', n: 'Компас странника', c: '#c9b07a', d: 'жизнь начинается на 3 зоны дальше' },
  { k: 'skull', n: 'Череп титана', c: '#cfcfcf', d: '+30% урона вожакам' }, { k: 'bag', n: 'Мешок душ', c: '#ff44ff', d: '+15% душ забега' },
  { k: 'echo', n: 'Камень эха', c: '#ccccff', d: '+20% прироста статов' }, { k: 'star', n: 'Звёздная пыль', c: '#fff6a0', d: '+5% ко всем эффектам' },
];
const trHas = k => !!(S.meta && S.meta.tr && S.meta.tr[k]);
const trCount = () => TREAS.filter(t => trHas(t.k)).length;
function trRoll(m) { if (m.obj) return; const ch = (m.boss ? 1 / 600 : m.rare ? 1 / 8000 : 1 / 60000) * (1 + (D.rare || 0) * 2); if (rnd() < ch) trDrop(m.x, m.y); }
function trDrop(x, y) {
  const M = S.meta; if (!M.tr) M.tr = {}; const t = TREAS[Math.floor(rnd() * TREAS.length)];
  if (M.tr[t.k]) { addSouls(bossSouls(S.zone) * 2); feed('Дубль сокровища «' + t.n + '» → души', t.c); return; }
  M.tr[t.k] = 1; D.dirty = true; recalc(); save();
  toast('СОКРОВИЩЕ: ' + t.n.toUpperCase() + '!', t.d + ' · навсегда · коллекция ' + trCount() + '/' + TREAS.length + ' (Вещи)', 4500);
  ring(x, y - 4, 24, t.c); burst(x, y - 4, t.c, 40, 70); [523, 784, 1047, 1568].forEach((f, i) => tone(f, .18, 'triangle', .05, 0, i * .09));
}
function trMods() {
  if (trHas('heart')) D.hit *= 1.25; if (trHas('eye')) D.aps = Math.min(14, D.aps * 1.1); if (trHas('crown')) D.rare = Math.min(.7, D.rare * 1.5);
  if (trHas('fang')) { D.crit = Math.min(.95, D.crit + .05); D.critM *= 1.25; } if (trHas('tear')) { D.maxHP *= 1.3; D.regen += .01; } if (trHas('echo')) D.gainMult *= 1.2;
}
function trHTML() {
  return `<div class="gsec">СОКРОВИЩА <span>${trCount()} / ${TREAS.length} · редкая находка с врагов, навсегда</span></div><div class="trs">` +
    TREAS.map(t => trHas(t.k) ? `<div class="trc" style="--tc:${t.c}"><i></i><b>${t.n}</b><small>${t.d}</small></div>` : `<div class="trc lk"><i></i><b>???</b><small>ещё не найдено</small></div>`).join('') + '</div>';
}
function effMech(dt) {
  const ff = F(EI.fire), fs = F(EI.shock), ft = F(EI.thorns), fr = F(EI.regen);
  for (const al of allies) {
    al.t -= dt; al.cd -= dt;
    let best = null, bd = 1e9; for (const m of mobs) { if (m.dead) continue; const d = Math.hypot(m.x - al.x, m.y - al.y); if (d < bd) { bd = d; best = m; } }
    if (best) { al.face = best.x >= al.x ? 1 : -1; if (bd > 6) { al.x += (best.x - al.x) / bd * 30 * dt; al.y += (best.y - al.y) / bd * 30 * dt; } else if (al.cd <= 0) { al.cd = .8; hitMob(best, D.hit * (.3 + 1.5 * cq(1)), false, false, '#7affb0'); } }
    if (al.t <= 0) { burst(al.x, al.y - 3, '#7affb0', 6, 20); if ((aw() && cls() === 'necro') || isSty('necro', 1)) { ring(al.x, al.y - 3, 14, '#7affb0'); hitAround(al.x, al.y, 14, D.hit * 2, '#7affb0'); } }
  }
  allies = allies.filter(al => al.t > 0);
  clsTick(dt); awkTick(dt); ntTick(dt); pathTick(dt); worldTick(dt); gearTick(dt); nfxTick(dt);
  if (D.grav > .02) { PT.grv = (PT.grv ?? 4) - dt; if (PT.grv <= 0) { PT.grv = 4;
      let n = 0; for (const m of mobs) { if (m.dead || m.boss) continue; const dx = hero.x - m.x, dy = hero.y - m.y, d = Math.hypot(dx, dy) || 1; if (d < 45 && d > 8) { m.kx += dx / d * 140 * D.grav; m.ky += dy / d * 140 * D.grav; n++; } }
      if (n) { fxLabel('Притяжение', hero.x, hero.y - 18, '#9a7aff'); for (let i = 0; i < 24; i++) { const a = rnd() * 6.28, r = 30 + rnd() * 10; parts.push({ x: hero.x + Math.cos(a) * r, y: hero.y - 4 + Math.sin(a) * r * .6, vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 45, l: .4, c: '#9a7aff', f: 1 }); } } } }
  if (D.spirits > 0) { PT.spr = (PT.spr ?? 1) - dt; if (PT.spr <= 0) { PT.spr = 1;
      for (let i = 0; i < D.spirits; i++) { const a = time * 2.5 + i * 6.28 / D.spirits, sx2 = hero.x + Math.cos(a) * 10, sy2 = hero.y - 5 + Math.sin(a) * 6;
        let best = null, bd = 34; for (const m of mobs) { if (m.dead) continue; const d = Math.hypot(m.x - sx2, m.y - sy2); if (d < bd) { bd = d; best = m; } }
        if (best) { bolts.push({ x1: sx2, y1: sy2, x2: best.x, y2: best.y - 3, l: .08, c: '#7affd8' }); hitMob(best, D.hit * .4, false, false, '#7affd8'); } } } }
  if (D.barrier > .01) { PT.bar = (PT.bar ?? 6) - dt; if (PT.bar <= 0) { PT.bar = 6; const sh = D.maxHP * D.barrier; if (hero.shield < sh) { hero.shield = sh; ring(hero.x, hero.y - 4, 9, '#6ad8ff'); fxLabel('Барьер', hero.x, hero.y - 16, '#6ad8ff'); } } }
  if (S.zmod === 'storm') { PT.zst = (PT.zst ?? 3) - dt; if (PT.zst <= 0) { PT.zst = 2 + rnd() * 2; const m = randMob(); if (m) { bolts.push({ x1: m.x + (rnd() - .5) * 10, y1: -4, x2: m.x, y2: m.y - 3, l: .15, c: '#ccf6ff' }); hitMob(m, D.hit * 2, false, false, '#ccf6ff'); flashT = Math.max(flashT, .04); fxLabel('Гроза', m.x, m.y - 14, '#99eeff'); } } }
  if (ksL(2, 0)) { PT.ksf = (PT.ksf || 0) - dt; if (PT.ksf <= 0) { PT.ksf = fireEvery(ksL(2, 0)); ring(hero.x, hero.y - 3, 22, '#ff6622'); hitAround(hero.x, hero.y, 22, D.hit * (.5 + .5 * ksL(2, 0)), '#ff6622'); } }
  if (ksL(2, 1)) { PT.kss = (PT.kss || 0) - dt; if (PT.kss <= 0) { PT.kss = 1 / ksL(2, 1); const m = randMob(); if (m) { fxLabel('Владыка бурь', m.x, m.y - 14, '#99eeff'); bolts.push({ x1: m.x + (rnd() - .5) * 8, y1: -4, x2: m.x, y2: m.y - 3, l: .12, c: '#99eeff' }); hitMob(m, D.hit, false, false, '#99eeff'); } } }
  if (ff >= 3) { PT.fire -= dt; if (PT.fire <= 0) { PT.fire = 3; const r = 18 + 2 * Math.min(8, ff - 3); ring(hero.x, hero.y - 3, r, '#ff6622'); hitAround(hero.x, hero.y, r, D.hit * (D.fire + .3) * 1.5, '#ff6622'); sfx.boom(); } }
  if (ff >= 4) { PT.met -= dt; if (PT.met <= 0) { PT.met = 2.5 / (ff - 3); const m = randMob(); if (m) {
    bolts.push({ x1: m.x + 18, y1: -4, x2: m.x, y2: m.y - 3, l: .15, c: '#ff9a3c' });
    ring(m.x, m.y - 2, D.fireR * 1.3, '#ff9a3c'); burst(m.x, m.y - 3, '#ff9a3c', 16, 50); hitAround(m.x, m.y, D.fireR * 1.3, D.hit * 1.5, '#ff9a3c'); shake = Math.max(shake, 3); sfx.boom(); } } }
  if (fs >= 3) { PT.orb -= dt; if (PT.orb <= 0) { PT.orb = .25; const n = Math.min(4, fs - 2);
    for (let i = 0; i < n; i++) { const a = time * 4 + i * 6.28 / n, ox = hero.x + Math.cos(a) * 12, oy = hero.y - 4 + Math.sin(a) * 7;
      for (const m of mobs) if (!m.dead && Math.hypot(m.x - ox, m.y - 3 - oy) < 6) { hitMob(m, D.hit * .5, false, false, '#99eeff'); break; } } } }
  if (fs >= 4) { PT.sky -= dt; if (PT.sky <= 0) { PT.sky = 3 / (fs - 3); const m = randMob(); if (m) { fxLabel('Небесный гром', m.x, m.y - 14, '#ccf6ff'); bolts.push({ x1: m.x + (rnd() - .5) * 8, y1: -4, x2: m.x, y2: m.y - 3, l: .15, c: '#ccf6ff' }); hitMob(m, D.hit * 1.2, true, true, '#99eeff'); sfx.tap(); flashT = Math.max(flashT, .03); } } }
  if (ft >= 3) { PT.nova -= dt; if (PT.nova <= 0) { PT.nova = 4; ring(hero.x, hero.y - 3, 14, '#cc9966'); hitAround(hero.x, hero.y, 14, D.hit * D.thorns * (1 + .5 * (ft - 3)), '#cc9966'); } }
  if (fr >= 2 && hero.hp >= D.maxHP * .999 && time - (hero.hitT ?? -9) > 3) hero.shield = Math.min(D.maxHP * Math.min(1.5, .15 * (fr - 1)), hero.shield + D.maxHP * D.regen * dt * 2);
  // ядовитые облака
  for (const c of clouds) { c.t -= dt; for (const m of mobs) if (!m.dead && Math.hypot(m.x - c.x, m.y - c.y) < c.r) { if (c.acid && aw() && cls() === 'alch') m.slowT = Math.max(m.slowT || 0, .2); trackDmg(c.acid ? 'Кислота' : c.fire ? 'Огонь' : 'Яд', Math.min(c.dps * dt, Math.max(0, m.hp))); m.hp -= c.dps * dt * (m.guard ? guardMul() : 1); if (m.hp <= 0) { m.dead = true; killMob(m); } } }
  clouds = clouds.filter(c => c.t > 0);
  for (const r of rings) { r.l -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 18); } rings = rings.filter(r => r.l > 0);
  for (const g of ghosts) g.l -= dt; ghosts = ghosts.filter(g => g.l > 0);
  // шарики прироста летят к герою
  for (const o of orbs) {
    o.t += dt; const dx = hero.x - o.x, dy = hero.y - 4 - o.y, d = Math.hypot(dx, dy) || 1, acc = 260 + o.t * 900;
    o.vx = (o.vx + dx / d * acc * dt) * Math.pow(.08, dt); o.vy = (o.vy + dy / d * acc * dt) * Math.pow(.08, dt);
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (d < 3 || o.t > 2) { o.done = true; if (hero.tintT < -.12) { hero.tint = o.c; hero.tintT = .06; } if (parts.length < 500) parts.push({ x: hero.x, y: hero.y - 4, vx: (rnd() - .5) * 30, vy: -20, l: .25, c: o.c, f: 1 }); }
  }
  orbs = orbs.filter(o => !o.done); if (orbs.length > 40) orbs.splice(0, orbs.length - 40);
  hero.tintT -= dt;
  hero.trailT -= dt; if (hero.trailT <= 0) { hero.trailT = .06; hero.trail.push({ x: hero.x, y: hero.y, face: hero.face }); if (hero.trail.length > 4) hero.trail.shift(); }
  // частицы-следы статов
  const fx_ = hero.x + hero.face * 4, top = hero.y - 4;
  if (fr) emit(fr * 2, dt, () => ({ x: hero.x + (rnd() - .5) * 8, y: hero.y - rnd() * 6, vx: 0, vy: -14, l: .5, c: '#44ee66', f: 1 }));
  if (fs) emit(fs * 3, dt, () => { const a = rnd() * 6.28; return { x: hero.x + Math.cos(a) * 6, y: top + Math.sin(a) * 5, vx: (rnd() - .5) * 40, vy: (rnd() - .5) * 40, l: .1, c: rnd() < .5 ? '#99eeff' : '#ffffff', f: 1 }; });
  if (ff) emit(ff * 4, dt, () => ({ x: fx_ + (rnd() - .5) * 2, y: top + rnd() * 2, vx: (rnd() - .5) * 8, vy: -18 - rnd() * 10, l: .3, c: rnd() < .5 ? '#ff6622' : '#ffcc33', f: 1 }));
  if (F(EI.luck)) emit(F(EI.luck), dt, () => ({ x: hero.x + (rnd() - .5) * 14, y: top + (rnd() - .5) * 10, vx: 0, vy: -6, l: .35, c: '#44ffaa', f: 1 }));
  if (F(EI.fury) && S.hpf < .5) emit(F(EI.fury) * 4, dt, () => ({ x: hero.x + (rnd() - .5) * 10, y: hero.y - rnd() * 8, vx: 0, vy: -20, l: .4, c: '#ff2222', f: 1 }));
  if (F(EI.poison)) emit(F(EI.poison), dt, () => ({ x: fx_, y: top + 2, vx: 0, vy: 6, l: .5, c: '#88ee22', f: 1 }));
}

