'use strict';
/* =========================================================
   БЕСКОНЕЧНАЯ ДРАКА — пиксельная бесконечная прокачка
   ========================================================= */
const $ = id => document.getElementById(id);
// SIM = true — быстрый режим симуляции баланса: без чисто визуальных эффектов (частицы, тексты, звук, следы); логика боя та же
var SIM = false;
const rnd = Math.random;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sat = (x, k) => x / (x + k);           // плавное насыщение 0..1, никогда не достигает 1
const lg = x => Math.log10(1 + Math.max(0, x));

/* ---------- форматирование чисел ---------- */
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 10) return (Math.round(n * 10) / 10).toString();
  if (n < 1000) return Math.floor(n).toString();
  const ex = Math.floor(Math.log10(n));
  const e3 = Math.floor(ex / 3);
  if (e3 < SUF.length) {
    const m = n / Math.pow(10, e3 * 3);
    return (m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : Math.floor(m)) + SUF[e3];
  }
  return (n / Math.pow(10, ex)).toFixed(2) + 'e' + ex;
}
const pct = x => (x * 100 < 10 ? (x * 100).toFixed(1) : Math.floor(x * 100)) + '%';
function roman(n) {
  const m = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s;
}

/* ---------- цвета ---------- */
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + ((1 << 24) | (clamp(r|0,0,255) << 16) | (clamp(g|0,0,255) << 8) | clamp(b|0,0,255)).toString(16).slice(1); }
function shade(h, f) { const [r, g, b] = hexRgb(h); return f < 0 ? rgbHex(r * (1 + f), g * (1 + f), b * (1 + f)) : rgbHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); }
function hsl2hex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
function hueShift(hex, dh) {
  let [r, g, b] = hexRgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return hsl2hex(h + dh, s * 100, l * 100);
}

/* ---------- эффекты (основы статов) ---------- */
const EFF = [
  { k: 'dmg',   n: 'Сила',        c: '#ff5544', d: 'урон удара' },
  { k: 'hp',    n: 'Живучесть',   c: '#ff88aa', d: 'макс. здоровье' },
  { k: 'aspd',  n: 'Ловкость',    c: '#ffdd44', d: 'скорость атаки' },
  { k: 'crit',  n: 'Точность',    c: '#ffaa22', d: 'шанс крита' },
  { k: 'regen', n: 'Регенерация', c: '#44ee66', d: 'восстановление HP' },
  { k: 'armor', n: 'Броня',       c: '#aabbcc', d: 'снижение урона' },
  { k: 'critd', n: 'Жестокость',  c: '#ff7a00', d: 'сила крита' },
  { k: 'vamp',  n: 'Вампиризм',   c: '#cc2244', d: 'лечение ударом' },
  { k: 'luck',  n: 'Удача',       c: '#44ffaa', d: 'редкие враги, награды' },
  { k: 'wis',   n: 'Мудрость',    c: '#bb88ff', d: 'прирост статов' },
  { k: 'move',  n: 'Скорость',    c: '#66ccff', d: 'скорость бега' },
  { k: 'cleave',n: 'Рассечение',  c: '#ff9988', d: 'доп. цели удара' },
  { k: 'dodge', n: 'Уклонение',   c: '#88ddff', d: 'шанс уворота' },
  { k: 'range', n: 'Размах',      c: '#dddd88', d: 'дальность удара' },
  { k: 'fire',  n: 'Пламя',       c: '#ff6622', d: 'огненный взрыв' },
  { k: 'poison',n: 'Яд',          c: '#88ee22', d: 'урон ядом' },
  { k: 'shock', n: 'Молния',      c: '#99eeff', d: 'цепная молния' },
  { k: 'thorns',n: 'Шипы',        c: '#cc9966', d: 'отражение урона' },
  { k: 'power', n: 'Мощь',        c: '#ff44ff', d: 'множитель урона' },
  { k: 'fury',  n: 'Ярость',      c: '#ff2222', d: 'урон при низком HP' },
  { k: 'bleed', n: 'Кровотечение', c: '#ff3355', d: 'удары вызывают кровотечение' },
  { k: 'frost', n: 'Холод',       c: '#a8e8ff', d: 'замедление и заморозка' },
  { k: 'exec',  n: 'Добивание',   c: '#f0f0f0', d: 'казнь ослабленных врагов' },
  { k: 'bounce',n: 'Рикошет',     c: '#ffe08a', d: 'удар отскакивает в соседей' },
  { k: 'grav',  n: 'Притяжение',  c: '#9a7aff', d: 'стягивает врагов к герою' },
  { k: 'spirit',n: 'Духи',        c: '#7affd8', d: 'призрачные клинки вокруг героя' },
  { k: 'greed', n: 'Алчность',    c: '#ffcc33', d: 'больше статов за убийство' },
  { k: 'barrier',n: 'Барьер',     c: '#6ad8ff', d: 'щит каждые несколько секунд' },
  { k: 'det',   n: 'Детонация',   c: '#ff7744', d: 'убитые враги взрываются' },
  { k: 'leech', n: 'Похищение',   c: '#dd2266', d: 'каждое убийство лечит' },
  { k: 'rage',  n: 'Раж',         c: '#ff9944', d: 'убийства разгоняют атаку' },
  { k: 'scrit', n: 'Сверхкрит',   c: '#ffff66', d: 'крит может сработать дважды' },
  { k: 'hunt',  n: 'Охотник',     c: '#ff5588', d: 'урон по вожакам и элите' },
  { k: 'energy',n: 'Энергия',     c: '#cc66ff', d: 'ульта заряжается быстрее' },
  { k: 'fear',  n: 'Аура страха', c: '#8844aa', d: 'враги рядом слабее и медленнее' },
  { k: 'curio', n: 'Любознательность', c: '#66ffcc', d: 'новые статы открываются быстрее' },
  { k: 'trail', n: 'Громовой шаг', c: '#99ccff', d: 'след героя бьёт врагов током' },
  { k: 'orbs',  n: 'Огненные сферы', c: '#ff8844', d: 'сферы вокруг героя жгут врагов' },
  { k: 'echo',  n: 'Эхо',         c: '#ccccff', d: 'удар повторяется волной через миг' },
  { k: 'mark',  n: 'Метка',       c: '#ff66aa', d: 'помеченные враги получают больше урона' },
  { k: 'horde', n: 'Орда',        c: '#d0a070', d: 'больше врагов на поле' },
  { k: 'blink', n: 'Скачок',      c: '#66ffff', d: 'герой телепортируется к цели' },
  { k: 'dust',  n: 'Кладоискатель', c: '#c9b07a', d: 'убийства дают пыль для вещей' },
  { k: 'quake', n: 'Землетрясение', c: '#b08a5a', d: 'каждый 6-й удар сотрясает землю' },
  { k: 'beam',  n: 'Кровавый луч', c: '#ff3366', d: 'луч бьёт сильнейшего врага и лечит' },
  { k: 'clone', n: 'Двойник',     c: '#8899ff', d: 'теневой двойник сражается рядом' },
  { k: 'hole',  n: 'Чёрная дыра', c: '#9a5aff', d: 'стягивает толпу и схлопывается' },
  { k: 'mirror',n: 'Зеркало',     c: '#bff4ff', d: 'щит отражает удар обратно' },
  { k: 'crows', n: 'Вороны',      c: '#7a6aa0', d: 'стая воронов пикирует на врагов' },
  { k: 'ritual',n: 'Ритуал',      c: '#cc0033', d: 'жертвует HP ради мощного взрыва' },
];
const NE = EFF.length;
const EI = {}; EFF.forEach((e, i) => EI[e.k] = i);
// формы эффектов: на порогах эффект меняет вид и получает новую механику
const EFORM = [
  ['Тяжёлый удар', 'Сокрушение', 'Раскол земли', 'Удар титана'],
  ['Крепкое тело', 'Каменная плоть', 'Живая гора', 'Бессмертное тело'],
  ['Быстрые руки', 'Шквал', 'Буря клинков', 'Тысяча ударов'],
  ['Меткий глаз', 'Слабые места', 'Звёздный крит', 'Абсолютный крит'],
  ['Заживление', 'Живой щит', 'Источник', 'Феникс'],
  ['Кожа', 'Кольчуга', 'Латы', 'Адамант'],
  ['Жестокость', 'Разрыв', 'Казнь', 'Аннигиляция'],
  ['Кровопийца', 'Жажда', 'Кровавая река', 'Владыка крови'],
  ['Везунчик', 'Клевер', 'Джекпот', 'Любимец судьбы'],
  ['Ученик', 'Двойной урок', 'Архимаг', 'Всезнание'],
  ['Резвость', 'Рывок', 'Послеобразы', 'Вездесущий'],
  ['Широкий замах', 'Двойной разрез', 'Вихрь', 'Ураган стали'],
  ['Ловкач', 'Тень', 'Призрак', 'Неуловимый'],
  ['Длинный меч', 'Алебарда', 'Копьё света', 'Бесконечный клинок'],
  ['Искры', 'Взрыв', 'Огненное кольцо', 'Метеоры'],
  ['Отрава', 'Ядовитое облако', 'Мор', 'Чёрная смерть'],
  ['Искра', 'Разряд', 'Шаровая молния', 'Небесный гром'],
  ['Колючки', 'Шипастая броня', 'Терновая волна', 'Терновый венец'],
  ['Сила воли', 'Мощь', 'Сияние', 'Божественная мощь'],
  ['Злость', 'Гнев', 'Багровая аура', 'Бешенство'],
  ['Порез', 'Рваная рана', 'Кровавый дождь', 'Река крови'],
  ['Озноб', 'Иней', 'Ледяные оковы', 'Вечная зима'],
  ['Добивание', 'Гильотина', 'Приговор', 'Жнец душ'],
  ['Отскок', 'Двойной рикошет', 'Пляска клинков', 'Буря рикошетов'],
  ['Тяга', 'Воронка', 'Чёрная дыра', 'Горизонт событий'],
  ['Искра духа', 'Пара духов', 'Хоровод', 'Легион духов'],
  ['Скупость', 'Жадность', 'Золотая лихорадка', 'Ненасытность'],
  ['Заслон', 'Купол', 'Бастион', 'Нерушимая стена'],
  ['Хлопок', 'Взрыв', 'Цепная реакция', 'Сверхновая'],
  ['Глоток', 'Пиявка', 'Кровавый пир', 'Бессмертный голод'],
  ['Азарт', 'Раж', 'Неистовство', 'Буря ярости'],
  ['Двойной крит', 'Сверхкрит', 'Мегакрит', 'Абсолютный удар'],
  ['Следопыт', 'Охотник', 'Ловец чудовищ', 'Убийца богов'],
  ['Искра', 'Заряд', 'Перегрузка', 'Бесконечная энергия'],
  ['Тень страха', 'Ужас', 'Кошмар', 'Конец света'],
  ['Интерес', 'Любопытство', 'Жажда знаний', 'Всеведение'],
  ['Искрящий след', 'Грозовой бег', 'Молниеносец', 'Шаг бури'],
  ['Уголёк', 'Две сферы', 'Солнечный хоровод', 'Малое солнце'],
  ['Отзвук', 'Эхо', 'Раскаты', 'Вечное эхо'],
  ['Метка', 'Клеймо', 'Приговорённый', 'Печать смерти'],
  ['Толпа', 'Стая', 'Орда', 'Нашествие тьмы'],
  ['Шаг', 'Скачок', 'Сквозь тени', 'Вездесущий'],
  ['Старатель', 'Кладоискатель', 'Золотая жила', 'Царь сокровищ'],
  ['Толчок', 'Удар оземь', 'Землетрясение', 'Раскол мира'],
  ['Алая нить', 'Кровавый луч', 'Багровый поток', 'Река крови'],
  ['Тень', 'Двойник', 'Отражение', 'Армия теней'],
  ['Воронка', 'Чёрная дыра', 'Горизонт событий', 'Сингулярность'],
  ['Блик', 'Зеркало', 'Зеркальный щит', 'Отражение мира'],
  ['Ворон', 'Стая', 'Чёрное крыло', 'Вороний король'],
  ['Порез', 'Ритуал', 'Кровавая жертва', 'Пакт крови'],
];
const FORM_HINT = {
  dmg: 'со 2-й формы удар даёт волну, с 3-й волна ранит соседей',
  regen: 'со 2-й формы лишнее лечение копится в щит',
  crit: 'с 3-й формы криты взрываются звездой',
  critd: 'криты оставляют огненный разрез',
  vamp: 'капли крови летят из врагов к герою',
  luck: 'с 3-й формы бывает ДЖЕКПОТ: все враги золотые',
  wis: 'со 2-й формы бывает двойной прирост',
  move: 'с 3-й формы послеобразы бьют других врагов',
  cleave: 'с 3-й формы каждый 4-й удар — вихрь по всем вокруг',
  fire: 'с 3-й формы огненное кольцо, с 4-й метеоры',
  poison: 'со 2-й формы яд оставляет облака',
  shock: 'с 3-й формы шаровые молнии, с 4-й удары с неба',
  thorns: 'с 3-й формы терновая волна вокруг героя',
};
const formNeed = f => 3 * Math.pow(10, 1.5 * (f - 1)) / (typeof SKYF !== 'undefined' && SKYF.sk_form ? 3 : 1);
const formName = (e, f) => f <= 0 ? 'нет формы' : EFORM[e][Math.min(f, 4) - 1] + (f > 4 ? ' ' + roman(f - 3) : '');
const SPEC = ['Громила', 'Колосс', 'Дуэлянт', 'Снайпер', 'Целитель', 'Страж', 'Палач', 'Вампир', 'Счастливчик', 'Мудрец',
  'Ветер', 'Мясник', 'Тень', 'Копейщик', 'Пиромант', 'Чумной доктор', 'Громовержец', 'Ёж', 'Титан', 'Берсерк',
  'Кровопускатель', 'Ледяной страж', 'Палач', 'Метатель', 'Гравитон', 'Призыватель', 'Скряга', 'Хранитель',
  'Подрывник', 'Пиявка', 'Неистовый', 'Мастер крита', 'Ловчий', 'Энергетик', 'Ужас ночи', 'Мудрец',
  'Громовой бегун', 'Огненный страж', 'Эхо войны', 'Метчик', 'Вожак орды', 'Призрак-скакун', 'Кладоискатель', 'Сотрясатель', 'Кровопийца', 'Двойник', 'Повелитель бездны', 'Зеркальщик', 'Вороний князь', 'Жрец крови'];
let formNew = [];
const F = i => ((S.form && S.form[i]) || 0) + ksL(6, 1);
function updForms(R) {
  if (!S.form) S.form = [];
  EFF.forEach((e, i) => {
    const r = R[e.k] * (1 + ta('form')), f = r < 3 ? 0 : 1 + Math.floor(Math.log10(r / 3) / 1.5);
    if (f > (S.form[i] || 0)) { S.form[i] = f; formNew.push([i, f]); }   // форма никогда не откатывается
  });
}
const NOUNS = ['Ярость','Кровь','Мощь','Длань','Душа','Печать','Сталь','Искра','Тень','Песнь','Клятва','Гнев','Дух','Пламя','Коготь','Клык','Сердце','Взор','Шёпот','Рёв','Воля','Руна','Слеза','Кость','Корона','Буря','Метка','Жажда'];
const GENS  = ['Дракона','Бездны','Титана','Пепла','Луны','Солнца','Бури','Звёзд','Древних','Хаоса','Грома','Льда','Демона','Феникса','Вечности','Пустоты','Короля','Волка','Крови','Мёртвых','Небес','Вулкана','Ворона','Змея','Рассвета','Глубин','Богов','Войны'];
const NPAIR = NOUNS.length * GENS.length;

function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; }
function makeStat(n) {
  let bn, e, w0;
  if (n < NE) { bn = EFF[n].n; e = n; w0 = 1; }
  else {
    const i = n - NE;
    const p = (i * 7919) % NPAIR, tier = Math.floor(i / NPAIR);
    bn = NOUNS[p % NOUNS.length] + ' ' + GENS[Math.floor(p / NOUNS.length)] + (tier ? ' (' + (tier + 1) + ')' : '');
    e = hash(i + 7) % NE; w0 = Math.pow(1.5, i / 10 + 1);
  }
  const s = { n, bn, e, w0, lvl: 0, v: 0, g: 0, at: 0 }; setLvl(s, 0); return s;
}
// эволюция: стат перерастает порог и превращается в более сильную версию (вес ×4)
function setLvl(s, l) { s.lvl = l; s.w = s.w0 * Math.pow(4, l); s.name = s.bn + (l ? ' ' + roman(l + 1) : ''); }
const evoAt = s => 1000 * Math.pow(1000, s.lvl) / (1 + ta('evo')) / (1 + .08 * ntL(6, 2));
let evoToastT = 0;
function tryEvolve(s, silent) {
  let up = 0; while (s.v >= evoAt(s)) { setLvl(s, s.lvl + 1); up++; }
  if (!up) return 0;
  D.dirty = true;
  if (s.el) { s.el.children[1].textContent = s.name; s.el.children[2].textContent = '×' + fmt(s.w); s.el.classList.remove('new'); void s.el.offsetWidth; s.el.classList.add('new'); }
  if (!silent) feed('Эволюция: ' + s.name + ' ×' + fmt(s.w), EFF[s.e].c);
  if (!silent && performance.now() > evoToastT) { evoToastT = performance.now() + 3000; sfx.evo(); burst(hero.x, hero.y - 4, EFF[s.e].c, 16, 40); tip('evo', 'Эволюция стата', 'Стат перерос порог и стал сильнее (вес ×4). Это происходит само.'); }
  return up;
}

/* ---------- синергии ---------- */
const SYN = [
  { n: 'Плазма',          a: 'fire',  b: 'shock',  d: 'взрывы бьют молниями' },
  { n: 'Чума',            a: 'poison',b: 'cleave', d: 'яд перекидывается на соседей' },
  { n: 'Кровавая жатва',  a: 'vamp',  b: 'crit',   d: 'криты лечат и бьют сильнее' },
  { n: 'Крепость',        a: 'armor', b: 'thorns', d: 'шипы сильнее и бьют вокруг' },
  { n: 'Ураган',          a: 'aspd',  b: 'move',   d: '+15% скорости атаки за уровень' },
  { n: 'Фортуна',         a: 'luck',  b: 'wis',    d: 'редкие враги чаще и щедрее' },
  { n: 'Берсерк',         a: 'fury',  b: 'power',  d: 'ярость намного сильнее' },
  { n: 'Бессмертие',      a: 'regen', b: 'hp',     d: '+50% регенерации за уровень' },
  { n: 'Танец теней',     a: 'dodge', b: 'move',   d: 'уворот даёт контрудар' },
  { n: 'Гроза',           a: 'shock', b: 'range',  d: 'цепь молний длиннее' },
  { n: 'Огненный шторм',  a: 'fire',  b: 'range',  d: 'радиус взрывов больше' },
  { n: 'Палач',           a: 'critd', b: 'dmg',    d: '+50% силы крита за уровень' },
].map(y => ({ ...y, a: EFF.findIndex(e => e.k === y.a), b: EFF.findIndex(e => e.k === y.b) }));
const SYN_TH = 50;
let synNew = [];
const sy = i => (S.syn && S.syn[i]) || 0;
function updSyn(R) {
  if (!S.syn) S.syn = [];
  SYN.forEach((y, i) => {
    const m = Math.min(R[EFF[y.a].k], R[EFF[y.b].k]);
    const l = m >= SYN_TH ? Math.floor(Math.log10(m / SYN_TH) / 2) + 1 : 0;
    const was = S.syn[i] || 0;
    if (l > was) { S.syn[i] = l; synNew.push([i, was]); }   // уровень синергии никогда не падает
  });
}

/* ---------- аффиксы мобов ---------- */
const AFF = [
  { n: 'Бронированный', c: '#aabbcc' }, { n: 'Быстрый', c: '#66ccff' }, { n: 'Взрывной', c: '#ff6622' }, { n: 'Вампир', c: '#cc2244' },
  { n: 'Делящийся', c: '#88ee22' }, { n: 'Гигант', c: '#ffdd44' }, { n: 'Регенерирующий', c: '#44ee66' }, { n: 'Призрачный', c: '#bb88ff' },
  { n: 'Ледяной', c: '#9fe8ff' }, { n: 'Мерцающий', c: '#ff88ff' }, { n: 'Отражающий', c: '#ffffff' }, { n: 'Ядовитый', c: '#88ee22' },
];
const popc = a => { let c = 0; while (a) { c += a & 1; a >>= 1; } return c; };
function rollAff(boss, force) {
  const max = Math.min(AFF.length, 1 + Math.floor(S.zone / 8));
  let n = 0;
  if (force) n = Math.min(AFF.length, force);
  else if (boss) n = S.zone < 6 ? 0 : Math.min(max, Math.floor(S.zone / 12) + 1);
  else { const p = Math.min(.85, .08 + S.zone * .012); while (n < max && rnd() < p) n++; }
  let af = 0, guard = 0;
  while (popc(af) < n && guard++ < 50) { const i = Math.floor(rnd() * AFF.length); if (boss && i === 5) continue; af |= 1 << i; }
  return af;
}
const affNames = af => AFF.filter((a, i) => af >> i & 1).map(a => a.n).join(', ');
const unlockKills = n => n < 3 ? 0 : Math.round(6 * Math.pow(n - 2, 1.6) / ((1 + (D.curious || 0)) * (1 + ta('unlock')) * (1 + ta('x_scholar'))));

/* ---------- модификаторы зон ---------- */
const ZMODS = {
  giant: { n: 'Гиганты', c: '#ffdd44', d: 'враги вдвое крепче и крупнее · награды ×2', g: 2 },
  swarm: { n: 'Рой', c: '#88ee22', d: 'врагов почти вдвое больше, но они слабее', g: 1 },
  fast: { n: 'Спешка', c: '#66ccff', d: 'враги быстрее · награды ×1.5', g: 1.5 },
  night: { n: 'Ночь', c: '#8a9aff', d: 'темно, но золотые враги чаще', g: 1 },
  storm: { n: 'Гроза', c: '#99eeff', d: 'молнии бьют врагов, но враги злее · награды ×1.3', g: 1.3 },
  snow: { n: 'Метель', c: '#e6f4ff', d: 'враги вязнут в снегу', g: 1 },
  gold: { n: 'Золотая лихорадка', c: '#ffd84a', d: 'золотые враги втрое чаще', g: 1 },
  curse: { n: 'Проклятие', c: '#c06bff', d: 'враги восстанавливаются · награды ×2', g: 2 },
};
const zm = () => S.zmod ? ZMODS[S.zmod] : null;

/* ---------- разнообразие зон (1–50): задачи зон и опасности биомов ---------- */
const ZTASKS = {
  waves: { n: 'ВОЛНЫ', c: '#ff9a3c', d: 'враги идут волнами — отбей 3 волны' },
  hunt: { n: 'ОХОТА', c: '#ff5588', d: 'по зоне бродит добыча (розовая метка) — убей 4' },
  totem: { n: 'ТОТЕМЫ', c: '#c06bff', d: 'тотемы усиливают врагов рядом — разрушь все 3' },
};
const zTask = () => S.zone <= 50 && S.ztask && ZTASKS[S.ztask] ? S.ztask : null;
function rollZTask() {
  const last = S.ztask; S.ztask = null; S.zt = null;
  if (S.zone < 4 || S.zone > 50 || isLegend(S.zone) || rnd() > .45) return;
  const ks = Object.keys(ZTASKS).filter(k => k !== last);
  S.ztask = ks[Math.floor(rnd() * ks.length)]; S.zt = { nk: 0, wave: 0, done: 0, wt: 1.2, prey: 0, tot: 0, pt: 0, fin: 0 };
}
const ztState = () => S.zt || (S.zt = { nk: 0, wave: 0, done: 0, wt: 1.2, prey: 0, tot: 0, pt: 0, fin: 0 });
function zkCalc() {
  const t = zTask(); if (!t) return; const z = ztState(), need = zoneNeed(); let v;
  if (t === 'waves') v = z.done >= 3 ? need : Math.floor(need * z.done / 3);
  else if (t === 'hunt') v = Math.min(Math.floor(need * .5), z.nk) + Math.ceil(need * .5 * Math.min(4, z.prey) / 4);
  else v = Math.min(Math.floor(need * .6), z.nk) + Math.ceil(need * .4 * Math.min(3, z.tot) / 3);
  S.zk = Math.min(need, v);
  if (S.zk >= need && !z.fin) { z.fin = 1; giveChest('r', 'задача'); toast('ЗАДАЧА ВЫПОЛНЕНА!', ZTASKS[t].n + ' · редкий сундук · идёт вожак'); tone(659, .1, 'square', .04); tone(988, .15, 'square', .04, 0, .1); }
}
function zkKill(m) {
  const h = hazard();
  if (m.harvest) { giveChest('c', 'жатва'); burst(m.x, m.y - 4, '#ff44ff', 20, 50); }
  if (skyOn('sk_harvest') && !m.boss && !m.obj && (S.hv = (S.hv || 0) + 1) % 150 === 0) { spawnMob(false); const o = mobs[mobs.length - 1]; o.hp *= 10; o.max *= 10; o.sz = 1.5; o.rare = true; o.harvest = 1; o.role = null; fxLabel('Жатва!', o.x, o.y - 14, '#ff44ff'); }
  if (!m.obj && ((m.boss && skyOn('sk_bosschest')) || ((m.boss || m.rare) && rnd() < skyV('chestc')))) giveChest('c', 'звезда');
  if (m.boss && skyOn('sk_comet')) later(.35, () => { ring(m.x, m.y - 4, 60, '#fff6a0'); burst(m.x, m.y - 6, '#fff6a0', 30, 80); for (const o of mobs) if (!o.dead && !o.obj) hitMob(o, D.hit * 20, true, false, '#fff6a0'); fxLabel('Комета', m.x, m.y - 20, '#fff6a0'); });
  if (m.loot) { S.runSouls = (S.runSouls || 0) + m.loot * 2; ftext(m.x, m.y - 14, '+' + fmt(m.loot * 2) + ' душ', '#ffd84a', 1, 1); }
  if (m.obj === 'crystal') { burst(m.x, m.y - 6, '#7ad8ff', 24, 60); ring(m.x, m.y - 4, 30, '#7ad8ff'); later(.05, () => hitAround(m.x, m.y, 32, D.hit * 12, '#7ad8ff', m)); }
  if (m.obj === 'portal') { addSouls(bossSouls(S.zone) * .25, m); burst(m.x, m.y - 6, '#b06aff', 24, 50); feed('Портал закрыт', '#b06aff'); }
  for (const o of mobs) if (o.role === 'berserk' && !o.dead && o !== m && (o.rage || 0) < 5 && Math.hypot(o.x - m.x, o.y - m.y) < 40) { o.rage = (o.rage || 0) + 1; o.sp *= 1.15; o.dm *= 1.2; burst(o.x, o.y - 4, '#ff2222', 3, 15); }
  if (h && h.k === 'crypt' && !m.boss && !m.obj && !m.undead && !m.goblin && rnd() < .2) { const x = m.x, y = m.y;
    later(1.4, () => { if (S.zone > 50) return; spawnMob(false); const o = mobs[mobs.length - 1]; o.x = x; o.y = y; o.undead = 1; o.role = null; o.hp *= .4; o.max *= .4; burst(x, y - 3, '#b06aff', 8, 25); }); }
  if (m.boss) return;
  const t = zTask(); if (!t) { S.zk += m.hw ?? 1; return; }
  const z = ztState();
  if (m.obj === 'totem') { z.tot++; feed('Тотем разрушен ' + Math.min(3, z.tot) + '/3', '#c06bff'); }
  else if (m.prey) { z.prey++; feed('Добыча ' + Math.min(4, z.prey) + '/4', '#ff5588'); }
  else if (!m.obj) z.nk++;
  zkCalc();
}
const zSpawnHold = () => zTask() === 'waves' && !bossAlive && ztState().done < 3;
function farPoint(minD, maxD = 999) { for (let i = 0; i < 30; i++) { const x = 15 + rnd() * (AW - 30), y = 22 + rnd() * (AH - 40), d = Math.hypot(x - hero.x, y - hero.y); if (d >= minD && d <= maxD) return { x, y }; } return { x: clamp(hero.x + minD, 15, AW - 15), y: hero.y }; }
function spawnObj(kind, x, y, hpm) { const hp = zoneHP(S.zone) * hpm; mobs.push({ t: 0, x, y, ax: x, ay: y, h: 0, hp, max: hp, rare: false, boss: false, sz: 1.3, af: 0, na: 0, obj: kind, sp: 0, dm: 0, cd: 99, fl: 0, kx: 0, ky: 0, psn: 0, psnT: 0, dead: false, ot: rnd() * 6 }); return mobs[mobs.length - 1]; }
function objTick(m, dt) {
  m.x = m.ax; m.y = m.ay; m.kx = m.ky = 0; m.fl -= dt; m.ot += dt; m.frz = 0;
  if (m.obj === 'portal') { m.st = (m.st ?? 2) - dt; if (m.st <= 0) { m.st = 3.5; if (mobs.length < 70) for (let i = 0; i < 2; i++) { spawnMob(false); const o = mobs[mobs.length - 1]; o.x = clamp(m.x + (rnd() - .5) * 12, 4, AW - 4); o.y = clamp(m.y + 4 + rnd() * 6, 8, AH - 2); } burst(m.x, m.y - 6, '#b06aff', 8, 30); } }
}
function spawnWave(z) {
  const n = clamp(Math.round(crowd() * 1.2), 8, 40) + Math.round(hordeAdd() * .8), b0 = mobs.length;   // в орде волны тоже огромные
  for (let i = 0; i < n; i++) spawnMob(false);
  for (let i = b0; i < mobs.length; i++) { const m = mobs[i], a = (i - b0) / n * 6.283 * 3 + rnd() * .3, rr = 48 + rnd() * 14 + ((i - b0) % 3) * 12; m.x = clamp(hero.x + Math.cos(a) * rr, 4, AW - 4); m.y = clamp(hero.y + Math.sin(a) * rr * .8, 8, AH - 2); m.wv = 1; }
  z.wave++; ring(hero.x, hero.y - 3, 40, '#ff9a3c'); toast('ВОЛНА ' + z.wave + ' / 3', z.wave === 3 ? 'последняя!' : 'отбей всех врагов', 1400); tone(330, .15, 'square', .04, 220);
}
function zoneTick(dt) {
  hzTick(dt);
  const t = zTask(); if (!t || bossAlive) return; const z = ztState();
  if (t === 'waves' && z.done < 3) {
    if (!mobs.some(m => !m.dead && m.wv)) { if (z.wave > z.done) { z.done = z.wave; zkCalc(); z.wt = 1.6; if (z.done < 3) feed('Волна отбита!', '#ff9a3c'); } else if ((z.wt -= dt) <= 0) spawnWave(z); }
  }
  if (t === 'hunt' && z.prey < 4) { const ap = mobs.filter(m => !m.dead && m.prey).length; z.pt -= dt;
    if (ap < 2 && ap + z.prey < 4 && z.pt <= 0) { z.pt = 2.5; spawnMob(false); const m = mobs[mobs.length - 1], pt = farPoint(55, 140); m.x = pt.x; m.y = pt.y; m.prey = 1; m.role = null; m.hp *= 4; m.max *= 4; m.sp *= 1.25; m.sz = Math.max(m.sz, 1.25); m.rare = false;
      if (z.prey + ap === 0) feed('Добыча где-то рядом — ищи розовую метку', '#ff5588'); } }
  if (t === 'totem' && z.tot < 3) { const at = mobs.filter(m => !m.dead && m.obj === 'totem').length;
    for (let i = at; i + z.tot < 3; i++) { const pt = farPoint(40, 100); spawnObj('totem', pt.x, pt.y, 8); } }
}
const HAZ = [null,
  { k: 'fog', n: 'Туман', c: '#9aa0b0', d: 'из тумана выходят засады' },
  { k: 'bog', n: 'Трясина', c: '#7ac03a', d: 'ядовитые лужи жгут героя, враги в них вязнут' },
  { k: 'sand', n: 'Смерч', c: '#e0c080', d: 'смерч бродит по полю и перемалывает врагов' },
  { k: 'crypt', n: 'Нежить', c: '#b06aff', d: 'павшие враги иногда встают снова' },
  { k: 'ice', n: 'Сосульки', c: '#a8e8ff', d: 'сверху падают сосульки — бьют и героя, и врагов' },
  { k: 'lava', n: 'Извержение', c: '#ff6622', d: 'камни лавы оставляют горящие лужи' },
  { k: 'abyss', n: 'Порталы', c: '#b06aff', d: 'порталы выпускают врагов — закрывай их' },
  { k: 'crystal', n: 'Кристаллы', c: '#7ad8ff', d: 'разбей кристалл — он взорвётся по врагам' },
  { k: 'spore', n: 'Споры', c: '#d080ff', d: 'облака спор замедляют всех внутри' },
];
const hazard = () => S.zone <= 50 ? HAZ[Math.floor((S.zone - 1) / ZONES_PER_BIOME)] || null : null;
let HZ = { z: -1, pools: [] };
function hzStart() {
  HZ = { z: S.zone, pools: [], torn: null, t: 3 }; const h = hazard(); if (!h) return;
  if (h.k === 'bog') for (let i = 0; i < 6; i++) { const pt = farPoint(18); HZ.pools.push({ x: pt.x, y: pt.y, r: 10 + rnd() * 7, tp: 'bog', t: 1e9 }); }
  if (h.k === 'sand') { const pt = farPoint(40, 90); HZ.torn = { x: pt.x, y: pt.y, a: rnd() * 6.28 }; }
}
function hzTick(dt) {
  if (HZ.z !== S.zone) hzStart();
  const h = hazard(); if (!h) return;
  HZ.t -= dt;
  if (h.k === 'fog' && HZ.t <= 0 && !bossAlive) { HZ.t = 16; for (let i = 0; i < 5; i++) { spawnMob(false); const m = mobs[mobs.length - 1], a = i / 5 * 6.28 + rnd(); m.x = clamp(hero.x + Math.cos(a) * 26, 4, AW - 4); m.y = clamp(hero.y + Math.sin(a) * 20, 8, AH - 2); burst(m.x, m.y - 3, '#c0c6d0', 5, 20); } fxLabel('Засада!', hero.x, hero.y - 18, '#c0c6d0'); }
  if (h.k === 'sand' && HZ.torn) { const T = HZ.torn; T.a += (rnd() - .5) * dt * 2.5;
    const toH = Math.atan2(hero.y - T.y, hero.x - T.x); if (Math.hypot(hero.x - T.x, hero.y - T.y) > 70) T.a += (toH - T.a) * dt;   // держится недалеко от боя
    T.x += Math.cos(T.a) * 16 * dt; T.y += Math.sin(T.a) * 16 * dt; if (T.x < 15 || T.x > AW - 15 || T.y < 20 || T.y > AH - 10) { T.a += Math.PI; T.x = clamp(T.x, 15, AW - 15); T.y = clamp(T.y, 20, AH - 10); }
    for (const m of mobs) if (!m.dead && !m.boss && !m.obj) { const d = Math.hypot(m.x - T.x, m.y - T.y); if (d < 16) { const a = Math.atan2(m.y - T.y, m.x - T.x) + 1.4; m.x += Math.cos(a) * 34 * dt; m.y += Math.sin(a) * 34 * dt; if (rnd() < dt * 3) hitMob(m, D.hit * .8, false, false, '#e0c080'); } }
    if (Math.hypot(hero.x - T.x, hero.y - T.y) < 12) { const a = Math.atan2(hero.y - T.y, hero.x - T.x); hero.x += Math.cos(a) * 40 * dt; hero.y += Math.sin(a) * 40 * dt; } }
  if ((h.k === 'ice' || h.k === 'lava') && HZ.t <= 0) { HZ.t = h.k === 'ice' ? 3.2 : 4.2;
    for (let i = 0; i < (h.k === 'lava' ? 2 : 1); i++) { const a = rnd() * 6.28, r = 6 + rnd() * 28; tele.push({ k: 'c', b: null, x: clamp(hero.x + Math.cos(a) * r, 6, AW - 6), y: clamp(hero.y + Math.sin(a) * r * .7, 10, AH - 4), r: 9, t: 1.2, max: 1.2, dmg: zoneDmg(S.zone) * 2, act: h.k, nolbl: true }); } }
  if (h.k === 'abyss' && HZ.t <= 0 && !bossAlive) { HZ.t = 20; if (mobs.filter(m => m.obj === 'portal' && !m.dead).length < 2) { const pt = farPoint(45, 110); spawnObj('portal', pt.x, pt.y, 6); feed('Открылся портал!', '#b06aff'); } }
  if (h.k === 'crystal' && HZ.t <= 0) { HZ.t = 10; if (mobs.filter(m => m.obj === 'crystal' && !m.dead).length < 3) { const pt = farPoint(25, 80); spawnObj('crystal', pt.x, pt.y, 2.5); } }
  if (h.k === 'spore' && HZ.t <= 0) { HZ.t = 5; const a = rnd() * 6.28, r = 8 + rnd() * 26; HZ.pools.push({ x: clamp(hero.x + Math.cos(a) * r, 10, AW - 10), y: clamp(hero.y + Math.sin(a) * r * .7, 14, AH - 6), r: 17, tp: 'spore', t: 3.5 }); }
  for (const p of HZ.pools) { p.t -= dt;
    const inH = Math.hypot(hero.x - p.x, (hero.y - p.y) * 1.4) < p.r;
    if (inH && (p.tp === 'bog' || p.tp === 'lava') && !(hero.iframe > 0)) hero.hp = Math.max(1, hero.hp - D.maxHP * (p.tp === 'lava' ? .03 : .01) * dt);
    if (inH && p.tp === 'spore') hero.slowT = Math.max(hero.slowT || 0, .3);
    for (const m of mobs) if (!m.dead && !m.obj && Math.hypot(m.x - p.x, (m.y - p.y) * 1.4) < p.r) { if (p.tp === 'lava') { if (rnd() < dt * 2) hitMob(m, D.hit * 1.5, false, false, '#ff6622'); } else m.slowT = Math.max(m.slowT || 0, .3); } }
  HZ.pools = HZ.pools.filter(p => p.t > 0);
}
function hzImpact(t) {
  if (t.act === 'ice') { for (const m of mobs) if (!m.dead && Math.hypot(m.x - t.x, (m.y - t.y) / .6) < t.r + 3) { hitMob(m, D.hit * 4, false, false, '#a8e8ff'); if (!m.boss) m.frz = Math.max(m.frz || 0, 1.5); } burst(t.x, t.y - 2, '#e6f6ff', 10, 35); }
  if (t.act === 'lava') { HZ.pools.push({ x: t.x, y: t.y, r: 11, tp: 'lava', t: 4 }); burst(t.x, t.y - 2, '#ff6622', 10, 40); }
}
function drawHazGround() {
  for (const p of HZ.pools) { const col = p.tp === 'bog' ? '#3f6a18' : p.tp === 'lava' ? '#ff5a10' : '#b070e0';
    ctx.globalAlpha = p.tp === 'spore' ? .22 * Math.min(1, p.t) : p.tp === 'lava' ? .5 * Math.min(1, p.t) : .55; ctx.fillStyle = col;
    const ry = p.r / 1.4; for (let dy = -Math.floor(ry); dy <= ry; dy++) { const w = Math.round(p.r * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2))); ctx.fillRect(Math.round(p.x) - w, Math.round(p.y) + dy, w * 2, 1); }
    ctx.globalAlpha = .8; const bub = p.tp === 'bog' ? '#9ae05a' : p.tp === 'lava' ? '#ffd040' : '#f0c0ff';
    for (let i = 0; i < 3; i++) { const ph = (time * .8 + i * .37 + p.x * .01) % 1; pix(p.x + Math.cos(i * 2.1 + p.y) * p.r * .5, p.y + Math.sin(i * 1.7) * ry * .5 - ph * 3, bub); } }
  ctx.globalAlpha = 1;
  if (HZ.torn) { const T = HZ.torn; for (let i = 0; i < 16; i++) { const a = time * 9 + i * .9, r = 2 + i * .55; ctx.globalAlpha = .75; pix(T.x + Math.cos(a) * r, T.y - i * 1.6 + Math.sin(a) * r * .25, i % 3 ? '#e0c080' : '#fff0c8'); } ctx.globalAlpha = 1; }
}
function drawHazTop() {
  const h = hazard(); if (!h || h.k !== 'fog') return;
  const g = ctx.createRadialGradient(hero.x, hero.y - 4, 28, hero.x, hero.y - 4, 95); g.addColorStop(0, 'rgba(150,158,176,0)'); g.addColorStop(1, 'rgba(120,128,146,.6)');
  ctx.fillStyle = g; ctx.fillRect(camX - 6, camY - 6, W + 12, H + 12);
}
function drawObj(o) {
  const x = Math.round(o.x), y = Math.round(o.y), bob = Math.round(Math.sin(o.ot * 3));
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 4, y - 1, 8, 2);
  if (o.obj === 'totem') { ctx.globalAlpha = .18; for (let i = 0; i < 28; i++) { const a = i / 28 * 6.28 + time * .3; pix(o.x + Math.cos(a) * 45, o.y + Math.sin(a) * 30, '#c06bff'); } ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 15, 7, 15); ctx.fillStyle = o.fl > 0 ? '#ffffff' : '#5a3a7a'; ctx.fillRect(x - 2, y - 14, 5, 13); ctx.fillStyle = '#c06bff'; ctx.fillRect(x - 2, y - 14, 5, 2); ctx.fillRect(x - 2, y - 7, 5, 1);
    ctx.fillStyle = Math.sin(time * 4) > 0 ? '#ff66ff' : '#ffccff'; ctx.fillRect(x - 1, y - 11, 3, 2); }
  else if (o.obj === 'portal') { for (let i = 0; i < 22; i++) { const a = i / 22 * 6.28 + time * 4, r = 5 + Math.sin(time * 6 + i) * .6; pix(o.x + Math.cos(a) * r, o.y - 8 + Math.sin(a) * r * 1.4, i % 2 ? '#b06aff' : '#ffffff'); }
    ctx.fillStyle = o.fl > 0 ? '#ffffff' : '#1a0a2a'; ctx.fillRect(x - 3, y - 13, 7, 10); }
  else if (o.obj === 'crystal') { const c = o.fl > 0 ? '#ffffff' : '#7ad8ff'; ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 12 + bob, 7, 11);
    for (let r = 0; r < 10; r++) { const w = r < 5 ? r : 9 - r; ctx.fillStyle = r < 3 ? '#e6fbff' : c; ctx.fillRect(x - Math.floor(w / 2) - 1, y - 11 + r + bob, w + 2, 1); }
    if (Math.sin(time * 3 + o.ot) > .9) pix(x - 1, y - 9 + bob, '#ffffff'); }
  if (o.hp < o.max) { ctx.fillStyle = '#000'; ctx.fillRect(x - 5, y - 19, 10, 2); ctx.fillStyle = o.obj === 'crystal' ? '#7ad8ff' : '#c06bff'; ctx.fillRect(x - 5, y - 19, Math.round(10 * o.hp / o.max), 2); }
}
const BOSS_FAV = ['jump', 'summon', 'dash', 'dash', 'summon', 'meteor', 'meteor', 'cross', 'ring', 'ring'];

/* ---------- биомы ---------- */
const BIOMES = [
  { n: 'Зелёный луг',      g: ['#3d7a3a', '#356b33', '#5a9a4a'], m: [0, 9, 3, 10], h: [110, 20, 90, 30], f: ['hp', 'regen'] },
  { n: 'Тёмный лес',       g: ['#24452a', '#1e3a23', '#3b6a3a'], m: [8, 3, 1, 10], h: [280, 100, 30, 0], f: ['dodge', 'move'] },
  { n: 'Гнилое болото',    g: ['#3b4a2a', '#2f3d22', '#56663a'], m: [0, 5, 9, 11], h: [70, 320, 160, 90], f: ['poison', 'vamp'] },
  { n: 'Пустыня костей',   g: ['#b39556', '#a48748', '#c9ad6e'], m: [8, 7, 2, 14], h: [30, 40, 50, 45], f: ['crit', 'critd', 'dmg'] },
  { n: 'Древний склеп',    g: ['#3a3a46', '#30303b', '#4a4a5a'], m: [2, 4, 1, 11], h: [60, 190, 260, 100], f: ['wis', 'thorns'] },
  { n: 'Ледяные пики',     g: ['#a9c6d8', '#97b6ca', '#c9e0ee'], m: [7, 4, 5, 13], h: [200, 180, 220, 190], f: ['armor', 'range'] },
  { n: 'Пылающий вулкан',  g: ['#4a2020', '#3b1818', '#6a2a1a'], m: [6, 0, 7, 12], h: [0, 20, 15, 25], f: ['fire', 'power'] },
  { n: 'Бездна',           g: ['#1b1530', '#150f26', '#2a2048'], m: [5, 6, 4, 14], h: [270, 300, 240, 280], f: ['shock', 'fury'] },
  { n: 'Кристальные пещеры', g: ['#2a3550', '#232d45', '#4a6aa0'], m: [13, 5, 8, 12], h: [200, 260, 180, 220], f: ['crit', 'range'] },
  { n: 'Грибной лес',      g: ['#3a2a40', '#30223a', '#5a3a5a'], m: [9, 0, 10, 11], h: [300, 20, 100, 280], f: ['poison', 'regen'] },
  { n: 'Затонувший храм',  g: ['#1f3a3a', '#1a3030', '#2f5555'], m: [11, 4, 2, 14], h: [170, 190, 150, 160], f: ['wis', 'luck'] },
  { n: 'Пепельная пустошь', g: ['#3a3330', '#302a28', '#55483f'], m: [12, 15, 6, 10], h: [20, 0, 40, 10], f: ['fury', 'power'] },
  { n: 'Небесные чертоги', g: ['#d8d2b8', '#c9c2a5', '#eee8cc'], m: [4, 6, 2, 12], h: [50, 200, 0, 45], f: ['luck', 'aspd', 'cleave'] },
];
const ZONES_PER_BIOME = 5;
function biomeOf(z) {
  if (z > 50 && typeof WORLDS !== 'undefined') return worldBiome(z);
  const bi = Math.floor((z - 1) / ZONES_PER_BIOME);
  const b = BIOMES[bi % BIOMES.length], cyc = Math.floor(bi / BIOMES.length);
  const sh = cyc * 53;
  return { bi: bi % BIOMES.length, name: b.n + (cyc ? ' ' + roman(cyc + 1) : ''), g: b.g.map(c => cyc ? hueShift(c, sh) : c), m: b.m, h: b.h.map(h => h + sh), cyc, fav: b.f.map(k => EI[k]) };
}

