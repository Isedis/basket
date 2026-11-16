'use strict';
/* ---------- классы героя: 16 классов, по 2 на каждую ветвь дерева ---------- */
// br — ветвь, которая прокачивает класс; reach — дальность (нет = ближний бой); st — 2 уникальных стата класса
const CLASSES = {
  war:   { n: 'Воин', br: 0, c: '#c9ced6', d: 'меч и волна клинка · +30% HP, +1 цель', st: [['Закалка', q => '+' + pct(.3 * q) + ' брони'], ['Размах', q => 'каждый 3-й удар: круг ' + (12 + 12 * q).toFixed(0) + ' на ' + pct(.4 + 1.6 * q) + ' удара']] },
  bers:  { n: 'Берсерк', br: 0, c: '#ff4433', d: 'вихрь топоров бьёт всех вокруг · +25% скорости, −20% HP', st: [['Жажда крови', q => '+' + pct(.04 * q) + ' HP за удар'], ['Бешенство', q => 'урон до ×' + (1 + 4 * q).toFixed(2) + ' при низком HP']] },
  pal:   { n: 'Паладин', br: 1, c: '#ffe08a', d: 'молот: каждый 4-й удар — святая волна с лечением · +20% HP', st: [['Святая аура', q => 'аура жжёт врагов рядом: ' + pct(.6 * q) + ' удара/с'], ['Благословение', q => 'святая волна даёт щит ' + pct(.3 * q) + ' HP']] },
  guard: { n: 'Страж', br: 1, c: '#8fb0d0', d: 'удар щитом: сильно отбрасывает и оглушает · +50% HP, +15% брони, −25% урона', st: [['Блок', q => 'шанс ' + pct(.5 * q) + ' полностью заблокировать удар'], ['Сокрушение', q => 'оглушение ' + (.3 + 1.2 * q).toFixed(1) + 'с, по оглушённым ×' + (1 + 2 * q).toFixed(2)]] },
  mage:  { n: 'Маг', br: 2, c: '#c06bff', reach: 40, d: 'огненные шары взрываются по площади · +30% урона, −30% скорости', st: [['Пламя', q => 'взрыв радиусом ' + (11 + 14 * q).toFixed(0) + ' на ' + pct(.7 + q) + ' удара'], ['Метеор', q => 'шанс ' + pct(.25 * q) + ' обрушить метеор (×3 по площади)']] },
  sham:  { n: 'Шаман', br: 2, c: '#66ccff', reach: 40, d: 'цепная молния и тотемы · +10% скорости атаки', st: [['Цепь', q => 'молния перескакивает на ' + (2 + Math.floor(6 * q)) + ' врагов'], ['Тотемы', q => (1 + Math.floor(3 * q)) + ' тотем(а) по ' + pct(.3 + .7 * q) + ' удара']] },
  arch:  { n: 'Лучник', br: 3, c: '#5cff8a', reach: 48, d: 'стреляет издалека · +40% скорости атаки, +15% крита, −20% HP', st: [['Залп', q => '+' + Math.floor(4 * q) + ' стрел(ы) по соседним целям'], ['Пронзание', q => 'шанс ' + pct(.8 * q) + ' прошить цель насквозь']] },
  assa:  { n: 'Ассасин', br: 3, c: '#9a7aff', reach: 36, d: 'мгновенный скачок за спину врага · +30% крита, +20% бега, −30% HP', st: [['Удар в спину', q => 'по врагу с полным HP ×' + (2 + 6 * q).toFixed(1)], ['Тень', q => '+' + pct(.3 * q) + ' уворота']] },
  gamb:  { n: 'Шулер', br: 4, c: '#44ffaa', reach: 44, d: 'бросает карты разных мастей · +50% к золотым врагам, +20% наград', st: [['Джокер', q => 'шанс ' + pct(.15 * q) + ' на джокера: взрыв ×5'], ['Крап', q => (1 + Math.floor(3 * q)) + ' карт(ы) за бросок']] },
  alch:  { n: 'Алхимик', br: 4, c: '#b6ff3c', reach: 40, d: 'колбы оставляют лужи кислоты · +20% наград, −10% урона', st: [['Кислота', q => 'лужа ' + pct(.3 + 1.2 * q) + ' удара/с'], ['Трансмутация', q => 'шанс ' + pct(.2 * q) + ': убитый в кислоте — награды ×5']] },
  priest:{ n: 'Жрец', br: 5, c: '#fff6c0', reach: 44, d: 'столпы света с неба, лечат героя · +50% заряда ульты', st: [['Свет', q => 'столп радиусом ' + (6 + 12 * q).toFixed(0) + ', лечит ' + pct(.01 + .03 * q)], ['Молитва', q => 'заряд ульты ×' + (1 + 2 * q).toFixed(2)]] },
  monk:  { n: 'Монах', br: 5, c: '#ffaa55', d: 'шквал кулаков и рывки ци · ×1.6 скорости, −40% урона, +20% уворота', st: [['Ци', q => 'урон до ×' + (1 + 3 * q).toFixed(2) + ' от комбо'], ['Сто кулаков', q => (1 + Math.floor(4 * q)) + ' доп. удар(а) за атаку']] },
  chrono:{ n: 'Хрономант', br: 6, c: '#88aaff', reach: 40, d: 'замедляет время вокруг, отложенные взрывы', st: [['Замедление', q => 'поле замедления радиусом ' + (24 + 24 * q).toFixed(0)], ['Отсрочка', q => 'через 1.2с враг получает ещё ' + pct(1.5 * q) + ' удара']] },
  rune:  { n: 'Рунник', br: 6, c: '#bb88ff', reach: 40, d: 'ставит руны под врагов, они взрываются · +20% урона, −20% скорости', st: [['Сила рун', q => 'руна радиусом ' + (10 + 10 * q).toFixed(0) + ' на ' + pct(1.4 + q) + ' удара'], ['Резонанс', q => 'шанс ' + pct(.6 * q) + ' на новую руну рядом']] },
  necro: { n: 'Некромант', br: 7, c: '#7affb0', reach: 32, d: 'тёмные сгустки; убитые встают скелетами · −20% урона', st: [['Легион', q => 'до ' + (4 + Math.floor(12 * q)) + ' скелетов, шанс ' + pct(.2 + .5 * q)], ['Тлен', q => 'скелеты бьют на ' + pct(.3 + 1.5 * q) + ' удара']] },
  reap:  { n: 'Жнец', br: 7, c: '#ff44ff', d: 'широкий взмах косы; души убитых усиливают · +20% урона, −15% скорости', st: [['Жатва', q => 'взмах радиусом ' + (16 + 12 * q).toFixed(0)], ['Души', q => 'до ' + (5 + Math.floor(25 * q)) + ' душ, +4% урона за каждую']] },
};
const CLS_KEYS = Object.keys(CLASSES);
const cls = () => CLASSES[S.cls] ? S.cls : 'war';
const CL = () => CLASSES[cls()];
const clsPow = () => 1 + .02 * ((TB[CL().br] || {}).pts || 0);   // мастерство: очки в ветви класса
const clsReach = () => CL().reach || D.range;
const cq = j => (D.cq && D.cq[j]) || 0;
let allies = [], totems = [], runes = [];
function rollClass() {
  // после смерти выпадает самый непрокачанный класс (меньше всего мастерства), при равенстве — случайный из них; текущий не повторяется
  const pool = CLS_KEYS.filter(k => k !== S.cls), lv = k => { const c = (S.meta.cl || {})[k]; return c ? c.lv + c.xp / cxpNeed(c.lv) : 0; };
  const minLv = Math.min(...pool.map(lv)), low = pool.filter(k => lv(k) - minLv < 1);
  const k = skyOn('nv_loyal') && CLASSES[S.cls] ? S.cls : low[Math.floor(rnd() * low.length)];
  S.cls = k; S.cstyle = rnd() < .5 ? 0 : 1; S.cst = [0, 0]; if (!S.meta.seen) S.meta.seen = {}; S.meta.seen[k] = (S.meta.seen[k] || 0) + 1;
  allies = []; totems = []; runes = []; hero.souls = 0;
  return k;
}
function clsGain(a) { if (!S.cst) S.cst = [0, 0]; const p = clsPow(); S.cst[0] += a * (.5 + rnd()) * p; S.cst[1] += a * (.5 + rnd()) * p; }
// уникальные модификаторы класса (вызывается из recalc)
function clsMods() {
  const z = zs(), p = clsPow(), pw = Math.sqrt(p), c0 = S.cst ? S.cst : [0, 0];
  D.cp = p; D.cq = [sat(lg(c0[0] / z / 1000), 4), sat(lg(c0[1] / z / 1000), 4)];   // логарифм: растёт бесконечно, но всё медленнее
  ctMods();   // ветка класса и стиль боя
  const q0 = D.cq[0], q1 = D.cq[1];
  const ml = 1 + .04 * clsLv(); D.hit *= pw * ml; D.maxHP *= pw * ml;
  if (aw() && cls() === 'monk') D.dodge = Math.min(.9, D.dodge + .15);
  switch (cls()) {
    case 'war': D.maxHP *= 1.3; D.cleave += 1; D.armor = Math.min(.95, D.armor + .3 * q0); break;
    case 'bers': D.aps *= 1.25; D.maxHP *= .8; D.vamp += .04 * q0; break;
    case 'pal': D.maxHP *= 1.2; D.armor = Math.min(.95, D.armor + .1); break;
    case 'guard': D.maxHP *= 1.5; D.armor = Math.min(.95, D.armor + .15); D.hit *= .75; break;
    case 'mage': D.hit *= 1.3; D.aps *= .7; break;
    case 'sham': D.aps *= 1.1; break;
    case 'arch': D.aps = Math.min(14, D.aps * 1.4); D.crit = Math.min(.95, D.crit + .15); D.maxHP *= .8; break;
    case 'assa': D.crit = Math.min(.95, D.crit + .3); D.move *= 1.2; D.maxHP *= .7; D.dodge = Math.min(.9, D.dodge + .3 * q1); break;
    case 'gamb': D.rare = Math.min(.6, D.rare * 1.5); D.gainMult *= 1.2; break;
    case 'alch': D.gainMult *= 1.2; D.hit *= .9; break;
    case 'priest': break;
    case 'monk': D.aps = Math.min(14, D.aps * 1.6); D.hit *= .6; D.dodge = Math.min(.9, D.dodge + .2); break;
    case 'chrono': D.aps *= .9; break;
    case 'rune': D.hit *= 1.2; D.aps *= .8; break;
    case 'necro': D.hit *= .8; break;
    case 'reap': D.hit *= 1.2; D.aps *= .85; break;
  }
}
/* ---------- мастерство класса (навсегда) и пробуждение ---------- */
// опыт класса копится, пока играешь им; уровни дают вечные бонусы и облик; на 10-м уровне + полной ветви — пробуждение
const AWAKE_LV = 10;
const AWK = {
  war:   ['Стальной вихрь', 'каждые 6с кольцо клинков бьёт всех вокруг (×3 удара)'],
  bers:  ['Неистовство', 'при HP ниже 50% урон ×2'],
  pal:   ['Освящённая земля', 'святая волна оставляет круг, который жжёт врагов 4с'],
  guard: ['Контрудар', 'заблокированный удар бьёт волной ×2 по всем рядом'],
  mage:  ['Огненная буря', 'каждый 4-й огненный шар раскалывается на 3'],
  sham:  ['Шаровая молния', '+2 тотема, тотемы бьют цепной молнией'],
  arch:  ['Веер', 'каждый 4-й выстрел — веер из 5 стрел'],
  assa:  ['Смертельная метка', 'враги ниже 20% HP погибают от твоего удара'],
  gamb:  ['Двойная ставка', 'каждая 3-я карта срабатывает дважды'],
  alch:  ['Философский камень', 'лужи кислоты вдвое шире и замедляют врагов'],
  priest:['Ангел-хранитель', 'смертельный удар вожака: полное лечение (раз в 30с)'],
  monk:  ['Железное тело', '+2 доп. удара за атаку и +15% уворота'],
  chrono:['Петля времени', 'раз за жизнь смерть отматывается: герой встаёт с полным HP'],
  rune:  ['Великая руна', 'каждые 7с огромная руна под толпой врагов (×4)'],
  necro: ['Лич', '+6 скелетов; исчезая, скелет взрывается'],
  reap:  ['Пожиратель душ', '+20 душ максимум; при полном запасе — взрыв душ по всем'],
};
const TIERS = [[5, '#c08040', 'бронза'], [10, '#d8e0ea', 'серебро'], [20, '#ffd84a', 'золото'], [30, '#ff66ff', 'радуга']];
const cxpNeed = l => Math.floor(160 * Math.pow(l + 1, 1.4));   // кривая положе: поздние уровни дорожают медленнее
function cm(k) { const M = S.meta; if (!M.cl) M.cl = {}; if (!M.cl[k]) M.cl[k] = { xp: 0, lv: 0 }; return M.cl[k]; }
const clsLv = k => cm(k || cls()).lv;
const awake = k => ctFull(k || cls());   // пробуждение: вся ветка класса заполнена
const aw = () => awake();
const tierOf = l => { let t = null; for (const x of TIERS) if (l >= x[0]) t = x; return t; };
function clsXP(v) {
  if (skyOn('nv_loyal')) v *= 3;
  v *= relMxp() * 3.2;   // класс качается быстрее
  // общий опыт: все уже встреченные классы получают 15% опыта текущего (тихо, без тостов)
  for (const k of CLS_KEYS) if (k !== cls() && S.meta.seen && S.meta.seen[k]) { const o = cm(k); o.xp += v * .15; while (o.xp >= cxpNeed(o.lv)) { o.xp -= cxpNeed(o.lv); o.lv++; } }
  const c = cm(cls()); c.xp += v;
  let up = 0; while (c.xp >= cxpNeed(c.lv)) { c.xp -= cxpNeed(c.lv); c.lv++; up++; }
  if (!up) return;
  D.dirty = true; const C = CL();
  const tr = TIERS.find(x => x[0] === c.lv);
  toast('МАСТЕРСТВО ' + C.n.toUpperCase() + ' ' + c.lv, '+1 очко в ветку класса · +4% урона и HP' + (tr ? ' · облик: ' + tr[2] : ''), 2400);
  ring(hero.x, hero.y - 4, 18, C.c); burst(hero.x, hero.y - 4, C.c, 20, 50); [523, 784, 1047].forEach((f, i) => tone(f, .12, 'triangle', .04, 0, i * .07));
}
function awakenFx() { const C = CL(); flashT = .3; shake = 10; for (let i = 0; i < 3; i++) ring(hero.x, hero.y - 4, 20 + i * 12, i % 2 ? '#ffffff' : C.c); burst(hero.x, hero.y - 4, C.c, 50, 80); }
// способности пробуждения, работающие по таймеру
function awkTick(dt) {
  if (!aw()) return;
  const k = cls();
  if (k === 'war') { PT.awk = (PT.awk ?? 6) - dt; if (PT.awk <= 0 && mobs.length) { PT.awk = 6; const C = CL(); fx1(.4, p => { ctx.globalAlpha = 1 - p; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + p * 4; for (let j = 0; j < 4; j++) pix(hero.x + Math.cos(a) * (8 + p * 20 + j), hero.y - 4 + Math.sin(a) * (8 + p * 20 + j) * .7, j === 3 ? '#ffffff' : C.c); } ctx.globalAlpha = 1; }); hitAround(hero.x, hero.y, 28, D.hit * 3, '#c9ced6'); fxLabel('Стальной вихрь', hero.x, hero.y - 18, '#c9ced6'); } }
  if (k === 'rune') { PT.awk = (PT.awk ?? 7) - dt; if (PT.awk <= 0 && mobs.length) { PT.awk = 7; let best = null, bn = -1; for (const m of mobs) { if (m.dead) continue; const n = mobs.filter(o => !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < 26).length; if (n > bn) { bn = n; best = m; } } if (best) { runes.push({ x: best.x, y: best.y, t: .8, m: best, r: 28, res: false, big: D.hit * 4 }); fxLabel('Великая руна', best.x, best.y - 14, '#bb88ff'); } } }
  if (k === 'reap' && hero.souls >= 25 + Math.floor(25 * cq(1))) { hero.souls = 0; ring(hero.x, hero.y - 3, 50, '#ff44ff'); for (const m of mobs) if (!m.dead) hitMob(m, D.hit * 4, true, false, '#ff44ff'); fxLabel('Взрыв душ', hero.x, hero.y - 18, '#ff44ff'); shake = 6; }
  if (k === 'pal') for (const z of holy) { z.t -= dt; z.cd -= dt; if (z.cd <= 0) { z.cd = .5; hitAround(z.x, z.y, 18, D.hit * .6, '#ffe9a0'); } }
  holy = holy.filter(z => z.t > 0);
}
let holy = [];
/* ---------- ветка прокачки класса (очки за уровни мастерства) ---------- */
// у каждого класса: 2 стиля боя (один выпадает случайно вместе с классом) и вершина
const CSTY = {
  war:   [['Защитник', 'вампиризм +1% и броня +5% за силу стиля'], ['Мечник', 'урон ударов +25% и «Размах» сильнее'], ['Владыка клинков', '+2 цели рассечения, урон ×1.25']],
  bers:  [['Мясник', 'каждое убийство лечит 1% HP за силу стиля'], ['Вихрь', 'скорость атаки +10% за силу стиля'], ['Бессмертная ярость', 'при HP ниже 30% входящий урон вдвое меньше']],
  pal:   [['Крестоносец', 'святая волна каждый 3-й удар, а не 4-й'], ['Хранитель', 'регенерация +1% HP/с за силу стиля'], ['Свет во тьме', 'святая волна лечит 15% HP, броня +5%']],
  guard: [['Бастион', '«Блок» намного сильнее'], ['Таран', 'урон ударов щитом +30% за силу стиля'], ['Крепость', 'HP ×1.5, броня до 97%']],
  mage:  [['Пироман', '«Пламя» намного сильнее'], ['Архимаг', 'каждый 5-й шар огромный: урон ×(2 + сила стиля)'], ['Метеорит', '+15% шанс метеора']],
  sham:  [['Громовержец', '«Цепь» намного сильнее'], ['Тотемист', '«Тотемы» намного сильнее'], ['Око бури', 'каждые 10с молния бьёт всех врагов']],
  arch:  [['Снайпер', 'урон стрел +30% за силу стиля'], ['Шквал', '«Залп» намного сильнее'], ['Ястребиный глаз', 'крит +15%, сила крита ×1.3']],
  assa:  [['Призрак', 'уворот +5% за силу стиля'], ['Палач', '«Удар в спину» намного сильнее'], ['Тень смерти', 'после убийства следующий удар ×3']],
  gamb:  [['Счастливчик', 'золотые враги чаще: +20% за силу стиля'], ['Крапленый', '«Крап» намного сильнее'], ['Вечный джокер', 'джокер выпадает втрое чаще']],
  alch:  [['Отравитель', '«Кислота» намного сильнее'], ['Взрывник', 'колбы взрываются по площади'], ['Великое делание', '«Трансмутация» сильнее, награды ×1.2']],
  priest:[['Целитель', 'столпы лечат больше: ×(1 + сила стиля)'], ['Каратель', '«Свет» намного сильнее'], ['Чудо', 'регенерация ×2']],
  monk:  [['Ветер', 'скорость атаки +10% за силу стиля'], ['Кулак горы', 'урон ударов +25% за силу стиля'], ['Просветление', 'уворот +15%, урон ×1.2']],
  chrono:[['Замедлитель', '«Замедление» намного сильнее'], ['Бомбист', '«Отсрочка» намного сильнее'], ['Вечность', 'по замедленным врагам урон ×1.3']],
  rune:  [['Резонатор', '«Резонанс» намного сильнее'], ['Великий рунник', '«Сила рун» намного сильнее'], ['Рунная буря', 'каждая атака ставит 2-ю руну рядом']],
  necro: [['Повелитель', '«Тлен» намного сильнее'], ['Чумной', 'исчезая, скелеты взрываются'], ['Бессмертная армия', '+6 скелетов, шанс подъёма +30%']],
  reap:  [['Жнец', '«Жатва» намного сильнее'], ['Собиратель', '«Души» намного сильнее'], ['Смерть', 'каждое убийство лечит 1% HP']],
};
// какие стили усиливают уникальные статы класса: [индекс стата] по стилю
const STY_Q = { 'guard0': 0, 'mage0': 0, 'sham0': 0, 'sham1': 1, 'arch1': 0, 'assa1': 0, 'gamb1': 1, 'alch0': 0, 'priest1': 0, 'chrono0': 0, 'chrono1': 1, 'rune0': 1, 'rune1': 0, 'necro0': 1, 'reap0': 0, 'reap1': 1, 'war1': 1 };
// форма ветки: id, путь, макс. уровень, требования
const CT = [
  { id: 'R', x: 1, y: 0, max: 3, req: [] },
  { id: 'A1', x: 0, y: 1, max: 3, req: ['R'] }, { id: 'U1', x: 1, y: 1, max: 3, req: ['R'] }, { id: 'B1', x: 2, y: 1, max: 3, req: ['R'] },
  { id: 'A2', x: 0, y: 2, max: 3, req: ['A1'] }, { id: 'U2', x: 1, y: 2, max: 3, req: ['U1'] }, { id: 'B2', x: 2, y: 2, max: 3, req: ['B1'] },
  { id: 'A3', x: 0, y: 3, max: 1, req: ['A2'] }, { id: 'U3', x: 1, y: 3, max: 1, req: ['U2'] }, { id: 'B3', x: 2, y: 3, max: 1, req: ['B2'] },
  { id: 'S', x: 1, y: 4, max: 3, req: ['A2|U2|B2', 'A2|U2|B2'] },
  { id: 'V', x: 1, y: 5, max: 1, req: ['A3', 'U3', 'B3', 'S'] },
];
const CT_TOTAL = 27;   // см. pTotal() для 4-й ступени
function ctNode(k, id) {
  const C = CLASSES[k], st = C.st;
  switch (id) {
    case 'R': return ['Основа: ' + C.n, l => '+' + 6 * l + '% урона и HP'];
    case 'A1': return [st[0][0] + ' I', l => '«' + st[0][0] + '» сильнее на ' + 10 * l + '%'];
    case 'A2': return [st[0][0] + ' II', l => '«' + st[0][0] + '» сильнее ещё на ' + 10 * l + '%'];
    case 'A3': return ['Предел: ' + st[0][0], () => '«' + st[0][0] + '» +15 пунктов силы'];
    case 'B1': return [st[1][0] + ' I', l => '«' + st[1][0] + '» сильнее на ' + 10 * l + '%'];
    case 'B2': return [st[1][0] + ' II', l => '«' + st[1][0] + '» сильнее ещё на ' + 10 * l + '%'];
    case 'B3': return ['Предел: ' + st[1][0], () => '«' + st[1][0] + '» +15 пунктов силы'];
    case 'U1': return ['Мощь ульты', l => 'урон ульты +' + 15 * l + '%'];
    case 'U2': return ['Заряд ульты', l => 'ульта копится на ' + 20 * l + '% быстрее'];
    case 'U3': return ['Эхо ульты', () => 'после ульты возвращается 30% заряда'];
    case 'S': return ['Стиль боя', l => 'сила стиля ' + (.5 + .5 * l).toFixed(1) + ' (стиль выпадает с классом)'];
    case 'V': return [CSTY[k][2][0], () => CSTY[k][2][1]];
  }
}
const ctL = (id, k) => { const c = cm(k || cls()); return (c.ct && c.ct[id]) || 0; };
const ctSpent = k => { const c = cm(k); let s = 0; if (c.cp) for (const id in c.cp) s += c.cp[id]; return s; };   // очки, вложенные в путь класса
const ctPts = k => Math.max(0, cm(k).lv - ctSpent(k));
const ctFull = k => tierDone(k, 3);   // пробуждение: 3-я ступень пути
const sty = () => S.cstyle || 0;                            // 0 или 1
const stf = () => .5 + .5 * formOf(cls());                 // сила стиля растёт с эволюцией
const isSty = (k, i) => cls() === k && sty() === i;
const capOn = k => cls() === k && awake(k);
function ctReqOk(k, n) {
  if (n.id === 'S') return ['A2', 'U2', 'B2'].filter(x => ctL(x, k) > 0).length >= 2;
  return n.req.every(r => ctL(r, k) > 0);
}
function ctBuy(k, id) {
  const n = CT.find(x => x.id === id), c = cm(k);
  if (!n || ctL(id, k) >= n.max || ctPts(k) < 1 || !ctReqOk(k, n)) return false;
  if (!c.ct) c.ct = {}; c.ct[id] = (c.ct[id] || 0) + 1; D.dirty = true; recalc(); save();
  tone(660, .06, 'square', .03); tone(990, .08, 'square', .03, 0, .06);
  return true;
}
// бонусы ветки и стиля к характеристикам (из clsMods)
function ctMods() {
  const k = cls(), f = stf();
  const r = 1 + .06 * ctL('R'); D.hit *= r; D.maxHP *= r;
  const qb = [(1 + .1 * (ctL('A1') + ctL('A2'))), (1 + .1 * (ctL('B1') + ctL('B2')))];
  D.cq[0] = D.cq[0] * qb[0] + (ctL('A3') ? .15 : 0); D.cq[1] = D.cq[1] * qb[1] + (ctL('B3') ? .15 : 0);
  const sq = STY_Q[k + sty()]; if (sq !== undefined) D.cq[sq] += .15 * f;
  D.cq = D.cq.map(q => Math.min(1.5, q));
  if (isSty('war', 0)) { D.vamp += .01 * f; D.armor = Math.min(.95, D.armor + .05 * f); }
  if (isSty('bers', 1) || isSty('monk', 0)) D.aps = Math.min(14, D.aps * (1 + .1 * f));
  if (isSty('pal', 1)) D.regen += .01 * f;
  if (isSty('assa', 0)) D.dodge = Math.min(.9, D.dodge + .05 * f);
  if (isSty('gamb', 0)) D.rare = Math.min(.7, D.rare * (1 + .2 * f));
  if (capOn('war')) { D.cleave += 2; D.hit *= 1.25; }
  if (capOn('pal')) D.armor = Math.min(.95, D.armor + .05);
  if (capOn('guard')) { D.maxHP *= 1.5; D.armor = Math.min(.97, D.armor + .1); }
  if (capOn('arch')) { D.crit = Math.min(.95, D.crit + .15); D.critM *= 1.3; }
  if (capOn('alch')) D.gainMult *= 1.2;
  if (capOn('priest')) D.regen *= 2;
  if (capOn('monk')) { D.dodge = Math.min(.9, D.dodge + .15); D.hit *= 1.2; }
}
// множитель урона удара от стиля и вершины
function ctDM(t) {
  const f = stf(); let m = 1;
  if (isSty('war', 1) || isSty('monk', 1)) m *= 1 + .25 * f;
  if (isSty('guard', 1)) m *= 1 + .3 * f;
  if (isSty('arch', 0)) m *= 1 + .3 * f;
  if (capOn('chrono') && t.slowT > 0) m *= 1.3;
  if (capOn('assa') && hero.tsd) { hero.tsd = 0; m *= 3; fxLabel('Тень смерти', t.x, t.y - 14, '#9a7aff'); }
  return m;
}

/* интерфейс ветки класса */
let ctK = null;
function openCT(k) { tip('dbl', 'Двойной тап', 'Тапни узел дважды подряд — сразу купишь уровень. Работает в талантах, ветке класса и на Небосводе.'); if (k !== ctK) ctHeroK = null; ctK = k; $('ctree').hidden = false; renderCT(); }

/* ================= РЕЛИКВИИ КЛАССОВ И НАСЛЕДИЕ ================= */
// Реликвия: своё оружие у каждого класса, уровень 1–100 за убийства этим классом; каждые 10 уровней — выбор 1 из 2 навсегда.
// Наследие: каждый класс качает свою общую характеристику (по уровню его реликвии), она действует на ВСЕХ героев.
const REL = {
  war: ['Клинок Рассвета', 'sword'], bers: ['Топор Кровавой Луны', 'sword'], pal: ['Молот Зари', 'helm'], guard: ['Щит Бастиона', 'helm'],
  mage: ['Посох Сверхновой', 'star'], sham: ['Тотем Грома', 'bulb'], arch: ['Лук Полярной Звезды', 'star'], assa: ['Кинжал Тени', 'sword'],
  gamb: ['Колода Судьбы', 'chest'], alch: ['Философский Камень', 'bulb'], priest: ['Скипетр Света', 'soul'], monk: ['Чётки Дракона', 'soul'],
  chrono: ['Часы Вечности', 'gear'], rune: ['Скрижаль Рун', 'stats'], necro: ['Череп Владыки', 'soul'], reap: ['Коса Затмения', 'sword'],
};
const LEGC = {
  war: ['Сила', L => '+' + L + '% урона'], bers: ['Ярость', L => '+' + (.3 * L).toFixed(1) + '% скорости атаки'], pal: ['Свет', L => '+' + (.02 * L).toFixed(2) + '% HP/с'],
  guard: ['Стойкость', L => '+' + (1.5 * L).toFixed(0) + '% HP'], mage: ['Чары', L => '+' + (.5 * L).toFixed(1) + '% ко всем эффектам'], sham: ['Гром', L => '+' + 2 * L + '% урона ульты'],
  arch: ['Меткость', L => '+' + (.1 * L).toFixed(1) + '% крита'], assa: ['Смертоносность', L => '+' + L + '% силы крита'], gamb: ['Фортуна', L => 'золотые враги +' + L + '%'],
  alch: ['Алхимия', L => '+' + L + '% прироста статов'], priest: ['Благодать', L => '+' + (.5 * L).toFixed(1) + '% душ'], monk: ['Дух', L => '+' + (.05 * L).toFixed(2) + '% уворота'],
  chrono: ['Время', L => 'ульта на ' + (.02 * L).toFixed(2) + 'с чаще'], rune: ['Знание', L => '+' + L + '% опыта мастерства'], necro: ['Тьма', L => '+' + L + '% урона вожакам'], reap: ['Жатва', L => '+' + (.01 * L).toFixed(2) + '% вампиризма'],
};
const REL_T = [
  [['Заточка', '+25% урона', { hit: .25 }], ['Закалка', '+40% HP', { hp: .4 }]],
  [['Резонанс', 'ульта ×1.5', { ult: .5 }], ['Ритм', 'ульта на 2с чаще', { ucd: 2 }]],
  [['Взрыв реликвии', 'удары иногда взрываются по кругу', { fx: ['nova', 5] }], ['Цепь реликвии', 'удары пускают цепную молнию', { fx: ['chain', 0] }]],
  [['Острота', '+8% крита', { crit: .08 }], ['Лёгкость', '+15% скорости атаки', { aps: .15 }]],
  [['Страж реликвии', 'дух-союзник сражается рядом', { fx: ['summon', 0] }], ['Кольцо реликвии', 'сферы кружат вокруг героя', { fx: ['orbit', 0] }]],
  [['Жажда', '+3% вампиризма', { vamp: .03 }], ['Твердь', '+10% брони', { armor: .1 }]],
  [['Небесный гнев', 'удары с неба по врагам', { fx: ['sky', 6] }], ['Залп реликвии', 'залп снарядов по толпе', { fx: ['volley', 5] }]],
  [['Охотник', '+50% урона вожакам', { boss: .5 }], ['Собиратель', '+25% душ', { souls: .25 }]],
  [['Родство', 'статы класса сильнее на 30%', { clsx: .3 }], ['Наставление', 'опыт мастерства ×2', { mxp: 1 }]],
  [['Сущность оружия', 'бонус уровня реликвии ×2', { core: 1 }], ['Сущность наследия', 'Наследие этого класса ×2', { leg: 1 }]],
];
const relS = k => { const M = S.meta; if (!M.rel) M.rel = {}; return M.rel[k] || (M.rel[k] = { xp: 0, lv: 0, ch: {} }); };
const relLv = k => (S.meta.rel && S.meta.rel[k] && S.meta.rel[k].lv) || 0;
const relNeed = L => Math.floor(64 * Math.pow(L + 1, 1.7));
const relCh = (k, t) => { const r = S.meta.rel && S.meta.rel[k]; return r && r.ch ? r.ch[t] : undefined; };
const relOpt = (k, key) => { let v = 0; REL_T.forEach((pair, t) => { const c = relCh(k, t); if (c != null && pair[c][2][key]) v += pair[c][2][key]; }); return v; };
const relPending = k => { const L = relLv(k); let n = 0; for (let t = 0; t < 10; t++) if (L >= (t + 1) * 10 && relCh(k, t) == null) n++; return n; };
function relGain(v) {
  const k = cls(); if (!CLASSES[k]) return; const r = relS(k); if (r.lv >= 100) return; r.xp += v;
  let up = 0; while (r.lv < 100 && r.xp >= relNeed(r.lv)) { r.xp -= relNeed(r.lv); r.lv++; up++; }
  if (!up) return; D.dirty = true;
  const L = r.lv; feed('Реликвия «' + REL[k][0] + '» · ур. ' + L, CL().c);
  if (L % 10 === 0) { toast(REL[k][0].toUpperCase() + ' · УРОВЕНЬ ' + L, 'открыт выбор реликвии — вкладка Класс → РЕЛИКВИЯ', 3000); tone(659, .1, 'triangle', .05); tone(988, .15, 'triangle', .05, 0, .1); }
}
const legL = k => relLv(k) * (relOpt(k, 'leg') ? 2 : 1);
const legR = () => 1 + .005 * legL('mage');
function relMods() {
  const L = k => legL(k);
  D.hit *= 1 + .01 * L('war'); D.aps = Math.min(14, D.aps * (1 + .003 * L('bers'))); D.regen += .0002 * L('pal'); D.maxHP *= 1 + .015 * L('guard');
  D.crit = Math.min(.95, D.crit + .001 * L('arch')); D.critM *= 1 + .01 * L('assa'); D.rare = Math.min(.7, D.rare * (1 + .01 * L('gamb'))); D.gainMult *= 1 + .01 * L('alch');
  D.dodge = Math.min(.9, D.dodge + .0005 * L('monk')); D.vamp += .0001 * L('reap');
  // реликвия текущего класса
  const k = cls(), lv = relLv(k), O = key => relOpt(k, key), core = O('core') ? 2 : 1;
  D.hit *= (1 + .01 * lv * core) * (1 + O('hit')); D.maxHP *= (1 + .01 * lv * core) * (1 + O('hp')); D.aps = Math.min(14, D.aps * (1 + O('aps')));
  D.crit = Math.min(.95, D.crit + O('crit')); D.vamp += O('vamp'); D.armor = Math.min(.95, D.armor + O('armor'));
  if (O('clsx') && D.cq) D.cq = D.cq.map(q => Math.min(1.5, q * (1 + O('clsx'))));
}
// Страж стены — ворота созвездий: урон реликвий и Наследия на него не действует
const relGuardDiv = () => { const k = cls(), core = relOpt(k, 'core') ? 2 : 1; return (1 + .01 * legL('war')) * (1 + .01 * relLv(k) * core) * (1 + relOpt(k, 'hit')) * (1 + .01 * legL('assa')) * relBossM(); };
const relUltM = () => (1 + .02 * legL('sham')) * (1 + relOpt(cls(), 'ult'));
const relUltCd = () => .02 * legL('chrono') + relOpt(cls(), 'ucd');
const relSoulM = () => (1 + .005 * legL('priest')) * (1 + relOpt(cls(), 'souls'));
const relBossM = () => (1 + .01 * legL('necro')) * (1 + relOpt(cls(), 'boss'));
const relMxp = () => (1 + .01 * legL('rune')) * (1 + relOpt(cls(), 'mxp'));
function relFx() { const k = cls(), out = []; REL_T.forEach((pair, t) => { const c = relCh(k, t); if (c == null) return; const o = pair[c]; if (o[2].fx) out.push({ n: o[0], ty: o[2].fx[0], p: o[2].fx[1] || 0, L: 1 + Math.floor(relLv(k) / 25), t: 9, id: 'rel' + t }); }); return out; }
function relHTML(k) {
  const C = CLASSES[k], r = (S.meta.rel || {})[k] || { xp: 0, lv: 0, ch: {} }, L = r.lv, cur = k === cls(), core = relOpt(k, 'core') ? 2 : 1, pend = relPending(k);
  const xpp = L >= 100 ? 100 : Math.min(100, r.xp / relNeed(L) * 100);
  let h = `<div class="relc" style="--cc:${C.c}"><div class="relicon">${pxImg(REL[k][1], C.c, 34)}</div><div class="relt"><b>${REL[k][0]}</b><small>реликвия класса «${C.n}» · ур. <span style="color:#ffe08a">${L}</span>/100</small>` +
    `<i class="ctxp"><u style="width:${xpp}%;background:${C.c}"></u></i><small>${L >= 100 ? 'максимум' : fmt(r.xp) + ' / ' + fmt(relNeed(L)) + ' — растёт за убийства этим классом'}</small>` +
    `<small>сила: +${L * core}% урона и HP${cur ? '' : ' (когда выпадет этот класс)'} · наследие «${LEGC[k][0]}»: ${LEGC[k][1](legL(k))} всем</small></div></div>`;
  h += `<div class="ctsum">Выбор каждые 10 уровней — навсегда${pend ? ` · <b style="color:#5cff8a">доступно выборов: ${pend}</b>` : ''}</div>`;
  h += REL_T.map((pair, t) => { const need = (t + 1) * 10, open = L >= need, ch = r.ch ? r.ch[t] : undefined;
    return `<div class="relrow${open ? '' : ' lk'}"><span class="reln">${need}</span>` + pair.map((o, j) => { const on = ch === j, off = ch != null && ch !== j;
      return `<button class="relo${on ? ' on' : ''}${off ? ' off' : ''}" data-rk="${k}" data-rt="${t}" data-rj="${j}"${!open || ch != null ? ' disabled' : ''}><b>${o[0]}</b><small>${o[1]}</small></button>`; }).join('') + '</div>'; }).join('');
  return h;
}
function legHTML() {
  const seen = S.meta.seen || {};
  return `<div class="ctsum">Наследие: каждый класс качает свою характеристику уровнем реликвии — она действует на ВСЕХ героев</div><div class="legg">` +
    CLS_KEYS.map(k => { const C = CLASSES[k], kn = !!seen[k], L = legL(k);
      return `<div class="legc${k === cls() ? ' cur' : ''}" style="--cc:${kn ? C.c : '#555'}"><b>${LEGC[k][0]}</b><small>${kn ? C.n : '???'} · реликвия ${relLv(k)}</small><em>${L ? LEGC[k][1](L) : 'нет'}</em><i class="ctxp"><u style="width:${relLv(k)}%;background:${C.c}"></u></i></div>`; }).join('') + '</div>';
}
let relConfirm = null;
function relPick(k, t, j) {
  const r = relS(k); if (r.lv < (t + 1) * 10 || r.ch[t] != null) return;
  const key = k + t + j; if (relConfirm !== key) { relConfirm = key; toast('ВЫБОР НАВСЕГДА', 'тапни «' + REL_T[t][j][0] + '» ещё раз, чтобы подтвердить', 1800); return; }
  relConfirm = null; r.ch[t] = j; D.dirty = true; calcPath(); recalc(); save(); tone(784, .1, 'triangle', .05); tone(1175, .15, 'triangle', .05, 0, .1);
  toast('РЕЛИКВИЯ: ' + REL_T[t][j][0].toUpperCase(), REL_T[t][j][1], 2200); renderCT();
}

let ctTab = 'tree', ctHeroK = null;
const sprURL = {};
function clsSprURL(k, known) {
  const key = k + known + formOf(k); if (sprURL[key]) return sprURL[key];
  const pc = heroPortrait(k, formOf(k)), cv2 = document.createElement('canvas'); cv2.width = pc.width; cv2.height = pc.height; const x = cv2.getContext('2d');
  x.drawImage(known ? pc : sil32(pc, '#3a3450'), 0, 0);   // неизвестный класс — тёмный силуэт
  return sprURL[key] = cv2.toDataURL();
}
function renderCT() {
  const k = ctK, C = CLASSES[k], c = cm(k), pts = ctPts(k), cur = k === cls(), full = ctFull(k), tr = tierOf(c.lv);
  $('cthead').innerHTML = `<span style="color:${C.c}">${evoName(k, formOf(k)).toUpperCase()}${cur ? ' <small style="color:var(--dim)">· твой класс</small>' : ''}</span><span>Очки: <b>${pts}</b></span><button class="btn" id="ctclose">✕</button>`;
  $('ctclose').onclick = () => { $('ctree').hidden = true; navOn('nFight'); };
  // герой: большая анимированная фигурка (создаётся один раз на класс)
  if (ctHeroK !== k || !$('cthc')) {
    ctHeroK = k;
    $('ctbody').innerHTML = `<div class="cthero"><canvas id="cthc" width="110" height="110"></canvas><div id="cthi"></div></div><div id="ctdyn"></div>`;
    runCard($('cthc'), 'show', () => ctK, () => !$('ctree').hidden);
  }
  const xpn = cxpNeed(c.lv), xpp = Math.min(100, c.xp / xpn * 100);
  const stl = cur ? `<b style="color:${C.c}">Стиль: ${CSTY[k][sty()][0]}</b> — ${CSTY[k][sty()][1]}` : `Стили: ${CSTY[k].slice(0, 2).map(s2 => s2[0]).join(' / ')} (выпадает случайно)`;
  $('cthi').innerHTML = `<div class="ctd">${C.d}</div>` +
    `<div class="ctl">Мастерство <b style="color:${C.c}">${c.lv}</b>${tr ? ' · облик: ' + tr[2] : ''}<i class="ctxp"><u style="width:${xpp}%;background:${C.c}"></u></i><small>${fmt(c.xp)} / ${fmt(xpn)} опыта · +${c.lv * 4}% урона и HP</small></div>` +
    `<div class="ctl">${stl}</div>` +
    (cur ? C.st.map(([n, f], j) => `<div class="ctl"><b style="color:${C.c}">${n}</b> ${fmt((S.cst || [0, 0])[j])} — ${f(cq(j))}</div>`).join('') : `<div class="ctl">Статы класса: ${C.st.map(x => x[0]).join(', ')}</div>`) +
    `<div class="ctl"><b style="color:${C.c}">Ульта «${(full ? '★ ' : '') + ULTS[k][0]}»</b> — ${ULTS[k][1]}${full ? ' (×2)' : ''}</div>` +
    `<div class="ctl">${full ? `<b style="color:${C.c}">★ Пробуждён: ${AWK[k][0]}</b> — ${AWK[k][1]}` : `${pxImg('lock', '#777', 8)}Пробуждение «${AWK[k][0]}»: заполни ветку (${ctSpent(k)}/${CT_TOTAL})`}</div>`;
  const tabs = `<div class="trow" style="margin:8px 0"><button class="tch${ctTab === 'tree' ? ' on' : ''}" data-ct="tree">ВЕТКА${pts ? ' · +' + pts : ''}</button><button class="tch${ctTab === 'rel' ? ' on' : ''}" data-ct="rel">РЕЛИКВИЯ${relPending(k) ? ' · +' + relPending(k) : ''}</button><button class="tch${ctTab === 'leg' ? ' on' : ''}" data-ct="leg">НАСЛЕДИЕ</button><button class="tch${ctTab === 'all' ? ' on' : ''}" data-ct="all">КОЛЛЕКЦИЯ ${Object.keys(S.meta.seen || {}).length}/16</button></div>`;
  let h = tabs;
  if (ctTab === 'tree') {
    h += `<div class="ctsum">Ветка класса: 3 ступени (+4-я после Вознесения) · ромбы — сигнатурные узлы, малые кружки — боковые ветви · уровень мастерства = 1 очко · вложено ${pSpent(k)} / ${pTotal()}${cur ? '' : ' · работает, когда играешь этим классом'}</div><canvas id="ptc" style="width:100%;height:${PTH}px;display:block;border-radius:6px"></canvas><div id="pinfo" class="pinfo"></div>`;
  } else if (ctTab === 'rel') h += relHTML(k);
  else if (ctTab === 'leg') h += legHTML();
  else {
    const seen = S.meta.seen || {};
    h += '<div class="ctcol">' + CLS_KEYS.map(k2 => { const c2 = CLASSES[k2], kn = !!seen[k2], m2 = cm(k2), p2 = ctPts(k2);
      return `<button class="ctc${k2 === k ? ' sel' : ''}${k2 === cls() ? ' cur' : ''}" data-ck="${k2}" style="--cc:${kn ? c2.c : '#555'}"><img src="${clsSprURL(k2, kn)}"><b>${kn ? c2.n : '???'}</b>` +
        `<small>${BRANCHES[c2.br].n}${kn ? '<br>ур. ' + m2.lv + ' · ' + ctSpent(k2) + '/' + pTotal() + (awake(k2) ? ' ★' : '') : ''}</small>${p2 && kn ? `<em>+${p2}</em>` : ''}</button>`; }).join('') + '</div>';
  }
  $('ctdyn').innerHTML = h;
  if (ctTab === 'tree') { renderPInfo(); if (!pRaf) pRaf = requestAnimationFrame(drawPath);
    if (renderCT.sc !== k) { renderCT.sc = k; const cv = $('ptc'), f = formOf(k); setTimeout(() => { $('ctbody').scrollTop = cv.offsetTop + pathTierY(cv.clientWidth, f) - $('ctbody').clientHeight + 160; }, 30); } }
}
$('ctbody').addEventListener('click', e => {
  if (e.target.id === 'ptc') { const r = e.target.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 30;
    for (const p of pathLayout(r.width)) if (p.kind === 'node') { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    if (best) { const twice = dbl('p' + ctK + best.t + best.id); pSel = { t: best.t, id: best.id }; if (twice) pBuy(ctK, best.t, best.id); renderPInfo(); } return; }
  const t = e.target.closest('[data-ct]'); if (t) { ctTab = t.dataset.ct; renderCT(); return; }
  const ro = e.target.closest('[data-rt]'); if (ro && !ro.disabled) { relPick(ro.dataset.rk, +ro.dataset.rt, +ro.dataset.rj); return; }
  const ck = e.target.closest('[data-ck]'); if (ck) { const k2 = ck.dataset.ck; if (!(S.meta.seen || {})[k2]) { toast('???', 'класс ещё не выпадал · ветвь «' + BRANCHES[CLASSES[k2].br].n + '»'); return; } ctHeroK = null; ctK = k2; ctTab = 'tree'; renderCT(); }
});
function openClassTab(k) { showSheet('none'); $('tree').hidden = true; $('gear').hidden = true; navOn('nCls'); openCT(k || cls()); }

/* ---------- ПУТЬ КЛАССА: 3 ступени, эволюция облика, узлы-механики ---------- */
// облики: [имя 2-й ступени, имя 3-й], украшения на 2-й и 3-й ступени
const EVO = {
  war:   [['Рыцарь клинка', 'Король мечей'], ['cape', 'pads'], ['cape', 'pads', 'crown']],
  bers:  [['Мясник', 'Владыка войны'], ['horns', 'pads'], ['horns', 'cape', 'flame']],
  pal:   [['Храмовник', 'Светоносец'], ['cape', 'halo'], ['wings', 'halo', 'pads']],
  guard: [['Бастион', 'Несокрушимый'], ['pads', 'crest'], ['pads', 'crest', 'cape']],
  mage:  [['Архимаг', 'Повелитель огня'], ['hat', 'cape'], ['flame', 'cape', 'orbs']],
  sham:  [['Громовержец', 'Владыка бурь'], ['feathers', 'cape'], ['feathers', 'wings', 'orbs']],
  arch:  [['Следопыт', 'Звёздный стрелок'], ['cape', 'feathers'], ['cape', 'star', 'wings']],
  assa:  [['Тень', 'Жнец теней'], ['cape', 'horns'], ['cape', 'wings', 'horns']],
  gamb:  [['Игрок', 'Повелитель удачи'], ['hat', 'cape'], ['crown', 'cape', 'orbs']],
  alch:  [['Мастер зелий', 'Великий алхимик'], ['pads', 'cape'], ['orbs', 'cape', 'hat']],
  priest:[['Епископ', 'Святой'], ['mitre', 'cape'], ['halo', 'wings', 'mitre']],
  monk:  [['Мастер', 'Просветлённый'], ['halo', 'pads'], ['halo', 'flame', 'orbs']],
  chrono:[['Часовщик', 'Владыка времени'], ['crest', 'cape'], ['halo', 'cape', 'orbs']],
  rune:  [['Рунный мастер', 'Архирунник'], ['orbs', 'cape'], ['orbs', 'wings', 'crest']],
  necro: [['Лорд костей', 'Король-лич'], ['pads', 'cape'], ['crown', 'pads', 'wings']],
  reap:  [['Пожиратель душ', 'Ангел смерти'], ['cape', 'horns'], ['wings', 'cape', 'halo']],
};
// украшения рисуются в увеличенной сетке: 4 — цвет класса, 6 — золото/отделка, 7 — свечение
function decorate(g, kind, big) {
  const W = g[0].length, H = g.length, set = (r, c, ch) => { if (r >= 0 && r < H && c >= 0 && c < W && g[r][c] === '.') g[r][c] = ch; };
  const L = (W - 8) / 2, top = H - 8, R = L + 7;   // где лежит базовый спрайт (10×10, 12×12, 14×14)
  switch (kind) {
    case 'cape': for (let r = top + 3; r < H; r++) { set(r, L, '4'); if (r > top + 4) set(r, L - 1, '4'); if (big && r > top + 5) set(r, L - 2, '4'); } break;
    case 'pads': set(top + 4, L, '6'); set(top + 4, R, '6'); set(top + 3, L, '6'); set(top + 3, R, '6'); if (big) { set(top + 4, L - 1, '6'); set(top + 4, R + 1, '6'); } break;
    case 'crown': for (let c = L + 2; c <= L + 5; c++) set(top - 1, c, '6'); set(top - 2, L + 2, '6'); set(top - 2, L + 4, '7'); set(top - 2, L + 5, '6'); break;
    case 'horns': set(top, L + 1, '6'); set(top - 1, L, '6'); set(top, R - 1, '6'); set(top - 1, R, '6'); if (big) { set(top - 2, L, '6'); set(top - 2, R, '6'); } break;
    case 'halo': for (let c = L + 2; c <= L + 5; c++) set(top - (big ? 3 : 2), c, '7'); set(top - (big ? 2 : 1), L + 1, '7'); set(top - (big ? 2 : 1), L + 6, '7'); break;
    case 'wings': { const len = big ? [2, 3, 3, 2, 2, 1] : [1, 2, 2, 1]; len.forEach((n, i) => { const r = top + i; for (let j = 0; j < n; j++) { const ch = j === n - 1 ? '7' : '4'; set(r, L - 1 - j, ch); set(r, R + 1 + j, ch); } }); break; }
    case 'flame': for (let c = L + 1; c <= L + 6; c++) { set(top - 1, c, c % 2 ? '4' : '6'); if (c % 2) set(top - 2, c, '7'); } break;
    case 'hat': for (let c = L + 1; c <= L + 6; c++) set(top - 1, c, '4'); for (let c = L + 2; c <= L + 5; c++) set(top - 2, c, '4'); set(top - 3, L + 4, '6'); break;
    case 'mitre': for (let c = L + 2; c <= L + 5; c++) { set(top - 1, c, '7'); set(top - 2, c, c === L + 3 || c === L + 4 ? '6' : '7'); } set(top - 3, L + 3, '7'); set(top - 3, L + 4, '7'); break;
    case 'crest': for (let r = top - 2; r < top; r++) set(r, L + 3, '4'), set(r, L + 4, '4'); set(top - 2, L + 5, '6'); break;
    case 'feathers': set(top - 1, L + 1, '4'); set(top - 2, L + 1, '7'); set(top - 1, L + 3, '6'); set(top - 2, L + 3, '6'); set(top - 3, L + 3, '4'); set(top - 1, R - 1, '4'); set(top - 2, R - 1, '7'); break;
    case 'orbs': set(top + 2, L - 1, '7'); set(top + 5, R + 1, '7'); if (big) { set(top, R + 1, '6'); set(top + 7, L - 1, '6'); } break;
    case 'star': set(top - 2, R, '7'); set(top - 3, R, '6'); set(top - 2, R + 1, '6'); set(top - 2, R - 1, '6'); set(top - 1, R, '6'); break;
  }
}
const evoCache = {};
function evoPat(k, form) {
  if (H16[k]) return crop16(pat16(k, Math.max(1, form), 'idle', null, false, 8));
  const key = k + form; if (evoCache[key]) return evoCache[key];
  const P = CLS_SPR[k].p; if (form <= 1) return evoCache[key] = P;
  const big = form >= 3, W = form >= 4 ? 14 : big ? 12 : 10, H = W, L = (W - 8) / 2, T = H - 8;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  P.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') g[T + j][L + i] = ch; }));
  for (const d of (form >= 4 ? [...new Set([...EVO[k][2], 'wings', 'halo', 'orbs', 'pads'])] : EVO[k][form - 1])) decorate(g, d, big);
  return evoCache[key] = g.map(r => r.join(''));
}
// узлы пути: [имя, тип, параметр] — по ступеням [A, B, развилка X, развилка Y]
const PATH = {
  war:   [[['Широкий замах', 'nova', 4], ['Закалённая сталь', 'tough'], ['Кровавое лезвие', 'leech'], ['Дуэлянт', 'crit']], [['Летящие клинки', 'volley', 5], ['Парирование', 'shield', 8], ['Вихрь мечей', 'orbit'], ['Казнь', 'exec']], [['Меч правосудия', 'sky', 6], ['Неудержимый', 'fury'], ['Армия клинков', 'summon', 1], ['Последний бастион', 'revive']]],
  bers:  [[['Боевой рёв', 'pulse', 6], ['Жажда крови', 'leech'], ['Безумие', 'fury'], ['Раскол', 'nova', 3]], [['Метательные топоры', 'volley', 4], ['Кровь врага', 'boom'], ['Слепая ярость', 'double'], ['Палач', 'exec']], [['Удар титана', 'sky', 5], ['Шкура зверя', 'tough'], ['Кровавая луна', 'chain'], ['Неумирающий', 'revive']]],
  pal:   [[['Святой удар', 'nova', 4], ['Благодать', 'shield', 7], ['Крестоносец', 'giant'], ['Милосердие', 'leech']], [['Освящение', 'trail'], ['Божий свет', 'sky', 6], ['Каратель', 'mark'], ['Стойкость веры', 'tough']], [['Сияние', 'pulse', 5], ['Ангелы', 'summon', 1], ['Суд', 'exec'], ['Воскрешение', 'revive']]],
  guard: [[['Шипы щита', 'pulse', 5], ['Каменная стена', 'tough'], ['Таран', 'nova', 4], ['Отражение', 'shield', 6]], [['Метательный щит', 'bounce'], ['Оглушающий гул', 'slow'], ['Броня предков', 'tough'], ['Контратака', 'double']], [['Падающая крепость', 'sky', 6], ['Стражи', 'summon', 1], ['Неприступность', 'shield', 4], ['Вечный страж', 'revive']]],
  mage:  [[['Отскок', 'bounce'], ['Горящая земля', 'trail'], ['Огненный шквал', 'volley', 4], ['Концентрация', 'giant']], [['Огненное кольцо', 'orbit'], ['Взрывная волна', 'nova', 4], ['Метеор', 'sky', 5], ['Феникс', 'revive']], [['Солнце', 'pulse', 7], ['Элементали', 'summon', 1], ['Пожар', 'chain'], ['Плазма', 'crit']]],
  sham:  [[['Разряд', 'chain'], ['Дух ветра', 'fury'], ['Тотем грома', 'pulse', 6], ['Целебный дождь', 'leech']], [['Шаровые молнии', 'orbit'], ['Гром небес', 'sky', 5], ['Буря', 'volley', 4], ['Духи предков', 'summon', 1]], [['Ураган', 'slow'], ['Электрошок', 'mark'], ['Гнев небес', 'nova', 3], ['Перерождение', 'revive']]],
  arch:  [[['Двойная стрела', 'double'], ['Меткость', 'crit'], ['Рикошет', 'bounce'], ['Взрывные стрелы', 'nova', 4]], [['Ливень', 'volley', 4], ['Метка охотника', 'mark'], ['Ястреб', 'summon', 1], ['Ловушки', 'trail']], [['Звёздная стрела', 'sky', 5], ['Попутный ветер', 'fury'], ['Пронзатель', 'exec'], ['Тень лучника', 'orbit']]],
  assa:  [[['Ядовитый след', 'trail'], ['Скрытность', 'crit'], ['Двойные клинки', 'double'], ['Кровопускание', 'leech']], [['Метательные ножи', 'volley', 4], ['Метка смерти', 'mark'], ['Убийца', 'exec'], ['Дымовая бомба', 'slow']], [['Танец клинков', 'orbit'], ['Удар из тени', 'sky', 5], ['Клоны', 'summon', 1], ['Неуловимый', 'revive']]],
  gamb:  [[['Крупная ставка', 'giant'], ['Счастливая карта', 'crit'], ['Колода', 'volley', 4], ['Удвоение', 'double']], [['Рулетка', 'nova', 5], ['Золотая жила', 'boom'], ['Кости судьбы', 'chain'], ['Блеф', 'shield', 7]], [['Джекпот', 'sky', 6], ['Карточный вихрь', 'orbit'], ['Тузы', 'summon', 1], ['Второй шанс', 'revive']]],
  alch:  [[['Кислотный след', 'trail'], ['Эликсир', 'leech'], ['Взрывчатка', 'nova', 4], ['Летучая смесь', 'bounce']], [['Ядовитое облако', 'pulse', 6], ['Склянки', 'volley', 4], ['Разъедание', 'mark'], ['Мутаген', 'tough']], [['Гомункулы', 'summon', 1], ['Философский камень', 'boom'], ['Цепная реакция', 'chain'], ['Эликсир жизни', 'revive']]],
  priest:[[['Молитва', 'ultc'], ['Исцеление', 'leech'], ['Кара', 'nova', 4], ['Щит веры', 'shield', 7]], [['Луч света', 'sky', 5], ['Нимбы', 'orbit'], ['Изгнание', 'exec'], ['Благословение', 'tough']], [['Святое сияние', 'pulse', 5], ['Ангелы-хранители', 'summon', 1], ['Гнев небес', 'chain'], ['Чудо', 'revive']]],
  monk:  [[['Шквал', 'double'], ['Ци', 'fury'], ['Ладонь', 'nova', 4], ['Медитация', 'shield', 7]], [['Волна ци', 'volley', 4], ['Железное тело', 'tough'], ['Удар дракона', 'sky', 5], ['Точка давления', 'mark']], [['Аура', 'pulse', 5], ['Сферы ци', 'orbit'], ['Тысяча ладоней', 'chain'], ['Нирвана', 'revive']]],
  chrono:[[['Замедление', 'slow'], ['Ускорение', 'fury'], ['Временная бомба', 'nova', 4], ['Песочные часы', 'shield', 7]], [['Шестерни', 'orbit'], ['Эхо времени', 'double'], ['Стрелки', 'volley', 4], ['Распад', 'mark']], [['Остановка', 'pulse', 6], ['Двойники', 'summon', 1], ['Конец времён', 'sky', 5], ['Откат', 'revive']]],
  rune:  [[['Огненная руна', 'nova', 4], ['Защитная руна', 'shield', 7], ['Руна молнии', 'chain'], ['Руна жизни', 'leech']], [['Руны вокруг', 'orbit'], ['Рунный след', 'trail'], ['Руна смерти', 'exec'], ['Руна силы', 'giant']], [['Великая печать', 'pulse', 6], ['Големы', 'summon', 1], ['Рунный дождь', 'volley', 3], ['Руна возрождения', 'revive']]],
  necro: [[['Костяной шип', 'volley', 5], ['Высасывание', 'leech'], ['Трупный взрыв', 'boom'], ['Проклятие', 'mark']], [['Легион', 'summon', 2], ['Тёмная аура', 'pulse', 6], ['Чума', 'chain'], ['Костяной щит', 'shield', 7]], [['Черепа', 'orbit'], ['Жатва', 'exec'], ['Тьма с небес', 'sky', 5], ['Филактерия', 'revive']]],
  reap:  [[['Широкий взмах', 'nova', 4], ['Сбор душ', 'leech'], ['Стремительность', 'fury'], ['Метка жнеца', 'mark']], [['Души вокруг', 'orbit'], ['Казнь', 'exec'], ['Летящая коса', 'volley', 4], ['Тень жнеца', 'double']], [['Призраки', 'summon', 2], ['Час смерти', 'sky', 5], ['Чума душ', 'chain'], ['Бессмертие', 'revive']]],
};
const ckey = () => (typeof ctK !== 'undefined' && ctK && !$('ctree').hidden) ? ctK : cls();
const PFX = {   // описание эффекта по уровню L и параметру p
  nova: (L, p) => `каждый ${p}-й удар — взрыв ×${(.8 + .6 * L).toFixed(1)} по площади`, chain: L => `шанс ${10 * L}%: разряд по ${2 + L} врагам`,
  bounce: L => `удар перескакивает ещё на ${L} врага`, orbit: L => `${L} сферы кружат вокруг и бьют врагов`, trail: L => `след жжёт врагов: ${pct(.25 * L)} удара/с`,
  pulse: (L, p) => `каждые ${p}с волна ×${1 + L} вокруг героя`, sky: (L, p) => `каждые ${p}с удар с неба по сильнейшему ×${2 + 2 * L}`,
  summon: (L, p) => `до ${p + L} союзников сражаются рядом`, boom: L => `шанс ${5 * L}%: убитый взрывается ×2`, leech: L => `убийство лечит ${(.5 * L).toFixed(1)}% HP`,
  shield: (L, p) => `каждые ${p}с щит ${6 * L}% HP`, exec: L => `враги ниже ${8 * L}% HP гибнут от удара`, mark: L => `удары метят врагов: по ним +${10 * L}% урона`,
  slow: L => `враги рядом замедлены и получают +${5 * L}% урона`, volley: (L, p) => `каждый ${p}-й удар — залп из ${2 + L} снарядов`, fury: L => `+${6 * L}% скорости атаки`,
  crit: L => `+${4 * L}% крита и +${10 * L}% силы крита`, tough: L => `+${10 * L}% HP и +${3 * L}% брони`, revive: L => `раз за жизнь встаёт с ${30 * L}% HP`,
  ultc: L => `ульта копится на ${15 * L}% быстрее`,
  sig0: L => `«${CLASSES[ckey()].st[0][0]}» сильнее на ${8 * L}%`, sig1: L => `«${CLASSES[ckey()].st[1][0]}» сильнее на ${8 * L}%`, sigU: L => `урон ульты +${25 * L}%`, sigA: L => `+${8 * L}% урона и HP этим классом`,
  mn_dmg: L => `+${4 * L}% урона`, mn_hp: L => `+${5 * L}% HP`, mn_aps: L => `+${2 * L}% скорости атаки`, mn_crit: L => `+${L}% крита`, mn_ult: L => `+${6 * L}% урона ульты`, mn_cq: L => `статы класса +${3 * L}%`, double: L => `шанс ${5 * L}% ударить дважды`, giant: L => `+${12 * L}% урона`,
};
const PICON = { nova: 'star', chain: 'bolt', bounce: 'swap', orbit: 'eye', trail: 'flame', pulse: 'spike', sky: 'bolt', summon: 'skull', boom: 'flame', leech: 'drop', shield: 'shield', exec: 'sword',
  mark: 'eye', slow: 'clock', volley: 'sword', fury: 'wing', crit: 'eye', tough: 'heart', revive: 'heart', ultc: 'star', double: 'fist', giant: 'fist', sig0: 'star', sig1: 'star', sigU: 'bolt', sigA: 'fist', mn_dmg: 'sword', mn_hp: 'heart', mn_aps: 'wing', mn_crit: 'eye', mn_ult: 'star', mn_cq: 'fist' };
const PIDS = ['A', 'B', 'X', 'Y'];
const P_MAX = 3, P_TOTAL = 27;
const pL = (k, t, id) => { const c = cm(k); return (c.cp && c.cp[t + id]) || 0; };
const pSpent = k => { const c = cm(k); let s = 0; if (c.cp) for (const i in c.cp) s += c.cp[i]; return s; };
const pPts = k => Math.max(0, cm(k).lv + (skyOn('sk_mast') ? 5 : 0) - pSpent(k));
const pFork = (k, t) => pL(k, t, 'X') ? 'X' : pL(k, t, 'Y') ? 'Y' : null;
/* 4-я ступень пути — «Вознесённый облик» (после первого Вознесения): 11 узлов, 2 развилки, вершина = 4-я способность */
const PIDS4 = ['A', 'B', 'C', 'X', 'Y', 'D', 'E', 'F', 'Z', 'W', 'V'];
const PATH4 = { A: ['Звёздный взрыв', 'nova', 3], B: ['Звёздная цепь', 'chain'], C: ['Звёздные сферы', 'orbit'], X: ['Звёздный залп', 'volley', 3], Y: ['Звёздный удар', 'sky', 3],
  D: ['Звёздная броня', 'tough'], E: ['Звёздное войско', 'summon', 2], F: ['Звёздная ярость', 'fury'], Z: ['Звёздная метка', 'mark'], W: ['Звёздная казнь', 'exec'] };
const FORK = { X: 'Y', Y: 'X', Z: 'W', W: 'Z' };
const EVO4 = { war: 'Бог войны', bers: 'Титан ярости', pal: 'Архангел', guard: 'Вечная крепость', mage: 'Солнечный бог', sham: 'Бог грома', arch: 'Небесный охотник', assa: 'Сама Тень',
  gamb: 'Бог фортуны', alch: 'Творец жизни', priest: 'Серафим', monk: 'Пробуждённый', chrono: 'Вечность', rune: 'Демиург рун', necro: 'Владыка смерти', reap: 'Сама Смерть' };
const CAP4 = {
  war: ['Меч богов', 'каждые 5с гигантский меч падает на сильнейшего (×20)'], bers: ['Апокалипсис', 'каждые 6с раскол земли вокруг героя (×12)'],
  pal: ['Небесное воинство', 'каждые 8с 3 ангела и лечение 20% HP'], guard: ['Бессмертие', 'каждые 10с 3с неуязвимости и ударная волна (×8)'],
  mage: ['Сверхновая', 'каждые 7с вспышка на весь экран (×15)'], sham: ['Небесный суд', 'каждые 4с молнии бьют 5 врагов (×6)'],
  arch: ['Звёздный дождь', 'каждые 5с 10 стрел с неба (×4 каждая)'], assa: ['Тысяча теней', 'каждые 6с скачок по 6 врагам, криты (×8)'],
  gamb: ['Джекпот вселенной', 'каждые 10с случайно: сундук, полная ульта или удар ×20 по всем'], alch: ['Великое делание', 'каждые 7с кислота под всеми врагами и россыпь наград'],
  priest: ['Чудо небес', 'каждые 8с полное лечение и столпы света на всех (×5)'], monk: ['Ладонь Будды', 'каждые 6с гигантская ладонь по толпе (×15)'],
  chrono: ['Петля веков', 'каждые 12с время стоит 2с, потом удар ×10 по всем'], rune: ['Мировая печать', 'каждые 7с руна под каждым врагом (×6)'],
  necro: ['Армия тьмы', 'каждые 8с 6 скелетов и луч тьмы по всем (×5)'], reap: ['Конец всего', 'каждые 6с коса во весь экран (×10)'],
};
const pMax = (t, id) => t === 4 && id === 'V' ? 1 : id[0] === 'M' ? 2 : P_MAX;
function sigNode(k, t, id) { const C = CLASSES[k], s0 = C.st[0][0], s1 = C.st[1][0];
  if (t === 1) return id === 'S' ? [s0, 'sig0', 0] : [s1, 'sig1', 0]; if (t === 2) return id === 'S' ? ['Мастер: ' + s0, 'sig0', 0] : ['Мастер: ' + s1, 'sig1', 0];
  if (t === 3) return id === 'S' ? ['Ульта «' + ULTS[k][0] + '»', 'sigU', 0] : ['Суть: ' + C.n, 'sigA', 0]; return id === 'S' ? ['Звезда: ' + s0, 'sig0', 0] : ['Звёздная ульта', 'sigU', 0]; }
function pNode(k, t, id) { if (id[0] === 'M') { const i = +id.slice(1), ty = MTY[i]; return [MNAME[ty] + ' ' + roman(t) + (i < 5 ? '·' + (i + 1) : '·' + (i - 4)), ty, 0]; } if (id === 'S' || id === 'T') return sigNode(k, t, id); if (t < 4) return PATH[k][t - 1][PIDS.indexOf(id)]; if (id === 'V') return [CAP4[k][0], 'cap4', 0]; return PATH4[id]; }
const pTotal = () => S.meta.asc ? 156 : 105;
function cap4Tick(dt) {
  const k = cls(), c = CL().c, T = (key, per) => { PT[key] = (PT[key] ?? per) - dt; if (PT[key] <= 0) { PT[key] = per; return true; } return false; };
  const all = () => mobs.filter(m => !m.dead), name = CAP4[k][0], lbl = () => fxLabel(name, hero.x, hero.y - 22, c), H = D.hit;
  switch (k) {
    case 'war': if (T('c4', 5)) { const o = all().sort((a, b) => b.hp - a.hp)[0]; if (o) { skyStrike('sword', o, H * 20, c, name); hitAround(o.x, o.y, 22, H * 6, c, o); } } break;
    case 'bers': if (T('c4', 6) && mobs.length) { skyStrike('quake', hero, 0, c, name); ring(hero.x, hero.y - 3, 40, '#ff4433'); hitAround(hero.x, hero.y, 40, H * 12, '#ff4433'); lbl(); } break;
    case 'pal': if (T('c4', 8)) { for (let i = 0; i < 3; i++) { const a = rnd() * 6.283; pals.push({ key: 'c4', x: hero.x + Math.cos(a) * 12, y: hero.y + Math.sin(a) * 7, t: 10, cd: .3, face: 1 }); } hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .2); ring(hero.x, hero.y - 4, 20, '#ffe08a'); lbl(); } break;
    case 'guard': if (T('c4', 10) && mobs.length) { hero.iframe = Math.max(hero.iframe, 3); ring(hero.x, hero.y - 3, 44, '#8fb0d0'); for (const m of all()) { const dx = m.x - hero.x, dy = m.y - hero.y, d = Math.hypot(dx, dy) || 1; if (d < 44) { m.kx += dx / d * 220; m.ky += dy / d * 220; hitMob(m, H * 8, true, false, '#8fb0d0'); } } lbl(); } break;
    case 'mage': if (T('c4', 7) && mobs.length) { for (let i = 0; i < 3; i++) ring(hero.x, hero.y - 3, 30 + i * 22, i % 2 ? '#ffdd66' : '#ff6622'); for (const m of all()) hitMob(m, H * 15, true, false, '#ff9a3c'); shake = Math.max(shake, 8); lbl(); } break;
    case 'sham': if (T('c4', 4)) { all().sort(() => rnd() - .5).slice(0, 5).forEach(o => skyStrike('lightning', o, H * 6, c, name)); } break;
    case 'arch': if (T('c4', 5)) { const L = all(); for (let i = 0; i < 10 && L.length; i++) later(i * .05, () => { const o = L[Math.floor(rnd() * L.length)]; if (o && !o.dead) skyStrike('arrow', o, H * 4, c, name); }); } break;
    case 'assa': if (T('c4', 6)) { near(6).forEach((m, i) => later(i * .1, () => { if (m.dead) return; blinkTo(m, true); hitMob(m, H * 8, true, true, c); burst(hero.x, hero.y - 4, '#4a3a6a', 8, 30); })); hero.iframe = Math.max(hero.iframe, .8); lbl(); } break;
    case 'gamb': if (T('c4', 10)) { const r = Math.floor(rnd() * 3); if (r === 0) giveChest('r', 'джекпот'); else if (r === 1) { if (ultCd <= 0) ult = 1; } else for (const m of all()) hitMob(m, H * 20, true, false, '#44ffaa'); fxLabel(name + ['', '', ''][r], hero.x, hero.y - 22, '#44ffaa'); ring(hero.x, hero.y - 3, 30, '#44ffaa'); } break;
    case 'alch': if (T('c4', 7)) { for (const m of all()) if (clouds.length < 40) clouds.push({ x: m.x, y: m.y, r: 12, dps: H * 2, t: 3, acid: true }); giveBurst(zs() * D.gainMult * 20); lbl(); } break;
    case 'priest': if (T('c4', 8)) { hero.hp = D.maxHP; for (const o of all()) skyStrike('pillar', o, H * 5, c, name); } break;
    case 'monk': if (T('c4', 6)) { let best = null, bn = -1; for (const m of all()) { const n = mobs.filter(o => !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < 24).length; if (n > bn) { bn = n; best = m; } } if (best) { skyStrike('palm', best, H * 15, c, name); hitAround(best.x, best.y, 24, H * 10, c, best); } } break;
    case 'chrono': if (T('c4', 12) && mobs.length) { const st = all(); for (const m of st) m.frz = Math.max(m.frz || 0, 2); lbl(); later(2, () => { for (const m of st) if (!m.dead) { ring(m.x, m.y - 3, 10, '#88aaff'); hitMob(m, H * 10, true, false, '#88aaff'); } shake = 8; }); } break;
    case 'rune': if (T('c4', 7)) { all().forEach((m, i) => runes.push({ x: m.x, y: m.y, t: .3 + i * .03, m, r: 16, res: false, big: H * 6 })); lbl(); } break;
    case 'necro': if (T('c4', 8)) { for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; allies.push({ x: hero.x + Math.cos(a) * 14, y: hero.y + Math.sin(a) * 8, t: 12, cd: .3, face: 1 }); } for (const m of all()) { bolts.push({ x1: hero.x, y1: hero.y - 6, x2: m.x, y2: m.y - 3, l: .2, c: '#7affb0' }); hitMob(m, H * 5, true, false, '#7affb0'); } lbl(); } break;
    case 'reap': if (T('c4', 6) && mobs.length) { hero.sweep = .5; ring(hero.x, hero.y - 3, 64, '#ff44ff'); for (const m of all()) hitMob(m, H * 10, true, false, '#ff44ff'); shake = Math.max(shake, 6); lbl(); } break;
  }
}

const tierDone = (k, t) => t === 4 ? (['A', 'B', 'C', 'D', 'E', 'F'].every(i => pL(k, 4, i) >= P_MAX) && (pL(k, 4, 'X') >= P_MAX || pL(k, 4, 'Y') >= P_MAX) && (pL(k, 4, 'Z') >= P_MAX || pL(k, 4, 'W') >= P_MAX) && pL(k, 4, 'V') >= 1)
  : pL(k, t, 'A') >= P_MAX && pL(k, t, 'B') >= P_MAX && (pL(k, t, 'X') >= P_MAX || pL(k, t, 'Y') >= P_MAX);
const formOf = k => tierDone(k, 4) ? 4 : tierDone(k, 1) ? (tierDone(k, 2) ? 3 : 2) : 1;
const evoName = (k, f) => f <= 1 ? CLASSES[k].n : f >= 4 ? EVO4[k] : EVO[k][0][f - 2];
const tierOpen = (k, t) => t === 1 || (tierDone(k, t - 1) && (t < 4 || !!S.meta.asc));
function pCanBuy(k, t, id) {
  if (!tierOpen(k, t) || pPts(k) < 1 || pL(k, t, id) >= pMax(t, id)) return false;
  if (FORK[id] && pL(k, t, FORK[id])) return false;
  if (id[0] === 'M') { const i = +id.slice(1), prev = i === 0 ? 'A' : i === 5 ? (t === 4 ? 'C' : 'B') : 'M' + (i - 1); if (!pL(k, t, prev)) return false; }
  if (t === 4 && id === 'V') { const tmp = cm(k).cp || {}; return ['A', 'B', 'C', 'D', 'E', 'F'].every(i => (tmp['4' + i] || 0) >= P_MAX) && ((tmp['4X'] || 0) >= P_MAX || (tmp['4Y'] || 0) >= P_MAX) && ((tmp['4Z'] || 0) >= P_MAX || (tmp['4W'] || 0) >= P_MAX); }
  return true;
}
// активные эффекты пути текущего класса
let PFXL = [];
function calcPath() {
  const k = cls(); PFXL = [];
  for (let t = 1; t <= 3; t++) PIDS.forEach((id, j) => { const L = pL(k, t, id); if (L) { const [n, ty, p] = PATH[k][t - 1][j]; PFXL.push({ n, ty, p: p || 0, L, t, id }); } });
  for (const id of PIDS4) { const L = pL(k, 4, id); if (!L || id === 'V') continue; const [n, ty, p] = PATH4[id]; PFXL.push({ n, ty, p: p || 0, L: L * 2, t: 4, id }); }   // звёздные узлы вдвое сильнее
  for (let t = 1; t <= 4; t++) for (let i = 0; i < 10; i++) { const L = pL(k, t, 'M' + i); if (L) PFXL.push({ n: MNAME[MTY[i]], ty: MTY[i], p: 0, L: t === 4 ? L * 2 : L, t, id: 'M' + i }); }
  for (let t = 1; t <= 4; t++) for (const id of ['S', 'T']) { const L = pL(k, t, id); if (!L) continue; const [n, ty] = sigNode(k, t, id); PFXL.push({ n, ty, p: 0, L: t === 4 ? L * 2 : L, t, id }); }   // сигнатурные узлы класса
  PFXL.push(...perkFx(), ...relFx());   // перки жизни
}
const pfx = ty => PFXL.filter(e => e.ty === ty);
/* облик механик пути для каждого класса: сферы, удар с неба, союзники, снаряды */
const CSKIN = {
  war:   { orb: 'sword', sky: 'sword', sum: ['shade', '#c9ced6'], vol: 'knife' },
  bers:  { orb: 'axe', sky: 'quake', sum: ['shade', '#ff4433'], vol: 'axe' },
  pal:   { orb: 'holy', sky: 'pillar', sum: [4, '#ffe08a'], vol: 'holy' },
  guard: { orb: 'shield', sky: 'shield', sum: [7, '#8fb0d0'], vol: 'shield' },
  mage:  { orb: 'fire', sky: 'meteor', sum: [12, '#ff7a30'], vol: 'fire' },
  sham:  { orb: 'bolt', sky: 'lightning', sum: [4, '#66ccff'], vol: 'bolt' },
  arch:  { orb: 'arrow', sky: 'arrow', sum: [1, '#5cff8a'], vol: 'arrow' },
  assa:  { orb: 'knife', sky: 'shadow', sum: ['shade', '#9a7aff'], vol: 'knife' },
  gamb:  { orb: 'card', sky: 'card', sum: [4, '#44ffaa'], vol: 'card' },
  alch:  { orb: 'flask', sky: 'flask', sum: [0, '#b6ff3c'], vol: 'flask' },
  priest:{ orb: 'halo', sky: 'pillar', sum: [4, '#fff6c0'], vol: 'holy' },
  monk:  { orb: 'chi', sky: 'palm', sum: ['shade', '#ffaa55'], vol: 'chi' },
  chrono:{ orb: 'gear', sky: 'clock', sum: ['shade', '#88aaff'], vol: 'time' },
  rune:  { orb: 'rune', sky: 'runepillar', sum: [7, '#bb88ff'], vol: 'rune' },
  necro: { orb: 'skull', sky: 'dark', sum: [2, '#7affb0'], vol: 'bone' },
  reap:  { orb: 'soul', sky: 'scythe', sum: [4, '#ff44ff'], vol: 'scythe' },
};
const SK = () => CSKIN[cls()];
function drawOrb(type, x, y, a, c) {
  x = Math.round(x); y = Math.round(y);
  switch (type) {
    case 'sword': art('sword', { G: '#ffd84a', W: '#ffffff', S: '#c9ced6', H: '#6a4a2a' }, x, y, .7, a + 1.57); break;
    case 'axe': for (let i = -2; i <= 2; i++) pix(x + Math.cos(a * 3) * i, y + Math.sin(a * 3) * i, i === 2 ? '#ffffff' : '#c9ced6'); dot(x + Math.cos(a * 3) * 2, y + Math.sin(a * 3) * 2, 2, '#ff4433'); break;
    case 'holy': ctx.fillStyle = '#ffe08a'; ctx.fillRect(x - 1, y - 3, 2, 6); ctx.fillRect(x - 3, y - 1, 6, 2); pix(x, y, '#ffffff'); break;
    case 'shield': ctx.fillStyle = '#5a6a8a'; ctx.fillRect(x - 2, y - 2, 4, 5); ctx.fillStyle = '#8fb0d0'; ctx.fillRect(x - 1, y - 1, 2, 3); break;
    case 'fire': dot(x, y, 4, '#ff7a30'); dot(x, y, 2, '#ffdd66'); ctx.globalAlpha = .5; for (let j = 1; j < 4; j++) pix(x - Math.cos(a + 1.57) * j * 2, y - Math.sin(a + 1.57) * j * 2, '#ff6622'); ctx.globalAlpha = 1; break;
    case 'bolt': dot(x, y, 3, '#ffffff'); pix(x + (rnd() < .5 ? 2 : -2), y + (rnd() < .5 ? 2 : -2), '#99eeff'); pix(x + (rnd() - .5) * 6, y + (rnd() - .5) * 6, '#66ccff'); break;
    case 'arrow': for (let j = 0; j < 5; j++) pix(x - Math.cos(a + 1.57) * j, y - Math.sin(a + 1.57) * j, j === 0 ? '#ffffff' : j > 3 ? '#5cff8a' : '#c9a36a'); break;
    case 'knife': for (let j = -2; j <= 2; j++) pix(x + Math.cos(a * 4) * j, y + Math.sin(a * 4) * j, j > 0 ? '#ffffff' : '#9a7aff'); break;
    case 'card': ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 3, 4, 6); ctx.fillStyle = ['#ff4466', '#ffd84a', '#228844', '#222244'][Math.floor(a * 2) & 3]; ctx.fillRect(x - 1, y - 1, 2, 2); break;
    case 'flask': art('flask', { W: '#e6e6e6', G: '#3a6a12', L: '#b6ff3c', B: '#ffffff' }, x, y, .8, a * 2); break;
    case 'halo': ctx.globalAlpha = .9; circ(x, y, 3, '#fff6c0', 10, .5, a * 3); pix(x, y, '#ffffff'); ctx.globalAlpha = 1; break;
    case 'chi': dot(x, y, 4, '#ffaa55'); dot(x, y, 2, '#fff0c0'); circ(x, y, 4, '#ffcc66', 8, 1, a * 4); break;
    case 'gear': circ(x, y, 3, '#88aaff', 8, 1, a * 5); dot(x, y, 2, '#ffffff'); break;
    case 'rune': ctx.fillStyle = '#bb88ff'; ctx.fillRect(x - 2, y - 2, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 2, y + 2, 5, 1); pix(x, y, '#ffffff'); break;
    case 'skull': art('skull', { W: '#d8e8d8', K: '#7affb0' }, x, y, .5, 0); break;
    case 'soul': dot(x, y, 3, '#ff44ff'); pix(x, y - 2, '#ffaaff'); ctx.globalAlpha = .5; pix(x - Math.cos(a) * 3, y - Math.sin(a) * 3 + 2, '#ff44ff'); ctx.globalAlpha = 1; break;
    default: ctx.fillStyle = c; ctx.fillRect(x - 1, y - 1, 3, 3); pix(x, y, '#ffffff');
  }
}
function skyStrike(type, o, dmg, c, name) {
  const tx = o.x, ty = o.y, hit = () => { if (!o.dead && o !== hero) hitMob(o, dmg, true, true, c); /* «землетрясение» берсерка бьёт вокруг героя, не по нему */ ring(tx, ty - 2, 16, c); groundMark(tx, ty + 2, 14, type === 'meteor' || type === 'quake' ? '#ff9a3c' : type === 'dark' ? '#7affb0' : '#ffffff'); fxLabel(name, tx, ty - 18, c); shake = Math.max(shake, 4); hitStop = Math.max(hitStop, .03); sfx.boom(); };
  switch (type) {
    case 'meteor': dropFx(tx + 40, ty - 90, o, .32, '#ff7a30', 6, hit); break;
    case 'sword': fx1(.3, p => art('sword', { G: '#ffd84a', W: '#ffffff', S: '#c9ced6', H: '#6a4a2a' }, tx, ty - 80 + 70 * p * p, 1.6, 0, 1, '#ffffff'), hit); break;
    case 'shield': fx1(.3, p => art('shield', { S: '#5a6a8a', W: '#ffffff', B: '#8fb0d0', G: '#ffd84a' }, tx, ty - 80 + 72 * p * p, 1.5, 0, 1, '#ffffff'), hit); break;
    case 'arrow': fx1(.2, p => art('arrow', { W: '#ffffff', S: '#5cff8a', G: '#2f8a4f' }, tx, ty - 80 + 74 * p, 2, Math.PI, 1, '#5cff8a'), hit); break;
    case 'card': fx1(.35, p => { ctx.save(); ctx.translate(Math.round(tx), Math.round(ty - 70 + 62 * p)); ctx.rotate(p * 9); ctx.drawImage(artCv('card', { K: '#000', W: '#ffffff' }), -7, -10, 14, 20); ctx.restore(); }, hit); break;
    case 'flask': fx1(.35, p => art('flask', { W: '#e6e6e6', G: '#3a6a12', L: '#b6ff3c', B: '#ffffff' }, tx, ty - 70 + 64 * p * p, 1.6, p * 10), () => { hit(); if (clouds.length < 36) clouds.push({ x: tx, y: ty, r: 14, dps: D.hit * .5, t: 3, acid: true }); }); break;
    case 'palm': fx1(.3, p => art('palm', { W: '#ffcc66' }, tx, ty - 60 + 54 * p * p, 2.2, 0, 1, '#ffffff'), hit); break;
    case 'scythe': fx1(.3, p => { const R = 22; for (let b = 0; b < 18; b++) { const a = -2.4 + p * 3.6 - b * .06, r = R - b * .5; for (let w = 0; w < 3; w++) pix(tx + Math.cos(a) * (r - w), ty - 6 + Math.sin(a) * (r - w) * .7, w ? '#ff44ff' : '#ffffff'); } }, hit); break;
    case 'quake': fx1(.25, p => { ctx.globalAlpha = 1 - p; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; dot(tx + Math.cos(a) * 10 * p, ty - 2 + Math.sin(a) * 6 * p - 8 * Math.sin(p * 3.14), 2, '#8a6a4a'); } ctx.globalAlpha = 1; }, hit); ring(tx, ty - 2, 20, '#b08a5a'); break;
    case 'lightning': bolt3(tx, camY - 4, tx, ty - 3, '#99eeff', 1); for (let i = 0; i < 3; i++) bolts.push({ x1: tx, y1: ty - 20 - i * 8, x2: tx + (rnd() - .5) * 20, y2: ty - 10 - i * 8, l: .12, c: '#ccf6ff' }); hit(); break;
    case 'pillar': fx1(.45, p => { const w = Math.round(8 * (1 - p)) + 2; ctx.globalAlpha = 1 - p * .6; ctx.fillStyle = c; ctx.fillRect(Math.round(tx - w / 2), camY - 6, w, Math.round(ty - camY + 4)); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(tx) - 1, camY - 6, 2, Math.round(ty - camY + 4)); ctx.globalAlpha = 1; }); hit(); break;
    case 'runepillar': fx1(.45, p => { ctx.globalAlpha = 1 - p; ctx.fillStyle = '#bb88ff'; ctx.fillRect(Math.round(tx) - 3, camY - 6, 6, Math.round(ty - camY + 4)); circ(tx, ty, 10, '#e0ccff', 16, .5, p * 6); ctx.globalAlpha = 1; }); hit(); break;
    case 'dark': bolt3(hero.x, hero.y - 8, tx, ty - 3, '#7affb0', 1); fx1(.4, p => { ctx.globalAlpha = 1 - p; dot(tx, ty - 6, 10 * (1 - p) + 2, '#1a3a26'); ctx.globalAlpha = 1; }); hit(); break;
    case 'shadow': fx1(.35, p => { ctx.globalAlpha = 1 - p; for (let j = -14; j <= 14; j++) { pix(tx + j, ty - 4 + j * .6, '#ffffff'); pix(tx + j, ty - 4 - j * .6, '#9a7aff'); } ctx.globalAlpha = 1; }); hit(); break;
    case 'clock': fx1(.5, p => { ctx.globalAlpha = 1 - p; circ(tx, ty - 3, 12, '#88aaff', 24, .8); const a = -1.57 + p * 12; for (let r = 0; r < 10; r++) pix(tx + Math.cos(a) * r, ty - 3 + Math.sin(a) * r * .8, '#ffffff'); ctx.globalAlpha = 1; }); hit(); break;
    default: bolt3(tx, camY - 4, tx, ty - 3, c, 1); hit();
  }
}
function palSprite(c) {
  const s = SK().sum;
  if (s[0] === 'shade') { const P = half16(evoPat(cls(), 1)); return sprite(P, { 0: shade(s[1], -.7), 1: s[1], 2: shade(s[1], -.5), 3: '#ffffff', 4: s[1], 5: shade(s[1], .3), 6: s[1], 7: '#ffffff', 8: shade(s[1], -.3), 9: shade(s[1], .3), h: shade(s[1], -.2), k: shade(s[1], -.4), n: shade(s[1], .1) }, 'pshade' + cls() + s[1]); }
  return sprite(MOBS[s[0]].p, { 1: s[1], 2: shade(s[1], -.5), 3: '#ffffff' }, 'pal' + s[0] + s[1]);
}
const PSND = { nova: [180, .12, 'square', 90], chain: [1600, .06, 'square', 400], sky: [90, .25, 'sawtooth', 40], pulse: [220, .15, 'triangle', 110], volley: [900, .05, 'triangle', 1500], summon: [300, .2, 'triangle', 600], boom: [120, .15, 'square', 60] };
const psnd = ty => { const s = PSND[ty]; if (s) tone(s[0], s[1], s[2], .03, s[3], 0, 'p' + ty, .08); };

/* механики узлов пути: общий движок, цвет — цвет класса */
let pals = [], pHitN = 0, novaDots = [];
const drawLater = (x, y, a) => { if (novaDots.length < 40) novaDots.push({ x, y, a, t: .25 }); };
function pathMods() {
  for (const e of PFXL) { const L = e.L;
    if (e.ty === 'fury') D.aps = Math.min(14, D.aps * (1 + .06 * L));
    if (e.ty === 'crit') { D.crit = Math.min(.95, D.crit + .04 * L); D.critM *= 1 + .1 * L; }
    if (e.ty === 'tough') { D.maxHP *= 1 + .1 * L; D.armor = Math.min(.95, D.armor + .03 * L); }
    if (e.ty === 'giant') D.hit *= 1 + .12 * L;
    if (e.ty === 'sig0' && D.cq) D.cq[0] = Math.min(1.5, D.cq[0] * (1 + .08 * L) + .02 * L); if (e.ty === 'sig1' && D.cq) D.cq[1] = Math.min(1.5, D.cq[1] * (1 + .08 * L) + .02 * L);
    if (e.ty === 'sigA') { D.hit *= 1 + .08 * L; D.maxHP *= 1 + .08 * L; }
    if (e.ty === 'mn_dmg') D.hit *= 1 + .04 * L; if (e.ty === 'mn_hp') D.maxHP *= 1 + .05 * L; if (e.ty === 'mn_aps') D.aps = Math.min(14, D.aps * (1 + .02 * L)); if (e.ty === 'mn_crit') D.crit = Math.min(.95, D.crit + .01 * L);
    if (e.ty === 'mn_cq' && D.cq) D.cq = D.cq.map(q => Math.min(1.5, q * (1 + .03 * L) + .01 * L)); }
  D.ultSig = PFXL.filter(e => e.ty === 'sigU').reduce((a, e) => a + .25 * e.L, 0) + PFXL.filter(e => e.ty === 'mn_ult').reduce((a, e) => a + .06 * e.L, 0);
  const f = formOf(cls()); D.hit *= 1 + .15 * (f - 1); D.maxHP *= 1 + .15 * (f - 1);   // каждая эволюция: +15% урона и HP
}
function pathHit(t, dmg, crit) {
  if (!PFXL.length || t.dead) return; pHitN++; const c = CL().c;
  for (const e of PFXL) { const L = e.L;
    switch (e.ty) {
      case 'nova': if (pHitN % e.p === 0) { const r = 12 + 3 * L; ring(t.x, t.y - 2, r, c); ring(t.x, t.y - 2, r * .55, '#ffffff'); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; drawLater(t.x + Math.cos(a) * r * .7, t.y - 3 + Math.sin(a) * r * .45, a); } hitAround(t.x, t.y, r, dmg * (.8 + .6 * L), c); psnd('nova'); hitStop = Math.max(hitStop, .02); if (rnd() < .3) fxLabel(e.n, t.x, t.y - 16, c); } break;
      case 'chain': if (rnd() < .1 * L) { let from = t; const hs = new Set([t]); for (let j = 0; j < 2 + L; j++) { const o = nearMobs(from.x, from.y, 34).find(m => !hs.has(m)); if (!o) break; hs.add(o); bolts.push({ x1: from.x, y1: from.y - 3, x2: o.x, y2: o.y - 3, l: .1, c }); hitMob(o, dmg * .6, false, false, c); from = o; } psnd('chain'); } break;
      case 'bounce': { let from = t; const hs = new Set([t]); for (let j = 0; j < L; j++) { const o = nearMobs(from.x, from.y, 36).find(m => !hs.has(m)); if (!o) break; hs.add(o); waves.push({ x: from.x, y: from.y - 4, t: o, sp: 240, a: 0, l: 1, pv: 1, c, dmg: dmg * .6, kind: SK().vol }); from = o; } break; }
      case 'exec': if (!t.boss && !t.dead && t.hp < t.max * .08 * L) { trackDmg('Казнь', t.hp); hitMob(t, t.hp + 1, false, false, c); fxLabel(e.n, t.x, t.y - 16, c); } break;
      case 'mark': t.pmk = time + 3; t.pmkV = .1 * L; break;
      case 'double': if (!hero.pdbl && rnd() < .05 * L && !t.dead) { hero.pdbl = 1; ghosts.push({ x: hero.x, y: hero.y, l: .2, face: hero.face }); heroStrike(t, true); hero.pdbl = 0; } break;
      case 'volley': if (pHitN % e.p === 0) { const all = mobs.filter(m => !m.dead); for (let j = 0; j < 2 + L && all.length; j++) { const o = all[Math.floor(rnd() * all.length)]; waves.push({ x: hero.x, y: hero.y - 5, t: o, sp: 200, a: 0, l: 1.4, pv: 1, c, dmg: dmg * .7, kind: SK().vol }); } psnd('volley'); } break;
      case 'ultc': if (ult < 1 && ultCd <= 0) ult = Math.min(1, ult + .002 * L); break;
    } }
}
function pathKill(m) {
  for (const e of PFXL) { const L = e.L, c = CL().c;
    if (e.ty === 'boom' && !m.boss && rnd() < .05 * L) { psnd('boom'); burst(m.x, m.y - 3, c, 16, 50); ring(m.x, m.y - 3, 16, c); hitAround(m.x, m.y, 16, D.hit * 2, c, m); fxLabel(e.n, m.x, m.y - 14, c); }
    if (e.ty === 'leech') hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .005 * L); }
}
function pathTick(dt) {
  if (pL(cls(), 4, 'V')) cap4Tick(dt);
  if (!PFXL.length) return;
  const c = CL().c, T = (key, per) => { PT[key] = (PT[key] ?? per) - dt; if (PT[key] <= 0) { PT[key] = per; return true; } return false; };
  for (const e of PFXL) { const L = e.L, key = 'p' + e.t + e.id;
    switch (e.ty) {
      case 'orbit': for (let i = 0; i < L; i++) { const a = time * 2.6 + i * 6.283 / L + e.t, ox = hero.x + Math.cos(a) * 16, oy = hero.y - 4 + Math.sin(a) * 10;
        for (const m of mobs) if (!m.dead && Math.hypot(m.x - ox, m.y - 3 - oy) < 6 && time > (m['po' + key] || 0)) { m['po' + key] = time + .4; hitMob(m, D.hit * .5, false, false, c); } } break;
      case 'trail': if (T(key, .45) && clouds.length < 34) clouds.push({ x: hero.x, y: hero.y, r: 7, dps: D.hit * .25 * L, t: 2.2, col: c }); break;
      case 'pulse': if (T(key, e.p) && mobs.length) { const r = 20 + 4 * L; ring(hero.x, hero.y - 3, r, c); ring(hero.x, hero.y - 3, r * .6, '#ffffff'); hitAround(hero.x, hero.y, r, D.hit * (1 + L), c); fxLabel(e.n, hero.x, hero.y - 20, c); psnd('pulse'); for (let i = 0; i < 16 && parts.length < 650; i++) { const a = i / 16 * 6.283; parts.push({ x: hero.x + Math.cos(a) * 6, y: hero.y - 3 + Math.sin(a) * 4, vx: Math.cos(a) * 90, vy: Math.sin(a) * 60, l: .3, c, f: 1 }); } } break;
      case 'sky': if (T(key, e.p)) { const o = mobs.filter(m => !m.dead).sort((a, b) => b.hp - a.hp)[0]; if (o) { skyStrike(SK().sky, o, D.hit * (2 + 2 * L), c, e.n); psnd('sky'); } } break;
      case 'summon': if (T(key, 4) && mobs.length && pals.filter(p2 => p2.key === key).length < e.p + L) { const a = rnd() * 6.283; psnd('summon'); pals.push({ key, x: hero.x + Math.cos(a) * 10, y: hero.y + Math.sin(a) * 6, t: 12, cd: .4, face: 1 }); burst(hero.x + Math.cos(a) * 10, hero.y + Math.sin(a) * 6 - 3, c, 8, 25); } break;
      case 'shield': if (T(key, e.p)) { hero.shield = Math.max(hero.shield, D.maxHP * .06 * L); ring(hero.x, hero.y - 4, 10, c); } break;
      case 'slow': for (const m of mobs) if (!m.dead && Math.hypot(m.x - hero.x, m.y - hero.y) < 28) { m.slowT = Math.max(m.slowT || 0, .1); m.pmk = Math.max(m.pmk || 0, time + .2); m.pmkV = Math.max(m.pmkV || 0, .05 * L); } break;
    } }
  for (const al of pals) {
    al.t -= dt; al.cd -= dt;
    let best = null, bd = 1e9; for (const m of mobs) { if (m.dead) continue; const d = Math.hypot(m.x - al.x, m.y - al.y); if (d < bd) { bd = d; best = m; } }
    if (best) { al.face = best.x >= al.x ? 1 : -1; if (bd > 6) { al.x += (best.x - al.x) / bd * 34 * dt; al.y += (best.y - al.y) / bd * 34 * dt; } else if (al.cd <= 0) { al.cd = .7; hitMob(best, D.hit * .6, false, false, c); } }
    if (al.t <= 0) burst(al.x, al.y - 3, c, 6, 20);
  }
  pals = pals.filter(al => al.t > 0);
}
// воскрешение пути (раз за жизнь)
function pathRevive() { const e = pfx('revive')[0]; if (!e || S.pRev) return false; S.pRev = 1; hero.hp = D.maxHP * Math.min(1, .3 * e.L); hero.iframe = 2; ftext(hero.x, hero.y - 16, e.n.toUpperCase() + '!', CL().c, 1.2, 1.2); ring(hero.x, hero.y - 4, 26, CL().c); burst(hero.x, hero.y - 4, CL().c, 30, 60); return true; }
function drawPathFx() {
  if (!PFXL.length) return;
  const c = CL().c;
  for (const e of pfx('orbit')) for (let i = 0; i < e.L; i++) { const a = time * 2.6 + i * 6.283 / e.L + e.t; drawOrb(SK().orb, hero.x + Math.cos(a) * 16, hero.y - 4 + Math.sin(a) * 10, a, c); }
  for (const al of pals) { const sp2 = palSprite(c), X = Math.round(al.x - 4), Y = Math.round(al.y - 8); ctx.globalAlpha = al.t < 1 ? al.t : .9;
    ctx.save(); if (al.face < 0) { ctx.translate((X + 4) * 2, 0); ctx.scale(-1, 1); } ctx.drawImage(sp2, X - (sp2.ox || 0), Y - (sp2.oy || 0)); ctx.restore(); ctx.globalAlpha = 1; }
  for (const d of novaDots) drawOrb(SK().orb, d.x, d.y, d.a, c); novaDots = novaDots.filter(d => (d.t -= .016) > 0);
}
/* ---------- сцена эволюции ---------- */
let EV = null;
function evolveStart(k, form, label) {
  const asF = label === 'ВОЗНЕСЁННЫЙ ОБЛИК';
  EV = { t: 0, k, form, old: Math.max(1, form - (label && !asF ? 0 : 1)), label: label || 'ЭВОЛЮЦИЯ', name: label && !asF ? AWK[k][0] : evoName(k, form), shown: false };
  hero.iframe = Math.max(hero.iframe, 4);
  [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, .25, 'triangle', .035, 0, i * .26));
  tone(80, 1.7, 'sawtooth', .04, 200);
}
function evFrame(real) {
  if (!EV) return 1; EV.t += real;
  if (EV.t >= 1.7 && !EV.shown) { EV.shown = true; evolveBurst(); }
  if (EV.t >= 3.4) { EV = null; return 1; }
  return EV.t < 2.3 ? .04 : .5;
}
const shownForm = k => EV && EV.k === k && EV.t < 1.7 ? (Math.floor(EV.t * 4) % 2 && EV.t > 1.1 ? EV.form : EV.old) : formOf(k);
function evolveBurst() {
  const c = CL().c; shake = 14; flashT = .2;
  for (let i = 0; i < 4; i++) ring(hero.x, hero.y - 5, 14 + i * 16, i % 2 ? '#ffffff' : c);
  for (let i = 0; i < 80 && parts.length < 650; i++) { const a = rnd() * 6.283, v = 50 + rnd() * 110; parts.push({ x: hero.x, y: hero.y - 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .7 - 20, l: .7 + rnd() * .5, c: rnd() < .4 ? '#ffffff' : c }); }
  groundMark(hero.x, hero.y + 2, 26, '#ffe08a');
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .35, 'square', .04, 0, i * .07)); tone(1047, .9, 'triangle', .05, 0, .4);
}
function drawEvolveWorld() {
  if (!EV) return;
  const t = EV.t, c = CL().c, hx = hero.x, hy = hero.y - 5, a = t < 1.7 ? Math.min(1, t / .6) : Math.max(0, 1 - (t - 1.7) / 1.4);
  tint('#05000f', .55 * a);
  ctx.globalAlpha = .6 * a; const w = 3 + Math.round(3 * Math.min(1, t)); ctx.fillStyle = c; ctx.fillRect(Math.round(hx - w / 2) - 1, camY - 6, w + 2, Math.round(hy - camY + 8)); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(hx) - 1, camY - 6, 2, Math.round(hy - camY + 8)); ctx.globalAlpha = 1;
  if (t < 1.7) { const R = 34 - 18 * Math.min(1, t / 1.6); ctx.globalAlpha = .9; circ(hx, hero.y, R, c, 48, .5, t * 3); circ(hx, hero.y, R * .7, '#ffffff', 30, .5, -t * 4);
    for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283 + t * 2, gx = hx + Math.cos(an) * R, gy = hero.y + Math.sin(an) * R * .5; pix(gx, gy - 1, '#ffffff'); pix(gx - 1, gy, c); pix(gx + 1, gy, c); pix(gx, gy + 1, '#ffffff'); }
    for (let i = 0; i < 18; i++) { const an = i * 1.7 + i, ph = (t * 1.6 + i * .09) % 1, r = 60 * (1 - ph); pix(hx + Math.cos(an) * r, hy + Math.sin(an) * r * .7, ph > .7 ? '#ffffff' : c); }
    ctx.globalAlpha = 1; }
}
function drawEvoBanner(k) {
  if (!EV || EV.t < 1.7) return;
  const t = EV.t - 1.7, w = fx.width, h = fx.height, a = t < .15 ? t / .15 : t > 1.3 ? Math.max(0, 1 - (t - 1.3) / .4) : 1;
  if (a <= 0) return;
  const c = CLASSES[EV.k].c, cy = h * .25, bh = h * .2, slide = (1 - Math.min(1, t / .2)) * w;
  fctx.save(); fctx.globalAlpha = a; fctx.translate(w / 2 + slide, cy);
  fctx.fillStyle = 'rgba(8,4,18,.92)'; fctx.fillRect(-w, -bh / 2, w * 2, bh); fctx.fillStyle = c; fctx.fillRect(-w, -bh / 2, w * 2, 4 * DPR); fctx.fillRect(-w, bh / 2 - 4 * DPR, w * 2, 4 * DPR);
  const spr = heroPortrait(EV.k, EV.form), n = spr.height, sc = Math.max(1, Math.floor(bh * .85 / n)), P = [{ length: spr.width }];
  fctx.imageSmoothingEnabled = false; fctx.drawImage(spr, -w * .36, -sc * n / 2, sc * spr.width, sc * n);
  const fs = Math.round(bh * .19); fctx.textAlign = 'left'; fctx.textBaseline = 'middle'; fctx.lineWidth = Math.max(3, fs / 3); fctx.strokeStyle = '#000';
  const tx = -w * .36 + sc * P[0].length + 10 * DPR;
  fctx.font = `${Math.round(fs * .55)}px "Press Start 2P", monospace`; fctx.fillStyle = '#a59fc0'; fctx.strokeText(EV.label, tx, -fs * .9); fctx.fillText(EV.label, tx, -fs * .9);
  fctx.font = `${fs}px "Press Start 2P", monospace`; fctx.fillStyle = c; const name = EV.name.toUpperCase(), mw = w * .55 - 10 * DPR, tw = fctx.measureText(name).width, k2 = tw > mw ? mw / tw : 1;
  fctx.save(); fctx.translate(tx, fs * .35); fctx.scale(k2, 1); fctx.strokeText(name, 0, 0); fctx.fillText(name, 0, 0); fctx.restore();
  fctx.restore(); fctx.textBaseline = 'alphabetic'; fctx.textAlign = 'center';
}
// палитра героя для крупных картинок
function heroCols(k, rk, v) {
  const cp = CLS_SPR[k].pal || {}, a = ARMOR[rk % ARMOR.length], cc = CLASSES[k].c;
  const c1 = cp[1] || a, hc = HAIR[k] || '#6a4a2a'; return { h: hc, k: shade(hc, -.35), n: shade(cp[5] || '#f0c090', -.2), 0: '#0c0814', 1: c1, 2: cp[2] || shade(a, -.5), 3: cp[3] || v, 4: cc, 5: cp[5] || '#f0c090', 6: '#ffd84a', 7: '#ffffff', 8: shade(cc, -.4), 9: shade(c1, .4) };
}

/* ---------- экран пути класса: огромный пиксельный символ класса + дерево узлов поверх ---------- */
let pSel = null, pRaf = 0;
const PTH = 2000, PBAND = 400;
// мини-атрибутика героя на фоне ветки (иконки 5×5)
const CATTR = { war: ['sword', 'shield', 'crown'], bers: ['sword', 'flame', 'drop'], pal: ['shield', 'star', 'crown'], guard: ['shield', 'gear', 'spike'], mage: ['flame', 'book', 'star'], sham: ['bolt', 'drop', 'wing'],
  arch: ['wing', 'eye', 'spike'], assa: ['drop', 'eye', 'spike'], gamb: ['clover', 'crown', 'star'], alch: ['drop', 'flame', 'gear'], priest: ['star', 'heart', 'book'], monk: ['fist', 'hand', 'wing'],
  chrono: ['clock', 'gear', 'star'], rune: ['book', 'eye', 'star'], necro: ['skull', 'drop', 'eye'], reap: ['skull', 'wing', 'spike'] };
function pathAttr(c, W, H, T, k) {
  const ic = CATTR[k], col = CLASSES[k].c, R = i => ((Math.sin(i * 78.233 + 3.1) * 12543.31) % 1 + 1) % 1;
  for (let i = 0; i < 34; i++) { const pat = ICONS[ic[i % ic.length]], ps = 3 + Math.floor(R(i + 5) * 3), x = Math.round(R(i) * (W - 30) + 6), y = Math.round(R(i + 50) * (H - 300) + 260 + Math.sin(T * .6 + i) * 4);
    c.globalAlpha = .17 + .1 * R(i + 9) + .05 * Math.sin(T * 1.2 + i); c.fillStyle = i % 4 ? col : '#ffe08a';
    for (let j = 0; j < 5; j++) for (let q = 0; q < 5; q++) if (pat[j][q] === '#') c.fillRect(x + q * ps, y + j * ps, ps, ps); }
  c.globalAlpha = 1;
}
// большие символы классов: примитивы в поле 100×300 (y вниз). материалы: 1 основной, 2 тёмный, 3 золото, 4 сияние, 5 стекло
const SYM2 = {
  war: [['poly', 1, [[44, 22], [50, 4], [56, 22], [57, 198], [43, 198]]], ['line', 2, 50, 26, 50, 188, 2], ['poly', 3, [[16, 198], [84, 198], [88, 212], [12, 212]]], ['circ', 4, 50, 205, 4],
    ['poly', 2, [[45, 212], [55, 212], [55, 268], [45, 268]]], ['line', 3, 45, 224, 55, 224, 2], ['line', 3, 45, 240, 55, 240, 2], ['line', 3, 45, 256, 55, 256, 2], ['circ', 3, 50, 278, 9], ['circ', 4, 50, 278, 4]],
  bers: [['poly', 2, [[47, 30], [53, 30], [54, 296], [46, 296]]], ['poly', 1, [[50, 40], [16, 18], [6, 60], [10, 112], [24, 134], [50, 100]]], ['poly', 1, [[50, 52], [80, 62], [50, 84]]], ['poly', 1, [[47, 32], [50, 6], [53, 32]]],
    ['line', 4, 13, 24, 7, 62, 2], ['line', 4, 7, 62, 11, 110, 2], ['line', 3, 46, 106, 54, 106, 3], ['line', 3, 46, 118, 54, 118, 3], ['circ', 3, 50, 292, 6]],
  pal: [['poly', 2, [[47, 90], [53, 90], [53, 292], [47, 292]]], ['poly', 1, [[12, 28], [88, 28], [88, 92], [12, 92]]], ['poly', 3, [[12, 28], [88, 28], [88, 38], [12, 38]]], ['poly', 3, [[12, 82], [88, 82], [88, 92], [12, 92]]],
    ['circ', 3, 50, 60, 12], ['circ', 4, 50, 60, 5], ['line', 3, 46, 130, 54, 130, 3], ['line', 3, 46, 200, 54, 200, 3], ['circ', 3, 50, 290, 8]],
  guard: [['line', 2, 50, 150, 50, 296, 5], ['poly', 3, [[44, 286], [56, 286], [50, 298]]], ['poly', 1, [[12, 20], [88, 20], [88, 110], [50, 176], [12, 110]]], ['pline', 3, [[12, 20], [88, 20], [88, 110], [50, 176], [12, 110], [12, 20]], 4], ['line', 2, 50, 28, 50, 162, 3], ['line', 2, 16, 84, 84, 84, 3], ['circ', 3, 50, 84, 14], ['circ', 4, 50, 84, 5]],
  mage: [['line', 2, 56, 96, 40, 296, 5], ['poly', 3, [[40, 72], [56, 98], [72, 72], [66, 100], [56, 108], [46, 100]]], ['poly', 4, [[56, 6], [78, 42], [56, 94], [34, 42]]], ['poly', 5, [[56, 14], [64, 42], [56, 80], [48, 42]]],
    ['circ', 4, 22, 30, 3], ['circ', 4, 88, 60, 3], ['circ', 4, 26, 90, 2], ['circ', 3, 40, 294, 5]],
  sham: [['poly', 2, [[42, 80], [58, 80], [58, 296], [42, 296]]], ['circ', 1, 50, 50, 22], ['poly', 3, [[38, 32], [50, 2], [62, 32]]], ['circ', 4, 42, 48, 3], ['circ', 4, 58, 48, 3], ['line', 2, 42, 62, 58, 62, 2],
    ['poly', 3, [[42, 92], [4, 72], [14, 102], [4, 120], [42, 112]]], ['poly', 3, [[58, 92], [96, 72], [86, 102], [96, 120], [58, 112]]],
    ['poly', 1, [[36, 130], [64, 130], [64, 172], [36, 172]]], ['circ', 4, 44, 146, 3], ['circ', 4, 56, 146, 3], ['line', 2, 42, 162, 58, 162, 2], ['poly', 1, [[36, 200], [64, 200], [64, 242], [36, 242]]], ['circ', 4, 44, 216, 3], ['circ', 4, 56, 216, 3]],
  arch: [['pline', 1, [[30, 8], [60, 40], [78, 110], [78, 190], [60, 260], [30, 292]], 6], ['poly', 3, [[72, 134], [84, 134], [84, 166], [72, 166]]], ['line', 4, 30, 10, 30, 290, 1],
    ['line', 2, 8, 150, 92, 150, 2], ['poly', 3, [[90, 142], [100, 150], [90, 158]]], ['poly', 3, [[10, 150], [2, 138], [18, 150], [2, 162]]]],
  assa: [['line', 1, 20, 282, 74, 40, 7], ['poly', 4, [[70, 44], [80, 20], [78, 50]]], ['line', 3, 18, 222, 46, 240, 4], ['circ', 3, 16, 290, 6],
    ['line', 1, 80, 282, 26, 40, 7], ['poly', 4, [[30, 44], [20, 20], [22, 50]]], ['line', 3, 82, 222, 54, 240, 4], ['circ', 3, 84, 290, 6], ['circ', 4, 50, 160, 5]],
  gamb: [['poly', 5, [[22, 196], [80, 186], [86, 280], [28, 292]]], ['pline', 2, [[22, 196], [80, 186], [86, 280], [28, 292], [22, 196]], 2], ['poly', 1, [[54, 214], [66, 238], [56, 264], [44, 240]]],
    ['poly', 5, [[14, 100], [72, 108], [66, 204], [8, 196]]], ['pline', 2, [[14, 100], [72, 108], [66, 204], [8, 196], [14, 100]], 2], ['poly', 1, [[40, 128], [52, 152], [40, 178], [28, 152]]],
    ['poly', 5, [[22, 10], [80, 10], [80, 106], [22, 106]]], ['pline', 2, [[22, 10], [80, 10], [80, 106], [22, 106], [22, 10]], 2], ['poly', 1, [[51, 30], [65, 58], [51, 86], [37, 58]]], ['poly', 4, [[51, 46], [57, 58], [51, 70], [45, 58]]]],
  alch: [['poly', 2, [[40, 8], [60, 8], [60, 24], [40, 24]]], ['poly', 5, [[42, 24], [58, 24], [58, 150], [42, 150]]], ['circ', 5, 50, 214, 46], ['poly', 1, [[8, 200], [92, 200], [90, 228], [74, 254], [26, 254], [10, 228]]],
    ['circ', 4, 38, 222, 4], ['circ', 4, 58, 236, 3], ['circ', 4, 52, 190, 3], ['circ', 4, 50, 120, 2], ['line', 3, 40, 160, 60, 160, 2]],
  priest: [['poly', 3, [[42, 18], [58, 18], [58, 296], [42, 296]]], ['poly', 3, [[12, 80], [88, 80], [88, 100], [12, 100]]], ['ring', 4, 50, 90, 32, 3], ['circ', 1, 50, 90, 9], ['circ', 4, 50, 90, 4],
    ['line', 4, 50, 40, 50, 50, 2], ['line', 4, 22, 140, 32, 130, 1], ['line', 4, 78, 140, 68, 130, 1]],
  monk: [['poly', 2, [[47, 116], [53, 116], [53, 296], [47, 296]]], ['circ', 1, 50, 66, 46], ['circ', 2, 50, 43, 23], ['circ', 1, 50, 89, 23], ['circ', 1, 50, 43, 7], ['circ', 2, 50, 89, 7], ['ring', 3, 50, 66, 46, 2],
    ['circ', 3, 50, 150, 6], ['circ', 3, 50, 176, 6], ['circ', 3, 50, 202, 6], ['circ', 3, 50, 228, 6]],
  chrono: [['poly', 3, [[16, 8], [84, 8], [84, 22], [16, 22]]], ['poly', 3, [[16, 168], [84, 168], [84, 182], [16, 182]]], ['line', 2, 20, 22, 20, 168, 4], ['line', 2, 80, 22, 80, 168, 4],
    ['poly', 5, [[26, 22], [74, 22], [54, 95], [74, 168], [26, 168], [46, 95]]], ['poly', 1, [[32, 44], [68, 44], [52, 92], [48, 92]]], ['poly', 1, [[32, 168], [68, 168], [50, 138]]], ['line', 1, 50, 95, 50, 140, 1],
    ['line', 2, 50, 182, 50, 210, 4], ['circ', 3, 50, 246, 36], ['circ', 2, 50, 246, 26], ['circ', 3, 50, 246, 6], ['line', 4, 50, 246, 50, 226, 2], ['line', 4, 50, 246, 64, 254, 2],
    ['circ', 3, 50, 206, 5], ['circ', 3, 86, 246, 5], ['circ', 3, 14, 246, 5], ['circ', 3, 50, 286, 5], ['circ', 3, 76, 220, 4], ['circ', 3, 24, 220, 4], ['circ', 3, 76, 272, 4], ['circ', 3, 24, 272, 4]],
  rune: [['poly', 2, [[20, 44], [50, 10], [80, 44], [86, 286], [14, 286]]], ['line', 4, 50, 60, 50, 244, 4], ['line', 4, 50, 104, 26, 72, 4], ['line', 4, 50, 104, 74, 72, 4], ['line', 4, 50, 186, 28, 222, 4], ['line', 4, 50, 186, 72, 222, 4], ['circ', 1, 50, 146, 9]],
  necro: [['line', 2, 50, 140, 50, 296, 6], ['line', 3, 18, 170, 82, 232, 4], ['line', 3, 82, 170, 18, 232, 4], ['circ', 1, 50, 66, 36], ['poly', 1, [[28, 88], [72, 88], [66, 130], [34, 130]]],
    ['circ', 2, 37, 70, 10], ['circ', 2, 63, 70, 10], ['circ', 4, 37, 70, 3], ['circ', 4, 63, 70, 3], ['poly', 2, [[50, 88], [44, 102], [56, 102]]], ['line', 2, 42, 112, 42, 128, 1], ['line', 2, 50, 112, 50, 128, 1], ['line', 2, 58, 112, 58, 128, 1]],
  reap: [['line', 2, 72, 296, 40, 18, 6], ['line', 3, 63, 216, 69, 222, 4], ['line', 3, 56, 150, 62, 156, 4], ['poly', 1, [[40, 22], [4, 40], [0, 96], [14, 72], [30, 54], [46, 40]]], ['line', 4, 4, 42, 1, 90, 2], ['circ', 3, 40, 22, 6]],
};
const CATM = {
  war: ['#1c1610', '#07050a', 'spark'], bers: ['#2a0a08', '#0a0204', 'ember'], pal: ['#2a2410', '#0a0804', 'ray'], guard: ['#141c26', '#05080c', 'glint'],
  mage: ['#1e0a2e', '#06020c', 'arcane'], sham: ['#0a1a2e', '#02060c', 'rain'], arch: ['#0c1e12', '#020604', 'leaf'], assa: ['#140c22', '#020106', 'smoke'],
  gamb: ['#0a1e16', '#020604', 'suit'], alch: ['#161e06', '#040602', 'bubble'], priest: ['#2a2616', '#0a0904', 'ray'], monk: ['#2a180a', '#0a0502', 'petal'],
  chrono: ['#0c122e', '#02040c', 'gear'], rune: ['#1c0a2e', '#05020c', 'glyph'], necro: ['#071c10', '#010402', 'fog'], reap: ['#1e0820', '#050106', 'soul'],
};
const symC = {};
function symArt(k, W, lit) {
  const key = k + W + lit; if (symC[key]) return symC[key];
  const sc = Math.min(PTH / 300, W / 100 * 1.15), px = W / 44, GW = Math.round(100 * sc / px), GH = Math.round(300 * sc / px), sx = sc, sy = sc, G = new Uint8Array(GW * GH), P = SYM2[k];
  const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const segD = (x, y, x1, y1, x2, y2) => { const ax = (x2 - x1) * sx, ay = (y2 - y1) * sy, bx = (x - x1) * sx, by = (y - y1) * sy, l2 = ax * ax + ay * ay || 1, u = clamp((ax * bx + ay * by) / l2, 0, 1); return Math.hypot(bx - ax * u, by - ay * u); };
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = (i + .5) * px / sx, y = (j + .5) * px / sy; let m = 0;
    for (const p of P) { const t = p[0]; let hit = false;
      if (t === 'poly') hit = inPoly(x, y, p[2]);
      else if (t === 'circ') hit = Math.hypot((x - p[2]) * sx, (y - p[3]) * sx) <= p[4] * sx;
      else if (t === 'ring') hit = Math.abs(Math.hypot((x - p[2]) * sx, (y - p[3]) * sx) - p[4] * sx) <= p[5] * sx / 2 + px * .3;
      else if (t === 'line') hit = segD(x, y, p[2], p[3], p[4], p[5]) <= p[6] * sx / 2 + px * .35;
      else if (t === 'pline') { const pts = p[2]; for (let q = 1; q < pts.length && !hit; q++) hit = segD(x, y, pts[q - 1][0], pts[q - 1][1], pts[q][0], pts[q][1]) <= p[3] * sx / 2 + px * .35; }
      if (hit) m = p[1]; }
    G[j * GW + i] = m; }
  const C = CLASSES[k].c, pal = { 1: C, 2: shade(C, -.55), 3: '#ffd84a', 4: '#ffffff', 5: '#bfe6ff' };
  const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH; const x = cv.getContext('2d'), g = (i, j) => (i < 0 || j < 0 || i >= GW || j >= GH) ? 0 : G[j * GW + i];
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const m = g(i, j);
    if (!m) { if (g(i - 1, j) || g(i + 1, j) || g(i, j - 1) || g(i, j + 1)) { x.fillStyle = '#000'; x.globalAlpha = lit ? .9 : .6; x.fillRect(i, j, 1, 1); } continue; }
    let col = pal[m]; if (g(i - 1, j) !== m || g(i, j - 1) !== m) col = shade(col, .3); else if (g(i + 1, j) !== m || g(i, j + 1) !== m) col = shade(col, -.3);
    if (!lit) col = shade(col, -.5); x.globalAlpha = m === 5 ? (lit ? .55 : .3) : 1; x.fillStyle = col; x.fillRect(i, j, 1, 1); }
  cv.aw = 100 * sc; cv.ah = 300 * sc; return symC[key] = cv;
}
function pathAtmo(c, W, H, T, k) {
  const A = CATM[k], col = CLASSES[k].c, g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, A[0]); g.addColorStop(1, A[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const ty = A[2], R = i => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 60; i++) { const r1 = R(i), r2 = R(i + 99), r3 = R(i + 199); let x = r1 * W, y = r2 * H; const sp = 10 + r3 * 20;
    switch (ty) {
      case 'spark': case 'ember': case 'soul': case 'bubble': { y = (H - ((T * sp + r2 * H) % H)); x += Math.sin(T * 1.5 + i) * 6; c.globalAlpha = .35 + .4 * r3;
        c.fillStyle = ty === 'spark' ? (i % 3 ? '#ffaa44' : '#ffee88') : ty === 'ember' ? (i % 3 ? '#ff3322' : '#ff8844') : ty === 'soul' ? (i % 2 ? col : '#ffffff') : '#d8ff7a';
        if (ty === 'bubble') { c.strokeStyle = '#b6ff3c'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 2 + r3 * 4, 0, 6.283); c.stroke(); } else c.fillRect(Math.round(x), Math.round(y), ty === 'soul' ? 3 : 2, ty === 'soul' ? 3 : 2); break; }
      case 'rain': { y = (T * 160 * (.6 + r3) + r2 * H) % H; c.globalAlpha = .35; c.fillStyle = '#7ad8ff'; c.fillRect(Math.round(x), Math.round(y), 1, 8); if (i === 0 && Math.sin(T * .7) > .985) { c.globalAlpha = .12; c.fillStyle = '#cfefff'; c.fillRect(0, 0, W, H); } break; }
      case 'leaf': case 'petal': { y = (T * sp * 1.2 + r2 * H) % H; x = (x + Math.sin(T + i) * 20 + T * 8) % W; c.globalAlpha = .55; c.fillStyle = ty === 'leaf' ? (i % 2 ? '#5cff8a' : '#2a8a4a') : (i % 2 ? '#ffaacc' : '#ffd0e0'); c.fillRect(Math.round(x), Math.round(y), 3, 2); c.fillRect(Math.round(x) + 1, Math.round(y) - 1, 1, 1); break; }
      case 'ray': if (i < 7) { c.globalAlpha = .06 + .04 * Math.sin(T * .6 + i); c.fillStyle = k === 'priest' ? '#fff6c0' : '#ffe08a'; c.beginPath(); const x0 = r1 * W; c.moveTo(x0 - 10, 0); c.lineTo(x0 + 20, 0); c.lineTo(x0 + 120, H); c.lineTo(x0 + 60, H); c.fill(); } else if (i < 30) { c.globalAlpha = .3 + .3 * Math.sin(T * 2 + i); c.fillStyle = '#fff6c0'; c.fillRect(Math.round(x), Math.round((y + T * 6) % H), 1, 1); } break;
      case 'glint': { const ph = (T * .5 + r3) % 1; if (ph < .15) { c.globalAlpha = 1 - ph / .15; c.fillStyle = '#ffffff'; c.fillRect(Math.round(x) - 3, Math.round(y), 7, 1); c.fillRect(Math.round(x), Math.round(y) - 3, 1, 7); } break; }
      case 'arcane': case 'glyph': { const a = T * (.2 + r3 * .3) + i; x += Math.cos(a) * 14; y += Math.sin(a) * 10; c.globalAlpha = .25 + .35 * Math.sin(T * 2 + i); c.fillStyle = ty === 'glyph' ? '#bb88ff' : (i % 3 ? '#c06bff' : '#ff8844');
        const gx = Math.round(x), gy = Math.round(y); c.fillRect(gx, gy, 4, 1); c.fillRect(gx + (i % 4), gy - 3, 1, 4); if (ty === 'glyph') c.fillRect(gx, gy + 3, 4, 1); break; }
      case 'smoke': case 'fog': { x = (x + T * (4 + r3 * 6)) % (W + 60) - 30; c.globalAlpha = .08; c.fillStyle = ty === 'fog' ? '#7affb0' : '#6a5aa0'; c.beginPath(); c.arc(x, y, 18 + r3 * 26, 0, 6.283); c.fill(); break; }
      case 'suit': { y = (T * sp + r2 * H) % H; c.globalAlpha = .3; c.fillStyle = i % 2 ? '#ff4466' : '#44ffaa'; const sx = Math.round(x), sy = Math.round(y); c.fillRect(sx + 1, sy, 1, 1); c.fillRect(sx, sy + 1, 3, 1); c.fillRect(sx + 1, sy + 2, 1, 1); break; }
      case 'gear': if (i < 7) { const gx = r1 * W, gy = r2 * H, rr = 14 + r3 * 22, a0 = T * (i % 2 ? .4 : -.4); c.globalAlpha = .12; c.strokeStyle = '#88aaff'; c.lineWidth = 2; c.beginPath(); c.arc(gx, gy, rr, 0, 6.283); c.stroke();
        for (let tt = 0; tt < 10; tt++) { const a = a0 + tt / 10 * 6.283; c.fillStyle = '#88aaff'; c.fillRect(gx + Math.cos(a) * (rr + 3) - 2, gy + Math.sin(a) * (rr + 3) - 2, 4, 4); } } break;
    } }
  c.globalAlpha = 1;
}
// дерево узлов: на каждую ступень — ядро (A, B, развилка X/Y, сигнатурные S, T) + две боковые ветви по 5 малых узлов
const MTY = ['mn_dmg', 'mn_hp', 'mn_aps', 'mn_crit', 'mn_ult', 'mn_cq', 'mn_dmg', 'mn_hp', 'mn_crit', 'mn_cq'];
const MNAME = { mn_dmg: 'Мощь', mn_hp: 'Живучесть', mn_aps: 'Быстрота', mn_crit: 'Точность', mn_ult: 'Сила ульты', mn_cq: 'Мастерство' };
const MPOS = [[.2, 96], [.09, 160], [.08, 232], [.14, 300], [.25, 352]];
const pathLayC = {};
function pathLayout(W) {
  const key = Math.round(W); if (pathLayC[key]) return pathLayC[key];
  const out = [], links = [], base = t => PTH - 70 - (t - 1) * PBAND, N = (t, id, fx, dy) => { const n = { kind: 'node', t, id, x: W * fx, y: base(t) - dy }; out.push(n); return n; }, by = (t, id) => out.find(n => n.t === t && n.id === id);
  const root = t => ({ x: W / 2, y: base(t) });
  for (let t = 1; t <= 3; t++) {
    const A = N(t, 'A', .36, 58), B = N(t, 'B', .64, 58), X = N(t, 'X', .38, 146), Y = N(t, 'Y', .62, 146), S0 = N(t, 'S', .5, 222), T0 = N(t, 'T', .5, 300);
    links.push([root(t), A], [root(t), B], [A, X], [B, Y], [X, S0], [Y, S0], [S0, T0]);
    let pl = A, pr = B; MPOS.forEach(([fx, dy], i) => { const l = N(t, 'M' + i, fx, dy), r = N(t, 'M' + (i + 5), 1 - fx, dy); links.push([pl, l], [pr, r]); pl = l; pr = r; });
    links.push([T0, root(t + 1)]);
  }
  const N4 = { A: [.26, 64], B: [.5, 70], C: [.74, 64], X: [.3, 130], Y: [.44, 140], D: [.7, 134], T: [.58, 196], E: [.34, 206], F: [.7, 214], S: [.5, 262], Z: [.38, 300], W: [.62, 300], V: [.5, 350] };
  for (const id in N4) N(4, id, N4[id][0], N4[id][1]);
  const Q = id => by(4, id), r4 = root(4);
  links.push([r4, Q('A')], [r4, Q('B')], [r4, Q('C')], [Q('A'), Q('X')], [Q('B'), Q('Y')], [Q('C'), Q('D')], [Q('X'), Q('E')], [Q('Y'), Q('E')], [Q('D'), Q('F')], [Q('Y'), Q('T')], [Q('E'), Q('S')], [Q('F'), Q('S')], [Q('S'), Q('Z')], [Q('S'), Q('W')], [Q('Z'), Q('V')], [Q('W'), Q('V')]);
  { let pl = Q('A'), pr = Q('C'); MPOS.forEach(([fx, dy], i) => { const l = N(4, 'M' + i, fx * .9, dy), r = N(4, 'M' + (i + 5), 1 - fx * .9, dy); links.push([pl, l], [pr, r]); pl = l; pr = r; }); }
  out.links = links; out.bands = [base(2), base(3), base(4)]; out.bottom = base(1); out.top = base(4) - 380; return pathLayC[key] = out;
}
function pathTierY(W, f) { const L = pathLayout(W); return f <= 1 ? L.bottom : f >= 4 ? L.top : L.bands[f - 2]; }
function drawPath() {
  const cv = $('ptc'); if (!cv || $('ctree').hidden) { pRaf = 0; return; }
  const k = ctK, C = CLASSES[k], W = cv.clientWidth, dpr = Math.min(3, devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(PTH * dpr); }
  const c = cv.getContext('2d'), T = performance.now() / 1000; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false;
  pathAtmo(c, W, PTH, T, k);
  const L = pathLayout(W), on = p => p.id ? pL(k, p.t, p.id) > 0 : true, prog = Math.min(1, pSpent(k) / pTotal()), yP = L.bottom + 40 - (L.bottom + 40 - L.top) * prog;
  pathAttr(c, W, PTH, T, k);
  // сияние, поднимающееся снизу вверх по мере вложений
  { const gl = c.createLinearGradient(0, yP - 120, 0, PTH); gl.addColorStop(0, C.c + '00'); gl.addColorStop(.25, C.c + '22'); gl.addColorStop(1, C.c + '44'); c.globalAlpha = .7 + .15 * Math.sin(T * 1.6); c.fillStyle = gl; c.fillRect(0, yP - 120, W, PTH - yP + 120); c.globalAlpha = 1; }
  if (prog > 0 && prog < 1) { c.fillStyle = '#ffffff'; for (let x = 0; x < W; x += 5) { c.globalAlpha = .35 + .35 * Math.sin(x * .3 + T * 6); c.fillRect(x, Math.round(yP + Math.sin(x * .05 + T * 3) * 2), 3, 1); } c.globalAlpha = 1; }
  // портрет героя в рамке: текущий облик
  { const f = formOf(k), pat = heroPortrait(k, f), cx = W / 2, cy = 120, fw = 176, sc = Math.floor(130 / Math.max(pat.height, pat.width)), bob = Math.round(Math.sin(T * 2) * 3);
    const gr = c.createRadialGradient(cx, cy, 10, cx, cy, 120); gr.addColorStop(0, C.c + '66'); gr.addColorStop(1, C.c + '00'); c.fillStyle = gr; c.fillRect(cx - 130, cy - 130, 260, 260);
    c.fillStyle = '#07040f'; c.fillRect(cx - fw / 2, cy - fw / 2, fw, fw);
    const bg = c.createRadialGradient(cx, cy + 20, 4, cx, cy, fw * .7); bg.addColorStop(0, shade(C.c, -.35)); bg.addColorStop(1, '#07040f'); c.fillStyle = bg; c.fillRect(cx - fw / 2 + 6, cy - fw / 2 + 6, fw - 12, fw - 12);
    for (let i = 0; i < 12; i++) { const a = T * .5 + i / 12 * 6.283, rr = 58 + Math.sin(T * 2 + i) * 4; c.globalAlpha = .5; c.fillStyle = i % 3 ? C.c : '#ffffff'; c.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + 6 + Math.sin(a) * rr * .4), 2, 2); } c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(cx, cy + 62, 46, 8, 0, 0, 6.283); c.fill();
    const spr = pat; c.drawImage(spr, Math.round(cx - pat.width * sc / 2), Math.round(cy + 62 - pat.height * sc + bob), pat.width * sc, pat.height * sc);
    c.strokeStyle = '#ffd84a'; c.lineWidth = 4; c.strokeRect(cx - fw / 2, cy - fw / 2, fw, fw); c.strokeStyle = '#5a3a10'; c.lineWidth = 2; c.strokeRect(cx - fw / 2 + 5, cy - fw / 2 + 5, fw - 10, fw - 10);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.fillStyle = '#ffd84a'; c.fillRect(cx + dx * fw / 2 - 7, cy + dy * fw / 2 - 7, 14, 14); c.fillStyle = C.c; c.fillRect(cx + dx * fw / 2 - 3, cy + dy * fw / 2 - 3, 6, 6); }
    c.font = '9px "Press Start 2P", monospace'; c.textAlign = 'center'; const nm = evoName(k, f).toUpperCase(), tw = c.measureText(nm).width + 24; c.fillStyle = '#0a0614'; c.fillRect(cx - tw / 2, cy + fw / 2 + 4, tw, 20); c.strokeStyle = C.c; c.lineWidth = 2; c.strokeRect(cx - tw / 2, cy + fw / 2 + 4, tw, 20);
    c.fillStyle = C.c; c.fillText(nm, cx, cy + fw / 2 + 18); c.font = '7px "Press Start 2P", monospace'; c.fillStyle = '#a59fc0'; c.fillText('мастерство ' + cm(k).lv + ' · облик ' + ['', 'I', 'II', 'III', 'IV'][f], cx, cy + fw / 2 + 38); }
  // затемнение под узлами, чтобы дерево читалось поверх рисунка
  c.fillStyle = 'rgba(4,2,10,.28)'; c.fillRect(0, 0, W, PTH);
  // связи
  for (const [a, b] of L.links) { const both = on(a) && on(b), op = !b.t || tierOpen(k, b.t);
    if (both) { c.globalAlpha = .35; c.strokeStyle = C.c; c.lineWidth = 9; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.globalAlpha = 1; c.lineWidth = 3; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      const f = (T * .6 + a.x * .013 + a.y * .007) % 1; c.fillStyle = '#fff'; c.fillRect(a.x + (b.x - a.x) * f - 1.5, a.y + (b.y - a.y) * f - 1.5, 3, 3); }
    else { c.strokeStyle = op ? shade(C.c, -.4) : '#2a2440'; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]); } }
  // полосы ступеней
  const plat = (y, f, got, cur, awk) => { const pat = heroPortrait(k, f), sc = 1, x = W / 2, bob = cur ? Math.round(Math.sin(T * 2) * 2) : 0;
    if (got) { const gr = c.createRadialGradient(x, y - 24, 4, x, y - 24, 70); gr.addColorStop(0, (awk ? '#ffffff' : C.c) + '55'); gr.addColorStop(1, C.c + '00'); c.fillStyle = gr; c.fillRect(x - 70, y - 94, 140, 140); }
    c.fillStyle = got ? shade(C.c, -.45) : '#16122a'; c.beginPath(); c.ellipse(x, y, 34, 7, 0, 0, 6.283); c.fill(); c.strokeStyle = got ? C.c : '#3a3260'; c.lineWidth = 2; c.stroke();
    const spr = (got ? pat : sil32(pat, '#2a2440'));
    if (awk && got) { c.globalAlpha = .5 + .3 * Math.sin(T * 4); const sl = sil32(pat, C.c); for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2]]) c.drawImage(sl, Math.round(x - pat.width * sc / 2) + dx, Math.round(y + 2 - pat.height * sc + bob) + dy, pat.width * sc, pat.height * sc); c.globalAlpha = 1; }
    c.drawImage(spr, Math.round(x - pat.width * sc / 2), Math.round(y + 2 - pat.height * sc + bob), pat.width * sc, pat.height * sc); };
  { const fN = formOf(k); plat(L.bottom, 1, true, fN === 1); plat(L.bands[0], 2, tierDone(k, 1), fN === 2); plat(L.bands[1], 3, tierDone(k, 2), fN === 3); plat(L.bands[2], 3, tierDone(k, 3), false, true); if (S.meta.asc) plat(L.top, 4, tierDone(k, 4), fN === 4); }
  const band = (y, f, txt, got, cur) => { c.globalAlpha = got ? .9 : .5; c.fillStyle = got ? C.c : '#3a3260'; for (let x = 4; x < W - 4; x += 8) c.fillRect(x, Math.round(y), 4, 1); c.globalAlpha = 1;
    c.font = '7px "Press Start 2P", monospace'; c.textAlign = 'center'; const tw = c.measureText(txt).width + 20, bx = W / 2;
    c.fillStyle = '#0a0614'; c.fillRect(bx - tw / 2, y + 8, tw, 22); c.strokeStyle = got ? C.c : '#3a3260'; c.lineWidth = 2; c.strokeRect(bx - tw / 2, y + 8, tw, 22);
    c.fillStyle = got ? (cur ? '#ffffff' : C.c) : '#6a6290'; c.fillText((cur ? '► ' : '') + txt, bx, y + 22); };
  const fNow = formOf(k);
  band(L.bottom, 1, 'I · ' + evoName(k, 1), true, fNow === 1);
  band(L.bands[0], 2, 'II · ' + evoName(k, 2), tierDone(k, 1), fNow === 2);
  band(L.bands[1], 3, 'III · ' + evoName(k, 3), tierDone(k, 2), fNow === 3);
  band(L.bands[2], 0, 'ПРОБУЖДЕНИЕ «' + AWK[k][0] + '»', tierDone(k, 3), false);
  band(L.top, 4, S.meta.asc ? 'IV · ' + evoName(k, 4) : 'IV · после Вознесения', tierDone(k, 4), fNow === 4);
  if (!S.meta.asc) { c.globalAlpha = .32; c.fillStyle = '#05030c'; c.fillRect(0, L.top + 34, W, L.bands[2] - L.top - 34); c.globalAlpha = 1; c.font = '7px "Press Start 2P", monospace'; c.fillStyle = '#7ad8ff'; c.textAlign = 'center'; c.fillText('4-я ступень откроется после Вознесения', W / 2, (L.top + L.bands[2]) / 2); }
  // узлы
  for (const p of L) {
    const [nm, ty] = pNode(k, p.t, p.id), lv = pL(k, p.t, p.id), op = tierOpen(k, p.t), can = pCanBuy(k, p.t, p.id), blk = !!FORK[p.id] && pL(k, p.t, FORK[p.id]) > 0, sig = p.id === 'S' || p.id === 'T', mn = p.id[0] === 'M', r = p.id === 'V' ? 18 : mn ? 10 : 14;
    if (lv) { const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.6); gr.addColorStop(0, C.c + '99'); gr.addColorStop(1, C.c + '00'); c.fillStyle = gr; c.fillRect(p.x - r * 2.6, p.y - r * 2.6, r * 5.2, r * 5.2); }
    if (can) { c.globalAlpha = .55 + .45 * Math.sin(T * 3); c.strokeStyle = '#5cff8a'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r + 5, 0, 6.283); c.stroke(); c.globalAlpha = 1; }
    c.beginPath();
    if (p.id === 'V') { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 - 1.57, rr = i % 2 ? r * .55 : r * 1.1; c.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); } c.closePath(); }
    else if (FORK[p.id]) { for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; c.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); } c.closePath(); }
    else if (sig) { c.moveTo(p.x, p.y - r - 3); c.lineTo(p.x + r + 3, p.y); c.lineTo(p.x, p.y + r + 3); c.lineTo(p.x - r - 3, p.y); c.closePath(); }
    else c.arc(p.x, p.y, r, 0, 6.283);
    c.fillStyle = lv ? C.c : op ? '#1a1430' : '#0e0a18'; c.fill(); c.strokeStyle = lv ? '#ffffff' : sig && op ? '#ffe08a' : op ? shade(C.c, -.1) : '#2a2440'; c.lineWidth = 2; c.stroke();
    const ic = ICONS[PICON[ty] || 'star'], ps = mn ? 2 : 3; c.fillStyle = lv ? 'rgba(0,0,0,.75)' : op ? (sig ? '#ffe08a' : C.c) : '#3a3260'; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (ic[j][i] === '#') c.fillRect(p.x - ps * 2.5 + i * ps, p.y - ps * 2.5 + j * ps, ps, ps);
    for (let i = 0; i < pMax(p.t, p.id); i++) { c.fillStyle = i < lv ? '#ffe08a' : '#2a2440'; c.fillRect(p.x - pMax(p.t, p.id) * 3 + i * 6 + 1, p.y + r + 3, 4, 3); }
    if ((pSel && pSel.t === p.t && pSel.id === p.id) || (can && !lv && !mn)) { c.font = '6px "Press Start 2P", monospace'; c.textAlign = 'center'; const tw = c.measureText(nm).width; c.fillStyle = 'rgba(5,3,12,.8)'; c.fillRect(p.x - tw / 2 - 2, p.y + r + 8, tw + 4, 9); c.fillStyle = lv ? '#fff' : '#cfc8ef'; c.fillText(nm, p.x, p.y + r + 15); }
    if (blk) { c.strokeStyle = '#ff4f6d'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x - 8, p.y - 8); c.lineTo(p.x + 8, p.y + 8); c.moveTo(p.x + 8, p.y - 8); c.lineTo(p.x - 8, p.y + 8); c.stroke(); }
    if (pSel && pSel.t === p.t && pSel.id === p.id) { c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.setLineDash([4, 3]); c.lineDashOffset = T * 12; c.beginPath(); c.arc(p.x, p.y, r + 9, 0, 6.283); c.stroke(); c.setLineDash([]); }
    if (p.id === 'X' && op) { const y2 = L.find(q => q.t === p.t && q.id === 'Y'); c.font = '6px "Press Start 2P", monospace'; c.textAlign = 'center'; c.fillStyle = '#f2c94c'; c.fillText('ИЛИ', (p.x + y2.x) / 2, p.y + 3); }
  }
  pRaf = requestAnimationFrame(drawPath);
}
function renderPInfo() {
  const k = ctK, C = CLASSES[k], el = $('pinfo'); if (!el) return;
  if (!pSel) { el.innerHTML = `<span class="k">Тапни узел. Заполни ступень (оба круглых узла и одну ветку развилки на 3/3) — герой эволюционирует. Ромбы — сигнатурные узлы класса: по желанию, но сильно качают его фишки.</span>`; return; }
  const { t, id } = pSel, [nm, ty, p] = pNode(k, t, id), lv = pL(k, t, id), can = pCanBuy(k, t, id), mx = pMax(t, id), m2 = t === 4 ? 2 : 1;
  const other = FORK[id] || null, op = tierOpen(k, t), DS = (L2) => ty === 'cap4' ? CAP4[k][1] : PFX[ty](L2 * m2, p);
  el.innerHTML = `<h3 style="color:${C.c}">${nm}${other ? ' <span style="color:#f2c94c">⇄ ВЫБОР</span>' : ''}</h3><span class="k">Ступень ${t}${t === 4 ? ' (звёздная, вдвое сильнее)' : ''} · ур. ${lv}/${mx}</span><br>` +
    `<span class="k">Сейчас:</span> ${lv ? DS(lv) : '—'}<br>` + (lv < mx ? `<span class="k">След.:</span> ${DS(lv + 1)}<br>` : '') +
    (other ? `<span class="k">или «${pNode(k, t, other)[0]}» — ${PFX[pNode(k, t, other)[1]](m2, pNode(k, t, other)[2])}</span><br>` : '') +
    (!op ? `<span style="color:#ff6b6b">${t === 4 && !S.meta.asc ? 'Откроется после первого Вознесения' : 'Сначала заверши ступень ' + (t - 1)}</span>` : '') + (t === 4 && id === 'V' && !can && op && lv < 1 ? '<span style="color:#ff6b6b">Сначала прокачай остальные узлы ступени на 3/3</span>' : '') +
    `<div class="row2"><button class="btn" id="pb1"${can ? '' : ' disabled'}>+1 · очко (${pPts(k)})</button>` + (other && lv && startOfLife() ? '<button class="btn" id="pbr" style="background:#5a3a2a">СБРОС</button>' : '') + '</div>';
  if ($('pb1')) $('pb1').onclick = () => pBuy(k, t, id);
  if ($('pbr')) $('pbr').onclick = () => { cm(k).cp[t + id] = 0; D.dirty = true; calcPath(); recalc(); save(); renderCT(); };
}
function pBuy(k, t, id, quiet) {   // quiet — из автоматики: без звука, пересчёта и сохранения на каждый узел
  if (!pCanBuy(k, t, id)) return;
  const f0 = formOf(k), a0 = tierDone(k, 3), c = cm(k); if (!c.cp) c.cp = {};
  c.cp[t + id] = (c.cp[t + id] || 0) + 1;
  if (!quiet) { calcPath(); D.dirty = true; recalc(); save(); tone(660, .06, 'square', .03); tone(990, .08, 'square', .03, 0, .06); }
  const f1 = formOf(k), a1 = tierDone(k, 3);
  if ((f1 > f0 || (a1 && !a0)) && k === cls()) { $('ctree').hidden = true; navOn('nFight'); setTimeout(() => evolveStart(k, f1, a1 && !a0 ? 'ПРОБУЖДЕНИЕ' : f1 === 4 ? 'ВОЗНЕСЁННЫЙ ОБЛИК' : null), 250); return; }
  if (f1 > f0) toast('ЭВОЛЮЦИЯ: ' + evoName(k, f1).toUpperCase(), 'новый облик появится, когда выпадет ' + CLASSES[k].n, 3000);
  if (ctK && !$('ctree').hidden) renderCT();
}

