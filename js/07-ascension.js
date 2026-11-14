'use strict';
/* ---------- ЭТАП 2: созвездия, Страж стены, Вознесение, Искры ---------- */
const CONST = [
  { n: 'Сталь', c: '#c9ced6', ks: ['war', 'bers', 'pal', 'guard'], b: ['+20% HP всем классам', '+50% HP и +5% брони'] },
  { n: 'Стихии', c: '#ff8a3c', ks: ['mage', 'sham', 'alch', 'chrono'], b: ['+15% урона', '+40% урона, эффекты стихий сильнее'] },
  { n: 'Тени', c: '#9a7aff', ks: ['assa', 'gamb', 'necro', 'reap'], b: ['+5% крита', '+12% крита и +30% силы крита'] },
  { n: 'Дух', c: '#fff2a0', ks: ['priest', 'monk', 'rune', 'arch'], b: ['ульта копится на 20% быстрее', 'ульта на 50% быстрее, регенерация ×1.5'] },
];
const constStars = ci => CONST[ci].ks.filter(k => awake(k)).length;
const starsTotal = () => CONST.reduce((a, c, i) => a + constStars(i), 0);
const constTier = ci => { const n = constStars(ci); return n >= 4 ? 2 : n >= 2 ? 1 : 0; };
function constMods() {
  let t;
  if ((t = constTier(0))) { D.maxHP *= t === 2 ? 1.5 : 1.2; if (t === 2) D.armor = Math.min(.95, D.armor + .05); }
  if ((t = constTier(1))) D.hit *= t === 2 ? 1.4 : 1.15;
  if ((t = constTier(2))) { D.crit = Math.min(.95, D.crit + (t === 2 ? .12 : .05)); if (t === 2) D.critM *= 1.3; }
  if ((t = constTier(3)) === 2) D.regen *= 1.5;
  { const tm = trophyMul(); if (tm > 1) { D.hit *= tm; D.maxHP *= tm; } }
  const a = ascL('power'); if (a) { D.hit *= Math.pow(10, .5 * a); D.maxHP *= Math.pow(10, .5 * a); }   // звёздная мощь
}
const constUlt = () => { const t = constTier(3); return t === 2 ? 1.5 : t ? 1.2 : 1; };
// дерево Вознесения (за Искры, конечное)
const ASC = [
  { k: 'power', n: 'Звёздная мощь', max: 40, c0: 1, d: L => 'урон и HP ×' + fmt(Math.pow(10, .5 * L)) },
  { k: 'path', n: 'Звёздный путь', max: 3, c0: 3, d: L => 'жизнь начинается с ' + (10 * L) + '-й зоны (не дальше рекорда −5)' },
  { k: 'souls', n: 'Память душ', max: 10, c0: 2, d: L => 'души ×' + (1 + .5 * L).toFixed(1) },
  { k: 'cheap', n: 'Лёгкое дерево', max: 10, c0: 2, d: L => 'таланты дешевле на ' + 5 * L + '%' },
  { k: 'legacy', n: 'Наследие', max: 5, c0: 4, d: L => 'после смерти остаётся часть статов (' + 5 * L + '%)' },
  { k: 'xp', n: 'Опыт веков', max: 8, c0: 2, d: L => 'опыт мастерства ×' + (1 + .25 * L).toFixed(2) },
  { k: 'world', n: 'Стойкость к мирам', max: 10, c0: 3, d: L => 'урон врагов за 50-й зоной −' + 5 * L + '%' },
];
const ascL = k => skyV(k);   // старые уровни вознесения теперь собираются со звёзд Небосвода
const ascCost = (n, L) => Math.ceil(n.c0 * Math.pow(n.k === 'power' ? 1.25 : 1.6, L));

/* ================= НЕБОСВОД — вечное дерево вознесения ================= */
// 12 созвездий-ветвей, 4 кольца (открываются на 1/3/6/10-м вознесении), ~490 звёзд.
// Обычные звёзды — бонусы; яркие — новые правила; сверхновые — «или-или»; рисунки созвездий — бонус за все звёзды фигуры.
const SKY_RING = [0, 120, 270, 430, 600], SKY_NEED = [0, 1, 3, 6, 10];
const GREEK = 'αβγδεζηθικλμνξοπρστυφχψω';
// суммарная сила ключа на всём Небосводе (в «старых уровнях» для power/path/souls/cheap/legacy/xp/world)
const SKY_TOT = { power: 40, path: 3, souls: 10, cheap: 10, legacy: 5, xp: 8, world: 10, hit: 2, hp: 4, aps: .5, ult: 3, boss: 2, gain: 2, rare: 1, critd: 1, sparks: 1, eff: .6, echo: .5, dust: 2, chestc: .3, wdmg: 3 };
const SKY_KEY = {
  power: v => 'урон и HP ×' + fmt(Math.pow(10, .5 * v)), path: v => 'старт жизни с ' + (10 * v).toFixed(1) + '-й зоны', souls: v => 'души ×' + (1 + .5 * v).toFixed(2),
  cheap: v => 'таланты дешевле на ' + (5 * v).toFixed(1) + '%', legacy: v => 'после смерти остаётся ' + (5 * v).toFixed(1) + '% статов', xp: v => 'опыт мастерства ×' + (1 + .25 * v).toFixed(2),
  world: v => 'урон врагов за 50-й зоной −' + (5 * v).toFixed(1) + '%', hit: v => '+' + pct(v) + ' урона', hp: v => '+' + pct(v) + ' HP', aps: v => '+' + pct(v) + ' скорости атаки',
  ult: v => '+' + pct(v) + ' урона ульты', boss: v => '+' + pct(v) + ' урона по вожакам', gain: v => '+' + pct(v) + ' прироста статов', rare: v => 'золотые враги +' + pct(v),
  critd: v => '+' + pct(v) + ' силы крита', sparks: v => '+' + pct(v) + ' искр', eff: v => '+' + pct(v) + ' ко всем эффектам', echo: v => 'после вознесения остаётся ' + pct(v) + ' дерева талантов',
  dust: v => '+' + pct(v) + ' пыли', chestc: v => pct(v) + ' шанс сундука с вожака и золотого', wdmg: v => '+' + pct(v) + ' урона за 50-й зоной',
};
const SKYB = [
  { n: 'Мощь', c: '#ff5544', k: [['power', 3], ['hit', 1]], nt: ['sk_first', 'sk_crit'], fig: 'Дракон', sh: 'zig', fb: ['hit', .5] },
  { n: 'Стойкость', c: '#8fb0d0', k: [['hp', 1], ['world', 1]], nt: ['sk_phx', 'sk_bossregen'], fig: 'Черепаха', sh: 'ring', fb: ['hp', .5] },
  { n: 'Время', c: '#66ccff', k: [['aps', 1], ['ult', 1]], nt: ['sk_ult2', 'sk_rush'], fig: 'Часы', sh: 'hour', fb: ['aps', .1] },
  { n: 'Души', c: '#ff44ff', k: [['souls', 2], ['sparks', 1]], nt: ['sk_soulboss', 'sk_harvest'], fig: 'Ворон', sh: 'wing', fb: ['sparks', .15] },
  { n: 'Удача', c: '#ffd84a', k: [['rare', 1], ['critd', 1]], nt: ['sk_meteor', 'sk_lucky'], fig: 'Кот', sh: 'cat', fb: ['critd', .5] },
  { n: 'Класс', c: '#c06bff', k: [['xp', 2], ['hit', 1]], nt: ['sk_mast', 'sk_awake'], fig: 'Маска', sh: 'mask', fb: ['xp', 1] },
  { n: 'Снаряжение', c: '#ff9a3c', k: [['dust', 1], ['chestc', 1]], nt: ['sk_bosschest', 'sk_pity'], fig: 'Наковальня', sh: 'anvil', fb: ['dust', .5] },
  { n: 'Миры', c: '#7affb0', k: [['world', 1], ['wdmg', 1]], nt: ['sk_titan', 'sk_wslow'], fig: 'Глобус', sh: 'ring', fb: ['wdmg', 1] },
  { n: 'Вожаки', c: '#ff2a4a', k: [['boss', 2], ['power', 1]], nt: ['sk_judge', 'sk_weak'], fig: 'Корона', sh: 'crown', fb: ['boss', .5] },
  { n: 'Эхо', c: '#ccccff', k: [['echo', 1], ['cheap', 1], ['legacy', 1]], nt: ['sk_autotree', 'sk_comet'], fig: 'Колокол', sh: 'bell', fb: ['echo', .1] },
  { n: 'Порядок', c: '#e0c080', k: [['path', 1], ['gain', 1]], nt: ['sk_perks', 'sk_starshield'], fig: 'Весы', sh: 'scales', fb: ['gain', .5] },
  { n: 'Звёздное пламя', c: '#fff6a0', k: [['eff', 1], ['power', 1]], nt: ['sk_form', 'sk_spec'], fig: 'Феникс', sh: 'wing', fb: ['eff', .15] },
];
const SKY_NT = {
  sk_first: ['Первый удар', 'первый удар по каждому врагу ×5'], sk_crit: ['Звёздный крит', 'сила крита ×1.5'],
  sk_phx: ['Звёздное перо', 'раз за жизнь спасает от смерти (вместе с Пером феникса — дважды)'], sk_bossregen: ['Второе дыхание', 'в бою с вожаком +3% HP в секунду'],
  sk_ult2: ['Эхо ульты', 'ульта бьёт второй раз через миг (60% силы)'], sk_rush: ['Рывок жизни', 'первые 30 секунд жизни атака ×2'],
  sk_soulboss: ['Пожиратель', 'вожаки дают души ×2'], sk_harvest: ['Жатва', 'каждый 150-й враг — мини-вожак с сундуком'],
  sk_meteor: ['Звездопад', 'каждые 6с звезда падает на сильнейшего врага (×40 удара)'], sk_lucky: ['Под звездой', 'золотые враги ×2 чаще'],
  sk_mast: ['Наставник', '+5 очков пути каждому классу'], sk_awake: ['Пробуждённый свет', 'пробуждённые классы бьют ×1.5'],
  sk_bosschest: ['Трофей вожака', 'каждый вожак роняет сундук'], sk_pity: ['Счастливая подкова', 'эпик+ гарантирован каждый 5-й сундук'],
  sk_titan: ['Охотник на титанов', 'трофеи титанов ×2 сильнее'], sk_wslow: ['Тяжесть миров', 'враги за 50-й зоной на 25% медленнее'],
  sk_judge: ['Терпение', 'вожак казнит, только если бой займёт больше 60с (а не 40с)'], sk_weak: ['Точный глаз', 'слабое место вожака ×2'],
  sk_autotree: ['Звёздная память', 'после вознесения дерево талантов само докупается'], sk_comet: ['Комета', 'смерть вожака обрушивает комету на всех врагов (×20 удара)'],
  sk_perks: ['Подготовка', 'каждая жизнь начинается с 2 перками на выбор'], sk_starshield: ['Звёздный щит', 'при HP ниже 30% — 3с неуязвимости (раз в 20с)'],
  sk_form: ['Ранний расцвет', 'формы эффектов наступают втрое раньше'], sk_spec: ['Призвание', 'специализация ×2 вместо ×1.5'],
};
const SKY_KS = [
  ['nv_glass', 'Стеклянная пушка', 'урон ×100, но HP ×0.1', 'nv_tank', 'Твердыня', 'HP ×100, но урон ×0.3'],
  ['nv_noult', 'Без ульты', 'ульты нет, удары ×20', 'nv_ultonly', 'Повелитель ульты', 'ульта раз в 3с, удары ×0.5'],
  ['nv_loyal', 'Верность', 'класс не меняется после смерти, мастерство ×3', 'nv_wander', 'Странник', 'души ×2'],
  ['nv_greed', 'Алчность', 'души ×5, враги ×3 крепче', 'nv_ascetic', 'Аскеза', 'души ×0.5, искры ×2'],
  ['nv_horde', 'Орда', 'врагов ×2, прирост статов ×2', 'nv_duel', 'Дуэль', 'врагов вдвое меньше, они ×4 крепче, прирост ×4'],
  ['nv_night', 'Вечная ночь', 'в каждой зоне ночь: золотые ×2.5', 'nv_day', 'Вечный день', 'золотых врагов нет, урон ×5'],
];
const SKY_SH = {
  zig: [[0, 0], [1, -.6], [2, 0], [3, -.6], [4, 0], [5, -.7], [5.6, -1.4], [6.4, -1.2]], ring: [[0, 0], [.9, -.9], [2.1, -1.1], [3.1, -.5], [3.3, .6], [2.4, 1.3], [1.1, 1.2], [.2, .7], 'loop'],
  hour: [[0, -1.2], [2.4, -1.2], [1.2, 0], [0, 1.2], [2.4, 1.2], [1.2, 0], [1.2, -2], [1.2, 2]], wing: [[0, 0], [1, -1], [2.2, -1.6], [3.4, -1.4], [2.6, -.5], [3.6, .2], [2.4, .6], [1.2, .4]],
  cat: [[0, 0], [.5, -1.2], [1.2, -.5], [2.2, -.5], [2.9, -1.2], [3.2, 0], [2.4, 1], [.8, 1], 'loop'], mask: [[0, 0], [1.2, -.8], [2.4, -.8], [3.6, 0], [2.8, 1], [1.8, .6], [.8, 1], [1.8, -.1]],
  anvil: [[0, -1], [3.6, -1], [3, -.2], [2.2, 0], [2.4, 1], [1.2, 1], [1.4, 0], [.6, -.2], 'loop'], crown: [[0, 1], [0, -.8], [.9, .1], [1.8, -1.2], [2.7, .1], [3.6, -.8], [3.6, 1], [1.8, 1], 'loop'],
  bell: [[1.6, -1.6], [.8, -1], [.4, .2], [0, 1], [1.6, 1.4], [3.2, 1], [2.8, .2], [2.4, -1], 'loop'], scales: [[1.8, -1.6], [1.8, 1.2], [0, -.8], [-.4, .4], [.6, .4], [3.6, -.8], [3.2, .4], [4.2, .4]],
};
const SN = [{ id: 0, n: 'Сердце неба', br: -1, ring: 0, k: 'power', v: 0, max: 1, x: 0, y: 0, p: -1, tp: 'root' }];
(function genSky() {
  const add = o => { o.id = SN.length; SN.push(o); return o; };
  SKYB.forEach((B, bi) => {
    const a0 = bi / SKYB.length * Math.PI * 2 - Math.PI / 2; let gi = 0;
    const nm = () => GREEK[gi++ % 24] + ' ' + B.n.split(' ')[0];
    const key = (j) => B.k[j % B.k.length][0];
    const pt = (r, da) => ({ x: Math.cos(a0 + da) * r, y: Math.sin(a0 + da) * r });
    let prev = 0;
    for (let ring = 1; ring <= 4; ring++) {
      const r0 = SKY_RING[ring - 1] + (ring === 1 ? 40 : 18), r1 = SKY_RING[ring] - 12, mx = [0, 5, 8, 10, 10][ring];
      const spine = [];
      for (let i = 0; i < 4; i++) { const r = r0 + (r1 - r0) * i / 3, wob = Math.sin(i * 1.7 + bi) * .03; spine.push(prev = add({ n: nm(), br: bi, ring, k: key(i + ring), v: 1, max: mx, p: prev, ...pt(r, wob), tp: 'star' }).id); }
      const sprig = (from, side, n) => { let pp = spine[from]; const base = SN[pp], br = Math.hypot(base.x, base.y);
        for (let j = 1; j <= n; j++) pp = add({ n: nm(), br: bi, ring, k: key(j + side + ring + 1), v: 1, max: mx, p: pp, ...pt(br + j * 10, side * (.07 + j * .045) * (300 / br)), tp: 'star' }).id; return pp; };
      if (ring === 1) { sprig(1, 1, 2); sprig(2, -1, 2); const e = SN[spine[3]]; add({ n: SKY_NT[B.nt[0]][0], br: bi, ring, k: B.nt[0], v: 1, max: 1, p: spine[3], ...pt(Math.hypot(e.x, e.y) + 4, .09), tp: 'nt' }); }
      if (ring === 2) { // рисунок созвездия
        const S0 = SKY_SH[B.sh], pts = S0.filter(q => q !== 'loop'), cx = (r0 + r1) / 2 + 10, sc = 13, ang = a0 + .2;
        let pp = spine[1]; const figIds = [];
        pts.forEach(([fx, fy], j) => { const lx = (fx - 1.8) * sc, ly = fy * sc, x = Math.cos(ang) * cx + lx * Math.cos(ang) - ly * Math.sin(ang), y = Math.sin(ang) * cx + lx * Math.sin(ang) + ly * Math.cos(ang);
          pp = add({ n: B.fig + ' ' + GREEK[j], br: bi, ring, k: key(j), v: 1, max: mx, p: pp, x, y, tp: 'fig', fig: bi }).id; figIds.push(pp); });
        B.figIds = figIds; B.figLoop = S0.includes('loop'); }
      if (ring === 3) { sprig(0, 1, 3); sprig(2, -1, 3); const e = SN[spine[3]]; add({ n: SKY_NT[B.nt[1]][0], br: bi, ring, k: B.nt[1], v: 1, max: 1, p: spine[3], ...pt(Math.hypot(e.x, e.y) + 4, -.08), tp: 'nt' }); }
      if (ring === 4) { sprig(1, 1, 2); sprig(2, -1, 2);
        if (bi % 2 === 0) { const K = SKY_KS[bi / 2], e = SN[spine[3]], rr = Math.hypot(e.x, e.y) + 30;
          const a = add({ n: K[1], br: bi, ring, k: K[0], v: 1, max: 1, p: spine[3], ...pt(rr, .09), tp: 'ks', kd: K[2] }), b = add({ n: K[4], br: bi, ring, k: K[3], v: 1, max: 1, p: spine[3], ...pt(rr, -.09), tp: 'ks', kd: K[5] });
          a.alt = b.id; b.alt = a.id; } }
    }
  });
  // нормировка: сумма по ключу = SKY_TOT
  const sum = {}; for (const n of SN) if (n.tp === 'star' || n.tp === 'fig') sum[n.k] = (sum[n.k] || 0) + n.max;
  for (const n of SN) if ((n.tp === 'star' || n.tp === 'fig') && SKY_TOT[n.k]) n.v = SKY_TOT[n.k] / sum[n.k];
})();
const SKY_COST0 = [0, 2, 9, 30, 90];
const skyCostRaw = (n, L) => n.tp === 'root' ? 1 : n.tp === 'nt' ? SKY_COST0[n.ring] * 12 : n.tp === 'ks' ? SKY_COST0[n.ring] * 25 : SKY_COST0[n.ring] * Math.pow(1.3, L);
// бюджет колец: 1-е ≈ 2–3 вознесения, дальше дороже; всего ≈ 45 000 искр (~20 вознесений)
const SKY_BUD = [0, 1500, 6500, 13000, 24000];
const SKY_K = (() => { const t = [0, 0, 0, 0, 0]; for (const n of SN) for (let l = 0; l < n.max; l++) t[n.ring] += skyCostRaw(n, l); return t.map((v, r) => r ? SKY_BUD[r] / v : 1); })();
const skyCost = (n, L) => Math.max(1, Math.ceil(skyCostRaw(n, L) * SKY_K[n.ring]));
const SL = id => (S.meta.sky && S.meta.sky[id]) || 0;
const skyRingOpen = r => (S.meta.asc || 0) >= SKY_NEED[r];
const skyOpen = n => n.p < 0 || (SL(n.p) > 0 && skyRingOpen(n.ring));
const skyBlocked = n => n.alt != null && SL(n.alt) > 0;
const skyCan = n => skyOpen(n) && !skyBlocked(n) && SL(n.id) < n.max && (S.meta.sparks || 0) >= skyCost(n, SL(n.id));
let SKYV = {}, SKYF = {};
function calcSky() {
  SKYV = {}; SKYF = {};
  for (const n of SN) { const L = SL(n.id); if (!L) continue; if (n.tp === 'star' || n.tp === 'fig') SKYV[n.k] = (SKYV[n.k] || 0) + n.v * L; else if (n.tp !== 'root') SKYF[n.k] = 1; }
  SKYB.forEach(B => { if (B.figIds && B.figIds.every(id => SL(id) >= SN[id].max)) { SKYV[B.fb[0]] = (SKYV[B.fb[0]] || 0) + B.fb[1]; B.figDone = true; } else B.figDone = false; });
}
const skyV = k => SKYV[k] || 0;
const skyOn = k => !!SKYF[k];
function skyMods() {
  D.hit *= 1 + skyV('hit'); D.maxHP *= 1 + skyV('hp'); D.aps = Math.min(14, D.aps * (1 + skyV('aps'))); D.gainMult *= 1 + skyV('gain'); D.rare = Math.min(.7, D.rare * (1 + skyV('rare')) * (skyOn('sk_lucky') ? 2 : 1));
  if (S.zone > 50) D.hit *= 1 + skyV('wdmg');
  D.critM *= 1 + skyV('critd'); if (skyOn('nv_day')) { D.hit *= 5; D.rare = 0; }
  if (skyOn('sk_crit')) D.critM *= 1.5; if (skyOn('sk_awake') && aw()) D.hit *= 1.5;
  if (skyOn('nv_glass')) { D.hit *= 100; D.maxHP *= .1; } if (skyOn('nv_tank')) { D.maxHP *= 100; D.hit *= .3; }
  if (skyOn('nv_noult')) D.hit *= 20; if (skyOn('nv_ultonly')) D.hit *= .5;
  if (skyOn('nv_horde')) D.gainMult *= 2; if (skyOn('nv_duel')) D.gainMult *= 4;
}
const skyHpM = () => (skyOn('nv_greed') ? 3 : 1) * (skyOn('nv_duel') ? 4 : 1);
const skySoulM = () => (skyOn('nv_greed') ? 5 : 1) * (skyOn('nv_ascetic') ? .5 : 1) * (skyOn('nv_wander') ? 2 : 1);
const skyCrowdM = () => (skyOn('nv_horde') ? 2 : 1) * (skyOn('nv_duel') ? .5 : 1);
const ASC_TITLES = ['Смертный', 'Звёздный', 'Сияющий', 'Небесный', 'Лучезарный', 'Звездорождённый', 'Вечный', 'Владыка неба', 'Космический', 'Бесконечный', 'Первозвёздный'];
const ascTitle = () => ASC_TITLES[Math.min(ASC_TITLES.length - 1, Math.floor(((S.meta.asc || 0) + 1) / 2))];
const ASC_HALO = ['#ffffff', '#7ad8ff', '#ffd84a', '#ff44ff', '#7affb0', '#ff9a3c', '#c06bff', '#ff5544', '#fff6a0', '#66ccff'];
// перенос старого магазина искр
function skyMigrate() {
  const M = S.meta; if (M.skyMig) return; M.skyMig = 1; if (!M.sky) M.sky = {};
  let ref = 0; for (const n of ASC) { const L = (M.asn || {})[n.k] || 0; for (let l = 0; l < L; l++) ref += ascCost(n, l); }
  if (ref > 0) { M.sparks = (M.sparks || 0) + ref; M.asn = {}; setTimeout(() => toast('НЕБОСВОД ОТКРЫТ', 'старое дерево вознесения превратилось в звёзды · возвращено ' + fmt(ref) + ' искр', 4500), 1500); }
}

/* ---------- экран Небосвода ---------- */
const scam = { x: 0, y: 0, z: .55 }; let sSel = 0, sW = 0, sH = 0, sDPR = 1, sRaf = 0, sMode = 'map', sFilt = 'buy', sBg = null;
const sPtr = new Map(); let sMoved = 0, sPinch = 0;
const SKY_BG = Array.from({ length: 260 }, (_, i) => ({ x: (Math.sin(i * 12.9898) * 43758.5453 % 1) * 1500 - 750, y: (Math.sin(i * 78.233) * 12543.31 % 1) * 1500 - 750, r: (i % 7 === 0) ? 1.6 : .8, t: i * .7 }));
function openSky() { tip('dbl', 'Двойной тап', 'Тапни узел дважды подряд — сразу купишь уровень. Работает в талантах, ветке класса и на Небосводе.'); calcSky(); $('sky').hidden = false; setSMode(sMode); sizeSky(); if (!openSky.fit) { openSky.fit = 1; skyFit(); } renderSInfo(); reqSky(); }
function skyFit() { let lr = 1; for (let r = 1; r <= 4; r++) if (skyRingOpen(r)) lr = r; scam.x = 0; scam.y = 0; scam.z = Math.min(sW, sH) / (2 * SKY_RING[lr] + 170); reqSky(); }
function sizeSky() { const v = $('sview'), r = v.getBoundingClientRect(); sDPR = Math.min(2, window.devicePixelRatio || 1); sW = r.width; sH = r.height; const c = $('scv'); c.width = Math.round(sW * sDPR); c.height = Math.round(sH * sDPR); c.style.width = sW + 'px'; c.style.height = sH + 'px'; sBg = null; }
function reqSky() { if (!sRaf) sRaf = requestAnimationFrame(() => { sRaf = 0; drawSky(); }); }
const s2x = x => (x - scam.x) * scam.z + sW / 2, s2y = y => (y - scam.y) * scam.z + sH / 2;
function skyStar(c, x, y, r, col, pts) { c.beginPath(); for (let i = 0; i < pts * 2; i++) { const a = i / (pts * 2) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .42 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fillStyle = col; c.fill(); }
/* ---- пиксельный космос: спрайты звёзд, туманности из точек, планеты ---- */
const SKY_SPR = {
  star: ['..#..', '.#o#.', '#ooo#', '.#o#.', '..#..'],
  fig: ['...#...', '...#...', '..#o#..', '##ooo##', '..#o#..', '...#...', '...#...'],
  nt: ['....#....', '.#..#..#.', '..#.#.#..', '...#o#...', '####o####', '...#o#...', '..#.#.#..', '.#..#..#.', '....#....'],
  ks: ['....#....', '...#o#...', '..#ooo#..', '.#ooooo#.', '#ooooooo#', '.#ooooo#.', '..#ooo#..', '...#o#...', '....#....'],
  root: ['......#......', '..#...#...#..', '...#..#..#...', '....#####....', '...#ooooo#...', '..#ooooooo#..', '####ooooo####', '..#ooooooo#..', '...#ooooo#...', '....#####....', '...#..#..#...', '..#...#...#..', '......#......'],
};
const skySprC = {};
function skySpr(kind, col, mode) {   // mode: 2 зажжена, 1 доступна, 0 тусклая
  const k = kind + col + mode; if (skySprC[k]) return skySprC[k]; const P = SKY_SPR[kind], c = document.createElement('canvas'); c.width = P[0].length; c.height = P.length; const x = c.getContext('2d');
  P.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; x.fillStyle = mode === 2 ? (ch === 'o' ? '#ffffff' : col) : mode === 1 ? (ch === 'o' ? '#d8d2ff' : '#8a80c0') : (ch === 'o' ? '#5a5288' : '#352e58'); x.fillRect(i, j, 1, 1); }));
  return skySprC[k] = c;
}
const skyHaloC = {};
function skyHalo(col) { if (skyHaloC[col]) return skyHaloC[col]; const r = 8, c = document.createElement('canvas'); c.width = c.height = r * 2 + 1; const x = c.getContext('2d'); x.fillStyle = col;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.hypot(i, j) / r; if (d > 1) continue; if ((i + j) % 2 === 0 && d > .35 || d <= .35 && (i % 2 === 0)) { x.globalAlpha = .55 * (1 - d); x.fillRect(i + r, j + r, 1, 1); } } return skyHaloC[col] = c; }
let skyNebC = null;
function skyNeb() {   // туманности ветвей из пиксельных точек (мировые координаты)
  if (skyNebC) return skyNebC; const R = 760, c = document.createElement('canvas'); c.width = c.height = R * 2; const x = c.getContext('2d'); let sd = 7;
  const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  SKYB.forEach((B, bi) => { const a = bi / SKYB.length * Math.PI * 2 - Math.PI / 2;
    for (let k = 0; k < 2600; k++) { const rad = 120 + rr() * 560, da = (rr() - .5) * .45 * (1 - rad / 900), px = Math.round(Math.cos(a + da) * rad + (rr() - .5) * 40) + R, py = Math.round(Math.sin(a + da) * rad + (rr() - .5) * 40) + R;
      x.globalAlpha = .1 + rr() * .22; x.fillStyle = rr() < .15 ? '#ffffff' : B.c; x.fillRect(px - (px % 2), py - (py % 2), 2, 2); } });
  x.globalAlpha = 1; return skyNebC = c;
}
const SKY_PLANETS = [[-700, -420, 26, '#c06bff', 1], [720, 260, 34, '#ff9a3c', 0], [-260, 760, 18, '#7ad8ff', 1], [430, -720, 22, '#7affb0', 0], [-780, 330, 14, '#ff5577', 0], [760, -500, 12, '#ffd84a', 1]];
const skyPlanC = {};
function skyPlanet(r, col, ringed) { const k = r + col + ringed; if (skyPlanC[k]) return skyPlanC[k]; const W2 = r * 4, c = document.createElement('canvas'); c.width = W2; c.height = W2; const x = c.getContext('2d'), cx = W2 / 2, cy = W2 / 2;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.hypot(i, j); if (d > r) continue; const lit = (-i - j) / (r * 1.4), band = Math.sin(j * .5) > .6;
    x.fillStyle = d > r - 1.2 ? '#0a0614' : lit > .35 ? '#ffffff' : lit > -.1 ? col : (i + j) % 2 ? '#1a1030' : col; if (band && lit > -.4 && d <= r - 1.2) x.globalAlpha = .75; x.fillRect(cx + i, cy + j, 1, 1); x.globalAlpha = 1; }
  if (ringed) { x.fillStyle = '#e8dcb0'; for (let a = 0; a < 6.283; a += .02) { const px = Math.round(cx + Math.cos(a) * r * 1.7), py = Math.round(cy + Math.sin(a) * r * .45); if (Math.sin(a) < 0 && Math.hypot(px - cx, py - cy) < r) continue; x.fillRect(px, py, 1, 1); } }
  return skyPlanC[k] = c; }
let skyFogPat = null;
function pxLine(c, x1, y1, x2, y2, step, sz) { const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.floor(d / step)); for (let i = 0; i <= n; i++) { const t = i / n; c.fillRect(Math.round(x1 + (x2 - x1) * t - sz / 2), Math.round(y1 + (y2 - y1) * t - sz / 2), sz, sz); } }
let skyShoot = null;
function drawSky() {
  const c = $('scv').getContext('2d'); c.setTransform(sDPR, 0, 0, sDPR, 0, 0); c.imageSmoothingEnabled = false;
  if (!sBg) { sBg = document.createElement('canvas'); sBg.width = Math.max(1, Math.round(sW)); sBg.height = Math.max(1, Math.round(sH)); const b = sBg.getContext('2d');
    b.fillStyle = '#05030e'; b.fillRect(0, 0, sW, sH); const bands = ['#07041a', '#0a0622', '#0d082a']; for (let y = 0; y < sH; y += 4) { b.fillStyle = bands[Math.floor((y / sH) * 3 + ((y / 4) % 2) * .5) % 3]; b.fillRect(0, y, sW, 2); }
    b.imageSmoothingEnabled = false; const pl = skyPlanet(40, '#3a2a6a', 1); b.globalAlpha = .55; b.drawImage(pl, sW - pl.width * 1.1, sH - pl.height * .9, pl.width * 1.4, pl.height * 1.4); b.globalAlpha = 1; }
  c.drawImage(sBg, 0, 0, sW, sH);
  const z = scam.z, tm = performance.now() / 1000, far = z < .22, ps = Math.max(1, Math.round(Math.min(3, z * 2.2)));
  // фоновые пиксельные звёзды (мигают кадрами)
  for (const s0 of SKY_BG) { const x = Math.round((s0.x - scam.x * .3) * Math.max(.4, z * .6) + sW / 2), y = Math.round((s0.y - scam.y * .3) * Math.max(.4, z * .6) + sH / 2); if (x < -3 || y < -3 || x > sW + 3 || y > sH + 3) continue;
    const ph = Math.floor(tm * 2 + s0.t) % 6; c.fillStyle = s0.r > 1 ? '#fff6d0' : ph === 0 ? '#ffffff' : '#7a76b0'; c.fillRect(x, y, 1, 1);
    if (s0.r > 1 && ph < 2) { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); } }
  // туманности и планеты (мировые)
  { const N = skyNeb(), R = N.width / 2; c.globalAlpha = .9; c.drawImage(N, s2x(-R), s2y(-R), N.width * z, N.height * z); c.globalAlpha = 1; }
  for (const [px, py, r, col, rg] of SKY_PLANETS) { const im = skyPlanet(r, col, rg), w = im.width * z; const x = s2x(px) - w / 2, y = s2y(py) - w / 2; if (x > sW || y > sH || x + w < 0 || y + w < 0) continue; c.drawImage(im, Math.round(x), Math.round(y), Math.round(w), Math.round(w)); }
  // падающая звезда — пиксельный хвост
  if (!skyShoot && Math.random() < .012) skyShoot = { x: Math.random() * sW, y: Math.random() * sH * .5, t: 0 };
  if (skyShoot) { const S0 = skyShoot; S0.t += .07; for (let k = 0; k < 10; k++) { const tt = S0.t - k * .025; if (tt < 0) continue; c.globalAlpha = Math.max(0, (1 - k / 10) * (1 - S0.t * .5)); c.fillStyle = k ? '#bfb8ff' : '#ffffff'; c.fillRect(Math.round(S0.x + tt * 140), Math.round(S0.y + tt * 70), k ? 1 : 2, k ? 1 : 2); } c.globalAlpha = 1; if (S0.t > 1.5) skyShoot = null; }
  // кольца — пиксельный пунктир
  let lr = 0; for (let r = 1; r <= 4; r++) if (skyRingOpen(r)) lr = r;
  for (let r = 1; r <= 4; r++) { const op = r <= lr, R = SKY_RING[r] * z, n = Math.max(24, Math.floor(R * 2 * Math.PI / 6)); c.fillStyle = op ? '#4a4290' : '#2a2450';
    for (let i = 0; i < n; i++) { if (!op && i % 2) continue; const a = i / n * Math.PI * 2; c.fillRect(Math.round(s2x(0) + Math.cos(a) * R), Math.round(s2y(0) + Math.sin(a) * R), 1, 1); }
    if (op && !far) { c.font = '7px "Press Start 2P", monospace'; c.textAlign = 'center'; c.fillStyle = '#6a62b0'; c.fillText(['', 'I', 'II', 'III', 'IV'][r], s2x(0), s2y(0) - R + 10); } }
  // туман закрытых колец — пиксельная сетка
  if (lr < 4) { if (!skyFogPat) { const pc = document.createElement('canvas'); pc.width = pc.height = 4; const px = pc.getContext('2d'); px.fillStyle = '#03020a'; [[0, 0], [2, 0], [1, 1], [3, 1], [0, 2], [2, 2], [1, 3], [3, 3], [0, 1], [2, 3]].forEach(([a, b]) => px.fillRect(a, b, 1, 1)); skyFogPat = c.createPattern(pc, 'repeat'); }
    const cx = s2x(0), cy = s2y(0), R0 = SKY_RING[lr] * z; c.save(); c.beginPath(); c.rect(0, 0, sW, sH); c.arc(cx, cy, R0 + 6, 0, Math.PI * 2, true); c.fillStyle = skyFogPat; c.fill('evenodd'); c.restore();
    c.font = `${Math.max(8, Math.round(10 * Math.min(1.4, z * 1.6)))}px "Press Start 2P", monospace`; c.textAlign = 'center'; const lbl = 'КОЛЬЦО ' + ['', 'I', 'II', 'III', 'IV'][lr + 1] + ' · ' + SKY_NEED[lr + 1] + '-Е ВОЗНЕСЕНИЕ', ly = cy - (SKY_RING[lr] + 24) * z - 26;
    c.fillStyle = '#000'; c.fillText(lbl, cx + 1, ly + 1); c.fillStyle = '#c9b07a'; c.fillText(lbl, cx, ly); }
  // связи: пиксельный пунктир, зажжённые — сплошные с бегущей искрой
  for (const n of SN) { if (n.p < 0) continue; if (n.tp === 'fig' && SN[n.p].tp === 'fig') continue; const p = SN[n.p], lit = SL(n.id) > 0 && SL(p.id) > 0, op = skyRingOpen(n.ring);
    const x1 = s2x(p.x), y1 = s2y(p.y), x2 = s2x(n.x), y2 = s2y(n.y); if (Math.max(x1, x2) < -10 || Math.min(x1, x2) > sW + 10 || Math.max(y1, y2) < -10 || Math.min(y1, y2) > sH + 10) continue;
    if (!op) continue;
    c.fillStyle = lit ? SKYB[n.br].c : '#3a3470'; c.globalAlpha = lit ? .8 : 1; pxLine(c, x1, y1, x2, y2, lit ? 1.5 : 4, lit ? Math.max(1, ps - 1) : 1);
    if (lit && !far) { const f = (tm * .5 + n.id * .37) % 1; c.globalAlpha = 1; c.fillStyle = '#ffffff'; c.fillRect(Math.round(x1 + (x2 - x1) * f) - 1, Math.round(y1 + (y2 - y1) * f) - 1, 2, 2); } }
  c.globalAlpha = 1;
  // рисунки созвездий: пиксельные линии, готовые — двойные с сиянием
  for (const B of SKYB) { if (!B.figIds) continue; const ids = B.figIds.slice(); if (B.figLoop) ids.push(ids[0]); const lit = B.figIds.filter(id => SL(id) > 0).length;
    for (let i = 1; i < ids.length; i++) { const a = SN[ids[i - 1]], b = SN[ids[i]], x1 = s2x(a.x), y1 = s2y(a.y), x2 = s2x(b.x), y2 = s2y(b.y);
      if (B.figDone) { c.globalAlpha = .35; c.fillStyle = B.c; pxLine(c, x1, y1, x2, y2, 1, ps + 2); c.globalAlpha = 1; c.fillStyle = Math.floor(tm * 3 + i) % 4 ? B.c : '#ffffff'; pxLine(c, x1, y1, x2, y2, 1, Math.max(1, ps)); }
      else { c.fillStyle = lit ? B.c : '#6a62a8'; c.globalAlpha = lit ? .7 : .6; pxLine(c, x1, y1, x2, y2, 3, 1); c.globalAlpha = 1; } }
    if (z >= .6) { const m = SN[B.figIds[3]], fs = Math.round(Math.max(7, 8 * Math.min(1.6, z * 1.3))); c.font = `${fs}px "Press Start 2P", monospace`; c.textAlign = 'center'; const t = B.fig + (B.figDone ? ' !' : ''), tx = s2x(m.x), ty = s2y(m.y) - 22 * z - 6;
      c.fillStyle = '#000'; c.fillText(t, tx + 1, ty + 1); c.fillStyle = B.figDone ? B.c : '#8a82c0'; c.fillText(t, tx, ty); } }
  // названия ветвей — золотые таблички по краю открытого неба
  SKYB.forEach((B, bi) => { const a = bi / SKYB.length * Math.PI * 2 - Math.PI / 2, r = SKY_RING[Math.max(1, lr)] + 24, fs = Math.round(Math.max(7, 8 * Math.min(1.3, z * 1.6)));
    c.font = `${fs}px "Press Start 2P", monospace`; c.textAlign = 'center'; const tx = Math.round(s2x(Math.cos(a) * r)), ty = Math.round(s2y(Math.sin(a) * r)), w = c.measureText(B.n).width + 8;
    c.fillStyle = '#0a0618'; c.fillRect(tx - w / 2, ty - fs - 3, w, fs + 7); c.fillStyle = B.c; c.fillRect(tx - w / 2, ty - fs - 3, w, 1); c.fillRect(tx - w / 2, ty + 3, w, 1); c.fillText(B.n, tx, ty); });
  // звёзды-спрайты
  for (const n of SN) { const x = s2x(n.x), y = s2y(n.y); if (x < -30 || y < -30 || x > sW + 30 || y > sH + 30) continue;
    const L = SL(n.id), op = skyRingOpen(n.ring), can = skyCan(n), open = skyOpen(n) && !skyBlocked(n), col = n.br < 0 ? '#fff6d0' : SKYB[n.br].c;
    if (!op) { c.fillStyle = '#2a2450'; c.fillRect(Math.round(x), Math.round(y), 1, 1); continue; }
    if (far && n.tp !== 'root') { c.fillStyle = L ? col : can ? '#ffffff' : '#4a4290'; const q = L ? 2 : 1; c.fillRect(Math.round(x) - (q >> 1), Math.round(y) - (q >> 1), q, q); continue; }
    const kind = n.tp === 'root' ? 'root' : n.tp === 'ks' ? 'ks' : n.tp === 'nt' ? 'nt' : n.tp === 'fig' ? 'fig' : 'star';
    const blink = L && Math.floor(tm * 1.5 + n.id * .61) % 7 === 0, sc = Math.max(1, ps) + (L && n.tp !== 'star' && n.tp !== 'fig' ? 1 : 0);
    if ((L && z >= .5) || n.tp === 'root') { const h = skyHalo(col), hs = h.width * sc * (n.tp === 'star' || n.tp === 'fig' ? 1 : 1.6); c.drawImage(h, Math.round(x - hs / 2), Math.round(y - hs / 2), Math.round(hs), Math.round(hs)); }
    const im = skySpr(kind, col, L || n.tp === 'root' ? 2 : open ? 1 : 0), w = im.width * sc, hgt = im.height * sc;
    if (blink) { c.fillStyle = '#ffffff'; c.fillRect(Math.round(x) - sc * 3, Math.round(y), sc * 6 + 1, sc); c.fillRect(Math.round(x), Math.round(y) - sc * 3, sc, sc * 6 + 1); }
    c.drawImage(im, Math.round(x - w / 2), Math.round(y - hgt / 2), w, hgt);
    if (skyBlocked(n)) { c.fillStyle = '#ff4466'; for (let k = -4; k <= 4; k++) c.fillRect(Math.round(x + k * sc / 1.2), Math.round(y + k * sc / 1.2), sc, sc); }
    if (can) { const on = Math.floor(tm * 3 + n.id) % 2; c.fillStyle = on ? '#5cff8a' : '#2a8a4a'; const o = Math.round(w / 2 + 3); c.fillRect(Math.round(x) - o, Math.round(y) - o, 2, 2); c.fillRect(Math.round(x) + o - 1, Math.round(y) - o, 2, 2); c.fillRect(Math.round(x) - o, Math.round(y) + o - 1, 2, 2); c.fillRect(Math.round(x) + o - 1, Math.round(y) + o - 1, 2, 2); }
    if (n.id === sSel) { const o = Math.round(w / 2 + 6), t = Math.floor(tm * 6) % 2; c.fillStyle = '#ffe08a';
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const cx = Math.round(x) + dx * o, cy = Math.round(y) + dy * o; c.fillRect(cx - (dx > 0 ? 3 : 0) + (t ? -dx : 0), cy, 4, 1); c.fillRect(cx, cy - (dy > 0 ? 3 : 0) + (t ? -dy : 0), 1, 4); } }
    if (L && n.max > 1 && z > 1.6) { c.font = '7px "Press Start 2P", monospace'; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(L, x + 1, y + hgt / 2 + 10); c.fillStyle = '#fff'; c.fillText(L, x, y + hgt / 2 + 9); } }
}
// мини-карта неба для вкладки Души
function skyMini(cv) {
  const W2 = cv.width, H2 = cv.height, c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.fillStyle = '#05030e'; c.fillRect(0, 0, W2, H2);
  for (let i = 0; i < 70; i++) { c.fillStyle = i % 9 ? '#4a4690' : '#ffffff'; c.fillRect((i * 97) % W2, (i * 53) % H2, 1, 1); }
  let lr = 1; for (let r = 1; r <= 4; r++) if (skyRingOpen(r)) lr = r; const k = (Math.min(W2, H2) / 2 - 4) / SKY_RING[lr], cx = W2 / 2, cy = H2 / 2;
  for (const n of SN) { if (!skyRingOpen(n.ring) || n.ring > lr) continue; const L = SL(n.id); c.fillStyle = L ? (n.br < 0 ? '#ffffff' : SKYB[n.br].c) : skyCan(n) ? '#5cff8a' : '#2e2860'; const q = L && n.tp !== 'star' ? 2 : 1; c.fillRect(Math.round(cx + n.x * k) - (q >> 1), Math.round(cy + n.y * k) - (q >> 1), q, q); }
}
function skyNodeDesc(n, L) {
  if (n.tp === 'root') return 'начало Небосвода';
  if (n.tp === 'nt') return SKY_NT[n.k][1]; if (n.tp === 'ks') return n.kd;
  return SKY_KEY[n.k] ? SKY_KEY[n.k](n.v * Math.max(1, L)) : n.k;
}
function renderSInfo() {
  const n = SN[sSel], L = SL(n.id), B = n.br >= 0 ? SKYB[n.br] : null, op = skyRingOpen(n.ring);
  const tp = { root: 'Сердце', star: 'звезда', fig: 'звезда созвездия «' + (B && B.fig) + '»', nt: 'ЯРКАЯ ЗВЕЗДА · новое правило', ks: 'СВЕРХНОВАЯ · выбери одну из двух' }[n.tp];
  const why = !op ? 'кольцо откроется на ' + SKY_NEED[n.ring] + '-м вознесении' : skyBlocked(n) ? 'выбрана «' + SN[n.alt].n + '»' : !skyOpen(n) ? 'сначала соседняя звезда' : L >= n.max ? 'зажжена полностью' : (S.meta.sparks || 0) < skyCost(n, L) ? 'не хватает искр' : '';
  $('sinfo').innerHTML = `<h3 style="color:${B ? B.c : '#fff'}">${n.n}</h3><div class="k">${B ? B.n + ' · ' : ''}${tp}${n.max > 1 ? ' · ур. ' + L + '/' + n.max : ''}</div>` +
    `<div>${L ? 'Сейчас: ' + skyNodeDesc(n, L) : skyNodeDesc(n, 1)}</div>${L && L < n.max ? `<div class="k">След.: ${skyNodeDesc(n, L + 1)}</div>` : ''}` +
    (n.tp === 'fig' && B ? `<div class="k">Все ${B.figIds.length} звёзд «${B.fig}» на максимуме: ${SKY_KEY[B.fb[0]](B.fb[1])}${B.figDone ? ' ✓' : ''}</div>` : '') +
    `<div class="row2"><button class="btn" id="sb1"${skyCan(n) ? '' : ' disabled'}>${L >= n.max ? 'ГОТОВО' : '+1 · ' + fmt(skyCost(n, L)) + ' искр'}</button><button class="btn" id="sbm"${skyCan(n) && n.max > 1 ? '' : ' disabled'}>МАКС</button></div>` + (why ? `<div class="k">${why}</div>` : '');
  $('sinfo').querySelector('#sb1').onclick = () => skyBuy(n, false); $('sinfo').querySelector('#sbm').onclick = () => skyBuy(n, true);
  $('ssparks').textContent = fmt(S.meta.sparks || 0);
}
function skyBuy(n, all) {
  let k = 0; while (skyCan(n) && k++ < 99) { S.meta.sparks -= skyCost(n, SL(n.id)); if (!S.meta.sky) S.meta.sky = {}; S.meta.sky[n.id] = SL(n.id) + 1; if (!all) break; }
  if (!k) return; const B = n.br >= 0 ? SKYB[n.br] : null, was = B && B.figDone; calcSky(); D.dirty = true; recalc(); save();
  tone(880, .06, 'triangle', .04); tone(1320, .1, 'triangle', .04, 0, .06);
  if (B && B.figDone && !was) toast('СОЗВЕЗДИЕ «' + B.fig.toUpperCase() + '» ЗАЖЖЕНО!', SKY_KEY[B.fb[0]](B.fb[1]), 3000);
  if (n.tp === 'nt' || n.tp === 'ks') toast(n.n.toUpperCase(), skyNodeDesc(n, 1), 2600);
  renderSInfo(); if (sMode === 'list') renderSList(); else reqSky(); renderSBar(); renderAsc.h = ''; renderAsc();
}
function skyBest() {
  let n = 0; while (n < 400) { let pick = null; for (const nd of SN) if (skyCan(nd) && nd.tp !== 'ks' && (!pick || skyCost(nd, SL(nd.id)) < skyCost(pick, SL(pick.id)))) pick = nd; if (!pick) break;
    S.meta.sparks -= skyCost(pick, SL(pick.id)); S.meta.sky[pick.id] = SL(pick.id) + 1; n++; }
  calcSky(); D.dirty = true; recalc(); save(); toast(n ? 'ЗАЖЖЕНО ЗВЁЗД: ' + n : 'Пока не на что тратить искры', n ? 'сверхновые «или-или» выбирай сам' : ''); renderSInfo(); renderSBar(); if (sMode === 'list') renderSList(); else reqSky();
}
function setSMode(m) { sMode = m; $('sview').hidden = m !== 'map'; $('sinfo').hidden = m !== 'map'; $('slist2').hidden = m !== 'list'; renderSBar(); if (m === 'list') renderSList(); else { sizeSky(); reqSky(); } }
function renderSBar() {
  const F = [['buy', 'Можно зажечь (' + SN.filter(skyCan).length + ')'], ['nt', 'Яркие'], ['ks', 'Сверхновые'], ['fig', 'Созвездия'], ['all', 'Все']];
  let h = `<div class="trow"><button class="tch${sMode === 'map' ? ' on' : ''}" data-sm="map">КАРТА</button><button class="tch${sMode === 'list' ? ' on' : ''}" data-sm="list">СПИСОК</button><span class="tsp"></span><button class="tch" data-sbest="1">★ ЛУЧШЕЕ ЗА ИСКРЫ</button></div>`;
  if (sMode === 'list') h += `<div class="trow">${F.map(([k, n]) => `<button class="tch${sFilt === k ? ' on' : ''}" data-sf="${k}">${n}</button>`).join('')}</div>`;
  h += `<div class="shint">${ascTitle()} · вознесений: ${S.meta.asc || 0} · зажжено ${SN.filter(n => SL(n.id)).length}/${SN.length} · созвездий ${SKYB.filter(B => B.figDone).length}/12</div>`;
  $('sbar').innerHTML = h;
}
function renderSList() {
  let L = SN.filter(n => n.tp !== 'root' && skyRingOpen(n.ring));
  if (sFilt === 'buy') L = L.filter(skyCan); if (sFilt === 'nt') L = L.filter(n => n.tp === 'nt'); if (sFilt === 'ks') L = L.filter(n => n.tp === 'ks'); if (sFilt === 'fig') L = L.filter(n => n.tp === 'fig');
  L.sort((a, b) => (skyCan(b) - skyCan(a)) || (a.ring - b.ring) || (a.br - b.br) || (a.id - b.id));
  $('slist2').innerHTML = (L.length ? L.slice(0, 120).map(n => { const B = SKYB[n.br], l = SL(n.id), can = skyCan(n);
    return `<div class="tcard${can ? ' can' : ''}${l ? ' own' : ''}${skyBlocked(n) ? ' blk' : ''}" style="--nc:${B.c}"><div class="tcm"><b>${n.n}</b><em style="color:${B.c}">${B.n}</em>${n.tp === 'nt' ? '<em>яркая</em>' : n.tp === 'ks' ? '<em>сверхновая</em>' : n.tp === 'fig' ? '<em>' + B.fig + '</em>' : ''}` +
      `<small>${l ? 'сейчас: ' + skyNodeDesc(n, l) : skyNodeDesc(n, 1)}${l && l < n.max ? '<br>след.: ' + skyNodeDesc(n, l + 1) : ''}</small></div>` +
      `<div class="tcb"><span>${l}/${n.max}</span>${can ? `<button class="btn" data-s1="${n.id}">+1 · ${fmt(skyCost(n, l))}</button>${n.max > 1 ? `<button class="btn" data-smx="${n.id}">МАКС</button>` : ''}` : ''}<button class="tgo" data-sgo="${n.id}">на карте</button></div></div>`; }).join('')
    : '<div class="tlh">Здесь пусто. Искры даёт вознесение.</div>');
}
function skyPick(px, py) { let best = -1, bd = 1e9; for (const n of SN) { const d = Math.hypot(s2x(n.x) - px, s2y(n.y) - py); if (d < bd) { bd = d; best = n.id; } } return bd < Math.max(18, 10 * scam.z) ? best : -1; }
function skyInit() {
  const v = $('sview');
  v.addEventListener('pointerdown', e => { v.setPointerCapture(e.pointerId); sPtr.set(e.pointerId, { x: e.clientX, y: e.clientY }); sMoved = 0; if (sPtr.size === 2) { const [a, b] = [...sPtr.values()]; sPinch = Math.hypot(a.x - b.x, a.y - b.y); } });
  v.addEventListener('pointermove', e => { const p = sPtr.get(e.pointerId); if (!p) return;
    if (sPtr.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; sMoved += Math.abs(dx) + Math.abs(dy); scam.x -= dx / scam.z; scam.y -= dy / scam.z; }
    sPtr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (sPtr.size === 2) { const [a, b] = [...sPtr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (sPinch) scam.z = clamp(scam.z * d / sPinch, .15, 3); sPinch = d; sMoved += 10; }
    reqSky(); });
  const up = e => { const was = sPtr.size; sPtr.delete(e.pointerId); if (was === 1 && sMoved < 8) { const r = v.getBoundingClientRect(), id = skyPick(e.clientX - r.left, e.clientY - r.top); if (id >= 0) { const twice = dbl('s' + id); sSel = id; if (twice) skyBuy(SN[id], false); renderSInfo(); reqSky(); } } if (sPtr.size < 2) sPinch = 0; };
  v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  v.addEventListener('wheel', e => { e.preventDefault(); scam.z = clamp(scam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), .15, 3); reqSky(); }, { passive: false });
  $('szi').onclick = () => { scam.z = Math.min(3, scam.z * 1.4); reqSky(); }; $('szo').onclick = () => { scam.z = Math.max(.15, scam.z / 1.4); reqSky(); };
  $('sfit').onclick = skyFit;
  $('sclose').onclick = () => { $('sky').hidden = true; renderAsc.h = ''; renderAsc(); };
  $('sbar').onclick = e => { const t = e.target.closest('button'); if (!t) return; if (t.dataset.sm) setSMode(t.dataset.sm); if (t.dataset.sf) { sFilt = t.dataset.sf; renderSBar(); renderSList(); } if (t.dataset.sbest) skyBest(); };
  $('slist2').onclick = e => { const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.s1) skyBuy(SN[+t.dataset.s1], false); if (t.dataset.smx) skyBuy(SN[+t.dataset.smx], true);
    if (t.dataset.sgo) { sSel = +t.dataset.sgo; const n = SN[sSel]; scam.x = n.x; scam.y = n.y; scam.z = Math.max(scam.z, 1.2); setSMode('map'); renderSInfo(); } };
  setInterval(() => { if (!$('sky').hidden && sMode === 'map' && !sPtr.size) reqSky(); }, 60);
  window.addEventListener('resize', () => { if (!$('sky').hidden) { sizeSky(); reqSky(); } });
}

function ascBuy(k) { const n = ASC.find(x => x.k === k), L = ascL(k), c = ascCost(n, L); if (L >= n.max || (S.meta.sparks || 0) < c) return; S.meta.sparks -= c; if (!S.meta.asn) S.meta.asn = {}; S.meta.asn[k] = L + 1; calcTal(); D.dirty = true; recalc(); save(); tone(880, .08, 'triangle', .04); tone(1320, .12, 'triangle', .04, 0, .06); renderSouls(); }
const wallZ = () => (S.meta.asc ? 100 : 50);
const sparksFor = () => { const M = S.meta, cyc = (M.soulsCyc || 0) + (S.runSouls || 0); if (cyc < 100) return 0; return Math.floor(22 * Math.pow(Math.log10(cyc), 1.5) * (1 + .1 * starsTotal()) * (1 + Math.max(0, M.best - 50) / 50) * (1 + skyV('sparks')) * (skyOn('nv_ascetic') ? 2 : 1)); };   // ~1–3.5К за вознесение: Небосвод ~45К заполняется к ~17-му вознесению
// Страж стены: огромный, почти неуязвим без звёзд созвездий
const guardMul = () => Math.min(1, Math.pow(10, -3 + .375 * starsTotal()));   // доля урона, что проходит сквозь защиту: 8 звёзд — вся
const guardDef = () => 1 - guardMul();
function makeGuardian(m) {
  Object.assign(m, { guard: true, t: 7, sz: 3.2, h: 45, name: 'Страж стены', sp: m.sp * .6 });
  m.hp *= 1e10; m.max = m.hp;   // рассчитан на героя с полным деревом: без звёзд непробиваем, с 8★ — около 10–30 секунд
  toast('СТРАЖ СТЕНЫ!', 'защита ' + (guardDef() * 100).toFixed(1) + '% · звёзды созвездий ломают её (8★ — полностью)', 3500);
  shake = 12; [98, 73, 55].forEach((f, i) => tone(f, .5, 'sawtooth', .06, 0, i * .25));
}
function guardianDown() {
  const M = S.meta; M.guard = 1;
  bossAlive = false;
  if (M.asc) { feed('Страж стены повержен — Вознесение снова доступно', '#ffd84a'); nextZone(); save(); return; } slowT = 1; flashT = .2; shake = 16;
  for (let i = 0; i < 4; i++) ring(hero.x, hero.y - 4, 20 + i * 18, i % 2 ? '#ffffff' : '#ffd84a');
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .3, 'triangle', .05, 0, i * .1));
  setTimeout(() => { $('mt').textContent = 'СТЕНА ПАЛА!'; $('mp').innerHTML = 'Страж стены повержен.<br><br>Открыто <span style="color:#ffd84a">ВОЗНЕСЕНИЕ</span> — вкладка ДУШИ.<br><br>Оно сбросит дерево и души, но даст <span style="color:#7ad8ff">Искры</span> для Небосвода, а стена уйдёт на 100-ю зону.'; $('modal').hidden = false; }, 1200);
  save();
}
// само Вознесение
let ascConfirm = 0;
function ascend() {
  const M = S.meta, g = sparksFor();
  M.sparks = (M.sparks || 0) + g; M.sparksTot = (M.sparksTot || 0) + g; M.asc = (M.asc || 0) + 1; M.soulsCyc = 0; M.guard = 0;   // в новом цикле Стража нужно победить снова
  M.best = Math.max(M.best, S.zone);
  // дерево талантов и души сгорают, автоматика остаётся
  // базовое Эхо 30%: вознесение не начинает дерево с нуля
  const keepN = {}, ef = Math.min(.8, .3 + skyV('echo')); for (const nd of TN) { const l = TL(nd.id); if (nd.auto && l) keepN[nd.id] = l; else if (l && ef > 0) { const k = Math.floor(l * ef); if (k) keepN[nd.id] = k; } }
  M.nodes = keepN; M.souls = 0;
  S.runSouls = 0; S.meta = M;
  rebirth(true); if (skyOn('sk_autotree')) bestBuy(true); ascScene(g);
  setTimeout(() => { if (!EV) openSky(); else setTimeout(openSky, 2500); }, 3500);
}
function ascScene(g) {
  EV = { t: 0, k: cls(), form: formOf(cls()), old: formOf(cls()), label: 'ВОЗНЕСЕНИЕ #' + S.meta.asc, name: '+' + fmt(g) + ' искр', shown: false };
  [262, 392, 523, 784, 1047, 1568].forEach((f, i) => tone(f, .4, 'triangle', .05, 0, i * .2));
}
function renderAsc() {
  const M = S.meta, el = $('ascbox'); if (!el) return;
  const st = starsTotal(), can = !!M.guard, g = sparksFor(), nextG = Math.floor(Math.sqrt(((M.soulsCyc || 0) + (S.runSouls || 0) + ((M.lastLife && M.lastLife.s) || 0)) / 50) * (1 + .1 * st) * (1 + Math.max(0, M.best - 50) / 10) * (1 + skyV('sparks')) * (skyOn('nv_ascetic') ? 2 : 1));
  const pip = n => Array.from({ length: 4 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  let h = `<div class="asx"><div class="axh"><span>${pxImg('star', '#ffe08a', 7)} СОЗВЕЗДИЯ КЛАССОВ</span><span>${st}/16</span></div><div class="axt">звезда — пробуждённый класс · 2 и 4 звезды дают бонус и ломают защиту Стража</div><div class="cgrid">` +
    CONST.map((c, ci) => { const n = constStars(ci), t = constTier(ci);
      return `<div class="cst${t ? ' on' : ''}" style="--cc:${c.c}"><b>${c.n}<span class="pips">${pip(n)}</span></b>` + c.ks.map(k => `<img src="${clsSprURL(k, !!(M.seen || {})[k])}" class="${awake(k) ? 'aw' : ''}" title="${CLASSES[k].n}">`).join('') +
        `<small class="${t >= 1 ? 'got' : ''}">2${pxImg('star', '#ffe08a', 7)} ${c.b[0]}</small><small class="${t >= 2 ? 'got' : ''}">4${pxImg('star', '#ffe08a', 7)} ${c.b[1]}</small></div>`; }).join('') + '</div></div>';
  h += `<div class="asx asc2"><div class="axh"><span>${pxImg('star', '#ffe08a', 7)} ВОЗНЕСЕНИЕ</span><span>${ascTitle()}</span></div>` +
    `<div class="axs"><div><small>ИСКРЫ</small><b style="color:#7ad8ff">${fmt(M.sparks || 0)}</b></div><div><small>ВОЗНЕСЕНИЙ</small><b>${M.asc || 0}</b></div><div><small>ЗА ВОЗНЕСЕНИЕ</small><b style="color:#ffe08a">+${fmt(g)}</b></div></div>` +
    (can ? `<div class="axt">Стена пала. Дерево талантов и души сгорят${skyV('echo') > 0 ? ' (Эхо вернёт ' + pct(Math.min(.5, skyV('echo'))) + ')' : ''}, классы, вещи и Небосвод останутся.${nextG > g ? ' Ещё одна жизнь ≈ +' + fmt(nextG) + ' искр.' : ''}</div>`
      : `<div class="axt">Чтобы вознестись, победи Стража стены на ${S.meta.asc ? 100 : 50}-й зоне. Звёзды созвездий ломают его защиту.</div>`) +
    `<button class="btn big" id="ascb"${can ? '' : ' disabled'}>${performance.now() < ascConfirm ? 'ТОЧНО? ДЕРЕВО СГОРИТ — ТАПНИ ЕЩЁ' : 'ВОЗНЕСТИСЬ · +' + fmt(g) + ' ИСКР'}</button></div>`;
  if ((M.asc || 0) > 0 || M.sparks) { const cn = SN.filter(skyCan).length, lit = SN.filter(n => SL(n.id)).length;
    h += `<div class="asx"><div class="axh"><span>${pxImg('star', '#ffe08a', 7)} НЕБОСВОД</span><span>${lit}/${SN.length} · созвездий ${SKYB.filter(B => B.figDone).length}/12</span></div>` +
      `<canvas id="skymini" width="300" height="140"></canvas><div class="axbar"><i style="width:${(lit / SN.length * 100).toFixed(1)}%"></i></div>` +
      `<button class="btn big" id="skyb">ОТКРЫТЬ НЕБОСВОД${cn ? ' · можно зажечь: ' + cn : ''}</button></div>`; }
  if (h !== renderAsc.h) { renderAsc.h = h; el.innerHTML = h; const mc = $('skymini'); if (mc) skyMini(mc); }
}

// множитель урона удара от класса
function clsDM(t) {
  return clsDM0(t) * ctDM(t);
}
function clsDM0(t) {
  switch (cls()) {
    case 'bers': return (1 + cq(1) * (1 + 3 * (1 - S.hpf))) * (aw() && S.hpf < .5 ? 2 : 1);
    case 'guard': return t.frz > 0 ? 1 + 2 * cq(1) : 1;
    case 'assa': if (aw() && !t.boss && t.hp < t.max * .2) { fxLabel('Метка смерти', t.x, t.y - 12, '#9a7aff'); return 1e6; } return t.hp >= t.max * .99 ? 2 + 6 * cq(0) : 1;
    case 'monk': return 1 + cq(0) * Math.min(3, combo / 50);
    case 'reap': return 1 + .04 * (hero.souls || 0);
  }
  return 1;
}
function shoot(t, kind, sp, ex) {
  const a = Math.atan2(t.y - 4 - (hero.y - 4), t.x - hero.x);
  hero.cast = .12; hero.swingA = a;
  waves.push(Object.assign({ x: hero.x + Math.cos(a) * 5, y: hero.y - 4 + Math.sin(a) * 5, t, sp, a, l: 1.4, kind }, ex || {}));
}
const nearMobs = (x, y, r, skip) => mobs.filter(o => !o.dead && o !== skip && Math.hypot(o.x - x, o.y - y) < r).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
// быстрый видимый рывок вместо мгновенного телепорта
function dashTo(x, y) { const dx = x - hero.x, dy = y - hero.y, d = Math.hypot(dx, dy); if (d < 2) return; const T = clamp(d / 450, .05, .13); hero.dvx = dx / T; hero.dvy = dy / T; hero.dashT = T; }
function blinkTo(t, back) {
  for (let i = 0; i < 4; i++) ghosts.push({ x: hero.x + (t.x - hero.x) * i / 4, y: hero.y + (t.y - hero.y) * i / 4, l: .25, face: hero.face });
  const f = t.x >= hero.x ? 1 : -1;
  dashTo(clamp(t.x + (back ? f * 6 : -f * 6), 10, AW - 10), clamp(t.y, 14, AH - 6)); hero.face = f;
}
// атака класса; true — атака обработана
function clsAttack(t, d) {
  const k = cls(), melee = d <= MELEE;
  switch (k) {
    case 'bers':
      if (!melee) { shoot(t, 'axe', 190); return true; }
      hero.spin = .2; heroStrike(t, false); hitAround(hero.x, hero.y, 15, D.hit * .5 * clsDM(t), '#ff6644', t);
      if (hero.atkN % 4 === 0) ring(hero.x, hero.y - 3, 15, '#ff6644');
      tone(180, .06, 'sawtooth', .025, 90, 0, 'spin', .08); return true;
    case 'pal':
      if (!melee) { shoot(t, 'hammer', 170); return true; }
      heroStrike(t, false); palWave(t); return true;
    case 'guard':
      if (!melee) { shoot(t, 'shield', 180); return true; }
      hero.kbBoost = 3; heroStrike(t, false); guardBash(t); return true;
    case 'mage': hero.awN = (hero.awN || 0) + 1; if (aw() && hero.awN % 4 === 0) for (const o of nearMobs(t.x, t.y, 40, t).slice(0, 2)) shoot(o, 'fire', 170); shoot(t, 'fire', 170); tone(300, .05, 'sawtooth', .02, 120, 0, 'shot', .05); return true;
    case 'sham': {
      hero.cast = .12; bolts.push({ x1: hero.x + hero.face * 3, y1: hero.y - 7, x2: t.x, y2: t.y - 3, l: .1, c: '#99eeff' });
      heroStrike(t, true);
      let from = t; const hs = new Set([t]);
      for (let j = 0; j < 2 + Math.floor(6 * cq(0)); j++) {
        const nx = nearMobs(from.x, from.y, 30).find(o => !hs.has(o)); if (!nx) break;
        bolts.push({ x1: from.x, y1: from.y - 3, x2: nx.x, y2: nx.y - 3, l: .1, c: '#ccf6ff' }); hs.add(nx); hitMob(nx, D.hit * .6, false, false, '#ccf6ff'); from = nx;
      }
      tone(1500, .04, 'square', .015, 400, 0, 'zap', .06); return true;
    }
    case 'arch': {
      shoot(t, 'arrow', 280); hero.awN = (hero.awN || 0) + 1; const n = Math.floor(4 * cq(0)) + (aw() && hero.awN % 4 === 0 ? 4 : 0);
      if (n) for (const o of nearMobs(t.x, t.y, 40, t).slice(0, n)) shoot(o, 'arrow', 280, { dmg: D.hit * .6 });
      tone(1100, .05, 'triangle', .02, 1600, 0, 'shot', .05); return true;
    }
    case 'assa':
      if (!melee) { blinkTo(t, true); burst(hero.x, hero.y - 4, '#4a3a6a', 8, 30); tone(1300, .05, 'triangle', .03, 500, 0, 'blink', .1); }
      heroStrike(t, false); return true;
    case 'gamb': {
      const n = 1 + Math.floor(3 * cq(1)), tg = [t, ...nearMobs(t.x, t.y, 40, t).slice(0, n - 1)];
      tg.forEach((o, i) => shoot(o, 'card', 230, { suit: Math.floor(rnd() * 4), main: i === 0, joker: rnd() < .15 * cq(0) * (capOn('gamb') ? 3 : 1) }));
      tone(1800, .03, 'triangle', .02, 2400, 0, 'card', .05); return true;
    }
    case 'alch': shoot(t, 'flask', 120, { l: 2, ox: hero.x, oy: hero.y }); tone(500, .05, 'sine', .02, 800, 0, 'shot', .05); return true;
    case 'priest': {
      hero.cast = .15; const r = 6 + 12 * cq(0);
      bolts.push({ x1: t.x, y1: t.y - 60, x2: t.x, y2: t.y - 3, l: .14, c: '#fff6c0' }); bolts.push({ x1: t.x + 1, y1: t.y - 60, x2: t.x + 1, y2: t.y - 3, l: .1, c: '#ffffff' });
      ring(t.x, t.y - 2, r, '#fff6c0'); heroStrike(t, true); hitAround(t.x, t.y, r, D.hit * .6, '#fff6c0', t);
      hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * (.01 + .03 * cq(0)) * (isSty('priest', 0) ? 1 + stf() : 1));
      tone(880, .08, 'sine', .02, 1320, 0, 'holy', .1); return true;
    }
    case 'monk': {
      if (!melee) { blinkTo(t, false); fxLabel('Рывок ци', hero.x, hero.y - 16, '#ffaa55'); }
      heroStrike(t, false); hero.fists = .15;
      for (let j = 0; j < Math.floor(1 + 4 * cq(1)) + (aw() ? 2 : 0); j++) if (!t.dead) { hitMob(t, D.hit * .5 * clsDM(t), false, false, '#ffaa55'); burst(t.x + (rnd() - .5) * 4, t.y - 4, '#ffaa55', 2, 20); }
      return true;
    }
    case 'chrono': shoot(t, 'time', 200); tone(600, .06, 'sine', .02, 300, 0, 'shot', .06); return true;
    case 'rune':
      hero.cast = .15; runes.push({ x: t.x, y: t.y, t: .45, m: t, r: 10 + 10 * cq(0), res: true });
      if (capOn('rune')) { const o2 = nearMobs(t.x, t.y, 40, t)[0]; if (o2) runes.push({ x: o2.x, y: o2.y, t: .55, m: o2, r: 10 + 10 * cq(0), res: false }); }
      tone(400, .05, 'square', .015, 600, 0, 'rune', .08); return true;
    case 'necro': shoot(t, 'dark', 170); tone(200, .05, 'sawtooth', .02, 120, 0, 'shot', .05); return true;
    case 'reap': {
      if (!melee) { shoot(t, 'scythe', 180); return true; }
      const a = Math.atan2(t.y - hero.y, t.x - hero.x), R = 16 + 12 * cq(0);
      hero.sweep = .2; hero.swingA = a; heroStrike(t, false);
      for (const o of nearMobs(hero.x, hero.y, R, t)) { let da = Math.abs(Math.atan2(o.y - hero.y, o.x - hero.x) - a); if (da > Math.PI) da = 6.283 - da; if (da < 1.6) hitMob(o, D.hit * .8 * clsDM(o), false, false, '#ff44ff'); }
      tone(240, .08, 'sawtooth', .025, 120, 0, 'sweep', .1); return true;
    }
  }
  return false;
}
function palWave(t) {
  hero.palN = (hero.palN || 0) + 1; if (hero.palN % (isSty('pal', 0) ? 3 : 4)) return;
  ring(t.x, t.y - 2, 20, '#fff2a8'); hitAround(t.x, t.y, 20, D.hit * 1.2, '#fff2a8');
  hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * (capOn('pal') ? .15 : .05));
  if (aw() && holy.length < 4) holy.push({ x: t.x, y: t.y, t: 4, cd: 0 });
  if (cq(1) > .01) hero.shield = Math.max(hero.shield, D.maxHP * .3 * cq(1));
  fxLabel('Святой молот', t.x, t.y - 14, '#fff2a8'); tone(523, .12, 'triangle', .03, 784);
}
function guardBash(t) {
  if (!t.boss && !t.dead) { t.frz = Math.max(t.frz || 0, .3 + 1.2 * cq(1)); if (texts.length < 8 && rnd() < .3) fxLabel('Оглушение', t.x, t.y - 12, '#8fb0d0'); }
  burst(t.x, t.y - 4, '#8fb0d0', 5, 30); tone(120, .06, 'square', .03, 80, 0, 'bash', .08);
}
// попадание снаряда класса (до обычного удара)
function clsWaveHit(w) {
  const t = w.t;
  switch (w.kind) {
    case 'fire': { hero.amN = (hero.amN || 0) + 1; const big = isSty('mage', 1) && hero.amN % 5 === 0, r = (11 + 14 * cq(0)) * (big ? 2 : 1); if (big) { fxLabel('Архимаг', t.x, t.y - 14, '#c06bff'); shake = Math.max(shake, 4); } ring(t.x, t.y - 3, r, '#ff8a3c'); hitAround(t.x, t.y, r, D.hit * (.7 + cq(0)) * (big ? 2 + stf() : 1), '#ff9a3c', t);
      if (rnd() < .25 * cq(1) + (capOn('mage') ? .15 : 0)) { bolts.push({ x1: t.x + 18, y1: t.y - 50, x2: t.x, y2: t.y - 3, l: .15, c: '#ff9a3c' }); ring(t.x, t.y - 2, 18, '#ff9a3c'); hitAround(t.x, t.y, 18, D.hit * 3, '#ff9a3c'); shake = Math.max(shake, 3); sfx.boom(); }
      break; }
    case 'arrow':
      if (w.dmg) { hitMob(t, w.dmg, false, false, '#5cff8a'); return true; }
      if (rnd() < .8 * cq(1)) { const nx = nearMobs(t.x, t.y, 40, t)[0]; if (nx) { waves.push({ x: t.x, y: t.y - 4, t: nx, sp: 280, a: 0, l: 1, kind: 'arrow', dmg: D.hit * .8 }); fxLabel('Пронзание', t.x, t.y - 12, '#5cff8a'); } }
      break;
    case 'card': {
      hero.awN = (hero.awN || 0) + 1; if (aw() && hero.awN % 3 === 0 && !w.dbl) { w.dbl = true; clsWaveHit(w); fxLabel('Двойная ставка', t.x, t.y - 14, '#44ffaa'); }
      const s = w.suit, col = ['#ff4466', '#ffd84a', '#5cff8a', '#e9e4ff'][s];
      if (w.joker) { ring(t.x, t.y - 3, 18, '#44ffaa'); hitAround(t.x, t.y, 18, D.hit * 5, '#44ffaa'); ftext(t.x, t.y - 14, 'ДЖОКЕР!', '#44ffaa', 1.1, .9); sfx.rare(); }
      if (s === 0) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .02);
      if (s === 1 && rnd() < .05) { giveBurst(zs() * D.gainMult * 3); fxLabel('Бубны: награда', t.x, t.y - 12, '#ffd84a'); }
      if (s === 2) { t.psn = Math.max(t.psn || 0, D.hit * .8); t.psnT = 3; }
      if (s === 3) hitMob(t, D.hit * D.critM * .4, true, false, '#e9e4ff');
      if (!w.main) { hitMob(t, D.hit * .7, false, false, col); return true; }
      break; }
    case 'flask': {
      const r = 10 + 6 * cq(0); burst(t.x, t.y - 2, '#b6ff3c', 10, 35);
      if (isSty('alch', 1)) { ring(t.x, t.y - 2, 14, '#b6ff3c'); hitAround(t.x, t.y, 14, D.hit * (.5 + .5 * stf()), '#b6ff3c', t); }
      if (clouds.length < 24) clouds.push({ x: t.x, y: t.y - 1, r: aw() ? r * 2 : r, dps: D.hit * (.3 + 1.2 * cq(0)), t: 3, acid: true });
      tone(900, .04, 'square', .015, 300, 0, 'glass', .06); break; }
    case 'time':
      t.slowT = Math.max(t.slowT || 0, 2);
      if (cq(1) > .01 && !(t.bombT > 0)) { t.bomb = D.hit * 1.5 * cq(1); t.bombT = 1.2; }
      break;
    case 'hammer': heroStrike(t, true); palWave(t); return true;
    case 'shield': hero.kbBoost = 3; heroStrike(t, true); guardBash(t); return true;
  }
  return false;
}
// постоянные эффекты класса
function clsTick(dt) {
  const k = cls();
  if (capOn('sham')) { PT.eye = (PT.eye ?? 10) - dt; if (PT.eye <= 0 && mobs.length) { PT.eye = 10; for (const m of mobs) if (!m.dead) { bolts.push({ x1: m.x + (rnd() - .5) * 10, y1: camY, x2: m.x, y2: m.y - 3, l: .15, c: '#ccf6ff' }); hitMob(m, D.hit * 2, false, false, '#ccf6ff'); } fxLabel('Око бури', hero.x, hero.y - 20, '#99eeff'); shake = Math.max(shake, 5); } }
  if (k === 'pal' && cq(0) > .01) { PT.pal = (PT.pal || 0) - dt; if (PT.pal <= 0) { PT.pal = .5; hitAround(hero.x, hero.y, 18, D.hit * .3 * cq(0), '#ffe9a0'); } }
  if (k === 'sham') {
    PT.tot = (PT.tot || 0) - dt;
    const max = 1 + Math.floor(3 * cq(1)) + (aw() ? 2 : 0);
    if (PT.tot <= 0 && mobs.length) { PT.tot = 5; totems.push({ x: hero.x + (rnd() - .5) * 12, y: hero.y + (rnd() - .5) * 8, t: 14, cd: .5 }); if (totems.length > max) totems.shift(); }
    for (const tt of totems) { tt.t -= dt; tt.cd -= dt; if (tt.cd <= 0) { const o = nearMobs(tt.x, tt.y, 34)[0]; if (o) { tt.cd = .7; bolts.push({ x1: tt.x, y1: tt.y - 9, x2: o.x, y2: o.y - 3, l: .08, c: '#99eeff' }); hitMob(o, D.hit * (.3 + .7 * cq(1)), false, false, '#99eeff'); if (aw()) { const o2 = nearMobs(o.x, o.y, 30, o)[0]; if (o2) { bolts.push({ x1: o.x, y1: o.y - 3, x2: o2.x, y2: o2.y - 3, l: .08, c: '#ccf6ff' }); hitMob(o2, D.hit * .5, false, false, '#ccf6ff'); } } } } }
    totems = totems.filter(tt => tt.t > 0);
  }
  if (k === 'chrono') {
    const r = 24 + 24 * cq(0);
    for (const m of mobs) if (!m.dead && Math.hypot(m.x - hero.x, m.y - hero.y) < r) { m.slowT = Math.max(m.slowT || 0, .1); m.cd += dt * .4; }
    for (const m of mobs) if (m.bombT > 0 && !m.dead) { m.bombT -= dt; if (m.bombT <= 0) { ring(m.x, m.y - 3, 10, '#88aaff'); fxLabel('Отсрочка', m.x, m.y - 12, '#88aaff'); const b = m.bomb; hitMob(m, b, false, true, '#88aaff'); hitAround(m.x, m.y, 10, b * .3, '#88aaff', m); } }
  }
  if (k === 'reap' && hero.souls > 0) { hero.soulT = (hero.soulT || 0) - dt; if (hero.soulT <= 0) { hero.soulT = .5; hero.souls--; } }
  for (const rn of runes) {
    rn.t -= dt; if (rn.t > 0) continue;
    const dmg = rn.big || D.hit * (1.4 + cq(0));
    ring(rn.x, rn.y - 2, rn.r, '#bb88ff'); burst(rn.x, rn.y - 2, '#bb88ff', 8, 35);
    if (rn.m && !rn.m.dead && Math.hypot(rn.m.x - rn.x, rn.m.y - rn.y) < rn.r) heroStrike(rn.m, true);
    hitAround(rn.x, rn.y, rn.r, dmg * .7, '#bb88ff', rn.m);
    if (rn.res && rnd() < .6 * cq(1)) { const o = nearMobs(rn.x, rn.y, 40, rn.m)[0]; if (o) { runes.push({ x: o.x, y: o.y, t: .3, m: o, r: rn.r, res: false }); fxLabel('Резонанс', o.x, o.y - 12, '#bb88ff'); } }
  }
  runes = runes.filter(rn => rn.t > 0);
}
// убийство: эффекты класса
function clsKill(m, base) {
  const k = cls();
  if (isSty('bers', 0)) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .01 * stf());
  if (capOn('reap')) hero.hp = Math.min(D.maxHP, hero.hp + D.maxHP * .01);
  if (capOn('assa')) hero.tsd = 1;
  if (k === 'necro' && !m.boss && !m.goblin && allies.length < 4 + Math.floor(12 * cq(0)) + (aw() ? 6 : 0) + (capOn('necro') ? 6 : 0) && rnd() < .2 + .5 * cq(0) + (capOn('necro') ? .3 : 0)) { allies.push({ x: m.x, y: m.y, t: 10 + 10 * cq(1), cd: .5, face: 1 }); burst(m.x, m.y - 3, '#7affb0', 8, 25); fxLabel('Восстань!', m.x, m.y - 12, '#7affb0'); }
  if (k === 'reap') { hero.souls = Math.min(5 + Math.floor(25 * cq(1)) + (aw() ? 20 : 0), (hero.souls || 0) + 1); hero.soulT = 4; orbs.push({ x: m.x, y: m.y - 3, vx: 0, vy: -40, c: '#ff44ff', t: 0 }); }
  if (k === 'alch' && cq(1) > .01 && clouds.some(c => c.acid && Math.hypot(c.x - m.x, c.y - m.y) < c.r) && rnd() < .2 * cq(1)) { giveBurst(base * 5); fxLabel('Трансмутация', m.x, m.y - 12, '#ffd84a'); burst(m.x, m.y - 3, '#ffd84a', 10, 35); }
}
// блок стража
function clsBlock(dmg) {
  if (capOn('bers') && S.hpf < .3) dmg *= .5;
  if (cls() === 'guard' && rnd() < .5 * cq(0)) { if (texts.length < 7 && rnd() < .5) ftext(hero.x, hero.y - 10, 'блок', '#8fb0d0', .8, .6); burst(hero.x + hero.face * 4, hero.y - 4, '#8fb0d0', 3, 20); if (aw() && time > (hero.ctrT || 0)) { hero.ctrT = time + .5; ring(hero.x, hero.y - 3, 16, '#8fb0d0'); hitAround(hero.x, hero.y, 16, D.hit * 2, '#8fb0d0'); } return 0; }
  return dmg;
}

function zs() { return Math.pow(1.08, S.zone - 1); }
function zoneNeed() { return 18 + S.zone * 3; }   // темп: в 1.5 раза больше убийств на зону
// сила зоны фиксирована и не зависит от героя: сначала тяжело, потом разносишь
let ZHP = 1.5, ZDM = 1.4, ZB = 9, ZK = 1.2, ZT = 12;
// рост зоны: в начале круче (герой растёт взрывно), дальше ×1.5 за зону
const zl = [0];
function zoneLog(z) { while (zl.length < z) { const i = zl.length; zl.push(zl[i - 1] + Math.log10(ZHP + ZK * Math.exp(-i / ZT))); } return zl[z - 1]; }
// враги крепнут всё быстрее: по кубу зоны, а после 50-й — несоизмеримо (стена мира)
let ZQ = .006, ZC = .0004, ZWK = 25;
const zx1 = z => ZQ * z * z + ZC * z * z * z;
// этап 1: куб до 50-й и стена после неё; этап 2 (после Вознесения): за 50-й рост мягче, стена после 100-й
const zoneX = z => { const W0 = S.meta && S.meta.asc ? 100 : 50; const base = z <= 50 ? zx1(z) : zx1(50) + .45 * (z - 50) + .004 * (z - 50) ** 2; return base + ZWK * Math.max(0, z - W0 + (W0 === 100 ? 1 : 0)) ** 2; };   // 2-й этап: стена ровно на 100-й
const zoneHP = z => ZB * Math.pow(10, zoneLog(z) + zoneX(z));
// угроза жизни: чем дольше живёт герой, тем злее враги и щедрее награды
const threatM = () => Math.pow(2, (S.lt || 0) / (S.meta.asc ? 70 : 45));   // удвоение каждые 45с жизни (70с после Вознесения — подъём длиннее)
let MOBDMG = 5;   // толпа опасна: урон обычных врагов ×5 (влияет и на ближний бой вожаков)
const zoneDmg = z => (z > 50 ? 1 - .05 * ascL('world') : 1) * (worldIdx(z) === 4 ? 1.2 : 1) * 2.2 * Math.pow(10, zoneLog(z) * Math.log(ZDM) / Math.log(ZHP) + .85 * zoneX(z));   // урон растёт медленнее здоровья: стена — «не пробить», а не «убили за секунду»
const isLegend = z => z % 10 === 0;
const bossMult = z => 18 * (isLegend(z) ? 4 : 1);
const bossAffN = z => z < 6 ? 0 : Math.min(Math.min(AFF.length, 1 + Math.floor(z / 8)), Math.floor(z / 12) + 1);
// готовность к вожаку: успеет ли герой убить его, пока сам держится
// быстрый старт после вознесений: проматываем зоны с 1-й, пока герой к ним готов (не телепорт — иначе петля смертей)
function fastStart(target) {
  let it = 0;
  while (S.zone < target && it++ < 4000) {
    if (it % 5 === 0) recalc();
    if (S.zk >= zoneNeed()) { recalc(); if (readiness() >= 1.3) { S.zone++; S.zk = 0; continue; } break; }
    const k = Math.max(1, zoneNeed() - S.zk), g = k * zs() * D.gainMult * 3.5 * (1 + D.rare * 7) * 1.3 * (1 + ta('gain')), picks = Math.min(stats.length, 12);
    for (let q = 0; q < picks; q++) { const st = pickStat(); st.v += g / picks * (.6 + rnd() * .8); tryEvolve(st, true); }
    S.kills += k; S.zk = Math.min(zoneNeed(), S.zk + k); checkUnlocks(true);
  }
  S.zk = 0; mobs = []; bossAlive = false;
  if (S.zone > 1) feed('Звёздный старт: сразу ' + S.zone + '-я зона', '#7ad8ff');
}
function readiness() {
  const z = S.zone;
  const bh = zoneHP(z) * 1.15 * 1.1 * bossMult(z) * (1 + .6 * bossAffN(z));
  const dps = D.hit * D.aps * (1 + D.crit * (D.critM - 1)) * 1.15;
  const killT = bh / dps;
  const inc = zoneDmg(z) * (2 * (isLegend(z) ? 1.5 : 1) + 2.5) * (1 - D.armor) * (1 - D.dodge);
  const heal = D.maxHP * D.regen + D.maxHP * D.vamp * D.aps;
  const surv = inc <= heal ? 1e9 : D.maxHP * .85 / (inc - heal);
  D.rKill = 22 / killT; D.rSurv = surv / killT;
  return Math.min(22 / killT, surv / killT);
}

function recalc() {
  const T = new Float64Array(NE);
  for (const s of stats) T[s.e] += s.v * s.w;
  const z = zs(), r = i => T[i] / z;
  const R = {}; EFF.forEach((e, i) => { const j = ATTR_OF[e.k]; R[e.k] = r(i) * (1 + ta('e_' + e.k)) * (j != null ? attrMul(j) : 1) * (1 + .05 * thrL(e.k)) * (trHas('star') ? 1.05 : 1) * (1 + skyV('eff')) * legR(); });
  thrCheck(R);
  updSyn(R);
  updForms(R);
  const ord = EFF.map((e, i) => i).sort((a, b) => R[EFF[b].k] - R[EFF[a].k]);
  D.top = ord.slice(0, 3);
  const lead = ord[0], r1 = R[EFF[lead].k], r2 = R[EFF[ord[1]].k];
  D.spec = r1 >= 10 && (r1 >= 1.5 * r2 || (D.spec === lead && r1 >= 1.2 * r2)) ? lead : -1;
  if (D.spec >= 0) R[EFF[D.spec].k] *= skyOn('sk_spec') ? 2 : 1.5;
  D.T = T; D.R = R;
  D.maxHP = (50 + 8 * T[1]) * (1 + ta('hp')) * (1 + ta('x_tank')) * (on('x_glass') ? .5 : 1);
  let aps = 1.2 * (1 + 0.7 * lg(R.aspd)) * (1 + .15 * sy(4)) * (1 + ta('x_haste')) * (on('x_tank') ? .75 : 1);
  let over = 1; if (aps > 10) { over = aps / 10; aps = 10; }
  D.aps = aps;
  D.power = 1 + lg(R.power);
  D.hit = (4 + T[0]) * D.power * over * (1 + ta('hit')) * (1 + ta('x_glass')) * (on('x_elem') ? .7 : 1) * (on('x_haste') ? .8 : 1) * (on('x_tapper') ? .7 : 1);
  D.crit = (0.05 + 0.7 * sat(R.crit, 40)) * (on('x_exec') ? .7 : 1);
  D.critM = (2 + Math.log2(1 + R.critd / 5)) * (1 + .5 * sy(11)) * (1 + ta('x_exec'));
  D.vamp = on('x_regen') ? 0 : 0.07 * sat(R.vamp, 60);
  D.regen = (0.02 + 0.07 * sat(R.regen, 60)) * (1 + .5 * sy(7)) * (1 + ta('x_regen'));
  D.armor = 0.9 * sat(R.armor, 80);
  D.dodge = 0.6 * sat(R.dodge, 120);
  D.rare = (0.02 + 0.06 * sat(R.luck, 100) + Math.min(.1, .01 * sy(5)) + Math.min(.15, ta('rare'))) * (on('x_gamble') ? 3 : 1);
  D.gainMult = (1 + 0.6 * lg(R.wis)) * (1 + 0.4 * lg(R.luck));
  D.move = 22 * (1 + 0.4 * lg(R.move));
  D.range = Math.min(40, 8 + 5 * lg(R.range));
  D.cleave = on('x_focus') ? 0 : Math.floor(Math.log2(1 + R.cleave / 15));
  D.fire = 0.6 * sat(R.fire, 80) * (1 + ta('x_elem')); D.fireR = Math.min(34, (6 + 3 * lg(R.fire)) * (1 + .3 * sy(10)));
  D.poison = 0.8 * sat(R.poison, 80) * (1 + ta('x_elem'));
  D.shock = Math.min(.85, 0.5 * sat(R.shock, 100) + .05 * sy(9)); D.chain = 3 + 2 * sy(9);
  D.thorns = 1.5 * sat(R.thorns, 80) * (1 + 2 * sy(3));
  D.bleed = .6 * sat(R.bleed, 60);
  D.frost = sat(R.frost, 60);
  D.exec = .25 * sat(R.exec, 80);
  D.bounce = Math.min(6, Math.floor(Math.log2(1 + R.bounce / 20)));
  D.grav = sat(R.grav, 80);
  D.spirits = Math.min(6, Math.floor(Math.log2(1 + R.spirit / 10)));
  D.greed = Math.min(10, Math.floor(Math.log2(1 + R.greed / 15)));
  D.barrier = .3 * sat(R.barrier, 60);
  D.det = .5 * sat(R.det, 60);
  D.leech = .05 * sat(R.leech, 60);
  D.rageK = .15 * sat(R.rage, 60);
  D.scrit = .4 * sat(R.scrit, 80);
  D.hunt = 1 + .5 * lg(R.hunt);
  D.energy = 1 + .3 * lg(R.energy);
  D.fear = .5 * sat(R.fear, 80);
  D.curious = .25 * lg(R.curio);
  D.trail = sat(R.trail, 60);
  D.orbs = Math.min(4, Math.floor(Math.log2(1 + R.orbs / 15)));
  D.echo = .6 * sat(R.echo, 60);
  D.mark = .5 * sat(R.mark, 60);
  D.horde = Math.min(40, Math.floor(6 * lg(R.horde)));
  D.blink = .6 * sat(R.blink, 80);
  D.dust = .25 * sat(R.dust, 60);
  D.quake = sat(R.quake, 60);
  D.beam = sat(R.beam || 0, 50); D.clone = sat(R.clone || 0, 50); D.hole = sat(R.hole || 0, 50); D.mirror = sat(R.mirror || 0, 50); D.crows = sat(R.crows || 0, 50); D.ritual = sat(R.ritual || 0, 50);
  calcPath();
  clsMods();   // классы: бонусы, уникальные статы, мастерство ветви
  ntMods(); pathMods(); constMods(); gearMods(); perkMods(); trMods(); skyMods(); relMods(); totemMods();
  D.aps = Math.min(8, D.aps * .7);   // темп боя: удары реже и читаемее
  D.furyK = 2 * sat(R.fury, 50) * (1 + sy(6));
}
const furyM = () => 1 + (1 - S.hpf) * D.furyK;
const exMult = () => S.hpf >= .35 ? 1 : .3 + .7 * S.hpf / .35;

