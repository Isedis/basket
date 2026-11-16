'use strict';
/* ---------- ПЕРВЫЕ 15 МИНУТ: обучение в бою, тишина, ранние «вау» ---------- */
// Коуч: пузырь со стрелкой и пульсирующим кольцом на нужном месте, по шагам (каждый — один раз):
//   тапай по врагам → вожак: бей в жёлтую точку → ульта готова: тапни → новый стат: ГЕРОЙ → после смерти: таланты в ПРОКАЧКЕ.
// Тишина: первые 5 минут первой жизни прочие подсказки (tip) молчат — откладываются, а не теряются.
// Ранние «вау»: в первой жизни ульта копится ×2; на 5-й зоне (в первой или второй жизни) — «Дар новичка»: мастерство до 9 очков пути и первая эволюция облика.
const onbFirst = () => !(S.meta.rebirths || 0);
const onbQuiet = () => onbFirst() && (S.lt || 0) < 300;
const TIP_OK = { tele: 1, raid: 1 };
const fightVis = () => uiSec === 'fight' || (typeof isWide === 'function' && isWide());   // на компьютере бой виден всегда   // эти подсказки нужны и в начале
let coachCur = null, coachT0 = 0, coachGap = 0, coachTaps = 0, coachLast = 0;   // время коуча — игровое (time): шаг виден N игровых секунд
const COACH = [
  { id: 'tap', when: () => onbFirst() && (S.lt || 0) > 2 && fightVis() && mobs.length, text: 'Герой сражается сам. Тапай по врагам — твой удар сильнее!',
    at: () => { let n = null, nd = 1e9; for (const m of mobs) { const d = Math.hypot(m.x - hero.x, m.y - hero.y), vis = m.x > camX + 6 && m.x < camX + W - 6 && m.y > camY + 14 && m.y < camY + H - 6; if (!m.dead && vis && d < nd) { nd = d; n = m; } } return n ? { wx: n.x, wy: n.y - 4 } : { wx: hero.x, wy: hero.y - 6 }; },
    done: t => coachTaps >= 3 || t > 12 },
  { id: 'boss', when: () => bossAlive && fightVis() && !S.raid && mobs.some(m => m.boss && m.ws && !m.dead && m.x > camX + 8 && m.x < camX + W - 8 && m.y + m.ws.oy > camY + 16 && m.y < camY + H - 4),   // вожак уже в кадре text: 'ВОЖАК! Тапай по жёлтой мигающей точке — урон ×12',
    at: () => { const b = mobs.find(m => m.boss && m.ws && !m.dead); return b ? { wx: b.x + b.ws.ox, wy: b.y + b.ws.oy } : null; }, done: t => !bossAlive || t > 14 },
  { id: 'ult', when: () => ult >= .999 && !S.meta.autoUlt && fightVis(), text: 'Ульта заряжена! Тапни по экрану — мощный удар',
    at: () => ({ wx: hero.x, wy: hero.y - 10 }), done: t => ult < .9 || !!US || t > 14 },
  { id: 'stats', when: () => stats.length >= 4 && (S.lt || 0) > 30 && fightVis(), text: 'Открылся новый стат — загляни: ГЕРОЙ',
    el: 'nHero', done: t => uiSec === 'hero' || t > 12 },
  { id: 'souls', when: () => (S.meta.rebirths || 0) >= 1 && !$('nUp').hidden && (S.meta.souls || 0) > 0, text: 'Души павшего героя — это таланты. Открой ПРОКАЧКА',
    el: 'nUp', done: t => uiSec === 'up' || t > 20 },
];
function coachTick() {
  if (SIM) return; const M = S.meta; if (!M.tutD) M.tutD = {};
  const box = $('coach'), ring = $('coachRing'); if (!box) return;
  if ((M.rebirths || 0) >= 3 && !coachCur) { box.hidden = true; ring.hidden = true; return; }
  const now = time, dtc = Math.max(0, now - (coachLast || now)); coachLast = now;
  if (coachCur) { const t = now - coachT0; if (coachCur.done(t)) { M.tutD[coachCur.id] = 1; coachCur = null; coachGap = now + 1.5; box.hidden = true; ring.hidden = true; return; } }
  else if (now > coachGap && deathT <= 0) { coachCur = COACH.find(s => !M.tutD[s.id] && s.when()) || null; if (coachCur) { coachT0 = now; if (coachCur.id === 'tap') coachTaps = 0; } }
  const cr = $('croll'), busy = S.raid || EV || (cr && !cr.hidden) || (coachCur && !coachCur.el && !fightVis());   // шаги на поле — только когда бой на экране   // не мешать рейду, сцене эволюции и карточкам
  if (!coachCur || busy) { box.hidden = true; ring.hidden = true; if (coachCur && busy) coachT0 += dtc; return; }   // пока шаг не виден — его время не идёт
  // цель: точка мира или кнопка интерфейса
  let x, y; const g = $('game').getBoundingClientRect();
  if (coachCur.el) { const r = $(coachCur.el).getBoundingClientRect(); if (!r.width) { box.hidden = true; ring.hidden = true; return; } x = r.left + r.width / 2; y = r.top + r.height / 2; }
  else { const p = coachCur.at(); if (!p) return; x = clamp(g.left + (p.wx - camX) * SC, g.left + 20, g.right - 20); y = clamp(g.top + (p.wy - camY) * SC, g.top + 20, g.bottom - 20); }   // цель всегда в пределах поля
  ring.hidden = false; ring.style.left = Math.round(x) + 'px'; ring.style.top = Math.round(y) + 'px';
  box.hidden = false; box.textContent = coachCur.text;
  const bw = Math.min(260, innerWidth - 24), above = y > g.top + 120; box.style.width = bw + 'px';
  box.style.left = Math.round(clamp(x - bw / 2, 12, innerWidth - bw - 12)) + 'px';
  box.classList.toggle('up', !above);
  const bh = box.getBoundingClientRect().height; box.style.top = Math.round(above ? y - 34 - bh : y + 34) + 'px';
  box.style.setProperty('--ax', Math.round(clamp(x - parseFloat(box.style.left), 14, bw - 14)) + 'px');
}
// «Дар новичка»: первая эволюция в первой жизни
function onbGift() {
  const M = S.meta; if (SIM || M.giftEvo || (M.rebirths || 0) > 1 || S.zone < 5 || EV || bossAlive || S.raid || deathT > 0) return;
  const k = cls(); M.giftEvo = 1; if (formOf(k) > 1) return;
  const c = cm(k), need = 9 - pPts(k); if (need > 0) c.lv += need;
  toast('ДАР НОВИЧКА', 'мастерство класса +' + Math.max(0, need) + ' — первая эволюция!', 3500);
  for (const id of ['A', 'A', 'A', 'B', 'B', 'B', 'X', 'X']) pBuy(k, 1, id, true);
  setTimeout(() => pBuy(k, 1, 'X'), 600);   // последний узел — с пересчётом: запускает сцену эволюции
}
function onbInit() {
  fx.addEventListener('pointerdown', () => { coachTaps++; });
  setInterval(() => { try { coachTick(); onbGift(); } catch (e) {} }, 120);
}
