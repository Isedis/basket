'use strict';
/* ---------- РЕЙД-БОСС НЕДЕЛИ ---------- */
// Раз в неделю — новый босс из 8 (по кругу). 3 попытки в день по 60 секунд на отдельной арене; урон копится за неделю.
// Запас HP босса подбирается по первой попытке недели: ×12 от её урона (≈ 4 дня по 3 попытки, герой за неделю растёт — выходит 2–4 дня).
// Фазы попытки: 0–20 с — обычные атаки, 20–40 с — призыв подмоги, 40–60 с — ярость (атаки чаще и сильнее).
// Победа даёт трофей босса: вечный бонус; повторная победа над тем же боссом через 8 недель — трофей +1 уровень.
// В попытке нельзя умереть по-настоящему: «смерть» лишь заканчивает попытку. Логика зоны (убийства, вожак, угроза) на время рейда замирает.
const RAID_TIME = 60, RAID_TRIES = 3, RAID_ZONE = 15;
const RAIDS = [
  { id: 'slime', n: 'Слизень-Исполин', t: 0, h: 120, tro: { k: 'hp', n: 'Ядро слизня', v: .08 } },
  { id: 'bone', n: 'Костяной Король', t: 2, h: 45, tro: { k: 'armor', n: 'Костяная корона', v: .02 } },
  { id: 'flame', n: 'Владыка Пламени', t: 6, h: 8, tro: { k: 'hit', n: 'Рог демона', v: .08 } },
  { id: 'golem', n: 'Древний Голем', t: 7, h: 30, tro: { k: 'regen', n: 'Сердце камня', v: .1 } },
  { id: 'spider', n: 'Королева Пауков', t: 8, h: 285, tro: { k: 'aps', n: 'Жвала королевы', v: .04 } },
  { id: 'eye', n: 'Всевидящее Око', t: 5, h: 200, tro: { k: 'crit', n: 'Зрачок Ока', v: .02 } },
  { id: 'troll', n: 'Горный Тролль', t: 15, h: 95, tro: { k: 'critd', n: 'Клык тролля', v: .08 } },
  { id: 'storm', n: 'Шторм-Элементаль', t: 12, h: 190, tro: { k: 'gain', n: 'Искра шторма', v: .08 } },
];
const TRO_D = { hp: 'HP', armor: 'брони', hit: 'урона', regen: 'регенерации', aps: 'скорости атаки', crit: 'шанса крита', critd: 'силы крита', gain: 'прироста статов' };
const troTxt = (b, L) => '+' + pct(b.tro.v * L) + ' ' + TRO_D[b.tro.k];
const weekIdx = () => Math.floor((Date.now() / 864e5 + 3) / 7);   // неделя с понедельника
const dayKey = () => new Date().toDateString();
function RA() { const M = S.meta; if (!M.raid) M.raid = { tro: {} }; const A = M.raid; if (!A.tro) A.tro = {};
  if (A.wk !== weekIdx()) { A.wk = weekIdx(); A.hp = 0; A.hpEst = 0; A.dmg = 0; A.won = 0; A.last = null; }
  if (A.day !== dayKey()) { A.day = dayKey(); A.tries = 0; } return A; }
const raidBoss = () => RAIDS[RA().wk % RAIDS.length];
const raidOpen = () => (S.meta.best || 0) >= RAID_ZONE || !!(S.meta.raid && Object.keys(S.meta.raid.tro || {}).length);
const raidLeft = () => Math.max(0, RAID_TRIES - (RA().tries || 0));
const raidCan = () => raidOpen() && raidLeft() > 0 && !RA().won && !S.raid;
// трофеи: вечные бонусы (в цепочке recalc)
function raidMods() { const T = (S.meta.raid && S.meta.raid.tro) || {};
  for (const b of RAIDS) { const L = T[b.id] || 0; if (!L) continue; const v = b.tro.v * L;
    switch (b.tro.k) { case 'hp': D.maxHP *= 1 + v; break; case 'hit': D.hit *= 1 + v; break; case 'aps': D.aps *= 1 + v; break; case 'regen': D.regen *= 1 + v; break;
      case 'crit': D.crit = Math.min(.95, D.crit + v); break; case 'critd': D.critM *= 1 + v; break; case 'gain': D.gainMult *= 1 + v; break; case 'armor': D.armor = Math.min(.9, D.armor + v); break; } } }
const raidEstDPS = () => Math.max(1, D.hit * D.aps * (1 + D.crit * (D.critM - 1)) * 1.4);

/* ---------- бой ---------- */
let raidGroundC = null;
function raidStart() {
  if (SIM || !raidCan()) return; if (deathT > 0) { toast('ГЕРОЙ ПАЛ', 'дождись новой жизни'); return; }
  const A = RA(), B = raidBoss(); A.tries = (A.tries || 0) + 1;
  const first = !A.hp, total = first ? 1e300 : A.hp;   // первая попытка недели — замер: босса не убить, запас HP = её урон ×12
  S.raid = { t: RAID_TIME, hp0: hero.hp, lt: S.lt || 0, zk: S.zk || 0, ph: 0, sumT: 0, dealt: 0, first };
  mobs = []; tele = []; proj = []; waves = []; bossAlive = false; hero.pool = 0; hero.hp = D.maxHP; hero.iframe = 1;
  hero.x = AW / 2 - 20; hero.y = AH / 2 + 10;
  const m = { t: B.t, x: AW / 2 + 22, y: AH / 2 - 6, h: B.h, hp: Math.max(1, total - (A.dmg || 0)), max: total, rare: false, boss: true, raid: 1, sz: 4.4, af: 0, na: 0, name: B.n,
    sp: 9, dm: 1, cd: 1, fl: 0, kx: 0, ky: 0, psn: 0, psnT: 0, dead: false, id: ++mobId, ws: { ox: 0, oy: -10, t: 0 } };
  m.dm = D.maxHP * .04 / Math.max(1e-300, zoneDmg(S.zone) * MOBDMG * threatM());   // касание ≈ 4% HP
  mobs.push(m); moveWS(m); bossAlive = true; bossT = 999; S.raid.hpStart = m.hp;
  raidArena(); camFX = clamp(hero.x - W / 2, 0, Math.max(0, AW - W)); camFY = clamp(hero.y - H / 2, 0, Math.max(0, AH - H));
  { const bb = $('raidb'); if (bb) bb.hidden = true; }
  go('fight'); toast('РЕЙД: ' + B.n.toUpperCase(), RAID_TIME + ' секунд · урон копится всю неделю', 3200); sfx.boss(); shake = 10; flashT = .2;
  tip('raid', 'Рейд-босс', 'Бей босса 60 секунд. Урон сохраняется на всю неделю — 3 попытки в день. Красные зоны — уклоняйся тапом по герою.');
}
const raidDmg = bm => D.maxHP * (.16 + .05 * (bm.phase || 0)) / Math.max(.1, 1 - D.armor);   // удар из красной зоны ≈ 16–26% HP
function raidTick(dt) {
  const R = S.raid; if (!R) return; R.t -= dt; const e = RAID_TIME - R.t, bm = mobs.find(m => m.raid && !m.dead);
  if (!bm) { raidEnd(true); return; }
  { const dx = bm.x - hero.x, dy = bm.y - hero.y, d = Math.hypot(dx, dy) || 1; if (d < 18) { bm.x = clamp(hero.x + dx / d * 18, 10, AW - 10); bm.y = clamp(hero.y + dy / d * 18, 20, AH - 4); } }   // гигант не наползает на героя
  const ph = e > 40 ? 2 : e > 20 ? 1 : 0;
  if (ph !== R.ph) { R.ph = ph; bm.phase = ph; bm.atkT = Math.min(bm.atkT || 0, 1);
    if (ph === 1) { toast('ПОДМОГА!', B_name() + ' зовёт слуг', 2000); } else { toast('ЯРОСТЬ!', 'последние 20 секунд — босс бьёт чаще', 2200); bm.sp *= 1.4; tone(110, .4, 'sawtooth', .05, 60); } shake = 8; flashT = .12; }
  if (ph >= 1) { R.sumT -= dt; if (R.sumT <= 0 && mobs.length < 30) { R.sumT = ph === 2 ? 4 : 6; ring(bm.x, bm.y - 8, 22, '#bb66ff'); for (let i = 0; i < 4; i++) { spawnMob(false); const o = mobs[mobs.length - 1]; o.x = clamp(bm.x + (rnd() - .5) * 40, 4, AW - 4); o.y = clamp(bm.y + (rnd() - .5) * 30, 8, AH - 2); o.hw = 0; } } }
  S.lt = R.lt;   // угроза жизни на время рейда не растёт
  if (R.t <= 0) raidEnd(false, 'time');
}
const B_name = () => raidBoss().n;
function raidEnd(win, why) {
  const R = S.raid; if (!R) return; const A = RA(), B = raidBoss(), bm = mobs.find(m => m.raid);
  const dealt = win ? R.hpStart : R.dealt;
  if (win) { A.hp = A.hp || (A.hpEst || 1); A.dmg = A.hp; A.won = 1; A.tro[B.id] = (A.tro[B.id] || 0) + 1; }
  else if (!A.hp) { A.hp = Math.max(dealt * 12, (A.dmg || 0) + dealt * 2, 1); A.dmg = dealt; }   // первая попытка недели задаёт запас HP
  else A.dmg = Math.min(A.hp - 1, (A.dmg || 0) + dealt);
  A.last = { dealt, win: win ? 1 : 0, why: why || '', f: dealt / A.hp };
  S.raid = null; mobs = []; tele = []; proj = []; waves = []; bossAlive = false; hero.pool = 0; hero.hp = Math.max(R.hp0, D.maxHP * .5); hero.iframe = 1.5; S.lt = R.lt; S.zk = R.zk;
  buildGround(); recalc(); save(true);
  if (win) { toast('БОСС НЕДЕЛИ ПОВЕРЖЕН!', 'трофей «' + B.tro.n + '» ' + roman(A.tro[B.id]) + ': ' + troTxt(B, A.tro[B.id]) + ' навсегда', 5000); flashT = .3; shake = 14; slowT = 1;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .25, 'triangle', .05, 0, i * .1)); }
  else toast(why === 'time' ? 'ВРЕМЯ ВЫШЛО' : 'ГЕРОЙ ОТСТУПИЛ', 'урон: ' + fmt(dealt) + ' (' + pct(dealt / A.hp) + ' босса) · всего ' + pct(A.dmg / A.hp) + ' · попыток сегодня: ' + raidLeft(), 4500);
  renderRaid();
}
// арена рейда: тёмный камень, круг рун, жаровни
function raidArena() {
  if (SIM) return; const c = document.createElement('canvas'); c.width = AW; c.height = AH; const g = c.getContext('2d'), cx = AW / 2, cy = AH / 2;
  g.fillStyle = '#16121e'; g.fillRect(0, 0, AW, AH);
  let s = 77; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < AH; y += 8) for (let x = (y / 8 % 2) * 6; x < AW; x += 12) { g.fillStyle = r() < .5 ? '#221c2c' : '#1c1726'; g.fillRect(x, y, 11, 7); g.fillStyle = '#2c2438'; g.fillRect(x, y, 11, 1); }
  const R1 = Math.min(AW, AH) * .42; g.strokeStyle = '#5a1a2a'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, R1, R1 * .62, 0, 0, 6.283); g.stroke();
  g.strokeStyle = '#8a2a3a'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, R1 - 5, R1 * .62 - 4, 0, 0, 6.283); g.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.fillStyle = i % 2 ? '#c84a5a' : '#6a1a2a'; g.fillRect(Math.round(cx + Math.cos(a) * (R1 - 2.5) - 1), Math.round(cy + Math.sin(a) * (R1 * .62 - 2) - 1), 2, 2); }
  for (const [fx, fy] of [[cx - R1, cy], [cx + R1, cy], [cx, cy - R1 * .62], [cx, cy + R1 * .62]]) { g.fillStyle = '#3a3040'; g.fillRect(fx - 3, fy - 3, 6, 6); g.fillStyle = '#ff9a3c'; g.fillRect(fx - 1, fy - 5, 2, 3); g.fillStyle = '#ffe08a'; g.fillRect(fx, fy - 5, 1, 1); }
  ground = c; decal = document.createElement('canvas'); decal.width = AW; decal.height = AH;
}
// панель рейда поверх боя: имя, таймер, прогресс недели
function raidHUD(k) {
  const R = S.raid; if (!R) return; const A = RA(), bm = mobs.find(m => m.raid), base = Math.max(8, Math.round(SC * 2)) * DPR;
  const fs = Math.round(base * .75 / DPR) * DPR, y = 10 * k; fctx.textAlign = 'center'; fctx.textBaseline = 'middle'; fctx.lineWidth = Math.max(2, fs / 3); fctx.strokeStyle = '#000';
  fctx.font = `${fs}px "Press Start 2P", monospace`; const tl = Math.ceil(R.t), txt = raidBoss().n.toUpperCase() + ' · ' + tl + ' с';
  fctx.fillStyle = tl <= 10 && Math.sin(time * 10) > 0 ? '#ff5a5a' : '#ffe08a'; fctx.strokeText(txt, fx.width / 2, y); fctx.fillText(txt, fx.width / 2, y);
  const dealt = R.dealt, f = A.hp ? (A.dmg + dealt) / A.hp : 0, s2 = (R.first ? 'замер силы босса' : 'неделя: ' + pct(Math.min(1, f))) + ' · урон: ' + fmt(Math.max(0, dealt));
  fctx.font = `${Math.round(fs * .8)}px "Press Start 2P", monospace`; fctx.fillStyle = '#c8b8e0'; fctx.strokeText(s2, fx.width / 2, y + fs * 1.4); fctx.fillText(s2, fx.width / 2, y + fs * 1.4);
}

/* ---------- экран рейда ---------- */
function renderRaid() {
  const el = $('raid'); if (!el || el.hidden) return; const A = RA(), B = raidBoss(), now = Date.now(), wEnd = (weekIdx() + 1) * 7 * 864e5 - 3 * 864e5, left = Math.max(0, wEnd - now), dd = Math.floor(left / 864e5), hh = Math.floor(left % 864e5 / 36e5);
  const f = A.hp ? A.dmg / A.hp : 0, L = A.tro[B.id] || 0, can = raidCan();
  const port = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').drawImage(mobSprite({ t: B.t, h: B.h, boss: true }, false), 0, 0); return c.toDataURL(); })();
  $('rdbody').innerHTML = `<div class="rdcard"><img src="${port}" class="rdimg"><div><b>${B.n}</b><small>босс недели · сменится через ${dd} д ${hh} ч</small>
    <small>трофей: <span style="color:#ffd84a">${B.tro.n}</span> — ${troTxt(B, 1)}${L ? ' (у тебя ' + roman(L) + ')' : ''}</small></div></div>
    <div class="rdbar"><i style="width:${(f * 100).toFixed(1)}%"></i><span>${A.won ? 'ПОВЕРЖЕН!' : A.hp ? 'урон недели: ' + pct(f) : 'первая попытка определит силу босса'}</span></div>
    <button class="btn big" id="rdgo"${can ? '' : ' disabled'}>${A.won ? 'БОСС ПОВЕРЖЕН — ЖДИ СЛЕДУЮЩЕГО' : raidLeft() ? 'В БОЙ · попыток ' + raidLeft() + '/' + RAID_TRIES : 'ПОПЫТКИ КОНЧИЛИСЬ — ЗАВТРА'}</button>
    ${A.last ? `<div class="k">Последняя попытка: ${A.last.win ? 'победа!' : fmt(A.last.dealt) + ' урона (' + pct(A.last.f) + ' босса)'}</div>` : ''}
    <div class="gsec">ТРОФЕИ</div><div class="rdtro">${RAIDS.map(b => { const l = A.tro[b.id] || 0; return `<div class="${l ? 'on' : ''}"><b>${l ? b.tro.n + ' ' + roman(l) : '???'}</b><small>${l ? troTxt(b, l) : b.n}</small></div>`; }).join('')}</div>
    <div class="dim">60 секунд против босса на отдельной арене. Урон копится за неделю, 3 попытки в день. Фазы: подмога на 20-й секунде, ярость на 40-й. Победа — трофей навсегда; тот же босс вернётся через 8 недель, и трофей станет сильнее.</div>`;
  $('rdgo').onclick = () => { uiTap(); raidStart(); };
}
function openRaid() { $('raid').hidden = false; renderRaid(); }
function raidInit() {
  const b = $('raidb'); if (b) b.onclick = () => { uiTap(); go('hero', 'raid'); };
  setInterval(() => { const bb = $('raidb'); if (!bb) return; const show = raidCan() && !S.raid && deathT <= 0; bb.hidden = !show; if (show) bb.textContent = '⚔ РЕЙД ' + raidLeft(); }, 1000);
}
