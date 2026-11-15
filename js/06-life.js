'use strict';
/* ---------- уровень героя в жизни и перки (1 из 3 на каждом уровне) ---------- */
// перки на эту жизнь: статы или механики (те же, что у пути класса), до 5 рангов
const PERKS = [
  { k: 'dmg', n: 'Острый клинок', d: L => '+' + 25 * L + '% урона' }, { k: 'hp', n: 'Толстая шкура', d: L => '+' + 30 * L + '% HP' },
  { k: 'aps', n: 'Быстрые руки', d: L => '+' + 10 * L + '% скорости атаки' }, { k: 'crit', n: 'Глаз орла', d: L => '+' + 4 * L + '% крита, +' + 15 * L + '% силы крита' },
  { k: 'vamp', n: 'Кровожадность', d: L => 'вампиризм +' + L + '%' }, { k: 'regen', n: 'Живучесть', d: L => 'регенерация +' + L + '% HP/с' },
  { k: 'gain', n: 'Жадность', d: L => '+' + 20 * L + '% прироста статов' }, { k: 'gold', n: 'Золотая лихорадка', d: L => 'золотых врагов ×' + (1 + .3 * L).toFixed(1) },
  { k: 'souls', n: 'Душелов', d: L => '+' + 15 * L + '% душ забега' }, { k: 'combo', n: 'Кураж', d: L => 'комбо держится на ' + L + 'с дольше' },
  { k: 'ult', n: 'Накопитель', d: L => 'ульта копится на ' + 20 * L + '% быстрее' }, { k: 'clsx', n: 'Мастер класса', d: L => 'статы класса сильнее на ' + 15 * L + '%' },
  { k: 'dodge', n: 'Тень', d: L => '+' + 3 * L + '% уворота' }, { k: 'armor', n: 'Латы', d: L => '+' + 4 * L + '% брони' },
  { k: 'm_nova', n: 'Взрывной удар', fx: ['nova', 4], d: L => PFX.nova(L, 4) }, { k: 'm_chain', n: 'Цепная молния', fx: ['chain'], d: L => PFX.chain(L) },
  { k: 'm_orbit', n: 'Сферы', fx: ['orbit'], d: L => PFX.orbit(L) }, { k: 'm_sky', n: 'Кара небес', fx: ['sky', 6], d: L => PFX.sky(L, 6) },
  { k: 'm_pulse', n: 'Волна силы', fx: ['pulse', 6], d: L => PFX.pulse(L, 6) }, { k: 'm_summon', n: 'Союзник', fx: ['summon', 0], d: L => PFX.summon(L, 0) },
  { k: 'm_trail', n: 'Огненный след', fx: ['trail'], d: L => PFX.trail(L) }, { k: 'm_volley', n: 'Залп', fx: ['volley', 5], d: L => PFX.volley(L, 5) },
  { k: 'm_boom', n: 'Взрыв трупов', fx: ['boom'], d: L => PFX.boom(L) }, { k: 'm_shield', n: 'Щит', fx: ['shield', 8], d: L => PFX.shield(L, 8) },
];
const PK = {}; PERKS.forEach(p => PK[p.k] = p);
const perkL = k => (S.perks && S.perks[k]) || 0;
const lvNeed = L => Math.floor(25 * Math.pow(1.25, L));
function lifeXP(v) {
  S.lxp = (S.lxp || 0) + v; S.lvl = S.lvl || 1;
  while (S.lxp >= lvNeed(S.lvl)) { S.lxp -= lvNeed(S.lvl); S.lvl++; S.pend = (S.pend || 0) + 1;
    ring(hero.x, hero.y - 4, 14, '#ffe08a'); ftext(hero.x, hero.y - 20, 'УРОВЕНЬ ' + S.lvl + '!', '#ffe08a', 1.1, 1); tone(784, .08, 'square', .04); tone(1175, .12, 'square', .04, 0, .07);
    tip('perk', 'Новый уровень!', 'Кнопка ★ ПЕРК справа внизу — выбери 1 из 3 улучшений на эту жизнь. В меню можно включить авто-выбор.'); }
  if (S.pend && S.meta.autoPerk) { while (S.pend) { const o = perkOffer(); if (!o.length) { S.pend = 0; break; } takePerk(o[0].k, true); } }
}
function perkOffer() {
  if (S.offer && S.offer.length) return S.offer.map(k => PK[k]);
  const pool = PERKS.filter(p => perkL(p.k) < 5).sort(() => rnd() - .5);
  // авто-выбор предпочитает уже взятые (сильнее стакаются)
  if (S.meta.autoPerk) pool.sort((a, b) => perkL(b.k) - perkL(a.k));
  S.offer = pool.slice(0, 3).map(p => p.k); return S.offer.map(k => PK[k]);
}
function takePerk(k, silent) {
  if (!S.perks) S.perks = {}; S.perks[k] = perkL(k) + 1; S.pend = Math.max(0, (S.pend || 0) - 1); S.offer = null;
  D.dirty = true; calcPath(); recalc();
  if (!silent) { feed('Перк: ' + PK[k].n + ' ' + roman(perkL(k)), '#ffe08a'); tone(1047, .1, 'triangle', .04); }
}
/* ---------- атрибуты жизни и пороги эффектов ---------- */
const ATTRS = [
  { k: 's', n: 'Сила', c: '#ff6644', e: ['dmg', 'critd', 'cleave', 'power', 'fury', 'bleed', 'exec', 'quake', 'range'] },
  { k: 'a', n: 'Ловкость', c: '#ffdd44', e: ['aspd', 'crit', 'dodge', 'move', 'blink', 'scrit', 'rage', 'bounce', 'echo', 'trail'] },
  { k: 'i', n: 'Интеллект', c: '#bb88ff', e: ['fire', 'poison', 'shock', 'frost', 'wis', 'spirit', 'orbs', 'energy', 'curio', 'mark', 'grav', 'det'] },
  { k: 'v', n: 'Выносливость', c: '#ff88aa', e: ['hp', 'regen', 'armor', 'vamp', 'thorns', 'barrier', 'leech', 'fear'] },
];
const ATTR_OF = {}; ATTRS.forEach((A, j) => A.e.forEach(k => ATTR_OF[k] = j));
const CLS_ATTR = { war: 0, bers: 0, reap: 0, pal: 3, guard: 3, mage: 2, sham: 2, alch: 2, priest: 2, chrono: 2, rune: 2, necro: 2, arch: 1, assa: 1, gamb: 1, monk: 1 };
const mainAttr = () => CLS_ATTR[cls()] ?? 0;
function attrGain(v) {
  if (!S.attr) S.attr = [0, 0, 0, 0];
  const m = mainAttr(); for (let j = 0; j < 4; j++) S.attr[j] += v * (j === m ? 2 : 1) * (.8 + .4 * rnd());
}
const attrMul = j => { const A = (S.attr && S.attr[j]) || 0; return 1 + .15 * Math.log2(1 + A / 20) * (j === mainAttr() ? 1.25 : 1); };
const thrL = k => (S.meta.thr && S.meta.thr[k]) || 0;
const thrTotal = () => { let n = 0; for (const e of EFF) n += thrL(e.k); return n; };
function thrCheck(R) {
  const M = S.meta; if (!M.thr) M.thr = {};
  for (const e of EFF) { const v = R[e.k]; if (!(v >= 1e3)) continue; const t = Math.min(20, Math.floor(Math.log10(v) / 3));
    if (t > (M.thr[e.k] || 0)) { M.thr[e.k] = t; D.dirty = true;
      const sv = bossSouls(S.zone) * .15 * t; addSouls(sv);
      feed('Порог: ' + e.n + ' ★' + t + ' · +' + 5 * t + '% навсегда', e.c);
      ftext(hero.x, hero.y - 26, e.n + ' ★' + t, e.c, 1, 1); tone(1319, .08, 'triangle', .035); } }
}
function perkMods() {
  const L = perkL;
  D.hit *= 1 + .25 * L('dmg'); D.maxHP *= 1 + .3 * L('hp'); D.aps = Math.min(14, D.aps * (1 + .1 * L('aps')));
  D.crit = Math.min(.95, D.crit + .04 * L('crit')); D.critM *= 1 + .15 * L('crit'); D.vamp += .01 * L('vamp'); D.regen += .01 * L('regen');
  D.gainMult *= 1 + .2 * L('gain'); D.rare = Math.min(.7, D.rare * (1 + .3 * L('gold'))); D.dodge = Math.min(.9, D.dodge + .03 * L('dodge')); D.armor = Math.min(.95, D.armor + .04 * L('armor'));
  if (L('clsx') && D.cq) D.cq = D.cq.map(q => Math.min(1.5, q * (1 + .15 * L('clsx'))));
}
function perkFx() { const out = []; for (const p of PERKS) if (p.fx && perkL(p.k)) out.push({ n: p.n, ty: p.fx[0], p: p.fx[1] || 0, L: perkL(p.k), t: 9, id: p.k }); return out; }
function openPerks() {
  if (!S.pend) return; const o = perkOffer(); if (!o.length) { S.pend = 0; return; }
  const el = $('perkbox'); el.hidden = false;
  el.innerHTML = `<div class="pkh">УРОВЕНЬ ${S.lvl} · ВЫБЕРИ ПЕРК${S.pend > 1 ? ' (ещё ' + (S.pend - 1) + ')' : ''}</div>` + o.map(p => { const L = perkL(p.k);
    return `<button class="pkc" data-pk="${p.k}"><b>${p.n} ${roman(L + 1)}</b><small>${p.d(L + 1)}</small>${L ? `<em>сейчас: ${p.d(L)}</em>` : ''}${p.fx ? '<i>механика</i>' : ''}</button>`; }).join('') + `<button class="pkx" data-pk="">позже</button>`;
}

