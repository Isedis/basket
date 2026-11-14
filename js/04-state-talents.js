'use strict';
/* ---------- состояние ---------- */
const SAVE_KEY = 'inf_brawl_save_v1';
const freshS = () => ({ open: {}, form: [], syn: [], kills: 0, zone: 1, zk: 0, pressure: .3, kps: .3, hpf: 1, mute: false, vals: [], cst: [0, 0], t: Date.now(), panelSmall: false,
  meta: { souls: 0, total: 0, rebirths: 0, best: 1, nodes: {}, gear: freshGear() } });
function freshGear() { return { eq: {}, inv: [], dust: 0, chests: { c: 0, r: 0, e: 0, w: 0 }, pity: 0, nid: 1 }; }
let S = freshS();

/* ---------- дерево талантов (вечные бонусы за души) ---------- */
const TK = {
  hit: ['Острая сталь', .12, v => '+' + pct(v) + ' урона'],
  hp: ['Крепость тела', .12, v => '+' + pct(v) + ' здоровья'],
  gain: ['Жадность', .1, v => '+' + pct(v) + ' прироста статов'],
  tap: ['Божья длань', .25, v => '+' + pct(v) + ' урона тапа'],
  weak: ['Глаз охотника', .25, v => '+' + pct(v) + ' урона по слабому месту'],
  ultc: ['Накопитель', .1, v => '+' + pct(v) + ' заряда ульты'],
  ultd: ['Гнев небес', .25, v => '+' + pct(v) + ' урона ульты'],
  combo_t: ['Выдержка', .25, v => '+' + v.toFixed(2) + 'с к таймеру комбо'],
  combo_m: ['Кураж', .1, v => '+' + pct(v) + ' к силе комбо'],
  boss_t: ['Упорство', 2, v => '+' + v.toFixed(0) + 'с на бой с вожаком'],
  bossdmg: ['Убийца вожаков', .15, v => '+' + pct(v) + ' урона по вожакам'],
  elite: ['Охотник на элиту', .15, v => '+' + pct(v) + ' урона и наград за особых врагов'],
  rare: ['Золотая лихорадка', .004, v => '+' + pct(Math.min(.15, v)) + ' шанса золотых врагов'],
  offline: ['Сон воина', .1, v => 'офлайн: эффективность ' + pct(.5 + .5 * sat(v, 1)) + ', лимит ' + offCapH(v).toFixed(1) + 'ч'],
  unlock: ['Любопытство', .08, v => 'новые статы открываются в ' + (1 + v).toFixed(2) + ' раза быстрее'],
  evo: ['Перерост', .15, v => 'эволюция наступает в ' + (1 + v).toFixed(2) + ' раза раньше'],
  form: ['Мастерство форм', .1, v => '+' + pct(v) + ' к прогрессу форм'],
  soul: ['Жатва душ', .1, v => '+' + pct(v) + ' душ за перерождение'],
  legacy: ['Память жизней', .5, v => '+' + pct(v) + ' прироста, пока зона ниже половины рекорда'],
  crowd: ['Зов битвы', .5, v => '+' + Math.floor(v) + ' врагов на поле'],
  spawn: ['Нетерпение', .08, v => 'враги появляются быстрее на ' + pct(v)],
  // условные узлы
  c_combo: ['Кураж резни', .5, v => '+' + pct(v) + ' урона, пока комбо ≥ 100'],
  c_full: ['Свежие силы', .3, v => '+' + pct(v) + ' урона при полном HP'],
  c_lowhp: ['Отчаяние', .4, v => 'ульта заряжается на ' + pct(v) + ' быстрее при HP < 50%'],
  c_boss: ['Первый удар', .5, v => '+' + pct(v) + ' урона в первые 10с боя с вожаком'],
  c_legend: ['Легендарный трофей', .5, v => '+' + pct(v) + ' наград в легендарных зонах'],
  c_crowd: ['В гуще боя', .3, v => '+' + pct(v) + ' наград, когда врагов ≥ 15'],
  c_rare: ['Золотоискатель', 1, v => '+' + pct(v) + ' наград за золотых врагов'],
  // узлы-выбор с ценой
  x_glass: ['Стеклянная пушка', .6, v => '+' + pct(v) + ' урона, но −50% здоровья'],
  x_exec: ['Палач', .5, v => '+' + pct(v) + ' силы крита, но −30% шанса крита'],
  x_tank: ['Танк', .6, v => '+' + pct(v) + ' здоровья, но −25% скорости атаки'],
  x_regen: ['Шкура тролля', .6, v => '+' + pct(v) + ' регенерации, но вампиризм отключён'],
  x_elem: ['Стихийник', .4, v => '+' + pct(v) + ' урона огня и яда, но −30% урона удара'],
  x_focus: ['Фокус', .5, v => '+' + pct(v) + ' урона по цели, но рассечение отключено'],
  x_haste: ['Спешка', .3, v => '+' + pct(v) + ' скорости атаки, но −20% урона'],
  x_swarm: ['Рой', 3, v => '+' + Math.floor(v) + ' врагов на поле, но они бьют на 20% сильнее'],
  x_greed: ['Жадность дракона', .5, v => '+' + pct(v) + ' наград, но враги на 30% крепче'],
  x_gamble: ['Азарт', .5, v => 'золотые враги втрое чаще и +' + pct(v) + ' наград за них, но обычные награды −20%'],
  x_tapper: ['Кулак бога', 1, v => '+' + pct(v) + ' урона тапа, но −30% урона героя'],
  x_ultra: ['Сверхульта', 1, v => '+' + pct(v) + ' урона ульты, но заряд вдвое медленнее'],
  x_scholar: ['Книжник', .5, v => 'статы открываются в ' + (1 + v).toFixed(1) + ' раза быстрее, но прирост −20%'],
  x_reaper: ['Жнец', .5, v => '+' + pct(v) + ' душ, но прирост −20%'],
};
EFF.forEach(e => TK['e_' + e.k] = [e.n, .15, v => '+' + pct(v) + ' к эффекту «' + e.n + '»']);
const ksEvery = L => Math.max(30, 110 - 10 * L), fireEvery = L => Math.max(.8, 3 - .4 * L);
// ключевые узлы: уникальные механики
const KS = [
  [['Мясник', L => 'шанс ' + pct(.02 * L) + ': убитый враг взрывается (×' + 3 * L + ' урона вокруг)'], ['Бог резни', L => 'каждые ' + ksEvery(L) + ' убийств — бесплатная ульта']],
  [['Несокрушимый', L => 'при HP < 30%: полное лечение и щит ' + pct(.2 * L) + ' (раз в 30с)'], ['Осада', L => pct(Math.min(1, .2 * L)) + ' урона по вожаку сохраняется между попытками']],
  [['Повелитель огня', L => 'огненная волна вокруг героя каждые ' + fireEvery(L).toFixed(1) + 'с'], ['Владыка бурь', L => 'молния бьёт случайного врага ' + L + ' раз в секунду']],
  [['Вихрь', L => 'каждый 3-й удар — вихрь (' + pct(.5 * L) + ' урона всем вокруг)'], ['Сама скорость', L => 'при комбо ≥ 50: +' + pct(.3 * L) + ' скорости атаки и бега']],
  [['Счастливая звезда', L => 'шанс ' + pct(.005 * L) + ' на сундук: награды как за 30 убийств'], ['Любимец богов', L => 'после золотого врага с шансом ' + pct(Math.min(1, .2 * L)) + ' следующие 5 тоже золотые']],
  [['Перст судьбы', L => 'слабые места у элиты (2+ особенности), урон по ним +' + pct(L)], ['Длань творца', L => 'каждый тап бьёт всех врагов на экране (' + pct(.2 * L) + ' урона)']],
  [['Мудрец', L => 'новый стат сразу получает прирост ×' + 10 * L], ['Всезнание', L => '+' + L + ' к уровню всех форм']],
  [['Пожиратель душ', L => 'вожаки после 30-й зоны дают ×' + (1 + L) + ' душ'], ['Бессмертная душа', L => 'после перерождения часть статов остаётся (' + pct(Math.min(.3, .03 * L)) + ', быстрый старт)']],
];
KS.forEach((pr, bi) => pr.forEach(([n, d], j) => TK['ks' + bi + '_' + j] = [n, 1, d]));
/* ---------- особые узлы дерева: механики, которые видно в бою (по 3 в ветке) ---------- */
const NOTABLE = [
  [['Кровавый счёт', 'Кровь', L => 'каждый 10-й удар бьёт ×' + (2 + L)], ['Гнев палача', 'Кровь', L => 'крит добивает раненого врага (<30% HP) с шансом ' + 4 * L + '%'], ['Тень берсерка', 'Тьма', L => 'при комбо 50+ тень повторяет удары на ' + 15 * L + '%']],
  [['Отдача', 'Сталь', L => 'при ударе по герою шанс ' + 5 * L + '% на ударную волну ×1.5'], ['Каменная кожа', 'Сталь', L => 'каждые 10с каменный щит ' + 4 * L + '% HP'], ['Второе сердце', 'Кровь', L => 'при HP ниже 50% регенерация +' + L + '% HP/с']],
  [['Огненный шлейф', 'Пламя', L => 'герой оставляет огонь: ' + pct(.2 * L) + ' удара/с'], ['Шаровая молния', 'Гроза', L => 'шар вокруг героя бьёт врагов раз в секунду на ' + pct(.5 * L) + ' удара'], ['Ледяная звезда', 'Ветер', L => 'каждые 8с ледяная звезда замораживает врагов рядом на ' + (.5 * L).toFixed(1) + 'с']],
  [['Двойной удар', 'Ветер', L => 'шанс ' + 4 * L + '% повторить атаку сразу'], ['Рывок', 'Ветер', L => 'каждые 6с рывок сквозь врагов (×' + L + ' удара каждому)'], ['Ураган', 'Ветер', L => 'при комбо 100+ скорость атаки +' + 5 * L + '%']],
  [['Золотой дождь', 'Золото', L => 'золотой враг рассыпает монеты: награда ×' + 3 * L], ['Мимик', 'Золото', L => 'шанс ' + (.2 * L).toFixed(1) + '% на сундук с каждого врага'], ['Счастливый крит', 'Золото', L => 'шанс ' + 3 * L + '% что крит станет ультра-критом (×5)']],
  [['Божья кара', 'Свет', L => 'каждые 5с молния с неба в самого крепкого врага (×' + 2 * L + ')'], ['Святой щит', 'Свет', L => 'ульта даёт щит ' + 10 * L + '% HP'], ['Небесный суд', 'Свет', L => 'урон по вожакам +' + 10 * L + '%']],
  [['Поток знаний', 'Свет', L => 'каждый новый стат даёт всплеск наград ×' + L], ['Озарение', 'Золото', L => 'каждые 30с всплеск наград ×' + 5 * L], ['Мудрость предков', 'Свет', L => 'эволюция статов на ' + 8 * L + '% раньше']],
  [['Жнец душ', 'Тьма', L => 'шанс ' + L + '% что убитый оставит взрывную душу (×2 удара)'], ['Призрачный страж', 'Тьма', L => Math.ceil(L / 2) + ' призрачных стража бьются рядом'], ['Вечная душа', 'Тьма', L => '+' + 5 * L + '% душ забега']],
];
NOTABLE.forEach((br, bi) => br.forEach(([n, tag, d], j) => TK['n' + bi + '_' + j] = [n, 1, d, tag]));
// новые развилки: по 2 на ветку, выбор стиля ветки (сильный буст одного эффекта)
const PAIRS2 = [[['crit', 'rage'], ['scrit', 'exec']], [['thorns', 'vamp'], ['barrier', 'leech']], [['fire', 'shock'], ['poison', 'frost']], [['aspd', 'blink'], ['trail', 'echo']],
  [['luck', 'greed'], ['dust', 'hunt']], [['energy', 'mark'], ['orbs', 'quake']], [['wis', 'curio'], ['spirit', 'grav']], [['bleed', 'det'], ['fear', 'horde']]];
for (const e of EFF) { const k = 'p_' + e.k; TK[k] = ['Путь: ' + e.n, .5, v => '«' + e.n + '» +' + pct(v)]; }
// темы и наборы
const TAGS = { 'Пламя': '#ff7a30', 'Гроза': '#7ad8ff', 'Кровь': '#ff3355', 'Сталь': '#b8c4d8', 'Золото': '#ffd84a', 'Ветер': '#8affc8', 'Тьма': '#b06aff', 'Свет': '#fff2a0' };
const TAG_OF = { e_fire: 'Пламя', e_det: 'Пламя', e_orbs: 'Пламя', e_shock: 'Гроза', e_echo: 'Гроза', e_spirit: 'Гроза', e_range: 'Гроза',
  e_vamp: 'Кровь', e_bleed: 'Кровь', e_leech: 'Кровь', e_fury: 'Кровь', e_rage: 'Кровь', hit: 'Кровь', e_dmg: 'Кровь', e_critd: 'Кровь', e_crit: 'Кровь', e_power: 'Кровь', e_exec: 'Кровь', e_scrit: 'Кровь',
  hp: 'Сталь', e_armor: 'Сталь', e_thorns: 'Сталь', e_barrier: 'Сталь', e_dodge: 'Сталь', e_regen: 'Сталь', e_cleave: 'Сталь',
  e_luck: 'Золото', rare: 'Золото', elite: 'Золото', gain: 'Золото', e_greed: 'Золото', e_dust: 'Золото', e_hunt: 'Золото',
  e_aspd: 'Ветер', e_move: 'Ветер', combo_t: 'Ветер', combo_m: 'Ветер', e_blink: 'Ветер', e_trail: 'Ветер', crowd: 'Ветер', spawn: 'Ветер', e_frost: 'Ветер',
  soul: 'Тьма', legacy: 'Тьма', e_fear: 'Тьма', e_horde: 'Тьма', e_grav: 'Тьма', e_poison: 'Тьма', offline: 'Тьма',
  tap: 'Свет', ultc: 'Свет', ultd: 'Свет', weak: 'Свет', e_energy: 'Свет', e_mark: 'Свет', boss_t: 'Свет', bossdmg: 'Свет', e_wis: 'Свет', unlock: 'Свет', evo: 'Свет', form: 'Свет', e_curio: 'Свет', e_quake: 'Свет' };
const SET_FX = {
  'Пламя': ['огонь сильнее', 'каждый 5-й удар — огненная вспышка', 'вспышка ×2 и шире'], 'Гроза': ['молнии сильнее', 'каждые 2с цепная молния по 3 врагам', 'по 6 врагам ×2'],
  'Кровь': ['урон и криты сильнее', 'убийства лечат 0.5% HP', 'лечат 1.5% HP'], 'Сталь': ['защита сильнее', 'каждые 8с щит 10% HP', 'щит 25% HP'],
  'Золото': ['удача сильнее', 'шанс 3% на россыпь наград за убийство', 'шанс 6%'], 'Ветер': ['скорость сильнее', '+10% скорости атаки и бега', '+25%'],
  'Тьма': ['тьма сильнее', 'каждые 4с тёмный импульс вокруг героя', 'импульс ×2'], 'Свет': ['свет сильнее', 'ульта копится на 20% быстрее', 'на 50%, луч света каждые 5с'],
};
const SET_EFF = { 'Пламя': ['fire', 'det', 'orbs'], 'Гроза': ['shock', 'echo', 'spirit'], 'Кровь': ['dmg', 'critd', 'vamp', 'bleed'], 'Сталь': ['armor', 'hp', 'thorns', 'barrier'],
  'Золото': ['luck', 'greed', 'dust'], 'Ветер': ['aspd', 'move', 'blink'], 'Тьма': ['fear', 'grav', 'poison'], 'Свет': ['energy', 'mark', 'wis'] };
const tagOf = nd => nd.tag || TAG_OF[nd.k] || (nd.k.startsWith('p_') ? TAG_OF['e_' + nd.k.slice(2)] : null);
let NTL = [], TSET = {};
const ntL = (bi, j) => (NTL[bi] && NTL[bi][j]) || 0;
let TAGTOT = null;   // сколько всего узлов у темы (развилка считается за один)
const setNeed = (tag, i) => { if (!TAGTOT) { TAGTOT = {}; for (const nd of TN) { if (nd.alt != null && nd.alt < nd.id) continue; const t = tagOf(nd); if (t) TAGTOT[t] = (TAGTOT[t] || 0) + 1; } } return Math.max(2, Math.round((TAGTOT[tag] || 4) * [.25, .5, .85][i])); };
const setT = tag => { const n = TSET[tag] || 0; return n >= setNeed(tag, 2) ? 3 : n >= setNeed(tag, 1) ? 2 : n >= setNeed(tag, 0) ? 1 : 0; };
function calcSets() {
  NTL = BRANCHES.map(() => [0, 0, 0]); TSET = {};
  for (const nd of TN) { const l = TL(nd.id); if (nd.nt) NTL[nd.br][nd.ntj] = Math.min(5, l); if (l > 0) { const t = tagOf(nd); if (t) TSET[t] = (TSET[t] || 0) + 1; } }
  for (const t in TAGS) { const tier = setT(t); if (tier) for (const e of SET_EFF[t]) TAL['e_' + e] = (TAL['e_' + e] || 0) + .25 * tier; }
}
// механики особых узлов и наборов
let hitCnt = 0;
function ntHit(t, dmg, crit) {
  hitCnt++;
  const a = ntL(0, 0); if (a && hitCnt % 10 === 0 && !t.dead) { hitMob(t, dmg * (1 + a), true, true, '#ff3355'); fxLabel('Кровавый счёт', t.x, t.y - 16, '#ff3355'); burst(t.x, t.y - 4, '#ff3355', 10, 40); }
  const b = ntL(0, 1); if (b && crit && !t.dead && !t.boss && t.hp < t.max * .3 && rnd() < .04 * b) { trackDmg('Казнь', t.hp); hitMob(t, t.hp + 1, true, false, '#ff3355'); fxLabel('Гнев палача', t.x, t.y - 16, '#ff3355'); }
  const c = ntL(0, 2); if (c && combo >= 50 && !t.dead) { ghosts.push({ x: hero.x - hero.face * 5, y: hero.y, l: .2, face: hero.face }); hitMob(t, dmg * .15 * c, false, false, '#b06aff'); }
  const d = ntL(3, 0); if (d && rnd() < .04 * d && !t.dead && !hero.dbl) { hero.dbl = 1; ghosts.push({ x: hero.x, y: hero.y, l: .2, face: hero.face }); heroStrike(t, true); hero.dbl = 0; }
  const f = ntL(4, 2); if (f && crit && rnd() < .03 * f && !t.dead) { hitMob(t, dmg * 4, true, true, '#ffd84a'); fxLabel('Счастливый крит', t.x, t.y - 16, '#ffd84a'); }
  const st = setT('Пламя'); if (st >= 2 && hitCnt % 5 === 0) { const r = st >= 3 ? 20 : 14; ring(t.x, t.y - 2, r, '#ff7a30'); hitAround(t.x, t.y, r, dmg * (st >= 3 ? 2 : 1), '#ff6622'); }
}
function ntHurt() {
  const a = ntL(1, 0); if (a && rnd() < .05 * a && time > (hero.otT || 0)) { hero.otT = time + .5; ring(hero.x, hero.y - 3, 18, '#b8c4d8'); hitAround(hero.x, hero.y, 18, D.hit * 1.5, '#b8c4d8'); fxLabel('Отдача', hero.x, hero.y - 18, '#b8c4d8'); }
}
function ntKill(m, base) {
  const a = ntL(4, 0); if (a && m.rare) { giveBurst(base * 3 * a); for (let i = 0; i < 10 && parts.length < 600; i++) parts.push({ x: m.x, y: m.y - 4, vx: (rnd() - .5) * 60, vy: -40 - rnd() * 40, l: .8, c: '#ffd84a' }); fxLabel('Золотой дождь', m.x, m.y - 14, '#ffd84a'); }
  const b = ntL(4, 1); if (b && rnd() < .002 * b) giveChest('c', 'мимик');
  const c = ntL(7, 0); if (c && !m.boss && rnd() < .01 * c) { const mx = m.x, my = m.y; fx1(.5, p => { ctx.globalAlpha = 1 - p * .5; dot(mx, my - 6 - p * 6, 3, '#b06aff'); pix(mx, my - 6 - p * 6, '#ffffff'); ctx.globalAlpha = 1; }, () => { ring(mx, my - 4, 14, '#b06aff'); hitAround(mx, my, 14, D.hit * 2, '#b06aff'); }); }
  const sk = setT('Кровь'); if (sk >= 2) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * (sk >= 3 ? .015 : .005));
  const sg = setT('Золото'); if (sg >= 2 && rnd() < (sg >= 3 ? .06 : .03)) { giveBurst(base * 4); burst(m.x, m.y - 4, '#ffd84a', 8, 40); }
}
function ntTick(dt) {
  const T = (k, per) => { PT[k] = (PT[k] ?? per) - dt; if (PT[k] <= 0) { PT[k] = per; return true; } return false; };
  const live2 = () => mobs.filter(m => !m.dead);
  let L;
  if ((L = ntL(1, 1)) && T('ntSkin', 10)) { hero.shield = Math.max(hero.shield, D.maxHP * .04 * L); ring(hero.x, hero.y - 4, 10, '#8a8f99'); fxLabel('Каменная кожа', hero.x, hero.y - 18, '#b8c4d8'); }
  if ((L = ntL(1, 2)) && S.hpf < .5) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .01 * L * dt);
  if ((L = ntL(2, 0)) && T('ntTrail', .4)) { if (clouds.length < 30) clouds.push({ x: hero.x, y: hero.y, r: 7, dps: D.hit * .2 * L, t: 2, fire: true }); }
  if ((L = ntL(2, 1))) { const a = time * 3, ox = hero.x + Math.cos(a) * 12, oy = hero.y - 4 + Math.sin(a) * 8; if (rnd() < .4) parts.push({ x: ox, y: oy, vx: 0, vy: 0, l: .15, c: '#7ad8ff', f: 1 });
    if (T('ntBall', 1)) { const o = nearMobs(ox, oy, 30)[0]; if (o) { bolts.push({ x1: ox, y1: oy, x2: o.x, y2: o.y - 3, l: .1, c: '#7ad8ff' }); hitMob(o, D.hit * .5 * L, false, false, '#99eeff'); } } }
  if ((L = ntL(2, 2)) && T('ntStar', 8) && mobs.length) { ring(hero.x, hero.y - 3, 24, '#a8e8ff'); for (const m of live2()) if (Math.hypot(m.x - hero.x, m.y - hero.y) < 24 && !m.boss) m.frz = Math.max(m.frz || 0, .5 * L); fxLabel('Ледяная звезда', hero.x, hero.y - 18, '#a8e8ff'); }
  if ((L = ntL(3, 1)) && T('ntDash', 6)) { const o = nearMobs(hero.x, hero.y, 50)[0]; if (o) { const x0 = hero.x, y0 = hero.y, a = Math.atan2(o.y - y0, o.x - x0), tx = clamp(o.x + Math.cos(a) * 10, 4, AW - 4), ty = clamp(o.y + Math.sin(a) * 10, 8, AH - 1);
      for (let i = 0; i < 5; i++) ghosts.push({ x: x0 + (tx - x0) * i / 5, y: y0 + (ty - y0) * i / 5, l: .3, face: hero.face }); for (const m of live2()) if (segDist(m.x, m.y, { x: x0, y: y0, x2: tx, y2: ty }) < 8) hitMob(m, D.hit * L, false, true, '#8affc8'); dashTo(tx, ty); fxLabel('Рывок', hero.x, hero.y - 18, '#8affc8'); } }
  if ((L = ntL(5, 0)) && T('ntSmite', 5)) { const o = live2().sort((a, b) => b.hp - a.hp)[0]; if (o) { bolts.push({ x1: o.x, y1: camY, x2: o.x, y2: o.y - 3, l: .2, c: '#fff2a0' }); bolts.push({ x1: o.x + 1, y1: camY, x2: o.x + 1, y2: o.y - 3, l: .15, c: '#ffffff' }); hitMob(o, D.hit * 2 * L, true, true, '#fff6c0'); fxLabel('Божья кара', o.x, o.y - 16, '#fff2a0'); } }
  if ((L = ntL(6, 1)) && T('ntInsight', 30)) { giveBurst(zs() * D.gainMult * 5 * L); feed('Озарение! Всплеск наград', '#ffd84a'); }
  if ((L = ntL(7, 1))) { const want = Math.ceil(L / 2); hero.guards = hero.guards || []; while (hero.guards.length < want) hero.guards.push({ a: hero.guards.length * 3.14, cd: 0 });
    for (const g of hero.guards) { g.cd -= dt; g.a += dt * 1.5; if (g.cd <= 0) { const gx = hero.x + Math.cos(g.a) * 14, gy = hero.y + Math.sin(g.a) * 8, o = nearMobs(gx, gy, 20)[0]; if (o) { g.cd = .8; bolts.push({ x1: gx, y1: gy - 5, x2: o.x, y2: o.y - 3, l: .08, c: '#b06aff' }); hitMob(o, D.hit * .6, false, false, '#b06aff'); } } } }
  let st;
  if ((st = setT('Гроза')) >= 2 && T('setStorm', 2)) { let from = { x: hero.x, y: hero.y }; const hs = new Set(); for (let j = 0; j < (st >= 3 ? 6 : 3); j++) { const o = nearMobs(from.x, from.y, 40).find(m => !hs.has(m)); if (!o) break; hs.add(o); bolts.push({ x1: from.x, y1: from.y - 3, x2: o.x, y2: o.y - 3, l: .1, c: '#7ad8ff' }); hitMob(o, D.hit * .8 * (st >= 3 ? 2 : 1), false, false, '#99eeff'); from = o; } }
  if ((st = setT('Сталь')) >= 2 && T('setSteel', 8)) hero.shield = Math.max(hero.shield, D.maxHP * (st >= 3 ? .25 : .1));
  if ((st = setT('Тьма')) >= 2 && T('setDark', 4) && mobs.length) { ring(hero.x, hero.y - 3, 22, '#b06aff'); hitAround(hero.x, hero.y, 22, D.hit * (st >= 3 ? 2 : 1), '#b06aff'); }
  if ((st = setT('Свет')) >= 3 && T('setLight', 5)) { const o = randMob(); if (o) { bolts.push({ x1: hero.x, y1: hero.y - 6, x2: o.x, y2: o.y - 3, l: .2, c: '#fff2a0' }); hitMob(o, D.hit * 3, true, false, '#fff6c0'); } }
}
function ntMods() {
  let L; if ((L = ntL(3, 2)) && combo >= 100) D.aps = Math.min(14, D.aps * (1 + .05 * L));
  const w = setT('Ветер'); if (w >= 2) { const k = w >= 3 ? 1.25 : 1.1; D.aps = Math.min(14, D.aps * k); D.move *= k; }
}
// ауры героя от наборов (видно, что собрано)
function drawSetAura() {
  if (S.fxLow) return;
  for (const t in TAGS) { const tier = setT(t); if (tier < 2) continue; const c = TAGS[t], n = tier === 3 ? 2 : 1;
    for (let i = 0; i < n; i++) if (rnd() < .35 && parts.length < 600) {
      const a = rnd() * 6.283, r = 5 + rnd() * 4;
      if (t === 'Пламя') parts.push({ x: hero.x + (rnd() - .5) * 8, y: hero.y - rnd() * 4, vx: 0, vy: -26, l: .45, c: rnd() < .5 ? c : '#ffcc33', f: 1 });
      else if (t === 'Гроза') parts.push({ x: hero.x + Math.cos(a) * r, y: hero.y - 4 + Math.sin(a) * r, vx: (rnd() - .5) * 60, vy: (rnd() - .5) * 60, l: .08, c: rnd() < .5 ? c : '#ffffff', f: 1 });
      else if (t === 'Кровь') parts.push({ x: hero.x + (rnd() - .5) * 8, y: hero.y - 6, vx: 0, vy: 12, l: .5, c });
      else if (t === 'Сталь') { if (rnd() < .3) parts.push({ x: hero.x + (rnd() - .5) * 8, y: hero.y - 3 - rnd() * 6, vx: 0, vy: 0, l: .2, c: '#ffffff', f: 1 }); }
      else if (t === 'Золото') parts.push({ x: hero.x + Math.cos(a) * 8, y: hero.y - 4 + Math.sin(a) * 4, vx: 0, vy: -8, l: .6, c, f: 1 });
      else if (t === 'Ветер') parts.push({ x: hero.x - hero.face * 6, y: hero.y - rnd() * 8, vx: -hero.face * 40, vy: 0, l: .25, c, f: 1 });
      else if (t === 'Тьма') parts.push({ x: hero.x + Math.cos(a) * 9, y: hero.y - 3 + Math.sin(a) * 5, vx: -Math.cos(a) * 14, vy: -Math.sin(a) * 10, l: .5, c, f: 1 });
      else if (t === 'Свет') parts.push({ x: hero.x + (rnd() - .5) * 12, y: hero.y - 10 - rnd() * 4, vx: 0, vy: -6, l: .7, c, f: 1 });
    } }
  if (hero.guards && ntL(7, 1)) for (const g of hero.guards) { const gx = hero.x + Math.cos(g.a) * 14, gy = hero.y + Math.sin(g.a) * 8; ctx.globalAlpha = .7; ctx.drawImage(sprite(MOBS[4].p, { 1: '#b06aff', 2: '#5a2a8a', 3: '#ffffff' }, 'guardG'), Math.round(gx - 4), Math.round(gy - 8)); ctx.globalAlpha = 1; }
  if (ntL(2, 1)) { const a = time * 3, ox = Math.round(hero.x + Math.cos(a) * 12), oy = Math.round(hero.y - 4 + Math.sin(a) * 8); ctx.fillStyle = '#7ad8ff'; ctx.fillRect(ox - 1, oy - 1, 3, 3); pix(ox, oy, '#ffffff'); }
}
// миграция: узлы, ставшие особыми, возвращают души по старой цене
function ntMigrate() {
  if (S.meta.ntMig) return; S.meta.ntMig = 1; let back = 0;
  for (const nd of TN) if (nd.nt) { const l = TL(nd.id); for (let i = 0; i < l; i++) back += Math.ceil(Math.pow(1 + .5 * i, 2.2) * (1 + nd.d * .35)); S.meta.nodes[nd.id] = 0; }
  if (back) { S.meta.souls += back; setTimeout(() => toast('ДЕРЕВО ОБНОВЛЕНО', 'особые узлы переделаны · возвращено ' + fmt(back) + ' душ', 4000), 1500); }
}

const BRANCHES = [
  { n: 'Ярость', c: '#ff5544', k: ['hit', 'e_crit', 'e_critd', 'e_power', 'e_dmg', 'e_fury'] },
  { n: 'Стойкость', c: '#aabbcc', k: ['hp', 'e_armor', 'e_regen', 'e_dodge', 'e_vamp', 'e_thorns'] },
  { n: 'Стихии', c: '#ff8a3c', k: ['e_fire', 'e_shock', 'e_poison', 'e_range', 'e_cleave'] },
  { n: 'Скорость', c: '#66ccff', k: ['e_aspd', 'e_move', 'crowd', 'spawn', 'combo_t', 'combo_m'] },
  { n: 'Удача', c: '#44ffaa', k: ['e_luck', 'rare', 'elite', 'gain', 'e_wis'] },
  { n: 'Рука бога', c: '#fff8a0', k: ['tap', 'weak', 'ultc', 'ultd', 'boss_t', 'bossdmg'] },
  { n: 'Знание', c: '#bb88ff', k: ['unlock', 'evo', 'form', 'gain', 'offline'] },
  { n: 'Душа', c: '#ff44ff', k: ['soul', 'legacy', 'offline', 'gain'] },
];
// развилки «или-или»: [условные], [с ценой]
const PAIRS = [
  [['c_combo', 'c_full'], ['x_glass', 'x_exec']], [['c_lowhp', 'c_full'], ['x_tank', 'x_regen']],
  [['c_crowd', 'c_boss'], ['x_elem', 'x_focus']], [['c_combo', 'c_crowd'], ['x_haste', 'x_swarm']],
  [['c_rare', 'c_legend'], ['x_greed', 'x_gamble']], [['c_boss', 'c_lowhp'], ['x_tapper', 'x_ultra']],
  [['c_legend', 'c_crowd'], ['x_scholar', 'x_greed']], [['c_legend', 'c_rare'], ['x_reaper', 'x_scholar']],
];
const TN = [{ id: 0, n: 'Искра души', k: 'gain', v: .2, br: -1, p: -1, x: 0, y: 0, d: 0, max: 0 }];
BRANCHES.forEach((b, bi) => {
  const a = bi / BRANCHES.length * Math.PI * 2 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
  let prev = 0, ki = 0; const cnt = {}; b.main = []; b.ksId = []; b.dir = [ca, sa, px, py];
  const add = (k, x, y, p, d, ks) => {
    cnt[k] = (cnt[k] || 0) + 1;
    TN.push({ id: TN.length, br: bi, k, p, x, y, d, v: TK[k][1], max: ks ? 5 : 0, n: ks ? TK[k][0] : TK[k][0] + ' ' + roman(cnt[k]) });
    return TN.length - 1;
  };
  for (let i = 1; i <= 12; i++) {
    const r = 26 * i + 14, ks = i === 6 ? 1 : i === 12 ? 2 : 0;
    const id = add(ks ? 'ks' + bi + '_' + (ks - 1) : b.k[ki++ % b.k.length], ca * r, sa * r, prev, i, ks);
    b.main[i] = id; if (ks) b.ksId.push(id);
    if ([2, 3, 5, 7, 8, 10, 11].includes(i)) {
      const side = i % 2 ? 1 : -1;
      const sid = add(b.k[ki++ % b.k.length], ca * r + px * 19 * side, sa * r + py * 19 * side, id, i + 1, 0);
      if ([3, 7, 11].includes(i)) { const nid = add(b.k[ki++ % b.k.length], ca * (r + 8) + px * 36 * side, sa * (r + 8) + py * 36 * side, sid, i + 2, 0), j = [3, 7, 11].indexOf(i), nk = 'n' + bi + '_' + j;
        Object.assign(TN[nid], { k: nk, v: 1, max: 5, n: TK[nk][0], nt: true, ntj: j, tag: TK[nk][3] }); }   // особый узел
    }
    prev = id;
  }
});
// второй проход: развилки (id старых узлов не меняются)
BRANCHES.forEach((b, bi) => {
  const [ca, sa, px, py] = b.dir;
  [4, 9].forEach((i, pi) => {
    const r = 26 * i + 14, pr = PAIRS[bi][pi], ids = [];
    [-1, 1].forEach((side, j) => { TN.push({ id: TN.length, br: bi, k: pr[j], p: b.main[i], x: ca * r + px * 22 * side, y: sa * r + py * 22 * side, d: i + 1, v: TK[pr[j]][1], max: 0, n: TK[pr[j]][0] }); ids.push(TN.length - 1); });
    TN[ids[0]].alt = ids[1]; TN[ids[1]].alt = ids[0];
  });
});
// узлы автоматики у корня дерева (добавлены в конец — id старых узлов не меняются)
const AUTO_NODES = [['chest', 'Авто-сундуки', 3], ['up', 'Авто-улучшение', 5], ['tal', 'Авто-таланты', 10], ['reb', 'Второй шанс', 20]];
AUTO_NODES.forEach(([k, n, cost], i) => {
  const a = (i * 2) / 8 * Math.PI * 2 - Math.PI / 2 + Math.PI / 8;
  TK['auto_' + k] = [n, 1, () => 'открывает автоматику «' + n + '»'];
  TN.push({ id: TN.length, br: -1, k: 'auto_' + k, p: 0, x: Math.cos(a) * 26, y: Math.sin(a) * 26, d: 1, v: 1, max: 1, n, auto: k, fixed: cost });
});
// новые развилки (id старых узлов не меняются): у первого узла ветки и после вершины
BRANCHES.forEach((b, bi) => {
  const [ca, sa, px, py] = b.dir;
  [[1, 0], [12, 1]].forEach(([i, pi]) => {
    const r = 26 * i + 14 + (i === 12 ? 22 : 0), pr = PAIRS2[bi][pi], ids = [], par = b.main[i];
    [-1, 1].forEach((side, j) => { const k = 'p_' + pr[j]; TN.push({ id: TN.length, br: bi, k, p: par, x: ca * r + px * 24 * side, y: sa * r + py * 24 * side, d: i + 1, v: TK[k][1], max: 0, n: TK[k][0], pair2: true }); ids.push(TN.length - 1); });
    TN[ids[0]].alt = ids[1]; TN[ids[1]].alt = ids[0];
  });
});
const autoOpen = k => (S.meta.nodes[TN.find(nd => nd.auto === k).id] || 0) > 0;
const TL = id => S.meta.nodes[id] || 0;
const tOpen = nd => nd.p < 0 || TL(nd.p) > 0;
const nMax = nd => nd.max || 50;   // обычный талант — до 50 уровней
const tCost = (nd, l) => nd.fixed ? nd.fixed : Math.ceil((1 - .05 * ascL('cheap')) * (nd.max ? 5 * Math.pow(1.45, l) : Math.pow(1 + .5 * l, 2.2)) * (1 + nd.d * .35));
const brActive = bi => true;   // все ветви работают одновременно
const startOfLife = () => S.zone <= 1 && S.kills < 200;
let TAL = {}, TB = [], KSL = [];
function calcTal() {
  if (!S.meta.act) {   // первая загрузка: активируем самые прокачанные ветви
    const pts = BRANCHES.map((b, bi) => [bi, TN.filter(n => n.br === bi).reduce((a, n) => a + TL(n.id), 0)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    S.meta.act = pts.slice(0, 3).map(x => x[0]);
  }
  TAL = {}; TB = BRANCHES.map(() => ({ pts: 0, ms: 0, full: false, bm: 1, n: 0, have: 0 }));
  for (const nd of TN) if (nd.br >= 0) { const b = TB[nd.br], l = TL(nd.id); b.pts += l; if (nd.alt == null || nd.alt > nd.id) { b.n++; if (l > 0 || (nd.alt != null && TL(nd.alt) > 0)) b.have++; } }
  TB.forEach(b => { b.ms = b.pts < 25 ? 0 : Math.floor(Math.log2(b.pts / 25)) + 1; b.full = b.have >= b.n; b.bm = (1 + .004 * b.pts) * Math.pow(1.15, b.ms) * (b.full ? 1.5 : 1); });
  KSL = BRANCHES.map((b, bi) => b.ksId.map(id => brActive(bi) ? Math.min(5, TL(id)) : 0));
  for (const nd of TN) {
    const l = TL(nd.id); if (!l || nd.k.startsWith('ks') || nd.nt || !brActive(nd.br)) continue;
    TAL[nd.k] = (TAL[nd.k] || 0) + nd.v * l * (nd.br >= 0 ? TB[nd.br].bm : 1); TAL[nd.k + '!'] = 1;
  }
  TAL.constel = TB.filter(b => b.full).length;
  calcSets();
  TAL.lv = 0; for (const nd of TN) if (!nd.auto) TAL.lv += TL(nd.id);
  calcGear();
}
const ta = k => TAL[k] || 0;
const on = k => !!TAL[k + '!'];
const ksL = (bi, j) => (KSL[bi] && KSL[bi][j]) || 0;
const condDmg = m => (combo >= 100 ? 1 + ta('c_combo') : 1) * (S.hpf >= .999 ? 1 + ta('c_full') : 1) * (m && m.boss && bossT > BOSS_TIME + ta('boss_t') - 10 ? 1 + ta('c_boss') : 1);
// темп до первой стены: души до первого вознесения ×PACE1 (цель — ~3 ч до зоны 50; подбирается tools/balance.js)
const PACE1 = .35;
const soulMul = () => .55 * (S.meta.asc ? 1 : PACE1) * soulMul0() * (1 + .3 * (threatM() - 1));
const soulMul0 = () => Math.sqrt((1 + ta('soul')) * (1 + ta('x_reaper'))) * (1 + .05 * ntL(7, 2)) * (1 + .5 * ascL('souls')) * (1 + .15 * perkL('souls')) * (trHas('bag') ? 1.15 : 1) * skySoulM() * relSoulM() * (1 + .5 * (S.meta.asc || 0));   // корень: души не разгоняются снежным комом
const bossSouls = z => 3 * (1 + z / 5) * Math.pow(1.05, z) * (isLegend(z) ? 3 : 1) * (z >= 30 ? 1 + ksL(7, 0) : 1) * (skyOn('sk_soulboss') ? 2 : 1);
function addSouls(v, m) {
  S.runSf = (S.runSf || 0) + v * soulMul(); const n = Math.floor(S.runSf); if (n <= 0) return;
  S.runSf -= n; S.runSouls = (S.runSouls || 0) + n;
  if (m) { if (m.boss || time > (addSouls.t || 0)) { addSouls.t = time + .8; ftext(m.x, m.y - 16, '+' + fmt(n) + ' душ', '#ff44ff', .8, .9); } if (m.boss) feed('+' + fmt(n) + ' душ забега (всего ' + fmt(S.runSouls) + ')', '#ff44ff'); }
}
let stats = [];
let D = {};          // производные значения
const hero = { x: 50, y: 60, hp: 50, face: 1, cd: 0, swing: 0, swingA: 0, hurt: 0, tx: 0, ty: 0, shield: 0, tint: '#fff', tintT: 0, atkN: 0, trail: [], trailT: 0, chain: 0, chainT: 0, swType: 0, swDur: .13, iframe: 0, dashT: 0, dashCd: 0, lastDash: -9, counter: 0, dvx: 0, dvy: 0 };
let orbs = [], rings = [], clouds = [], ghosts = [];
const PT = { fire: 0, met: 0, orb: 0, sky: 0, nova: 0 };
let mobs = [], parts = [], texts = [], bolts = [];
let bossAlive = false, shake = 0, time = 0, tapCd = 0;
let flashT = 0, slowT = 0, decal = null, decalT = 0;
let combo = 0, comboT = 0, comboPop = 0;
let bossT = 0, bossCd = 0, forceBoss = false;
const BOSS_TIME = 30;
const prepT = () => Math.min(30, .02 * (S.meta.best || 1) ** 2);   // передышка перед вожаком: герой ещё качается, тап по шкале — сразу в бой
const wallT = () => Math.min(300, 40 + 2 * (S.meta.best || 1));   // сколько вожак ждёт на стене: чем дальше рекорд, тем дольше жизнь
let ult = 0, ultReadyT = 0, ultT = 0, tapStreak = 0, lastTap = 0, wsHintT = 0;
function moveWS(b) { b.ws.ox = Math.round((rnd() - .5) * 10); b.ws.oy = -Math.round(3 + rnd() * 11); b.ws.t = 1.6 + rnd(); }
function retreat(b, why) {
  if (ksL(1, 1)) S.siege = Math.min(.9, 1 - (1 - (S.siege || 0)) * (1 - (1 - Math.max(0, b.hp) / b.max) * Math.min(1, .2 * ksL(1, 1))));
  b.dead = true; bossAlive = false; bossCd = 12; tele = [];
  burst(b.x, b.y - 8, '#ffffff', 20, 40);
  hero.hp = D.maxHP; hero.shield = 0;
  combo = 0;
  toast('ОТСТУПЛЕНИЕ', why + ' · готовность ' + Math.floor(Math.min(9.99, D.ready) * 100) + '% · копим силу');
  tone(330, .15, 'square', .04, 0); tone(220, .3, 'square', .04, 0, .15);
  tip('retreat', 'Это не поражение', 'Герой отступил и копит силу на обычных врагах. Шкала сверху — готовность к вожаку. Тап по ней — бой сразу.');
}
const comboTime = () => 2.5 + ta('combo_t') + perkL('combo');
const comboM = () => 1 + .25 * (1 + ta('combo_m')) * Math.log2(1 + combo / 5);
const COMBO_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

