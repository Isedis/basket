'use strict';
/* ---------- снаряжение и сундуки ---------- */
const RAR = [{ n: 'Обычный', c: '#b8b8c0' }, { n: 'Необычный', c: '#5cff8a' }, { n: 'Редкий', c: '#4fa8ff' }, { n: 'Эпический', c: '#c06bff' }, { n: 'Легендарный', c: '#ff9a3c' }];
const RM = [1, 1.6, 2.5, 4, 6.5];
const SLOTS = {
  w: { n: 'Оружие', icon: 'sword', main: ['hit'], names: [['Ржавый меч', 'Тупой топор', 'Старая дубина'], ['Стальной клинок', 'Боевой топор', 'Булава'], ['Рунный меч', 'Секира рун', 'Молот гнома'], ['Клинок бури', 'Топор бездны', 'Молот грома'], ['Меч конца времён', 'Секира богов', 'Молот титанов']] },
  a: { n: 'Броня', icon: 'shield', main: ['hp', 'e_armor'], names: [['Кожаная куртка', 'Стёганка', 'Рваный плащ'], ['Кольчуга', 'Чешуйчатый доспех', 'Бригантина'], ['Латы стража', 'Доспех охотника', 'Кираса паладина'], ['Доспех титана', 'Панцирь дракона', 'Латы бури'], ['Броня бессмертного', 'Доспех вечности', 'Кожа левиафана']] },
  m: { n: 'Амулет', icon: 'star', main: ['gain'], names: [['Деревянный оберег', 'Костяной зуб', 'Медный жетон'], ['Серебряный амулет', 'Камень удачи', 'Клык волка'], ['Око дракона', 'Печать мага', 'Лунный камень'], ['Сердце бури', 'Осколок звезды', 'Глаз бездны'], ['Слеза богов', 'Искра творения', 'Сердце мира']] },
  r: { n: 'Кольцо', icon: 'eye', main: ['e_crit', 'e_critd'], names: [['Медное кольцо', 'Простой перстень', 'Железное кольцо'], ['Кольцо силы', 'Серебряный перстень', 'Кольцо охотника'], ['Перстень мага', 'Кольцо теней', 'Печатка короля'], ['Кольцо рока', 'Перстень бури', 'Кольцо пламени'], ['Кольцо вечности', 'Перстень богов', 'Кольцо судьбы']] },
};
const GPOOL = ['e_fire', 'e_shock', 'e_poison', 'e_vamp', 'e_regen', 'e_aspd', 'e_move', 'e_luck', 'e_wis', 'e_power', 'e_range', 'e_cleave', 'e_thorns', 'e_dodge', 'tap', 'ultd', 'ultc', 'combo_m', 'bossdmg', 'elite', 'rare', 'gain', 'hit', 'hp', 'e_bleed', 'e_frost', 'e_exec', 'e_bounce', 'e_grav', 'e_spirit', 'e_greed', 'e_barrier', 'e_det', 'e_leech', 'e_rage', 'e_scrit', 'e_hunt', 'e_energy', 'e_fear', 'e_curio', 'e_trail', 'e_orbs', 'e_echo', 'e_mark', 'e_horde', 'e_blink', 'e_dust', 'e_quake'];
const GSUF = { e_fire: 'пламени', e_shock: 'грозы', e_poison: 'яда', e_vamp: 'крови', e_regen: 'жизни', e_aspd: 'ветра', e_move: 'бега', e_luck: 'удачи', e_wis: 'мудрости', e_power: 'мощи',
  e_range: 'размаха', e_cleave: 'резни', e_thorns: 'шипов', e_dodge: 'тени', tap: 'длани', ultd: 'гнева', ultc: 'бури', combo_m: 'куража', bossdmg: 'охотника', elite: 'ловца', rare: 'золота', gain: 'жадности', hit: 'силы', hp: 'крепости',
  e_bleed: 'крови', e_frost: 'стужи', e_exec: 'палача', e_bounce: 'рикошета', e_grav: 'бездны', e_spirit: 'духов', e_greed: 'скупца', e_barrier: 'бастиона',
  e_det: 'взрыва', e_leech: 'пиявки', e_rage: 'ража', e_scrit: 'удачного удара', e_hunt: 'ловчего', e_energy: 'энергии', e_fear: 'ужаса', e_curio: 'познания',
  e_trail: 'грозы', e_orbs: 'солнца', e_echo: 'эха', e_mark: 'клейма', e_horde: 'орды', e_blink: 'теней', e_dust: 'кладов', e_quake: 'тверди' };
const CH = { c: { n: 'Обычный сундук', p: [60, 28, 9, 2.5, .5], col: '#a0703a' }, r: { n: 'Редкий сундук', p: [0, 45, 38, 14, 3], col: '#9fb4cc' }, e: { n: 'Эпический сундук', p: [0, 0, 55, 35, 10], col: '#ffd84a' } };
/* ---------- вещи миров: мифические и божественные, сеты, камни, реликвии ---------- */
RAR.push({ n: 'Мифический', c: '#ff3a6e' }, { n: 'Божественный', c: '#fff2a0' }); RM.push(11, 18);
CH.w = { n: 'Сундук мира', p: [0, 0, 0, 30, 40, 22, 8], col: '#ff3a6e' };
SLOTS.x = { n: 'Реликвия', icon: 'crown', main: ['hit'], names: [] };
const HINAMES = { w: ['Клинок миров', 'Звёздная секира'], a: ['Доспех титана', 'Небесная броня'], m: ['Сердце мира', 'Звёздный оберег'], r: ['Кольцо вечности', 'Перстень богов'] };
const WSET = [
  { n: 'Пепел', b2: 'урон огня ×2, жар слабее вдвое', b4: 'жар не жжёт, каждые 4с огненная вспышка' },
  { n: 'Небо', b2: 'скорость атаки +30%', b4: 'ближние удары по парящим без штрафа' },
  { n: 'Цитадель', b2: 'крит +10%', b4: 'щиты врагов не держат удары' },
  { n: 'Бездна', b2: 'уворот +10%', b4: 'удары достают врагов в тени' },
  { n: 'Пустота', b2: 'урон ×3', b4: 'разломы не тянут героя и жгут врагов' },
];
const GEMS = [
  { n: 'Огненный рубин', c: '#ff5a3a', d: 'урон ×5' }, { n: 'Небесный сапфир', c: '#7ab8ff', d: 'HP ×5' }, { n: 'Топаз цитадели', c: '#ffd84a', d: 'урон ×3, крит +3%' },
  { n: 'Камень бездны', c: '#b06aff', d: 'HP ×3, уворот +3%' }, { n: 'Звезда пустоты', c: '#ff88ff', d: 'урон и HP ×4' },
];
const RELICS = [
  { n: 'Сердце вулкана', d: 'каждые 10с метеоритный дождь (5 × ×8 удара)' }, { n: 'Перо исполина', d: 'каждые 8с вихрь ветра по линии (×6)' },
  { n: 'Ядро колосса', d: 'каждые 12с орбитальный луч (×10 всем на линии)' }, { n: 'Око бездны', d: 'каждые 10с чёрная дыра стягивает и жжёт (×8)' },
  { n: 'Сердце звезды', d: 'каждые 15с сверхновая (×20 всем)' },
];
const sockets = it => it.rar >= 6 ? 2 : it.rar >= 5 ? 1 : 0;
function setCount() { const n = [0, 0, 0, 0, 0], eq = G().eq; for (const sl in eq) { const it = eq[sl]; if (it && it.set != null && sl !== 'x') n[it.set]++; } return n; }
const setOn = (i, k) => (gearSets[i] || 0) >= k;
let gearSets = [0, 0, 0, 0, 0];
function gearMods() {
  gearSets = setCount();
  if (setOn(0, 2)) D.fire *= 2; if (setOn(1, 2)) D.aps = Math.min(14, D.aps * 1.3); if (setOn(2, 2)) D.crit = Math.min(.95, D.crit + .1);
  if (setOn(3, 2)) D.dodge = Math.min(.9, D.dodge + .1); if (setOn(4, 2)) D.hit *= 3;
  const eq = G().eq; for (const sl in eq) { const it = eq[sl]; if (!it || !it.gems) continue; for (const gi of it.gems) {
    if (gi === 0) D.hit *= 5; if (gi === 1) D.maxHP *= 5; if (gi === 2) { D.hit *= 3; D.crit = Math.min(.95, D.crit + .03); } if (gi === 3) { D.maxHP *= 3; D.dodge = Math.min(.9, D.dodge + .03); } if (gi === 4) { D.hit *= 4; D.maxHP *= 4; } } }
}
const heatRes = () => setOn(0, 4) ? 1 : setOn(0, 2) ? .5 : 0;
function makeRelic(wi, ilvl) {
  const it = makeItem('w', 6, ilvl); Object.assign(it, { slot: 'x', relic: wi, name: RELICS[wi].n, leg: null, set: null }); return it;
}
function gearTick(dt) {
  const T = (key, per) => { PT[key] = (PT[key] ?? per) - dt; if (PT[key] <= 0) { PT[key] = per; return true; } return false; }, all = () => mobs.filter(m => !m.dead), H = D.hit;
  if (setOn(0, 4) && T('set0', 4) && mobs.length) { ring(hero.x, hero.y - 3, 20, '#ff7a30'); hitAround(hero.x, hero.y, 20, H * 2, '#ff6622'); }
  if (setOn(4, 4)) for (const r of rifts) if (T('rift' + Math.round(r.x), .5)) hitAround(r.x, r.y, 18, H, '#ff44ff');
  const rl = G().eq.x; if (!rl) return;
  const nm = RELICS[rl.relic].n, lbl = () => fxLabel(nm, hero.x, hero.y - 24, '#fff2a0');
  switch (rl.relic) {
    case 0: if (T('rel', 10)) { const L = all(); for (let i = 0; i < 5 && L.length; i++) later(i * .12, () => { const o = L[Math.floor(rnd() * L.length)]; if (o && !o.dead) skyStrike('meteor', o, H * 8, '#ff7a30', nm); }); } break;
    case 1: if (T('rel', 8) && mobs.length) { const o = near(1)[0]; if (o) { const a = Math.atan2(o.y - hero.y, o.x - hero.x), x2 = hero.x + Math.cos(a) * 90, y2 = hero.y + Math.sin(a) * 90; for (const m of all()) if (segDist(m.x, m.y, { x: hero.x, y: hero.y, x2, y2 }) < 10) hitMob(m, H * 6, true, false, '#d8e2f2'); fx1(.4, p => { ctx.globalAlpha = 1 - p; for (let i = 0; i < 40; i++) pix(hero.x + Math.cos(a) * i * 2.2 + Math.sin(i + p * 20) * 3, hero.y - 4 + Math.sin(a) * i * 2.2, '#ffffff'); ctx.globalAlpha = 1; }); lbl(); } } break;
    case 2: if (T('rel', 12) && mobs.length) { const o = all().sort((a, b) => b.hp - a.hp)[0]; if (o) { for (const m of all()) if (Math.abs(m.x - o.x) < 8) hitMob(m, H * 10, true, false, '#7ad8ff'); fx1(.5, p => { ctx.globalAlpha = 1 - p; ctx.fillStyle = '#7ad8ff'; ctx.fillRect(Math.round(o.x) - 4, camY - 6, 8, H + 12); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(o.x) - 1, camY - 6, 2, H + 12); ctx.globalAlpha = 1; }); lbl(); } } break;
    case 3: if (T('rel', 10) && mobs.length) { const o = randMob(); if (o) { const bx = o.x, by = o.y; fx1(1.5, p => { circ(bx, by, 14 * (1 - p) + 4, '#b06aff', 24, .6, p * 10); dot(bx, by - 2, 5, '#000'); for (const m of all()) { const dx = bx - m.x, dy = by - m.y, d = Math.hypot(dx, dy) || 1; if (d < 40 && !m.boss) { m.x += dx / d * 40 * .016; m.y += dy / d * 40 * .016; } } }, () => { hitAround(bx, by, 24, H * 8, '#b06aff'); ring(bx, by - 2, 24, '#b06aff'); }); lbl(); } } break;
    case 4: if (T('rel', 15) && mobs.length) { for (let i = 0; i < 3; i++) ring(hero.x, hero.y - 3, 30 + i * 25, i % 2 ? '#ffffff' : '#ff88ff'); for (const m of all()) hitMob(m, H * 20, true, false, '#ff88ff'); shake = Math.max(shake, 8); lbl(); } break;
  }
}
// трофеи миров: сундуки, камни, реликвии
function worldLoot(m) {
  if (S.zone <= 50) return; const wi = worldIdx(S.zone), M = S.meta;
  if (m.titan) { giveChest('w', 'титан'); giveChest('w', 'титан'); if (!M.gems) M.gems = [0, 0, 0, 0, 0]; const n = 1 + (M.troph && M.troph[wi] ? 0 : 1); M.gems[wi] += n; feed('+' + n + ' ' + GEMS[wi].n, GEMS[wi].c);
    if (!M.relGot) M.relGot = {}; if (!M.relGot[wi] || rnd() < .25) { M.relGot[wi] = 1; addItem(makeRelic(wi, ilvlNow())); toast('РЕЛИКВИЯ: ' + RELICS[wi].n.toUpperCase(), RELICS[wi].d, 3500); } }
  else if (S.zone % 5 === 0) giveChest('w', 'вожак мира');
  else if (rnd() < .25) giveChest('w', 'вожак мира');
}
const G = () => S.meta.gear;
const LEG = {
  storm: { n: 'Громовой', d: 'каждый крит бьёт молнией по случайному врагу' }, blood: { n: 'Кровавый', d: 'каждое убийство лечит 2% здоровья' },
  echo: { n: 'Эхо', d: '20% шанс ударить второй раз' }, gold: { n: 'Златой', d: 'убийства иногда дают сундук' },
  phoenix: { n: 'Фениксов', d: 'раз в 60с при HP < 10% — полное исцеление' }, frost: { n: 'Ледяной', d: 'удары замедляют врагов' },
  nova: { n: 'Сверхновый', d: 'каждое 5-е убийство — взрыв вокруг' }, twin: { n: 'Двойной', d: 'ульта бьёт дважды' },
};
function legOn(k) { const eq = S.meta.gear && S.meta.gear.eq; if (!eq) return false; for (const sl in eq) if (eq[sl] && eq[sl].leg === k) return true; return false; }
function makeItem(slot, rar, ilvl) {
  const sd = SLOTS[slot], mv = (.15 + .01 * ilvl) * RM[rar];
  const main = sd.main.map(k => ({ k, v: mv * (sd.main.length > 1 ? .7 : 1) }));
  const pool = GPOOL.filter(k => !sd.main.includes(k)), aff = [];
  for (let i = 0; i <= rar; i++) { const k = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; aff.push({ k, v: TK[k][1] * 1.5 * RM[rar] * (1 + ilvl / 50) * (.7 + rnd() * .6) }); }
  const nl = sd.names[rar] || HINAMES[slot] || ['Реликвия'], base = Array.isArray(nl) ? nl[Math.floor(rnd() * nl.length)] : nl;
  const leg = rar >= 4 ? Object.keys(LEG)[Math.floor(rnd() * Object.keys(LEG).length)] : null;
  return { id: G().nid++, slot, rar, ilvl, up: 0, main, aff, leg, name: base + (leg ? ' «' + LEG[leg].n + '»' : ' ' + GSUF[aff[0].k]), gems: [] };
}
const mainV = (it, a) => a.v * (1 + .1 * it.up);
const score = it => it ? it.main.reduce((s2, a) => s2 + mainV(it, a) / .15 * 2, 0) + it.aff.reduce((s2, a) => s2 + a.v / TK[a.k][1], 0) : 0;
const dustOf = it => Math.ceil([1, 3, 10, 40, 150, 500, 2000][it.rar] * (1 + it.ilvl / 20) * (1 + it.up * .5));
const upCost = it => Math.ceil(10 * Math.pow(1.6, it.up) * (1 + it.rar));
function calcGear() {
  const eq = S.meta.gear ? S.meta.gear.eq : {};
  for (const sl in eq) { const it = eq[sl]; if (!it) continue;
    for (const a of it.main) TAL[a.k] = (TAL[a.k] || 0) + mainV(it, a);
    for (const a of it.aff) TAL[a.k] = (TAL[a.k] || 0) + a.v; }
}
function gearChanged() { calcTal(); D.dirty = true; save(); }
function addItem(it) {
  const g = G(), cur = g.eq[it.slot];
  if (!cur || score(it) > score(cur)) { g.eq[it.slot] = it; if (cur) g.inv.push(cur); }
  else g.inv.push(it);
  while (g.inv.length > 30) { let w = 0; g.inv.forEach((x, i) => { if (score(x) < score(g.inv[w])) w = i; }); g.dust += dustOf(g.inv[w]); g.inv.splice(w, 1); }
  gearChanged();
}
function giveChest(t, why) {
  G().chests[t] = (G().chests[t] || 0) + 1; feed('+ ' + CH[t].n + (why ? ' · ' + why : ''), CH[t].col); tone(660, .08, 'square', .04); tone(990, .12, 'square', .04, 0, .07);
  tip('chest', 'Сундук!', 'Кнопка ▣ вверху — снаряжение и сундуки. Открой, чтобы получить оружие, броню, амулет или кольцо.');
}
function rollRar(t) {
  const g = G(), p = CH[t].p, tot = p.reduce((a, b) => a + b, 0); let x = rnd() * tot, r = 0;
  for (let i = 0; i < p.length; i++) { if (x < p[i]) { r = i; break; } x -= p[i]; }
  g.pity++; if (g.pity >= (skyOn('sk_pity') ? 5 : 10)) r = Math.max(r, 3); if (r >= 3) g.pity = 0;
  return r;
}
const ilvlNow = () => Math.max(S.zone, Math.floor(S.meta.best * .5));
// иконки предметов (пиксельные, из набора иконок дерева)
const icCache = {};
function iconURL(name, col) {
  const key = name + col; if (icCache[key]) return icCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 7; const x = c.getContext('2d');
  x.fillStyle = '#110e1c'; x.fillRect(0, 0, 7, 7); x.fillStyle = col;
  ICONS[name].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') x.fillRect(i + 1, j + 1, 1, 1); }));
  return icCache[key] = c.toDataURL();
}
function itemHTML(it, cmp) {
  const rc = RAR[it.rar].c;
  let h = `<div class="nm" style="color:${rc}">${it.name}${it.up ? ' +' + it.up : ''}</div><span class="k">${RAR[it.rar].n} · ${SLOTS[it.slot].n} · ур. предмета ${it.ilvl}</span><br>`;
  h += it.main.map(a => '<b style="font-weight:normal;color:#fff">' + TK[a.k][2](mainV(it, a)) + '</b>').join('<br>') + '<br>';
  h += it.aff.map(a => TK[a.k][2](a.v)).join('<br>');
  if (it.leg) h += `<br><span style="color:#ff9a3c">★ ${LEG[it.leg].d}</span>`;
  if (it.relic != null) h += `<br><span style="color:#fff2a0">✦ ${RELICS[it.relic].d}</span>`;
  if (it.set != null) h += `<br><span style="color:${WORLDS[it.set].c}">Сет «${WSET[it.set].n}»: 2 — ${WSET[it.set].b2}; 4 — ${WSET[it.set].b4}</span>`;
  if (sockets(it)) h += '<br>Гнёзда: ' + [...Array(sockets(it))].map((_, i) => it.gems && it.gems[i] != null ? `<span style="color:${GEMS[it.gems[i]].c}">◆ ${GEMS[it.gems[i]].n} (${GEMS[it.gems[i]].d})</span>` : '<span style="color:#5a5470">◇ пусто</span>').join(' ');
  if (cmp !== undefined) { const cur = G().eq[it.slot], d = score(it) - score(cur);
    h += '<br>' + (!cur ? '<span style="color:#5cff8a">слот пуст — наденется</span>' : d > 0 ? `<span style="color:#5cff8a">лучше надетого (+${Math.round(d / Math.max(1, score(cur)) * 100)}%)</span>` : `<span style="color:#ff6b6b">хуже надетого (${Math.round(d / Math.max(1, score(cur)) * 100)}%)</span>`); }
  return h;
}
function renderGear() {
  const g = G();
  $('gdust').textContent = fmt(g.dust);
  $('gpity').textContent = 'эпик+ гарантирован через ' + (10 - g.pity);
  $('gch').innerHTML = Object.keys(CH).map(t => `<div class="chest"><img class="ic" src="${iconURL('crown', CH[t].col)}"><div class="tx" style="color:${CH[t].col}">${CH[t].n}<br><span style="color:var(--dim);font-size:7px">в наличии: ${g.chests[t]}</span></div>` +
    (g.chests[t] > 1 ? `<button class="btn" data-oa="${t}" style="margin-right:4px">ВСЕ</button>` : '') + `<button class="btn" data-o="${t}" ${g.chests[t] ? '' : 'disabled'}>ОТКРЫТЬ</button></div>`).join('');
  $('gtr').innerHTML = trHTML();
  $('geq').innerHTML = Object.keys(SLOTS).map(sl => { const it = g.eq[sl];
    if (!it) return `<div class="it empty"><img class="ic" src="${iconURL(SLOTS[sl].icon, '#3a3450')}"><div class="tx">${SLOTS[sl].n}: пусто<br>выпадает из сундуков</div></div>`;
    return `<div class="it" style="border-color:${RAR[it.rar].c}55"><img class="ic" src="${iconURL(SLOTS[sl].icon, RAR[it.rar].c)}"><div class="tx">${itemHTML(it)}</div>` +
      `<div class="bt"><button class="btn" data-u="${sl}" ${g.dust >= upCost(it) ? '' : 'disabled'}>УЛУЧШИТЬ<br>${fmt(upCost(it))} пыли</button>${(it.gems || []).length < sockets(it) && (S.meta.gems || []).some(x => x) ? (S.meta.gems || []).map((n, gi) => n ? `<button class="btn" data-gem="${sl}:${gi}" style="background:#3a1a3a;color:${GEMS[gi].c}">◆ ${GEMS[gi].n.split(' ')[0]}</button>` : '').join('') : ''}</div></div>`; }).join('');
  { const M = S.meta, gm = M.gems || [0, 0, 0, 0, 0], sc = setCount();
    $('gsets').innerHTML = (gm.some(x => x) ? '<div class="gsec">КАМНИ <span>от титанов · вставляются в гнёзда мифических и божественных вещей</span></div><div class="gems">' + GEMS.map((gg, i) => `<span style="color:${gm[i] ? gg.c : '#3a3450'}">◆ ${gg.n} ×${gm[i]}<br><small>${gg.d}</small></span>`).join('') + '</div>' : '') +
      (sc.some(x => x) ? '<div class="gsec">СЕТЫ МИРОВ</div>' + WSET.map((st, i) => sc[i] ? `<div class="sline" style="color:${WORLDS[i].c}">«${st.n}» ${sc[i]}/4 · <span style="opacity:${sc[i] >= 2 ? 1 : .45}">2: ${st.b2}</span> · <span style="opacity:${sc[i] >= 4 ? 1 : .45}">4: ${st.b4}</span></div>` : '').join('') : ''); }
  $('gcnt').textContent = '(' + g.inv.length + '/30)';
  const inv = g.inv.slice().sort((a, b) => b.rar - a.rar || score(b) - score(a));
  $('ginv').innerHTML = inv.length ? inv.map(it => `<div class="it"><img class="ic" src="${iconURL(SLOTS[it.slot].icon, RAR[it.rar].c)}"><div class="tx">${itemHTML(it, 1)}</div>` +
    `<div class="bt"><button class="btn" data-e="${it.id}">НАДЕТЬ</button><button class="btn" data-s="${it.id}" style="background:#5a3a2a">В ПЫЛЬ<br>+${fmt(dustOf(it))}</button></div></div>`).join('') : '<div class="it empty">Пусто. Лишние вещи из сундуков попадают сюда.</div>';
}
$('gearb').onclick = () => { showSheet('none'); $('tree').hidden = true; navOn('gearb'); $('gear').hidden = false; renderGear(); };
$('gclose').onclick = () => { $('gear').hidden = true; navOn('nFight'); };
$('gbody').onclick = e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return; const g = G();
  if (b.dataset.o) startOpening(b.dataset.o);
  if (b.dataset.oa) { startOpening(b.dataset.oa); openAll(); }
  if (b.dataset.gem) { const [sl, gi] = b.dataset.gem.split(':'), it = g.eq[sl], M = S.meta; if (it && (M.gems || [])[+gi] > 0 && (it.gems || []).length < sockets(it)) { if (!it.gems) it.gems = []; it.gems.push(+gi); M.gems[+gi]--; tone(1047, .12, 'triangle', .05); tone(1568, .15, 'triangle', .04, 0, .08); gearChanged(); renderGear(); } }
  if (b.dataset.u) { const it = g.eq[b.dataset.u], c = upCost(it); if (g.dust >= c) { g.dust -= c; it.up++; tone(523, .08, 'square', .04); tone(784, .1, 'square', .04, 0, .06); gearChanged(); renderGear(); } }
  if (b.dataset.e) { const i = g.inv.findIndex(x => x.id == b.dataset.e), it = g.inv[i], cur = g.eq[it.slot]; g.inv.splice(i, 1); g.eq[it.slot] = it; if (cur) g.inv.push(cur); gearChanged(); renderGear(); }
  if (b.dataset.s) { const i = g.inv.findIndex(x => x.id == b.dataset.s); g.dust += dustOf(g.inv[i]); g.inv.splice(i, 1); gearChanged(); renderGear(); }
};
$('gsalv').onclick = () => { const g = G(); for (const it of g.inv) g.dust += dustOf(it); g.inv = []; gearChanged(); renderGear(); tone(220, .15, 'square', .04, 110); };

/* ---------- открытие сундука ---------- */
const CHEST_PX = ['..########..', '.#llllllll#.', '#llllllllll#', '#llllllllll#', '############', '#bbbbggbbbb#', '#bbbbggbbbb#', '#bbbbbbbbbb#', '#bbbbbbbbbb#', '############'];
const ocv = $('ocv'), octx = ocv.getContext('2d'); ocv.width = 120; ocv.height = 100;
let op = null, opRaf = 0;
function startOpening(t) {
  const g = G(); if (!g.chests[t]) return;
  g.chests[t]--; const rar = rollRar(t), slot = Object.keys(SLOTS)[Math.floor(rnd() * 4)], it = makeItem(slot, rar, ilvlNow()); if (t === 'w') it.set = Math.max(0, worldIdx(S.meta.best > 50 ? Math.min(100, Math.max(S.zone, 51)) : 51));
  op = { t, it, ph: 'shake', time: 0, parts: [] };
  $('opening').hidden = false; $('ocard').innerHTML = `<span style="color:var(--dim)">тапни по сундуку</span>`;
  $('otake').hidden = true; $('oall').hidden = !g.chests[t];
  $('oall').textContent = 'ОТКРЫТЬ ВСЕ (' + (g.chests[t] + 1) + ')';
  if (!opRaf) { let last = performance.now(); const step = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; tickOpen(dt); opRaf = $('opening').hidden ? 0 : requestAnimationFrame(step); }; opRaf = requestAnimationFrame(step); }
  save();
}
function revealOpen() {
  if (!op || op.ph !== 'shake') return;
  op.ph = 'burst'; op.time = 0; const rc = RAR[op.it.rar].c;
  for (let i = 0; i < 50 + op.it.rar * 30; i++) { const a = rnd() * 6.28, v = 20 + rnd() * 60; op.parts.push({ x: 60, y: 52, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, l: .6 + rnd() * .8, c: rnd() < .6 ? rc : '#ffffff' }); }
  const notes = [[523, 659], [523, 659, 784], [523, 659, 784, 1047], [392, 523, 659, 784, 1047], [262, 392, 523, 659, 784, 1047, 1319]][Math.min(4, op.it.rar)];
  notes.forEach((f, i) => tone(f, .14, op.it.rar >= 3 ? 'triangle' : 'square', .05, 0, i * .08));
  const cur = G().eq[op.it.slot], better = !cur || score(op.it) > score(cur);
  $('ocard').innerHTML = `<div class="rn" style="color:${rc}">${RAR[op.it.rar].n.toUpperCase()}!</div>` + itemHTML(op.it, 1);
  $('otake').hidden = false; $('otake').textContent = better ? 'НАДЕТЬ' : 'В ИНВЕНТАРЬ';
  if (op.it.rar >= 4) toast('ЛЕГЕНДАРНЫЙ ПРЕДМЕТ!', op.it.name);
}
function takeOpen() {
  if (!op) return; addItem(op.it); const t = op.t; op = null;
  if (G().chests[t]) startOpening(t); else { $('opening').hidden = true; renderGear(); }
}
function openAll() {
  if (!op) return; const t = op.t, got = [op.it]; addItem(op.it); const g = G();
  while (g.chests[t] > 0) { g.chests[t]--; const r = rollRar(t), sl = Object.keys(SLOTS)[Math.floor(rnd() * 4)], it = makeItem(sl, r, ilvlNow()); addItem(it); got.push(it); }
  const best = got.reduce((a, b) => b.rar > a.rar ? b : a, got[0]);
  op.ph = 'burst'; op.time = 0; op.it = best;
  for (let i = 0; i < 120; i++) { const a = rnd() * 6.28, v = 20 + rnd() * 70; op.parts.push({ x: 60, y: 52, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, l: .6 + rnd(), c: RAR[got[Math.floor(rnd() * got.length)].rar].c }); }
  const cnt = RAR.map(() => 0); got.forEach(x => cnt[x.rar]++);
  $('ocard').innerHTML = `<div class="rn" style="color:${RAR[best.rar].c}">ОТКРЫТО: ${got.length}</div>` + cnt.map((n, i) => n ? `<span style="color:${RAR[i].c}">${RAR[i].n}: ${n}</span>` : '').filter(Boolean).join('<br>') +
    `<br><br>Лучшее: <span style="color:${RAR[best.rar].c}">${best.name}</span><br><span style="color:var(--dim)">лучшие вещи надеты автоматически</span>`;
  op = null; $('otake').hidden = false; $('otake').textContent = 'ГОТОВО'; $('oall').hidden = true;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, .12, 'square', .05, 0, i * .07));
  opDone = true;
}
let opDone = false;
$('ocv').onclick = () => revealOpen();
$('otake').onclick = () => { if (opDone) { opDone = false; $('opening').hidden = true; renderGear(); return; } takeOpen(); };
$('oall').onclick = () => { if (op && op.ph === 'shake') revealOpen(); openAll(); };
function tickOpen(dt) {
  const c = octx; c.clearRect(0, 0, 120, 100);
  const st = op || { ph: 'done', time: 1, it: null, parts: [] };
  if (op) op.time += dt;
  const col = op ? CH[op.t].col : '#a0703a', rc = op && op.it ? RAR[op.it.rar].c : '#ffffff';
  if (op && op.ph === 'shake' && op.time > 1.3) revealOpen();
  // лучи при раскрытии
  if (op && op.ph === 'burst') { c.save(); c.translate(60, 52); c.rotate(op.time * .8); c.globalAlpha = .35; c.fillStyle = rc; for (let i = 0; i < 10; i++) { c.rotate(Math.PI / 5); c.fillRect(-2, 0, 4, 70); } c.restore(); c.globalAlpha = 1; }
  // сундук
  const shake = op && op.ph === 'shake' ? Math.sin(op.time * 50) * op.time * 2.2 : 0, S4 = 6, ox = 60 - 6 * S4 + Math.round(shake), oy = 30;
  const lidUp = op && op.ph === 'burst' ? Math.min(18, op.time * 90) : 0;
  CHEST_PX.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return;
    c.fillStyle = ch === '#' ? '#000' : ch === 'l' ? col : ch === 'g' ? '#ffd84a' : shade(col, -.35);
    c.fillRect(ox + i * S4, oy + j * S4 - (j < 4 ? lidUp : 0), S4, S4); }));
  if (op && op.ph === 'shake' && op.time > .6) { c.globalAlpha = (op.time - .6) * .8; c.fillStyle = op.it.rar >= 3 ? rc : '#ffffff'; c.fillRect(ox + S4, oy + 4 * S4 - 2, 10 * S4, 3); c.globalAlpha = 1; }
  for (const p of st.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; p.l -= dt; c.globalAlpha = Math.max(0, Math.min(1, p.l)); c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
  c.globalAlpha = 1; if (op) op.parts = op.parts.filter(p => p.l > 0);
}

