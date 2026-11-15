'use strict';
/* ---------- основной цикл ---------- */
let spawnT = 0, pressT = 0, kpsT = 0, uiT = 0, saveT = 0;
function update(dt) {
  juiceTick(dt); smokeTick(dt);
  if (US && performance.now() - usReal > 250) ultFrame(dt, true);   // окно в фоне или симуляция: ульта идёт по игровому времени
  time += dt; tapCd -= dt;
  const z = zs();
  // спавн
  spawnT -= dt;
  if (time > hkT) { hkT = time + 1; const was = HK; HK = hordeK(); if (was < .05 && HK >= .05 && !S.hordeTip) { S.hordeTip = 1; feed('ОРДА: герой слишком силён — врагов становится больше', '#ff9a3c'); } }
  const cb = bossAlive ? Math.ceil(crowd() / 2) : crowd(), want = Math.min(Math.max(cb, 230), Math.floor((cb + (bossAlive ? Math.round(hordeAdd() / 2) : hordeAdd())) * (ev && ev.type === 'inv' ? 2.5 : 1)));   // не больше 230 на поле
  spawnMob.hw = Math.min(1, Math.sqrt(cb / Math.max(1, want - (ev && ev.type === 'inv' ? want * .6 : 0))));
  if (hordeC() > 0 && time > packT) { packT = time + 1.2 + rnd() * .8; packA = rnd() * 6.2832; }
  zoneTick(dt);
  if (spawnT <= 0 && mobs.length < want && !zSpawnHold()) { const n = Math.min(want - mobs.length, 1 + Math.floor(S.zone / 15) + Math.round(hordeC() * 18)); for (let i = 0; i < Math.min(n, 4 + Math.round(hordeC() * 18)); i++) spawnMob(false); spawnT = (mobs.length < want / 2 ? .15 : .45) / (1 + ta('spawn')); }
  if (S.zk > zoneNeed()) S.zk = zoneNeed();
  bossCd -= dt;
  // без таймеров: вожак приходит, как заполнилась полоска; если герой еле убивает врагов — приходит сам («чует слабость»)
  if (!bossAlive) { S.wallW = (S.wallW || 0) + dt; S.wk = S.wk || []; if (S.wallW > 20) { const recent = S.kills - (S.wkK ?? S.kills); if (S.wallW - (S.wkT || 0) >= 20) { S.weak = recent < 4; S.wkK = S.kills; S.wkT = S.wallW; } } }
  if (!bossAlive && bossCd <= 0 && (S.zk >= zoneNeed() || S.weak)) { if (S.zk < zoneNeed()) feed('Вожак чует слабость и приходит сам!', '#ff6b6b'); S.weak = false; S.wallW = 0; S.wkT = 0; S.wkK = undefined; forceBoss = false; spawnMob(true); }
  if (bossAlive) {
    bossT -= dt;
    const bm = mobs.find(m => m.boss && !m.dead);
    if (bm) { bm.ws.t -= dt; if (bm.ws.t <= 0) moveWS(bm); }
    if (bm) bossJudge(bm, dt);
  }
  for (const m of mobs) if (m.ws && !m.boss) { m.ws.t -= dt; if (m.ws.t <= 0) moveWS(m); }
  // регенерация, давление
  hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * D.regen * dt);
  hero.slowT = (hero.slowT || 0) - dt;
  hero.rageT = (hero.rageT || 0) - dt; if (hero.rageT <= 0) hero.rage = 0;
  { const M = D.maxHP || 1, press = (hero.pool || 0) > M * .05;
    // pr — разрешённая ЧИСТАЯ потеря HP (доля в секунду): рана снимает постоянное лечение героя + pr; 4%/с, под натиском +15% каждые 5 с
    hero.pr = press ? Math.min(6, (hero.pr || .04) * Math.pow(hero.hp > M * .9 ? 1.15 + .08 * Math.log10(1 + hero.pool / M) : 1.05, dt / 5)) : Math.max(.04, (hero.pr || .04) * Math.pow(.9, dt));   // пока HP почти полное — натиск разгоняется (быстрее, если рана огромная); когда HP тает — растёт медленно, чтобы борьба длилась
    if (hero.pool > 0 && deathT <= 0) { const hr = M * ((D.regen || 0) + (D.vamp || 0) * (D.aps || 0));   // постоянное лечение героя в секунду (реген + вампиризм); разовые лечения и воскрешения рана не съедает
      const d = Math.min(hero.pool, (hr + M * hero.pr) * dt + (hero.pool < M * .02 ? hero.pool : 0)); hero.pool -= d; hurtHero(d, true, 0, true); }   // рана стекает в HP
    if (hero.pool > 0 && time - (hero.poolT || 0) > 2) hero.pool *= Math.pow(.8, dt);   // без новых ударов рана затягивается
    hero.lastHp = hero.hp; }
  if (hero.psnT > 0) { hero.psnT -= dt; hero.hp -= hero.psnD * dt * (1 - D.armor); if (hero.hp <= 0 && deathT <= 0) { hero.hp = 0; hurtHero(1, true); } if (rnd() < dt * 8 && parts.length < 500) parts.push({ x: hero.x + (rnd() - .5) * 6, y: hero.y - 6, vx: 0, vy: -10, l: .4, c: '#88ee22', f: 1 }); }
  PT.phx = (PT.phx || 0) - dt;
  if (legOn('phoenix') && hero.hp < D.maxHP * .1 && PT.phx <= 0) { PT.phx = 60; hero.hp = D.maxHP; burst(hero.x, hero.y - 4, '#ff9a3c', 30, 50); ring(hero.x, hero.y - 4, 20, '#ff9a3c'); feed('Феникс: полное исцеление!', '#ff9a3c'); flashT = .1; }
  PT.unb = (PT.unb || 0) - dt;
  if (ksL(1, 0) && hero.hp < D.maxHP * .3 && PT.unb <= 0) { PT.unb = 30; hero.hp = D.maxHP; hero.shield += D.maxHP * .2 * ksL(1, 0); feed('Несокрушимый: второе дыхание!', '#aabbcc'); ring(hero.x, hero.y - 4, 20, '#aabbcc'); flashT = Math.max(flashT, .08); }
  S.hpf = clamp(hero.hp / D.maxHP, 0, 1);
  pressT -= dt;
  kpsT += dt;
  if (kpsT >= 5) { S.kps = S.kps * .8 + .2 * (killWindow / kpsT); killWindow = 0; kpsT = 0; }

  // герой: цель
  let tgt = null, td = 1e9;
  for (const m of mobs) { if (m.dead) continue; const d = Math.hypot(m.x - hero.x, m.y - hero.y) - (m.sz - 1) * 4, sc = d - (m.role === 'shaman' ? 25 : m.role === 'archer' ? 12 : m.goblin ? 30 : 0) + (m.boss ? -60 : m.prey || m.obj ? -35 : .5 * Math.hypot(m.x - AW / 2, m.y - AH / 2)) - (m === hero.lastT ? 12 : 0); if (sc < td - (td === 1e9 ? 0 : 0)) { td = sc; tgt = m; } }
  if (tgt) td = Math.hypot(tgt.x - hero.x, tgt.y - hero.y) - (tgt.sz - 1) * 4; hero.lastT = tgt;
  if (deathT > 0) { deathT -= dt; hero.hp = 0; hero.cd = 1; hero.dashT = 0; if (deathT <= 0) { rebirth(); return; } }
  hero.cast = (hero.cast || 0) - dt; hero.spin = (hero.spin || 0) - dt; hero.sweep = (hero.sweep || 0) - dt; hero.fists = (hero.fists || 0) - dt; hero.cd -= dt; hero.swing -= dt; hero.hurt -= dt; hero.iframe -= dt; hero.dashCd -= dt; hero.counter -= dt; hero.chainT -= dt;
  if (hero.chainT <= 0) hero.chain = 0;
  if (hero.dashT > 0) { const st = Math.min(dt, hero.dashT); hero.dashT -= dt; hero.x += hero.dvx * st; hero.y += hero.dvy * st; if (rnd() < .5) ghosts.push({ x: hero.x, y: hero.y, l: .2, face: hero.face }); }
  updTele(dt); updWaves(dt); updUltQ(dt); updUfx(dt); if (hero.stopT > 0) hero.stopT -= dt;
  for (const e of echoes) { e.t -= dt; if (e.t <= 0) { ring(e.x, e.y - 3, 9, '#ccccff'); hitAround(e.x, e.y, 9, e.dmg, '#ccccff'); fxLabel('Эхо', e.x, e.y - 12, '#ccccff'); } } echoes = echoes.filter(e => e.t > 0);
  if (D.trail > .01) {
    PT.trl = (PT.trl || 0) - dt; if (PT.trl <= 0) { PT.trl = .1; const lp = trailPts[trailPts.length - 1]; if (!lp || Math.hypot(lp.x - hero.x, lp.y - hero.y) > 2) trailPts.push({ x: hero.x, y: hero.y, t: 1.2 }); }
    for (const tp of trailPts) { tp.t -= dt; for (const m of mobs) if (!m.dead && Math.abs(m.x - tp.x) < 4 && Math.abs(m.y - tp.y) < 4) { m.trlCd = (m.trlCd || 0) - dt; if (m.trlCd <= 0) { m.trlCd = .3; hitMob(m, D.hit * D.trail * .45, false, false, '#99ccff'); } } }
    trailPts = trailPts.filter(tp => tp.t > 0);
  } else trailPts = [];
  if (D.orbs > 0) for (let i = 0; i < D.orbs; i++) { const a = time * 3 + i * 6.28 / D.orbs, ox = hero.x + Math.cos(a) * 15, oy = hero.y - 4 + Math.sin(a) * 9;
    for (const m of mobs) if (!m.dead && Math.hypot(m.x - ox, m.y - 3 - oy) < 5) { if (time > (m.orbCd || 0)) { m.orbCd = time + .4; hitMob(m, D.hit * .6, false, false, '#ff8844'); } } }
  for (const pr of proj) { pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.t -= dt;
    if (Math.hypot(pr.x - hero.x, pr.y - (hero.y - 4)) < 3.5) { pr.t = 0; if (hero.iframe <= 0 && rnd() >= D.dodge) { const pd = hurtHero(pr.dmg * (1 - D.armor)); if (pr.web) { hero.slowT = Math.max(hero.slowT || 0, 2); fxLabel('Паутина', hero.x, hero.y - 16, '#e8e8e8'); } if (texts.length < 7) ftext(hero.x, hero.y - 10, '-' + fmt(pd), '#ffdd44', .8, .6); } } }
  proj = proj.filter(pr => pr.t > 0 && pr.x > -10 && pr.x < AW + 10 && pr.y > -10 && pr.y < AH + 10);
  if (ev) { ev.t -= dt; if (ev.t <= 0) { if (ev.type === 'gob') { const g = mobs.find(m => m.goblin); if (g) { g.dead = true; burst(g.x, g.y - 3, '#ffd84a', 12, 30); feed('Гоблин сбежал...', '#aaaaaa'); } } else { feed(EVS[ev.type].n + ' закончилось', '#aaaaaa'); if (ev.type === 'moon') giveChest(rnd() < .5 ? 'e' : 'r', 'кровавая луна'); if (ev.type === 'inv') giveChest('c', 'нашествие'); } ev = null; } }
  else if (!bossAlive && S.zone >= 3) { evNext -= dt; if (evNext <= 0) { evNext = 150 + rnd() * 90; startEvent(); } }
  if (tgt) {
    hero.face = tgt.x >= hero.x ? 1 : -1;
    const reachH = Math.max(clsReach(), tgt.role === 'archer' || tgt.role === 'shaman' || tgt.goblin ? 40 : 0);
    if (td > reachH) {
      const dx = tgt.x - hero.x, dy = tgt.y - hero.y, d = Math.hypot(dx, dy) || 1;
      if (D.blink > .01 && td > 40 && time > (hero.blinkT || 0) && rnd() < D.blink * dt) { hero.blinkT = time + 1.5; for (let i = 0; i < 4; i++) ghosts.push({ x: hero.x + (tgt.x - hero.x) * i / 4, y: hero.y + (tgt.y - hero.y) * i / 4, l: .25, face: hero.face }); const bd = Math.max(1, Math.hypot(tgt.x - hero.x, tgt.y - hero.y)); dashTo(tgt.x - (tgt.x - hero.x) / bd * 6, tgt.y - (tgt.y - hero.y) / bd * 6); fxLabel('Скачок', hero.x, hero.y - 16, '#66ffff'); tone(1300, .06, 'triangle', .03, 600, 0, 'blink', .2); }
      const mv0 = D.move * (combo >= 50 ? 1 + .3 * ksL(3, 1) : 1) * (hero.slowT > 0 ? .6 : 1), mv = mvCap(mv0); hero.x += dx / d * Math.min(mv * dt, d); hero.y += dy / d * Math.min(mv * dt, d);
    } else { const cx = AW / 2 - hero.x, cy = AH / 2 - hero.y, cd = Math.hypot(cx, cy); if (cd > 30) { hero.x += cx / cd * 22 * dt; hero.y += cy / cd * 22 * dt; } }
    if (td <= reachH && hero.cd <= 0) { hero.cd = 1 / (D.aps * (1 + (hero.rage || 0) * (D.rageK || 0)) * (combo >= 50 ? 1 + .3 * ksL(3, 1) : 1) * (skyOn('sk_rush') && (S.lt || 0) < 30 ? 2 : 1)) * (hero.slowT > 0 ? 1.6 : 1); heroAttack(tgt); }
  } else {
    const dx = AW / 2 - hero.x, dy = AH / 2 - hero.y, d = Math.hypot(dx, dy);
    if (d > 8) { hero.x += dx / d * mvCap(D.move) * .5 * dt; hero.y += dy / d * mvCap(D.move) * .5 * dt; }
  }
  hero.x = clamp(hero.x, 10, AW - 10); hero.y = clamp(hero.y, 14, AH - 6);
  { const tx = clamp(hero.x - W / 2, 0, Math.max(0, AW - W)), ty = clamp(hero.y - H / 2, 0, Math.max(0, AH - H));
    camFX += (tx - camFX) * Math.min(1, dt * 6); camFY += (ty - camFY) * Math.min(1, dt * 6); camX = Math.round(camFX); camY = Math.round(camFY); }
  effMech(dt);

  // мобы
  const mdmg = zoneDmg(S.zone) * MOBDMG * threatM() * (on('x_swarm') ? 1.2 : 1) * (S.zmod === 'storm' ? 1.2 : 1) * (ev && ev.type === 'moon' ? 1.5 : 1);
  const tots = mobs.filter(o => o.obj === 'totem' && !o.dead);
  for (const m of mobs) {
    if (m.dead) continue;
    if (m.obj) { objTick(m, dt); continue; }
    const dx = hero.x - m.x, dy = hero.y - m.y, d = Math.hypot(dx, dy) || 1;
    const ox0 = m.x, oy0 = m.y;
    const reach = 5 + m.sz * 2, ranged = m.role === 'archer' || m.role === 'shaman' || m.role === 'webber';
    m.tb = tots.length && !m.boss ? tots.some(o => Math.hypot(o.x - m.x, o.y - m.y) < 45) : false; if (m.tb) m.hp = Math.min(m.max, m.hp + m.max * .02 * dt);
    if (m.role === 'thief' && !m.loot && d <= reach + 1) { const amt = Math.max(1, Math.floor((S.runSouls || 0) * .08)); m.loot = amt; S.runSouls = Math.max(0, (S.runSouls || 0) - amt); ftext(m.x, m.y - 10, '-' + fmt(amt) + ' душ', '#ffd84a', .9, 1); m.lt = 0; fxLabel('Вор крадёт души!', m.x, m.y - 16, '#ffd84a'); }
    if (m.loot) { m.lt += dt; if (m.lt > 9) { m.dead = true; burst(m.x, m.y - 3, '#ffd84a', 10, 30); feed('Вор сбежал с душами: ' + fmt(m.loot), '#aaaaaa'); continue; } }
    if (m.role === 'charger' && !(m.frz > 0)) { m.rt = (m.rt ?? 2 + rnd() * 2) - dt; if (m.rt <= 0 && d < 70 && d > 12) { m.rt = 4.5; m.chgT = time + .9; const L = Math.min(80, d + 25); tele.push({ k: 'l', b: m, x: m.x, y: m.y, x2: clamp(m.x + dx / d * L, 4, AW - 4), y2: clamp(m.y + dy / d * L, 8, AH - 2), r: 5, t: .9, max: .9, dmg: mdmg * m.dm * 2.5, act: 'dash', nolbl: true }); } }
    if (m.goblin || m.loot || (m.prey && d < 40)) { const fs = m.prey ? .7 : 1; m.x -= dx / d * m.sp * fs * dt; m.y -= dy / d * m.sp * fs * dt; m.x = clamp(m.x, 5, AW - 5); m.y = clamp(m.y, 10, AH - 3); if (rnd() < dt * 8) parts.push({ x: m.x, y: m.y - 2, vx: 0, vy: 0, l: .4, c: '#ffd84a', f: 1 }); }
    else if (ranged) { const want = m.role === 'archer' ? 34 : m.role === 'webber' ? 30 : 28; if (d > want + 6) { m.x += dx / d * m.sp * dt; m.y += dy / d * m.sp * dt; } else if (d < want - 6) { m.x -= dx / d * m.sp * .8 * dt; m.y -= dy / d * m.sp * .8 * dt; } m.x = clamp(m.x, 4, AW - 4); m.y = clamp(m.y, 9, AH - 2); shooter(m, dt, mdmg); }
    else if (d > reach) { m.x += dx / d * m.sp * dt; m.y += dy / d * m.sp * dt; }
    { const f = (m.slowT > 0 ? .5 : 1) * (S.zmod === 'snow' ? .7 : 1) * (D.fear > .02 && !m.boss && Math.hypot(hero.x - m.x, hero.y - m.y) < 22 ? 1 - D.fear * .6 : 1); if (f < 1) { m.x = ox0 + (m.x - ox0) * f; m.y = oy0 + (m.y - oy0) * f; } m.slowT = (m.slowT || 0) - dt; }
    if (m.af & 512) { m.tp = (m.tp ?? 2 + rnd() * 2) - dt; if (m.tp <= 0) { m.tp = 3; burst(m.x, m.y - 3, '#ff88ff', 8, 30); const a = rnd() * 6.28; m.x = clamp(hero.x + Math.cos(a) * 14, 4, AW - 4); m.y = clamp(hero.y + Math.sin(a) * 10, 8, AH - 2); burst(m.x, m.y - 3, '#ff88ff', 8, 30); } }
    if (m.chgT > time) { m.x = ox0; m.y = oy0; }
    if (m.mark > 0) m.mark -= dt;
    if (m.frz > 0) { m.frz -= dt; m.x = ox0; m.y = oy0; m.cd = Math.max(m.cd, .3); }
    if (m.blT > 0 && !m.dead) { m.blT -= dt; trackDmg('Кровотечение', Math.min(m.bl * dt, Math.max(0, m.hp))); m.hp -= m.bl * dt * (m.guard ? guardMul() : 1); if (rnd() < dt * 5 && parts.length < 500) parts.push({ x: m.x + (rnd() - .5) * 5, y: m.y - 4, vx: 0, vy: 15, l: .4, c: '#ff3355' }); if (m.hp <= 0) { m.dead = true; killMob(m); continue; } }
    if (S.zmod === 'curse' && !m.dead) m.hp = Math.min(m.max, m.hp + m.max * .03 * dt);
    if (m.role === 'summoner') shooter(m, dt, mdmg);
    if (m.boss) { bossAI(m, dt); bossPhase(m); }
    if (m.role === 'bomber' && d <= reach + 1) {
      m.dead = true; burst(m.x, m.y - 3, '#ff3322', 22, 55); ring(m.x, m.y - 3, 16, '#ff3322'); sfx.boom(); shake = Math.max(shake, 5);
      if (hero.iframe <= 0 && rnd() >= D.dodge) { const bd = hurtHero(mdmg * m.dm * 3 * (1 - D.armor), false, .15); ftext(hero.x, hero.y - 12, '-' + fmt(bd), '#ff3322', 1, .7); }
      hitAround(m.x, m.y, 16, D.hit * 2, '#ff6622', m); killMob(m); continue;
    }
    // отбрасывание: отскок от краёв и столкновения с другими врагами
    const kv = Math.hypot(m.kx, m.ky);
    if (m.boss) { m.kx = 0; m.ky = 0; }   // вожака не отбрасывает — его не затолкать к краю
    m.x += m.kx * dt; m.y += m.ky * dt;
    if (kv > 25) {
      if ((m.x < 3 && m.kx < 0) || (m.x > AW - 3 && m.kx > 0)) m.kx *= -.6;
      if ((m.y < 8 && m.ky < 0) || (m.y > AH - 2 && m.ky > 0)) m.ky *= -.6;
    }
    if (kv > 70) for (const o of mobs) if (o !== m && !o.dead && !o.boss && Math.hypot(o.x - m.x, o.y - m.y) < 6 * Math.max(1, o.sz)) {
      o.kx += m.kx * .5; o.ky += m.ky * .5; m.kx *= .5; m.ky *= .5; hitMob(o, D.hit * .15, false, false, '#ffffff'); burst((o.x + m.x) / 2, (o.y + m.y) / 2 - 3, '#ffffff', 3, 25); break;
    }
    m.kx *= Math.pow(.004, dt); m.ky *= Math.pow(.004, dt);
    m.fl -= dt; m.cd -= dt;
    if (!ranged && !m.goblin && !m.loot && d <= reach + 1 && m.cd <= 0) {
      m.cd = (1 + rnd() * .3) * (m.af & 2 ? .6 : 1);
      if (rnd() < D.dodge) { if (texts.length < 7) ftext(hero.x, hero.y - 10, 'мимо', '#88ddff', .8, .6); if (sy(8) && rnd() < .5) heroAttack(m); }
      else {
        if (hero.iframe > 0) continue;
        const raw = mdmg * m.dm * (1 - D.armor) * (1 - (D.fear || 0)) * (m.tb ? 1.5 : 1);
        const dmg = hurtHero(raw, false, m.boss ? .25 : .09); sfx.hurt();
        if (m.af & 256) hero.slowT = 1.5;
        if (m.af & 2048) { hero.psnT = 3; hero.psnD = Math.min(dmg * .3, D.maxHP * .03); }
        if (m.af & 8) { m.hp = Math.min(m.max, m.hp + m.max * .15); burst(m.x, m.y - 4, '#cc2244', 3, 15); }
        if (rnd() < .35 && texts.length < 7) ftext(hero.x + (rnd() - .5) * 6, hero.y - 9, '-' + fmt(dmg), '#ff6b6b', .8, .6);
        if (D.thorns > .02) hitMob(m, D.hit * D.thorns, false, false, '#cc9966');
        if (sy(3)) for (const o of mobs) if (o !== m && !o.dead && Math.hypot(o.x - hero.x, o.y - hero.y) < 12) hitMob(o, D.hit * D.thorns * .5, false, false, '#cc9966');
      }
    }
    if (m.af & 64 && !m.dead) m.hp = Math.min(m.max, m.hp + m.max * (m.boss ? .01 : .04) * dt);
    if (m.psnT > 0 && !m.dead) {
      m.psnT -= dt; trackDmg('Яд', Math.min(m.psn * dt, Math.max(0, m.hp))); m.hp -= m.psn * dt * (m.guard ? guardMul() : 1);
      if (rnd() < dt * 6) parts.push({ x: m.x + (rnd() - .5) * 6, y: m.y - 4, vx: 0, vy: -12, l: .4, c: '#88ee22' });
      if (m.hp <= 0) { m.dead = true; killMob(m); }
    }
  }
  // расталкивание мобов
  { // сетка 16×16: сравниваем только соседей по клеткам (было — все пары, при 230 врагах это 26 тыс. проверок за кадр)
    const G = new Map(), CS = 16; for (const m of mobs) { if (m.id === undefined) m.id = ++mobId; const key = (Math.floor(m.x / CS) << 12) | Math.floor(m.y / CS); let c = G.get(key); if (!c) G.set(key, c = []); c.push(m); }
    for (const m of mobs) { const cx = Math.floor(m.x / CS), cy = Math.floor(m.y / CS);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { const c = G.get(((cx + ox) << 12) | (cy + oy)); if (!c) continue;
        for (const b of c) { if (b === m || b.id < m.id) continue; const a = m, dx = b.x - a.x, dy = b.y - a.y, r = 3.5 * (a.sz + b.sz), d2 = dx * dx + dy * dy;
          if (d2 < r * r && d2 > .001) { const d = Math.sqrt(d2), p = (r - d) / d * .5; a.x -= dx * p * .5; a.y -= dy * p * .5; b.x += dx * p * .5; b.y += dy * p * .5; } } } }
  }
  mobs = mobs.filter(m => !m.dead);

  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.f ? 0 : 60) * dt; p.vx *= .96; p.l -= dt; }
  parts = parts.filter(p => p.l > 0); if (parts.length > 320) parts.splice(0, parts.length - 320);
  if (rings.length > 18) rings.splice(0, rings.length - 18);
  for (const t of texts) { t.t += dt; t.x += t.vx * dt; t.y -= 14 * dt; }
  texts = texts.filter(t => t.t < t.life);
  for (const b of bolts) b.l -= dt; bolts = bolts.filter(b => b.l > 0);
  shake = Math.max(0, Math.min(shake, 16) - dt * 40);
  comboPop = Math.max(0, comboPop - dt);
  if (ultCd > 0) { ultCd -= dt; if (ultCd <= 0 && ult >= .999) { ult = 1; ultReadyT = 0; tone(660, .1, 'square', .04); tone(990, .2, 'square', .04, 0, .1); } }
  ultT -= dt; hurtV = Math.max(0, hurtV - dt * 1.5);
  for (const f of feedArr) f.t += dt; feedArr = feedArr.filter(f => f.t < 3);
  if (ult >= 1) { ultReadyT += dt; if (ultReadyT > 20 || (S.meta.autoUlt && bossAlive || S.meta.autoUlt && ultReadyT > 2)) fireUlt(true); }
  if (S.meta.autoPath && (autoPathSpend.t = (autoPathSpend.t || 0) + dt) > 2) { autoPathSpend.t = 0; autoPathSpend(); }
  if (combo) { comboT -= dt; if (comboT <= 0) { if (combo >= 10) ftext(hero.x, hero.y - 14, 'комбо ' + combo + ' прервано', '#aaaaaa', .8, 1.2); combo = 0; } }
  decalT -= dt;
  if (decalT <= 0) { decalT = 1.5; const g = decal.getContext('2d'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, 0, AW, AH); g.globalCompositeOperation = 'source-over'; }
  // аура высоких рангов
  const rk = heroRank();
  if (rk >= 12 && rnd() < dt * (4 + rk / 3)) parts.push({ x: hero.x + (rnd() - .5) * 8, y: hero.y - rnd() * 8, vx: 0, vy: -15, l: .5, c: ARMOR[(rk + 3) % ARMOR.length] });

  uiT -= dt; if (uiT <= 0) { uiT = .25; if (D.dirty) { recalc(); D.dirty = false; } if (SIM) { if (time > autoT) { autoT = time + 1; runAuto(); } } else updateUI(); }   // в симуляции — только автоигра, без интерфейса
  saveT -= dt; if (saveT <= 0) { saveT = 5; if (!SIM) save(); }
}

function pix(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); }
function line(x1, y1, x2, y2, c, jag) {
  const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4)); let px = x1, py = y1;
  for (let i = 1; i <= n; i++) {
    let nx = x1 + (x2 - x1) * i / n, ny = y1 + (y2 - y1) * i / n;
    if (jag && i < n) { nx += (rnd() - .5) * 5; ny += (rnd() - .5) * 3; }
    const steps = Math.ceil(Math.max(Math.abs(nx - px), Math.abs(ny - py)));
    for (let s = 0; s <= steps; s++) pix(px + (nx - px) * s / steps, py + (ny - py) * s / steps, c);
    px = nx; py = ny;
  }
}

function render() {
  // тряска: мягкий потолок амплитуды; режим в Меню (выкл / слабая / полная)
  const shM = S.meta.shk ?? 1, amp = !shake || !shM ? 0 : shM === 1 ? 2.2 * (1 - Math.exp(-shake / 8)) : 5 * (1 - Math.exp(-shake / 10));
  const sx = amp ? Math.round((rnd() - .5) * amp) : 0, sy = amp ? Math.round((rnd() - .5) * amp * .6) : 0;
  ctx.setTransform(1, 0, 0, 1, sx - camX, sy - camY);
  ctx.fillStyle = '#05040a'; ctx.fillRect(camX - 6, camY - 6, W + 12, H + 12);
  ctx.drawImage(ground, 0, 0);
  ctx.drawImage(decal, 0, 0);
  for (const c of clouds) { ctx.globalAlpha = Math.min(.5, c.t * .3); const n = Math.floor(c.r * 1.5); for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = rnd() * c.r; pix(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * .6, c.acid ? (i % 2 ? '#b6ff3c' : '#e8ff8a') : c.col ? (i % 2 ? c.col : '#ffffff') : c.fire ? (i % 2 ? '#ff7a30' : '#ffcc33') : i % 2 ? '#88ee22' : '#4a8a12'); } }
  drawClsWorld();
  ctx.globalAlpha = 1;
  // красные зоны атак вожака: заливка в шахматку + яркая мигающая граница
  for (const t of tele) {
    const f = 1 - t.t / t.max, edge = Math.sin(time * (12 + f * 30)) > 0 ? '#ffffff' : '#ff2222';
    ctx.fillStyle = '#ff2222';
    if (t.k === 'c') {
      ctx.globalAlpha = .28 + .3 * f;
      for (let yy = -t.r; yy <= t.r; yy += 1) for (let xx = -t.r; xx <= t.r; xx += 1) if ((xx + yy + Math.floor(time * 8)) % 2 === 0 && (xx * xx) / (t.r * t.r) + (yy * yy) / (t.r * t.r * .36) <= 1) ctx.fillRect(Math.round(t.x + xx), Math.round(t.y + yy * .6), 1, 1);
      ctx.globalAlpha = 1; const n = Math.floor(t.r * 4);
      for (let i = 0; i < n; i++) { const a = i / n * 6.28; pix(t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r * .6, edge); }
      const ir = t.r * f; for (let i = 0; i < n; i++) { const a = i / n * 6.28; pix(t.x + Math.cos(a) * ir, t.y + Math.sin(a) * ir * .6, '#ffaa66'); }
    } else {
      const L = Math.hypot(t.x2 - t.x, t.y2 - t.y) || 1, n = Math.floor(L), nx = -(t.y2 - t.y) / L, ny = (t.x2 - t.x) / L;
      for (let i = 0; i <= n; i++) { const u = i / n, cx = t.x + (t.x2 - t.x) * u, cy = t.y + (t.y2 - t.y) * u;
        ctx.globalAlpha = .28 + .3 * f; for (let w = -t.r + 1; w < t.r; w++) if ((i + w + Math.floor(time * 8)) % 2 === 0) ctx.fillRect(Math.round(cx + nx * w), Math.round(cy + ny * w), 1, 1);
        ctx.globalAlpha = 1; pix(cx + nx * t.r, cy + ny * t.r, edge); pix(cx - nx * t.r, cy - ny * t.r, edge); if (u < f) pix(cx, cy, '#ffaa66'); }
    }
    ctx.fillStyle = '#ff2222';
  }
  ctx.globalAlpha = 1;
  const rk = heroRank();
  // аура
  if (rk >= 4) {
    const ac = ARMOR[(rk + 4) % ARMOR.length], rad = 6 + Math.min(10, (rk - 4) * .5) + Math.sin(time * 4);
    glow(hero.x, hero.y - 1, ac, rad, .35 + .1 * Math.sin(time * 3));
  }
  drawHazGround();
  // объекты по y
  const all = mobs.slice(); all.push(hero); all.sort((a, b) => a.y - b.y);
  for (const o of all) {
    if (o === hero) { drawHero(rk); continue; }
    if (o.obj) { drawObj(o); continue; }
    if (o.x < camX - 20 || o.x > camX + W + 20 || o.y < camY - 10 || o.y > camY + H + 24) continue;   // за краем экрана не рисуем
    const s = 8 * o.sz, x = Math.round(o.x - s / 2), y = Math.round(o.y - s);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 1, Math.round(o.y) - 1, s - 2, 1);
    const bob = Math.sin(time * 10 + o.x) > .6 ? -1 : 0;
    const ol = sprite(MOBS[o.t].p, { 1: '#000', 2: '#000', 3: '#000' }, 'mo' + o.t), os = s / 8;
    const sq = o.sqT > time ? (o.sqT - time) / .14 : 0, sw = Math.round(s * (1 + .3 * sq)), sh2 = Math.round(s * (1 - .22 * sq)), xo = Math.round(x - (sw - s) / 2 + (o.sqx || 0) * 2 * sq), yo = y + (s - sh2);   // сплющивание при ударе
    { const oc = outl8(ol, o.t), q = Math.max(1, Math.round(os)); ctx.drawImage(oc, xo - q, yo + bob - q, sw + 2 * q, sh2 + 2 * q); }
    const fly = wRule('fly') ? -3 - Math.round(Math.sin(time * 3 + o.x) * 1.5) : 0;
    if (o.ph) ctx.globalAlpha = .25;
    ctx.drawImage(mobSprite(o, o.fl > 0), xo, yo + bob + fly, sw, sh2); ctx.globalAlpha = 1;
    if (o.shd > 0) { ctx.globalAlpha = .55; circ(o.x, o.y - s / 2, s * .6 + 1, '#7ad8ff', 14, .9, time); ctx.globalAlpha = 1; }
    if (o.af) { let q = 0; for (let i = 0; i < AFF.length; i++) if (o.af >> i & 1) { pix(x + q * 2, y - 4 + bob, AFF[i].c); q++; } }
    if (o.rare && rnd() < .15) pix(o.x + (rnd() - .5) * 10, o.y - rnd() * 10, '#fff6b0');
    if (o.psnT > 0) pix(o.x, y - 1, '#88ee22');
    if (o.frz > 0) { ctx.globalAlpha = .55; ctx.drawImage(sprite(MOBS[o.t].p, { 1: '#a8e8ff', 2: '#6ab8e0', 3: '#ffffff' }, 'mz' + o.t), x, y + bob, s, s); ctx.globalAlpha = 1; }
    if (o.blT > 0) pix(o.x + 2, y - 1, '#ff3355');
    if (o.mark > 0) { pix(o.x - 2, y - 2 + bob, '#ff66aa'); pix(o.x - 3, y - 1 + bob, '#ff66aa'); pix(o.x - 1, y - 1 + bob, '#ff66aa'); }
    if (o.role) { const rc = ROLES[o.role].c, mx = Math.round(o.x), my = y - 6 + bob;
      if (o.role === 'archer') { pix(mx, my - 1, rc); pix(mx - 1, my, rc); pix(mx + 1, my, rc); }
      else if (o.role === 'shaman') { pix(mx, my - 1, rc); pix(mx - 1, my, rc); pix(mx, my, rc); pix(mx + 1, my, rc); pix(mx, my + 1, rc); }
      else if (o.role === 'shield') { ctx.fillStyle = rc; ctx.fillRect(mx - 1, my - 1, 3, 3); ctx.globalAlpha = .25; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 + time; pix(o.x + Math.cos(a) * 14, o.y + Math.sin(a) * 8, rc); } ctx.globalAlpha = 1; }
      else if (o.role === 'bomber') { if (Math.sin(time * 16) > 0) { ctx.fillStyle = rc; ctx.fillRect(mx - 1, my - 1, 2, 2); } }
      else if (o.role === 'thief') { ctx.fillStyle = rc; ctx.fillRect(mx - 1, my - 1, 3, 2); if (o.loot) { pix(o.x + 3, o.y - 3, '#ffd84a'); pix(o.x + 4, o.y - 4, '#fff2a0'); } }
      else if (o.role === 'charger') { const f = o.chgT > time && Math.sin(time * 20) > 0 ? '#ffffff' : rc; pix(mx - 1, my - 1, f); pix(mx, my, f); pix(mx - 1, my + 1, f); pix(mx + 1, my, f); }
      else if (o.role === 'webber') { pix(mx - 1, my - 1, rc); pix(mx + 1, my - 1, rc); pix(mx, my, rc); pix(mx - 1, my + 1, rc); pix(mx + 1, my + 1, rc); }
      else if (o.role === 'berserk') { const n = 1 + (o.rage || 0); ctx.fillStyle = rc; ctx.fillRect(mx - Math.floor(n / 2), my, n, 1); if (o.rage) { ctx.globalAlpha = .35; ctx.fillRect(Math.round(o.x) - 4, y + bob, 8, 8 * o.sz); ctx.globalAlpha = 1; } }
      else { pix(mx - 1, my, rc); pix(mx + 1, my, rc); pix(mx, my - 1, rc); pix(mx, my + 1, rc); } }
    if (o.boss && o.phase) { ctx.globalAlpha = .25 + .2 * Math.sin(time * 12); ctx.drawImage(sprite(MOBS[o.t].p, { 1: '#ff0000', 2: '#ff0000', 3: '#ffffff' }, 'mr' + o.t), x, y + bob, s, s); ctx.globalAlpha = 1; }
    if (o.prey) { const py = y - 7 + bob + (Math.sin(time * 5) > 0 ? 0 : -1); ctx.fillStyle = '#000'; ctx.fillRect(Math.round(o.x) - 2, py - 1, 5, 5); ctx.fillStyle = '#ff5588'; ctx.fillRect(Math.round(o.x) - 1, py, 3, 3); }
    if (o.undead) { ctx.globalAlpha = .4; ctx.fillStyle = '#b06aff'; ctx.fillRect(Math.round(o.x) - 4, y + bob, 8, 8); ctx.globalAlpha = 1; }
    if (o.tb) pix(o.x - 3, y - 1 + bob, '#c06bff');
    if (o.goblin) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(Math.round(o.x) + 3, y + 4 + bob, 3, 3); pix(o.x + 4, y + 4 + bob, '#b07a10'); }
    if (o.hp < o.max && !o.boss) {
      ctx.fillStyle = '#300'; ctx.fillRect(x, y - 2, s, 1);
      ctx.fillStyle = o.rare ? '#ffd84a' : '#e33'; ctx.fillRect(x, y - 2, Math.max(1, Math.round(s * o.hp / o.max)), 1);
    }
  }
  { const hx = hero.x, hy = hero.y - 4; for (const p of parts) { ctx.globalAlpha = Math.min(p.f ? .55 : 1, p.l * 3) * (Math.abs(p.x - hx) < 6 && Math.abs(p.y - hy) < 7 ? .3 : 1); pix(p.x, p.y, p.c); } }
  ctx.globalAlpha = 1;
  drawSmoke(); drawJuice();
  for (const b of bolts) { line(b.x1, b.y1, b.x2, b.y2, b.c, true); }
  for (const r of rings) { if (r.max < 10 && mobs.length > 60) continue; const k = r.l * 4, fr = r.r / r.max; if (fr < .45) glow(r.x, r.y, r.c, Math.min(18, r.max * .6), .5 * (1 - fr / .45));
    ctx.globalAlpha = Math.min(r.c === '#ff3322' ? 1 : .75, k); const n = Math.max(16, Math.floor(r.r * 6)); for (let i = 0; i < n; i++) { const a = i / n * 6.28; pix(r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r * .6, i % 2 ? r.c : '#ffffff'); }
    if (r.r > 6) { ctx.globalAlpha = Math.min(.35, k * .4); const n2 = Math.floor(n * .7); for (let i = 0; i < n2; i++) { const a = i / n2 * 6.28; pix(r.x + Math.cos(a) * (r.r - 2), r.y + Math.sin(a) * (r.r - 2) * .6, r.c); } } }
  ctx.globalAlpha = 1;
  drawUfx(); drawUltCharge(); drawEvolveWorld(); drawWorldFx();
  // волны клинка: светлый серп поперёк полёта + след
  for (const w of waves) {
    if (drawClsWave(w)) continue;
    if (w.kind === 'arrow') { const ca = Math.cos(w.a), sa = Math.sin(w.a); for (let j = 0; j < 6; j++) pix(w.x - ca * j, w.y - sa * j, j === 0 ? '#ffffff' : j > 4 ? '#5cff8a' : '#c9a36a'); continue; }
    if (w.kind === 'fire') { ctx.fillStyle = '#ffcc33'; ctx.fillRect(Math.round(w.x) - 1, Math.round(w.y) - 1, 3, 3); pix(w.x, w.y, '#ffffff'); ctx.globalAlpha = .5; for (let j = 1; j <= 4; j++) pix(w.x - Math.cos(w.a) * j * 1.5 + (rnd() - .5), w.y - Math.sin(w.a) * j * 1.5 + (rnd() - .5), '#ff6622'); ctx.globalAlpha = 1; continue; }
    if (w.kind === 'dark') { ctx.fillStyle = '#2a0a3a'; ctx.fillRect(Math.round(w.x) - 1, Math.round(w.y) - 1, 3, 3); pix(w.x, w.y, '#7affb0'); ctx.globalAlpha = .5; for (let j = 1; j <= 3; j++) pix(w.x - Math.cos(w.a) * j * 2, w.y - Math.sin(w.a) * j * 2, '#9a4aff'); ctx.globalAlpha = 1; continue; }
    const ca = Math.cos(w.a), sa = Math.sin(w.a), wc = w.bounce ? '#ffe08a' : w.fin ? '#ffffff' : (S.meta.gear && S.meta.gear.eq.w ? RAR[S.meta.gear.eq.w.rar].c : F(EI.range) >= 2 ? '#ffffaa' : '#dddd88'), half = w.fin ? 6 : 4;
    for (let i = -half; i <= half; i++) { const bend = (half - Math.abs(i)) * .7; for (const th of [0, -1]) pix(w.x - sa * i + ca * (bend + th), w.y + ca * i + sa * (bend + th), Math.abs(i) < 2 ? '#ffffff' : wc); }
    ctx.globalAlpha = .4; for (let j = 1; j <= 3; j++) pix(w.x - ca * j * 2, w.y - sa * j * 2, wc); ctx.globalAlpha = 1;
  }
  for (const pr of proj) { pix(pr.x, pr.y, '#ffffff'); pix(pr.x - pr.vx * .02, pr.y - pr.vy * .02, '#ff3322'); pix(pr.x - pr.vx * .04, pr.y - pr.vy * .04, '#ff3322'); }
  for (const [qx, qy] of pix2) { ctx.fillStyle = '#66aaff'; ctx.fillRect(Math.round(qx) - 1, Math.round(qy), 3, 1); } pix2 = [];
  for (const o of orbs) { pix(o.x, o.y, o.c); ctx.globalAlpha = .45; pix(o.x - o.vx * .025, o.y - o.vy * .025, o.c); ctx.globalAlpha = 1; }
  drawNfx();
  drawHazTop();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, sx, sy); drawArenaFx(); drawFg(); ctx.restore();
  drawHeroTop(rk);
  // полоса вожака (экранные координаты)
  const boss = mobs.find(m => m.boss);
  ctx.setTransform(1, 0, 0, 1, sx, sy);
  if (boss) {
    ctx.fillStyle = '#000'; ctx.fillRect(4, 2, W - 8, 4);
    ctx.fillStyle = '#5a0a0a'; ctx.fillRect(5, 3, W - 10, 2);
    ctx.fillStyle = '#ff2a2a'; ctx.fillRect(5, 3, Math.max(0, Math.round((W - 10) * boss.hp / boss.max)), 2);
  }
  ctx.setTransform(1, 0, 0, 1, sx - camX, sy - camY);
  // слабое место вожака
  for (const wm of mobs) if (wm.ws && !wm.dead) {
    const wx = Math.round(wm.x + wm.ws.ox), wy = Math.round(wm.y + wm.ws.oy), pu = Math.sin(time * 14) > 0;
    ctx.fillStyle = pu ? '#ffee66' : '#ffffff'; ctx.fillRect(wx - 1, wy - 1, 2, 2);
    const rr = 4 + (pu ? 1 : 0); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + time * 3; pix(wx + Math.cos(a) * rr, wy + Math.sin(a) * rr, '#ffee66'); }
  }
  ctx.setTransform(1, 0, 0, 1, sx, sy);
  // стрелки к важным целям за краем экрана
  for (const m of mobs) if ((m.boss || m.goblin) && !m.dead) {
    const px = m.x - camX, py = m.y - 4 - camY;
    if (px >= 0 && px <= W && py >= 0 && py <= H) continue;
    const cx = W / 2, cy = H / 2, dx = px - cx, dy = py - cy, k2 = Math.min((W / 2 - 5) / Math.abs(dx || 1e-6), (H / 2 - 9) / Math.abs(dy || 1e-6));
    const ax = cx + dx * k2, ay = cy + dy * k2, an = Math.atan2(dy, dx), col = m.boss ? '#ff3322' : '#ffd84a', bl = Math.sin(time * 10) > 0;
    for (let i = 0; i < 4; i++) for (let j = -i; j <= i; j++) pix(ax - Math.cos(an) * (i - 3) - Math.sin(an) * j * .8, ay - Math.sin(an) * (i - 3) + Math.cos(an) * j * .8, bl ? col : '#ffffff');
  }
  // полоса ульты
  const ub = H - 3; ctx.fillStyle = '#000'; ctx.fillRect(2, ub, W - 4, 2);
  ctx.fillStyle = ult >= 1 ? (Math.sin(time * 3) > 0 ? '#ff88ff' : '#ffc8ff') : ultCd > 0 ? '#5a4a6a' : '#a04cc0'; ctx.fillRect(2, ub, Math.round((W - 4) * ult), 2);
  if (ultCd > 0) { ctx.fillStyle = '#ff88ff'; ctx.fillRect(2, ub, Math.round((W - 4) * (1 - ultCd / ULT_CD)), 1); }
  drawUltScreen(sx, sy); ctx.setTransform(1, 0, 0, 1, sx, sy);
  if (ultT > 0) { ctx.fillStyle = 'rgba(20,0,30,' + Math.min(.55, ultT) + ')'; ctx.fillRect(-4, -4, W + 8, H + 8); }
  // мерцание при изнеможении
  // мягкая вспышка: не ярче 12% и не чаще раза в 1.5с (без мерцания на весь экран)
  if (flashT > 0 && !S.fxLow) { if (time - (render.fl ?? -9) > 1.5 || render.flOn) { if (!render.flOn) { render.fl = time; render.flOn = true; } ctx.fillStyle = 'rgba(255,255,255,' + Math.min(.12, flashT * .6) + ')'; ctx.fillRect(-4, -4, W + 8, H + 8); } } else render.flOn = false;
  if (hero.stopT > 0) { ctx.fillStyle = 'rgba(60,90,200,.18)'; ctx.fillRect(-4, -4, W + 8, H + 8); }
  if (S.zmod === 'night') { ctx.save(); ctx.fillStyle = 'rgba(0,0,25,.55)'; ctx.beginPath(); ctx.rect(-4, -4, W + 8, H + 8); ctx.arc(hero.x - camX, hero.y - 4 - camY, 34, 0, 6.2832, true); ctx.fill('evenodd'); ctx.restore(); }
  if (S.zmod === 'storm' || S.zmod === 'snow') { const st = S.zmod === 'storm';
    for (let i = 0; i < 70; i++) { const yy = ((i * 53.7 + time * (st ? 110 : 14)) % (H + 10)) - 5, xx = ((i * 37.3 + (st ? -yy * .35 : Math.sin(time + i) * 4)) % W + W) % W;
      ctx.globalAlpha = st ? .45 : .75; pix(xx, yy, st ? '#9fb8ff' : '#ffffff'); if (st) pix(xx + .35, yy - 1, '#9fb8ff'); } ctx.globalAlpha = 1; }
  if (hurtV > 0) { ctx.fillStyle = 'rgba(255,30,30,' + hurtV + ')'; ctx.fillRect(-4, -4, W + 8, 3 + 4); ctx.fillRect(-4, H - 3, W + 8, 7); ctx.fillRect(-4, -4, 3 + 4, H + 8); ctx.fillRect(W - 3, -4, 7, H + 8); }
  if (ev && ev.type === 'moon') { ctx.fillStyle = 'rgba(140,0,20,.16)'; ctx.fillRect(-4, -4, W + 8, H + 8); }
  if (S.hpf < .35) { ctx.fillStyle = `rgba(120,0,0,${.12 + .08 * Math.sin(time * 6)})`; ctx.fillRect(-4, -4, W + 8, H + 8); }

  // текст на hi-res слое
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.clearRect(0, 0, fx.width, fx.height);
  const k = SC * DPR, base = Math.max(8, Math.round(SC * 2)) * DPR;
  drawHeroHi(heroHiD, k, sx, sy);
  fctx.textAlign = 'center'; fctx.textBaseline = 'middle'; fctx.lineJoin = 'round';
  for (const t of texts) {
    const a = 1 - Math.max(0, (t.t - t.life * .6) / (t.life * .4));
    const pop = t.t < .08 ? 1.4 : 1;
    const fs = Math.round(base * t.size * pop / DPR) * DPR;
    fctx.font = `${fs}px "Press Start 2P", monospace`;
    fctx.globalAlpha = a;
    const hw = fctx.measureText(t.s).width / 2 + 4;
    const x = Math.round(clamp((t.x - camX + sx) * k, hw, fx.width - hw)), y = Math.round(clamp((t.y - camY + sy) * k, fs, fx.height - fs));
    fctx.lineWidth = Math.max(2, fs / 3); fctx.strokeStyle = '#000'; fctx.strokeText(t.s, x, y);
    fctx.fillStyle = t.c; fctx.fillText(t.s, x, y);
  }
  fctx.globalAlpha = 1;
  if (boss) {
    fctx.font = `${Math.round(base * .8 / DPR) * DPR}px "Press Start 2P", monospace`;
    fctx.fillStyle = '#fff'; fctx.strokeStyle = '#000'; fctx.lineWidth = base / 4;
    const s = (boss.guard ? 'СТРАЖ СТЕНЫ' : boss.titan ? 'ТИТАН: ' + boss.name : (isLegend(S.zone) ? 'ЛЕГЕНДА: ' : 'ВОЖАК: ') + (boss.name || MOBS[boss.t].n)) + ' ' + fmt(Math.max(0, boss.hp)) + (boss.exec ? ' · КАЗНЬ!' : '');
    fctx.strokeText(s, fx.width / 2, 9 * k); fctx.fillText(s, fx.width / 2, 9 * k);
  }
  // лента событий
  if (feedArr.length) {
    const fs3 = Math.round(base * .6 / DPR) * DPR;   // лента событий — тихая, мелкая
    fctx.font = `${fs3}px "Press Start 2P", monospace`; fctx.textAlign = 'left'; fctx.lineWidth = Math.max(2, fs3 / 3); fctx.strokeStyle = '#000';
    const y0 = (H - 17) * k, maxW = fx.width - 6 * k - (combo >= 3 ? 34 * k : 0);   // над надписью ульты и не заезжая на комбо
    feedArr.forEach((f, i) => {
      const yy = y0 - (feedArr.length - 1 - i) * fs3 * 1.5; let s = f.s;
      if (fctx.measureText(s).width > maxW) { while (s.length > 4 && fctx.measureText(s + '…').width > maxW) s = s.slice(0, -1); s += '…'; }
      fctx.globalAlpha = .6 * clamp(1 - (f.t - 2) / 1, 0, 1);
      fctx.strokeText(s, 3 * k, yy); fctx.fillStyle = f.c; fctx.fillText(s, 3 * k, yy);
    });
    fctx.globalAlpha = 1; fctx.textAlign = 'center';
  }
  drawUltBanner(k); drawCutIn(US ? US.k : cls()); drawEvoBanner();
  if (ult >= .999 && ult < 1 && ultCd > 0) { fctx.font = `${Math.round(base * .8 / DPR) * DPR}px "Press Start 2P", monospace`; fctx.lineWidth = base / 3; fctx.strokeStyle = '#000'; fctx.fillStyle = '#a59fc0'; const tt = 'УЛЬТА ЧЕРЕЗ ' + Math.ceil(ultCd) + 'С'; fctx.strokeText(tt, fx.width / 2, (H - 9) * k); fctx.fillText(tt, fx.width / 2, (H - 9) * k); }
  if (ult >= 1) {
    fctx.font = `${Math.round(base * 1 / DPR) * DPR}px "Press Start 2P", monospace`; fctx.lineWidth = base / 3; fctx.strokeStyle = '#000';
    fctx.fillStyle = Math.sin(time * 3) > 0 ? '#ff88ff' : '#ffc8ff';
    fctx.strokeText('УЛЬТА ГОТОВА — ТАПНИ!', fx.width / 2, (H - 9) * k); fctx.fillText('УЛЬТА ГОТОВА — ТАПНИ!', fx.width / 2, (H - 9) * k);
  }
  {
    const fsT = Math.round(base * .8 / DPR) * DPR; fctx.font = `${fsT}px "Press Start 2P", monospace`; fctx.textAlign = 'center'; fctx.lineWidth = Math.max(2, fsT / 3); fctx.strokeStyle = '#000';
    for (const t of tele) { const nm = { jump: 'ПРЫЖОК!', dash: 'РЫВОК!', ring: 'КОЛЬЦО!', meteor: 'МЕТЕОРЫ!', cross: 'КРЕСТ!' }[t.act]; if (!nm || t.nolbl) continue;
      const lx = (t.k === 'c' ? t.x : (t.x + t.x2) / 2) - camX + sx, ly = (t.k === 'c' ? t.y - t.r * .6 - 3 : (t.y + t.y2) / 2 - 8) - camY + sy;
      fctx.fillStyle = Math.sin(time * 14) > 0 ? '#ffffff' : '#ff3322'; fctx.strokeText(nm, lx * k, ly * k); fctx.fillText(nm, lx * k, ly * k); }
    const fsR = Math.round(base * .65 / DPR) * DPR; fctx.font = `${fsR}px "Press Start 2P", monospace`; fctx.lineWidth = Math.max(2, fsR / 3);
    for (const m of mobs) if (m.lblUntil > time && m.role) { fctx.fillStyle = ROLES[m.role].c; const lx = (m.x - camX + sx) * k, ly = (m.y - 12 * m.sz - camY + sy) * k; fctx.strokeText(ROLES[m.role].n, lx, ly); fctx.fillText(ROLES[m.role].n, lx, ly); }
  }
  if (ev) {
    const E = EVS[ev.type], fsE = Math.round(base * .8 / DPR) * DPR, yy = (boss ? 15 : 5) * k;
    fctx.font = `${fsE}px "Press Start 2P", monospace`; fctx.textAlign = 'center'; fctx.lineWidth = Math.max(2, fsE / 3); fctx.strokeStyle = '#000'; fctx.fillStyle = E.c;
    const es = E.n + ' · ' + Math.ceil(ev.t) + 'с' + (E.g > 1 ? ' · награды ×' + E.g : ''); fctx.strokeText(es, fx.width / 2, yy); fctx.fillText(es, fx.width / 2, yy);
  }
  if (hero.counter > 0) {
    const fsC = Math.round(base * .8 / DPR) * DPR; fctx.font = `${fsC}px "Press Start 2P", monospace`; fctx.textAlign = 'center'; fctx.lineWidth = Math.max(2, fsC / 3); fctx.strokeStyle = '#000'; fctx.fillStyle = '#5cff8a';
    const cs = 'КОНТРАТАКА ×3 · ' + hero.counter.toFixed(1); fctx.strokeText(cs, (hero.x - camX + sx) * k, (hero.y - 20 - camY + sy) * k); fctx.fillText(cs, (hero.x - camX + sx) * k, (hero.y - 20 - camY + sy) * k);
  }
  if (combo >= 3) {
    const col = combo < 25 ? '#ffffff' : combo < 100 ? '#ffdd44' : combo < 500 ? '#ff7a00' : combo < 2500 ? '#ff2a6a' : '#d9a0ff';
    const fs = Math.round(base * (.75 + comboPop * 1.2) / DPR) * DPR, fs2 = Math.round(base * .55 / DPR) * DPR;
    const bw = 30 * k, cx = fx.width - 4 * k - bw, cy = (H - 17) * k - fs2 * 1.3 - 6 * DPR - fs * .9;
    fctx.textAlign = 'left'; fctx.lineWidth = Math.max(2, fs / 3); fctx.strokeStyle = '#000';
    fctx.font = `${fs}px "Press Start 2P", monospace`; fctx.fillStyle = col;
    fctx.strokeText('КОМБО ' + combo, cx, cy); fctx.fillText('КОМБО ' + combo, cx, cy);
    fctx.font = `${fs2}px "Press Start 2P", monospace`; fctx.lineWidth = Math.max(2, fs2 / 3);
    const s2 = 'награды ×' + comboM().toFixed(2);
    fctx.strokeText(s2, cx, cy + fs * .9 + 2 * DPR); fctx.fillText(s2, cx, cy + fs * .9 + 2 * DPR);
    const by = cy + fs * .9 + fs2 + 2 * DPR;
    fctx.fillStyle = '#000'; fctx.fillRect(cx, by, bw, 2 * DPR + 2);
    fctx.fillStyle = col; fctx.fillRect(cx + 1, by + 1, (bw - 2) * clamp(comboT / comboTime(), 0, 1), 2 * DPR);
    fctx.textAlign = 'center';
  }
}
// герой поверх всех эффектов: чёрный контур + спрайт; указатель, когда на экране тесно
let heroHiD = null;
function drawHeroTop(rk) {
  heroHiD = null;
  if (deathT > 0 || hero.iframe > 0 && Math.sin(time * 40) > 0) return;
  const x = Math.round(hero.x - 4), y = Math.round(hero.y - 8 - (hero.lift || 0)), moving = heroFrame === 'walk';
  const hop = hero.swType === 2 && hero.swing > hero.swDur * .4 ? -3 : 0, y0 = y + hop - (moving ? 1 : 0);
  const spr = heroSprite(rk, hero.hurt > 0, S.hpf < .35);
  const flip = (img, X, Y, f) => { ctx.save(); if (f < 0) { ctx.translate((X + 4) * 2, 0); ctx.scale(-1, 1); } ctx.drawImage(img, X - (img.ox || 0), Y - (img.oy || 0)); ctx.restore(); };
  const busy = parts.length > 120 || mobs.length > 14;
  if (busy) { ctx.globalAlpha = .5; ctx.fillStyle = '#0a0612'; for (let dy = -7; dy <= 7; dy++) { const w = Math.round(8 * Math.sqrt(1 - (dy / 7.5) ** 2)); ctx.fillRect(Math.round(hero.x) - w, Math.round(hero.y - 5) + dy, w * 2, 1); }
    heroGlow.push({ c: '#000000', a: .9, o: 1 }); }
  ctx.globalAlpha = 1; heroHiD = { rk, x: hero.x, y: hero.y - (hero.lift || 0) + hop - (moving ? .5 : 0), face: hero.face, flash: hero.hurt > 0, ex: S.hpf < .35 };
  if (S.meta.asc) { const hc = ASC_HALO[(S.meta.asc - 1) % ASC_HALO.length], hy = y0 - hTop() - 2; ctx.globalAlpha = .7 + .2 * Math.sin(time * 3); for (let i = -2; i <= 2; i++) pix(hero.x + i, hy - (Math.abs(i) === 2 ? 0 : 1), hc); ctx.globalAlpha = 1; }
  if (busy) { const top = y0 - hTop() - 4 + (Math.sin(time * 4) > 0 ? 0 : -1), cx = Math.round(hero.x), c = CL().c;
    const t2 = top - 2; ctx.fillStyle = '#000'; ctx.fillRect(cx - 4, t2 - 1, 9, 2); ctx.fillRect(cx - 3, t2 + 1, 7, 1); ctx.fillRect(cx - 2, t2 + 2, 5, 1); ctx.fillRect(cx - 1, t2 + 3, 3, 1); ctx.fillRect(cx, t2 + 4, 1, 1);
    ctx.fillStyle = c; ctx.fillRect(cx - 3, t2, 7, 1); ctx.fillRect(cx - 2, t2 + 1, 5, 1); ctx.fillRect(cx - 1, t2 + 2, 3, 1); ctx.fillStyle = '#fff'; ctx.fillRect(cx, t2 + 3, 1, 1); }
}
let heroGlow = [], heroGhosts = [];
function drawHero(rk) {
  heroGlow = [];
  const x = Math.round(hero.x - 4), y = Math.round(hero.y - 8 - (hero.lift || 0));
  if (deathT > 0) { heroFrame = 'hurt'; ctx.globalAlpha = Math.min(1, deathT / 1.4); const ds = silhouette('#ff3355'); ctx.drawImage(ds, x - (ds.ox || 0), y - (ds.oy || 0) + Math.round((1.4 - deathT) * 3)); ctx.globalAlpha = 1; return; }
  // светлое кольцо под ногами — героя видно всегда
  ctx.globalAlpha = .45; ctx.fillStyle = '#000'; for (let dy = -3; dy <= 2; dy++) { const w = Math.round(9 * Math.sqrt(1 - (dy / 3.5) ** 2)); ctx.fillRect(Math.round(hero.x) - w, Math.round(hero.y) + dy, w * 2, 1); }
  ctx.globalAlpha = .9; for (let i = 0; i < 20; i++) { const a = i / 20 * 6.28; pix(hero.x + Math.cos(a) * 7, hero.y + Math.sin(a) * 2.4, i % 2 ? CL().c : '#ffffff'); } ctx.globalAlpha = 1;
  heroFrame = pickHeroFrame();
  const moving = heroFrame === 'walk';
  const hop = hero.swType === 2 && hero.swing > hero.swDur * .4 ? -3 : 0;
  if (hero.iframe > 0 && Math.sin(time * 40) > 0) ctx.globalAlpha = .5;
  const spr = heroSprite(rk, hero.hurt > 0, S.hpf < .35);
  const flip = (img, X, Y, f) => { ctx.save(); if (f < 0) { ctx.translate((X + 4) * 2, 0); ctx.scale(-1, 1); } ctx.drawImage(img, X - (img.ox || 0), Y - (img.oy || 0)); ctx.restore(); };   // крупные облики центрируются по ногам
  // послеобразы скорости
  if (F(EI.move) >= 2) { ctx.globalAlpha = .18; for (const t of hero.trail) if (Math.hypot(t.x - hero.x, t.y - hero.y) > 7) heroGhosts.push({ x: t.x, y: t.y, face: t.face, c: EFF[EI.move].c, a: .18 }); ctx.globalAlpha = 1; }
  for (const g of ghosts) heroGhosts.push({ x: g.x, y: g.y, face: g.face, c: '#66ccff', a: Math.min(.8, g.l * 2) }); ctx.globalAlpha = 1;
  // сияние мощи
  const fp = F(EI.power);
  if (fp) heroGlow.push({ c: EFF[EI.power].c, a: Math.min(.6, .15 + fp * .1) * (.7 + .3 * Math.sin(time * 6)), o: 2 });
  // плащ второго по силе эффекта
  if (D.top && D.R[EFF[D.top[1]].k] >= 3) { const cc = EFF[D.top[1]].c, bx = hero.x - hero.face * 3, fl = Math.sin(time * 9) > 0 ? 1 : 0; for (let i = 0; i < 4; i++) pix(bx - hero.face * (i > 1 ? fl + 1 : 0), y + 3 + i, i % 2 ? shade(cc, -.25) : cc); }
  { const tr = tierOf(clsLv()), y0 = y + hop - (moving ? 1 : 0);
    if (aw()) { heroGlow.push({ c: CL().c, a: .45 + .25 * Math.sin(time * 5), o: 3 });
      if (rnd() < .4 && parts.length < 500) parts.push({ x: hero.x + (rnd() - .5) * 8, y: hero.y - rnd() * 9, vx: 0, vy: -18, l: .5, c: rnd() < .5 ? CL().c : '#ffffff', f: 1 }); }
    if (tr) heroGlow.push({ c: tr[0] === 30 ? hsl2hex(Math.floor(time * 4) % 12 * 30, 90, 65) : tr[1], a: .9, o: 1 }); }
  ctx.globalAlpha = 1;
  drawPathFx();
  const ac = ARMOR[(rk + 4) % ARMOR.length];
  // шипы
  const fth = F(EI.thorns);
  if (fth) for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + time * .5; for (let j = 0; j < Math.min(4, fth); j++) pix(hero.x + Math.cos(a) * (6 + j), hero.y - 4 + Math.sin(a) * (5 + j) * .8, j ? '#8a6a44' : '#cc9966'); }
  // руны мудрости
  const fw = F(EI.wis);
  for (let i = 0; i < Math.min(5, fw); i++) { const a = time * 2 + i * 6.28 / Math.min(5, fw); pix(hero.x + Math.cos(a) * 9, hero.y - 5 + Math.sin(a) * 4, '#bb88ff'); pix(hero.x + Math.cos(a) * 9, hero.y - 6 + Math.sin(a) * 4, '#e0ccff'); }
  // блик брони
  if (F(EI.armor)) { const ph = (time * (.6 + F(EI.armor) * .1)) % 2; if (ph < .35) { const gx = x + Math.floor(ph / .35 * 9); pix(gx, y + 2, '#ffffff'); pix(gx - 1, y + 3, '#ffffff'); } }
  // щит
  if (hero.shield > 0) { ctx.globalAlpha = .5; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + time; pix(hero.x + Math.cos(a) * 7, hero.y - 4 + Math.sin(a) * 6, '#9fe8ff'); } ctx.globalAlpha = 1; }
  // союзники некроманта
  for (const al of allies) { const sp2 = sprite(MOBS[2].p, { 1: '#bfe8d0', 2: '#4a8a6a', 3: '#7affb0' }, 'ally'); ctx.globalAlpha = al.t < 1 ? al.t : .9;
    ctx.save(); if (al.face < 0) { ctx.translate(Math.round(al.x - 4) * 2 + 8, 0); ctx.scale(-1, 1); } ctx.drawImage(sp2, Math.round(al.x - 4), Math.round(al.y - 8)); ctx.restore(); ctx.globalAlpha = 1; }
  // аура страха и раж
  if (D.fear > .02) { ctx.globalAlpha = .3 + .1 * Math.sin(time * 3); for (let i = 0; i < 28; i++) { const a = i / 28 * 6.28 - time * .7; pix(hero.x + Math.cos(a) * 22, hero.y - 2 + Math.sin(a) * 13, '#8844aa'); } ctx.globalAlpha = 1; }
  for (const tp of trailPts) { if (rnd() < .5) pix(tp.x + (rnd() - .5) * 3, tp.y - rnd() * 2, rnd() < .5 ? '#99ccff' : '#ffffff'); }
  for (let i = 0; i < (D.orbs || 0); i++) { const a = time * 3 + i * 6.28 / D.orbs, ox = Math.round(hero.x + Math.cos(a) * 15), oy = Math.round(hero.y - 4 + Math.sin(a) * 9); ctx.fillStyle = '#ff8844'; ctx.fillRect(ox - 1, oy - 1, 3, 3); pix(ox, oy, '#ffee88'); }
  for (const e of echoes) { ctx.globalAlpha = .5; const rr = 9 * (1 - e.t / .45); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; pix(e.x + Math.cos(a) * rr, e.y - 3 + Math.sin(a) * rr * .6, '#ccccff'); } ctx.globalAlpha = 1; }
  if (hero.rage > 0) for (let i = 0; i < hero.rage; i++) pix(hero.x - 4 + i * 2, y - 3, '#ff9944');
  // духи-клинки
  for (let i = 0; i < (D.spirits || 0); i++) { const a = time * 2.5 + i * 6.28 / D.spirits, sx2 = Math.round(hero.x + Math.cos(a) * 10), sy2 = Math.round(hero.y - 5 + Math.sin(a) * 6); pix(sx2, sy2 - 1, '#7affd8'); pix(sx2 - 1, sy2, '#7affd8'); pix(sx2 + 1, sy2, '#7affd8'); pix(sx2, sy2 + 1, '#ffffff'); }
  // шаровые молнии
  const fsh = F(EI.shock);
  if (fsh >= 3) { const n = Math.min(4, fsh - 2); for (let i = 0; i < n; i++) { const a = time * 4 + i * 6.28 / n, ox = Math.round(hero.x + Math.cos(a) * 12), oy = Math.round(hero.y - 4 + Math.sin(a) * 7); ctx.fillStyle = '#ffffff'; ctx.fillRect(ox, oy, 2, 2); pix(ox - 1, oy, '#99eeff'); pix(ox + 2, oy + 1, '#99eeff'); } }
  // облик от ключевых талантов
  const hk = bi => ksL(bi, 0) || ksL(bi, 1);
  if (hk(0)) { pix(x + 1, y - 1, '#ff3322'); pix(x + 6, y - 1, '#ff3322'); pix(x, y - 2, '#ff3322'); pix(x + 7, y - 2, '#ff3322'); }
  if (hk(5)) { ctx.globalAlpha = .9; for (let i = -2; i <= 3; i++) pix(hero.x + i, y - 3 + (Math.abs(i - .5) > 2 ? 1 : 0), '#ffe08a'); ctx.globalAlpha = 1; }
  if (hk(1)) { const sx2 = hero.x + hero.face * 4; ctx.fillStyle = '#aabbcc'; ctx.fillRect(Math.round(sx2) - 1, y + 3, 3, 3); pix(sx2, y + 4, '#ffffff'); }
  if (hk(2) && Math.sin(time * 20) > -.3) { pix(x + 1, y + 2 - (Math.sin(time * 9) > 0 ? 1 : 0), '#ff8a3c'); pix(x + 6, y + 2 - (Math.sin(time * 11) > 0 ? 1 : 0), '#ffcc33'); }
  if (hk(3)) { ctx.globalAlpha = .5; for (let i = 1; i < 6; i++) pix(hero.x - hero.face * (4 + i), y + 3 + (i % 2), '#66ccff'); ctx.globalAlpha = 1; }
  if (hk(4)) { const a = time * 2; pix(hero.x + Math.cos(a) * 6, y - 2 + Math.sin(a) * 2, '#44ffaa'); }
  if (hk(6)) { const by = y - 5 + Math.round(Math.sin(time * 3)); ctx.fillStyle = '#bb88ff'; ctx.fillRect(Math.round(hero.x) + 4, by, 3, 2); }
  if (hk(7) && rnd() < .3 && parts.length < 500) parts.push({ x: hero.x + (rnd() - .5) * 8, y: hero.y - rnd() * 8, vx: 0, vy: -10, l: .5, c: '#ff44ff', f: 1 });
  // крылья
  if (rk >= 10) { const f = Math.sin(time * 8) > 0 ? 1 : 0; for (let i = 0; i < 3; i++) { pix(hero.x - 4 - i, y + 2 + i - f, ac); pix(hero.x + 3 + i, y + 2 + i - f, ac); } }
  // корона
  if (rk >= 15) { pix(hero.x - 2, y - 1, '#ffd84a'); pix(hero.x, y - 2, '#ffd84a'); pix(hero.x + 1, y - 1, '#ffd84a'); pix(hero.x - 1, y - 1, '#ffd84a'); }
  // меч
  const sw = hero.swing > 0;
  const geq = S.meta.gear ? S.meta.gear.eq : {};
  const swordC = cls() !== 'war' ? CL().c : geq.w ? RAR[geq.w.rar].c : rk >= 8 ? ac : '#e6e6f0';
  drawClsFx(); drawSetAura();
  if (geq.a) { const ac2 = RAR[geq.a.rar].c; pix(x + 1, y + 3, ac2); pix(x + 6, y + 3, ac2); pix(x + 1, y + 4, shade(ac2, -.3)); pix(x + 6, y + 4, shade(ac2, -.3)); }
  if (geq.m) pix(hero.x, y + 4, RAR[geq.m.rar].c);
  if (geq.r && Math.sin(time * 3) > .9) pix(hero.x + hero.face * 3, y + 5, '#ffffff');
  if (sw && hero.swType === 1) {   // укол
    const p = 1 - hero.swing / hero.swDur, len = (MELEE + 1) * (.5 + p), ca = Math.cos(hero.swingA), sa = Math.sin(hero.swingA);
    for (let r = 2; r < len; r++) { pix(hero.x + ca * r, hero.y - 4 + sa * r, r > len - 3 ? '#ffffff' : swordC); pix(hero.x + ca * r - sa, hero.y - 4 + sa * r + ca, swordC); }
  } else if (sw && hero.swType === 2) {   // удар с прыжка: дуга сверху вниз
    const p = 1 - hero.swing / hero.swDur, len = MELEE + 1;
    for (let s2 = 0; s2 < 9; s2++) { const a = -Math.PI / 2 + hero.face * (s2 / 8) * Math.PI * Math.min(1, p * 1.5); for (let r = 3; r < len; r++) pix(hero.x + Math.cos(a) * r, hero.y - 6 + hop + Math.sin(a) * r, s2 === 8 ? '#ffffff' : swordC); }
  } else if (sw) {
    const p = 1 - hero.swing / .13, len = MELEE + Math.min(3, F(EI.dmg) >> 1), wd = 2 + Math.min(4, F(EI.cleave)) + Math.min(2, F(EI.aspd) >> 1);
    const swingC = F(EI.fire) >= 2 ? '#ff9a3c' : swordC;
    for (let s = -wd; s <= wd; s++) {
      const a = hero.swingA + (p - .5) * 2.2 + s * .12;
      for (let r = 2; r < len; r++) pix(hero.x + Math.cos(a) * r, hero.y - 4 + Math.sin(a) * r, s === 0 ? '#fff' : swingC);
    }
  } else if (cls() !== 'war') drawClsIdle(x, y);
  else {
    const fx2 = hero.x + hero.face * 3;
    for (let i = 0; i < 4; i++) pix(fx2 + hero.face * (i > 1 ? 1 : 0), y + 1 + i, swordC);
  }
  if (S.hpf < .35 && Math.sin(time * 5) > 0) pix(hero.x + 3, y, '#7cf');
  if (hero.slowT > 0) { ctx.globalAlpha = .7; for (let i = 0; i < 6; i++) pix(hero.x - 3 + i, y + 8, '#9fe8ff'); ctx.globalAlpha = 1; }
}

// облик и оружие класса (когда герой не машет мечом)
function drawClsIdle(x, y) {
  const f = hero.face, hx = hero.x, P = (dx, dy, col) => pix(hx + f * dx, y + dy, col);
  switch (cls()) {
    case 'arch': { const bx = Math.round(hx + f * 4); for (let i = 0; i < 6; i++) pix(bx + f * (i === 0 || i === 5 ? 0 : 1), y + 1 + i, '#c9a36a'); for (let i = 1; i < 5; i++) pix(bx, y + 1 + i, '#e6e6e6'); P(-3, 3, '#8a5a2a'); P(-3, 2, '#ffffff'); break; }
    case 'mage': for (let i = 0; i < 7; i++) P(4, i, '#8a5a2a'); ctx.fillStyle = hero.cast > 0 ? '#ffffff' : '#ff9a3c'; ctx.fillRect(Math.round(hx + f * 4) - 1, y - 2, 3, 3); break;
    case 'necro': for (let i = 0; i < 8; i++) P(4, i - 1, '#5a4a6a'); for (let i = 0; i < 4; i++) P(4 - i, -1 - (i > 2 ? 1 : 0), '#c9ced6'); if (Math.sin(time * 4) > 0) P(4, -2, '#7affb0'); break;
    case 'bers': for (let i = 0; i < 5; i++) P(4, i + 1, '#8a5a2a'); P(5, 1, '#c9ced6'); P(5, 2, '#c9ced6'); P(6, 2, '#ffffff'); P(5, 3, '#c9ced6'); P(-4, 3, '#8a5a2a'); P(-4, 4, '#8a5a2a'); P(-5, 3, '#c9ced6'); break;
    case 'pal': for (let i = 0; i < 5; i++) P(4, i + 2, '#8a6a3a'); ctx.fillStyle = '#ffe08a'; ctx.fillRect(Math.round(hx + f * 4) - 1, y, 3, 3); pix(hx + f * 4, y + 1, '#ffffff'); break;
    case 'guard': ctx.fillStyle = '#5a6a8a'; ctx.fillRect(Math.round(hx + f * 4) - 1, y + 2, 3, 5); for (let i = 0; i < 5; i++) P(5, 2 + i, '#8fb0d0'); P(4, 4, '#ffffff'); break;
    case 'sham': for (let i = 0; i < 8; i++) P(4, i - 1, '#6a4a2a'); P(4, -2, '#66ccff'); if (Math.sin(time * 12) > 0) { P(5, -3, '#ffffff'); P(3, -3, '#99eeff'); } break;
    case 'assa': P(4, 4, '#c9ced6'); P(5, 3, '#ffffff'); P(-4, 5, '#c9ced6'); P(-5, 4, '#ffffff'); break;
    case 'gamb': { const cy = y + 3 + (Math.sin(time * 5) > 0 ? 0 : 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(hx + f * 4), cy, 2, 3); pix(hx + f * 4, cy + 1, '#ff4466'); break; }
    case 'alch': ctx.fillStyle = '#b6ff3c'; ctx.fillRect(Math.round(hx + f * 4) - (f < 0 ? 1 : 0), y + 4, 2, 3); P(4, 3, '#e6e6e6'); if (rnd() < .3 && parts.length < 500) parts.push({ x: hx + f * 4, y: y + 2, vx: 0, vy: -10, l: .4, c: '#b6ff3c', f: 1 }); break;
    case 'priest': for (let i = 0; i < 8; i++) P(4, i - 1, '#e6d090'); P(3, -1, '#ffe08a'); P(5, -1, '#ffe08a'); P(4, -2, '#ffffff'); if (Math.sin(time * 3) > 0) P(0, -2, '#ffffff'); break;
    case 'monk': if (hero.fists > 0) for (let i = 0; i < 3; i++) { const a = hero.swingA + (rnd() - .5) * .8, r = 4 + rnd() * 7; ctx.fillStyle = '#ffcc99'; ctx.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(hero.y - 4 + Math.sin(a) * r), 2, 2); } else { P(4, 4, '#f0c090'); P(-3, 4, '#f0c090'); } break;
    case 'chrono': { const ox = Math.round(hx + f * 5), oy = y + 2 + Math.round(Math.sin(time * 3)); ctx.fillStyle = '#88aaff'; ctx.fillRect(ox - 1, oy - 1, 3, 3); pix(ox, oy, '#ffffff'); const a = time * 3; pix(ox + Math.round(Math.cos(a) * 2), oy + Math.round(Math.sin(a) * 2), '#ffffff'); break; }
    case 'rune': for (let i = 0; i < 3; i++) { const a = time * 2 + i * 2.09, rx = hx + Math.cos(a) * 7, ry = y + 3 + Math.sin(a) * 3; pix(rx, ry, '#bb88ff'); pix(rx, ry - 1, '#e0ccff'); pix(rx + 1, ry, '#bb88ff'); } break;
    case 'reap': for (let i = 0; i < 9; i++) P(4, i - 2, '#3a2a3a'); for (let i = 0; i < 5; i++) P(4 - i, -2 - (i > 3 ? 1 : 0), i === 4 ? '#ffffff' : '#c9ced6'); break;
  }
}
// эффекты класса поверх героя: вихрь, коса, души
function drawClsFx() {
  const hx = hero.x, hy = hero.y - 4;
  if (hero.spin > 0) { const p = 1 - hero.spin / .2; for (let i = 0; i < 3; i++) { const a = p * 12 + i * 2.09; for (let r = 6; r < 14; r += 2) pix(hx + Math.cos(a) * r, hy + Math.sin(a) * r * .7, r > 11 ? '#ffffff' : '#ff6644'); } }
  if (hero.sweep > 0) { const p = 1 - hero.sweep / .2, R = 16 + 12 * cq(0); for (let s = 0; s < 14; s++) { const a = hero.swingA - 1.6 + s / 13 * 3.2 * Math.min(1, p * 1.6); for (let r = R - 3; r < R; r++) pix(hx + Math.cos(a) * r, hy + Math.sin(a) * r * .8, r === R - 1 ? '#ffffff' : '#ff44ff'); } }
  if (hero.souls > 0) for (let i = 0; i < Math.min(12, hero.souls); i++) { const a = time * 2 + i * 6.28 / Math.min(12, hero.souls); pix(hx + Math.cos(a) * 9, hy - 2 + Math.sin(a) * 4, i % 2 ? '#ff44ff' : '#ffaaff'); }
}
// мир: тотемы, руны, поле времени
function drawClsWorld() {
  for (const z of holy) { ctx.globalAlpha = Math.min(.6, z.t * .3); circ(z.x, z.y, 18, '#ffe9a0', 30, .55, time); circ(z.x, z.y, 10, '#ffffff', 16, .55, -time); ctx.globalAlpha = 1; }
  if (cls() === 'sham') for (const tt of totems) { const x = Math.round(tt.x), y = Math.round(tt.y); ctx.globalAlpha = tt.t < 1 ? tt.t : 1; ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 1, y - 8, 3, 8); ctx.fillStyle = '#66ccff'; ctx.fillRect(x - 1, y - 10, 3, 2); pix(x, y - 6, '#ffffff'); if (tt.cd > .55) pix(x, y - 11, '#ffffff'); ctx.globalAlpha = 1; }
  for (const rn of runes) { const k = 1 - rn.t / .45, n = 14; ctx.globalAlpha = .5 + .5 * k; for (let i = 0; i < n; i++) { const a = i / n * 6.28 + time * 3; pix(rn.x + Math.cos(a) * rn.r * (.4 + .6 * k), rn.y + Math.sin(a) * rn.r * .5 * (.4 + .6 * k), '#bb88ff'); } pix(rn.x, rn.y, '#ffffff'); pix(rn.x - 1, rn.y - 1, '#e0ccff'); pix(rn.x + 1, rn.y + 1, '#e0ccff'); ctx.globalAlpha = 1; }
  if (cls() === 'chrono') { const r = 24 + 24 * cq(0); ctx.globalAlpha = .25; for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28 + time * .4; pix(hero.x + Math.cos(a) * r, hero.y - 2 + Math.sin(a) * r * .6, '#88aaff'); } ctx.globalAlpha = 1;
    for (const m of mobs) if (m.bombT > 0) { const b = Math.sin(time * 20) > 0; pix(m.x, m.y - 8 * m.sz - 3, b ? '#ffffff' : '#88aaff'); } }
}
// снаряды классов
function drawClsWave(w) {
  const PVK = { knife: 'knife', bone: 'skull', chi: 'chi', holy: 'holy', rune: 'rune', bolt: 'bolt', flask: 'flask', card: 'card' };
  if (w.pv && PVK[w.kind]) { drawOrb(PVK[w.kind], w.x, w.y, w.a + time * 6, w.c); return true; }
  if (w.pv && !w.kind) { const x = Math.round(w.x), y = Math.round(w.y); ctx.fillStyle = w.c; ctx.fillRect(x - 1, y - 1, 3, 3); pix(x, y, '#ffffff'); ctx.globalAlpha = .45; for (let j = 1; j <= 3; j++) pix(x - Math.cos(w.a) * j * 2, y - Math.sin(w.a) * j * 2, w.c); ctx.globalAlpha = 1; return true; }
  const x = Math.round(w.x), y = Math.round(w.y), ca = Math.cos(w.a), sa = Math.sin(w.a), sp = time * 25;
  switch (w.kind) {
    case 'axe': case 'scythe': case 'hammer': case 'shield': {
      const col = WCOL[w.kind]; ctx.fillStyle = col;
      if (w.kind === 'shield') { ctx.fillRect(x - 1, y - 2, 3, 4); pix(x, y - 1, '#ffffff'); return true; }
      if (w.kind === 'hammer') { ctx.fillRect(x - 1, y - 1, 3, 3); pix(x, y, '#ffffff'); pix(x - Math.round(Math.cos(sp) * 2), y - Math.round(Math.sin(sp) * 2), '#8a6a3a'); return true; }
      for (let i = -2; i <= 2; i++) pix(x + Math.cos(sp) * i, y + Math.sin(sp) * i, i === 2 ? '#ffffff' : col); if (w.kind === 'scythe') for (let i = 0; i < 3; i++) pix(x + Math.cos(sp + 1.6) * (2 + i * .5), y + Math.sin(sp + 1.6) * (2 + i * .5), '#ffffff'); return true; }
    case 'card': { ctx.fillStyle = w.joker ? '#44ffaa' : '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 3); pix(x, y, ['#ff4466', '#ffd84a', '#228844', '#222222'][w.suit]); return true; }
    case 'flask': { const tot = Math.hypot(w.t.x - w.ox, w.t.y - w.oy) || 1, rest = Math.hypot(w.t.x - w.x, w.t.y - w.y), k = clamp(1 - rest / tot, 0, 1), arc = Math.round(Math.sin(k * Math.PI) * 10);
      ctx.fillStyle = '#b6ff3c'; ctx.fillRect(x - 1, y - arc - 1, 2, 2); pix(x, y - arc - 2, '#e6e6e6'); ctx.globalAlpha = .3; pix(x, y + 1, '#000'); ctx.globalAlpha = 1; return true; }
    case 'time': { ctx.fillStyle = '#88aaff'; ctx.fillRect(x - 1, y - 1, 3, 3); pix(x + Math.round(Math.cos(sp) * 2), y + Math.round(Math.sin(sp) * 2), '#ffffff'); ctx.globalAlpha = .4; for (let j = 1; j <= 3; j++) pix(x - ca * j * 2, y - sa * j * 2, '#88aaff'); ctx.globalAlpha = 1; return true; }
  }
  return false;
}

