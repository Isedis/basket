'use strict';
/* ---------- статы: открытие и прирост ---------- */
const slist = $('slist');
function addStatRow(s, isNew) {
  const el = document.createElement('div');
  el.className = 'row' + (isNew ? ' new' : '');
  el.innerHTML = `<i style="background:${EFF[s.e].c}"></i><span class="nm"></span><span class="w"></span><span class="val"></span>`;
  el.children[1].textContent = s.name;
  el.children[2].textContent = s.w > 1 ? '×' + fmt(s.w) : '';
  el.onclick = () => showInfo({ s });
  s.el = el; s.valEl = el.children[3]; s.shown = -1;
  groupOf(s.e).body.prepend(el);
}
const groups = [];
function groupOf(e) {
  if (groups[e]) return groups[e];
  const g = { e, el: document.createElement('div') };
  g.el.className = 'grp';
  g.el.style.setProperty('--ec', EFF[e].c);
  g.el.innerHTML = `<div class="gh"><div class="rtop"><span class="ricw"><img class="ric" src="${effIconURL(e)}"></span><span class="gn"><b></b><em></em></span><span class="rt"></span></div>` +
    `<div class="rmid"><span class="gv"></span><span class="gc"></span><span class="ga"></span></div><div class="rbar"><i></i></div><div class="rfx"></div></div><div class="gb"></div>`;
  g.head = g.el.firstChild; g.body = g.el.lastChild; g.arrow = g.head.querySelector('.ga');
  g.nm = g.head.querySelector('b'); g.fm = g.head.querySelector('em'); g.cnt = g.head.querySelector('.gc'); g.val = g.head.querySelector('.gv');
  g.tier = g.head.querySelector('.rt'); g.bar = g.head.querySelector('.rbar i'); g.fx = g.head.querySelector('.rfx');
  g.head.onclick = () => { S.open[e] = !S.open[e]; applyGroup(g); showInfo({ e }); };
  let after = null; for (let i = e + 1; i < NE; i++) if (groups[i]) { after = groups[i].el; break; }
  slist.insertBefore(g.el, after);
  groups[e] = g; applyGroup(g); return g;
}
function applyGroup(g) { const o = !!S.open[g.e]; g.body.hidden = !o; g.el.classList.toggle('open', o); g.arrow.textContent = o ? '▴' : '▾'; }
// пиксельные иконки эффектов для карточек-рун
const EICON = { dmg: 'sword', hp: 'heart', aspd: 'wing', crit: 'eye', regen: 'heart', armor: 'shield', critd: 'spike', vamp: 'drop', luck: 'clover', wis: 'book', move: 'wing', cleave: 'sword', dodge: 'swap', range: 'spike',
  fire: 'flame', poison: 'drop', shock: 'bolt', thorns: 'spike', power: 'fist', fury: 'flame', bleed: 'drop', frost: 'cond', exec: 'skull', bounce: 'swap', grav: 'gear', spirit: 'wing', greed: 'crown', barrier: 'shield',
  det: 'flame', leech: 'drop', rage: 'fist', scrit: 'star', hunt: 'eye', energy: 'bolt', fear: 'skull', curio: 'book', trail: 'bolt', orbs: 'star', echo: 'clock', mark: 'eye', horde: 'hand', blink: 'wing', dust: 'clover',
  quake: 'fist', beam: 'bolt', clone: 'hand', hole: 'gear', mirror: 'shield', crows: 'wing', ritual: 'skull' };
const effIcC = {};
function effIconURL(e) { if (effIcC[e]) return effIcC[e]; const P = ICONS[EICON[EFF[e].k] || 'star'] || ICONS.star, c = document.createElement('canvas'); c.width = c.height = 7; const x = c.getContext('2d');
  x.fillStyle = '#000'; P.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') for (const [dx, dy] of [[0, 1], [1, 0], [1, 1]]) x.fillRect(i + 1 + dx, j + 1 + dy, 1, 1); }));
  x.fillStyle = EFF[e].c; P.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') x.fillRect(i + 1, j + 1, 1, 1); })); return effIcC[e] = c.toDataURL(); }
// прогресс до следующей формы: форма = 1 + floor(log10(r/3)/1.5)
function formProg(e) { const r = (D.R && D.R[EFF[e].k] || 0) * (1 + ta('form')); if (r < 3) return Math.max(0, r / 3); const v = Math.log10(r / 3) / 1.5; return v - Math.floor(v); }


/* ================= АЛТАРЬ СИЛЫ — эпичное окно статов ================= */
let alSel = -1, alRaf = 0, alW = 0, alH = 0, alDPR = 1, alPos = {};
function openAltar() { $('altar').hidden = false; sizeAltar(); renderAltarInfo(); if (!alRaf) alRaf = requestAnimationFrame(drawAltar); }
function sizeAltar() { const v = $('alview'), r = v.getBoundingClientRect(); alDPR = Math.min(2, devicePixelRatio || 1); alW = r.width; alH = r.height; const c = $('alcv'); c.width = Math.round(alW * alDPR); c.height = Math.round(alH * alDPR); c.style.width = alW + 'px'; c.style.height = alH + 'px'; }
const alGemC = {};
function alGem(col, tier, big) {   // пиксельный камень: огранка, свет сверху-слева, рамка цвета формы
  const key = col + tier + big; if (alGemC[key]) return alGemC[key];
  const P = big ? ['...#####...', '..#ooooo#..', '.#ooolooo#.', '#oollloooo#', '#oollooooo#', '#ooooooood#', '#oooooood#.', '.#ooooodd#.', '..#oooddd#.', '...#oddd#..', '....###....'] : ['..###..', '.#olo#.', '#ollo#.', '#ooood#', '.#ood#.', '..###..'];
  const c = document.createElement('canvas'); c.width = P[0].length; c.height = P.length; const x = c.getContext('2d'), rim = tier >= 4 ? '#ffd84a' : tier >= 3 ? '#ffffff' : tier >= 1 ? shade(col, .35) : '#3a3260';
  P.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; x.fillStyle = ch === '#' ? rim : ch === 'l' ? shade(col, .55) : ch === 'd' ? shade(col, -.45) : col; x.fillRect(i, j, 1, 1); }));
  return alGemC[key] = c;
}
function alLayout() {
  const act = groups.filter(g => g && stats.some(s => s.e === g.e)).map(g => g.e).sort((a, b) => D.T[b] - D.T[a]);
  const cx = alW / 2, cy = alH * .5, R = Math.min(alW, alH) / 2;
  const rings = [[act.slice(0, 6), R * .42, .16, 1], [act.slice(6, 18), R * .64, -.1, 0], [act.slice(18), R * .86, .06, 0]];
  return { act, cx, cy, R, rings };
}
function drawAltar() {
  const cv = $('alcv'); if (!cv || $('altar').hidden) { alRaf = 0; return; }
  const c = cv.getContext('2d'); c.setTransform(alDPR, 0, 0, alDPR, 0, 0); c.imageSmoothingEnabled = false;
  const T = performance.now() / 1000, k = cls(), C = CL(), L = alLayout(), { cx, cy, R } = L;
  // фон: тёмный зал с пиксельными звёздами и туманом цвета класса
  const g = c.createRadialGradient(cx, cy, 10, cx, cy, Math.max(alW, alH) * .75); g.addColorStop(0, shade(C.c, -.6)); g.addColorStop(.45, '#0a0618'); g.addColorStop(1, '#030209'); c.fillStyle = g; c.fillRect(0, 0, alW, alH);
  for (let i = 0; i < 90; i++) { const x = (i * 97.3) % alW, y = (i * 53.7 + i * i * .3) % alH, ph = Math.floor(T * 2 + i) % 7; c.fillStyle = ph ? '#4a4690' : '#ffffff'; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
  // руны на полу: кольца орбит
  for (const [, rr] of L.rings) { const n = Math.floor(rr * 2 * Math.PI / 7); c.fillStyle = shade(C.c, -.35); for (let i = 0; i < n; i++) { if ((i + Math.floor(T * 4)) % 3 === 0) continue; const a = i / n * Math.PI * 2; c.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * .55), 2, 1); } }
  // столпы атрибутов по углам
  const corners = [[.1, .2], [.9, .2], [.1, .86], [.9, .86]];
  ATTRS.forEach((A, j) => { const [fx, fy] = corners[j], x = Math.round(alW * fx), y = Math.round(alH * fy), m = attrMul(j), h = Math.round(18 + Math.min(70, (m - 1) * 28)), main = j === mainAttr();
    c.fillStyle = '#000'; c.fillRect(x - 7, y - h - 1, 14, h + 2); c.fillStyle = shade(A.c, -.55); c.fillRect(x - 6, y - h, 12, h); c.fillStyle = shade(A.c, -.3); c.fillRect(x - 6, y - h, 3, h);
    for (let q = y - h + 4; q < y; q += 8) { c.fillStyle = shade(A.c, -.2); c.fillRect(x - 6, q, 12, 1); }
    const oy = y - h - 9 + Math.round(Math.sin(T * 2 + j) * 2), gr = c.createRadialGradient(x, oy, 1, x, oy, 18); gr.addColorStop(0, A.c + 'cc'); gr.addColorStop(1, A.c + '00'); c.fillStyle = gr; c.fillRect(x - 18, oy - 18, 36, 36);
    c.fillStyle = A.c; c.fillRect(x - 4, oy - 4, 8, 8); c.fillStyle = '#fff'; c.fillRect(x - 3, oy - 3, 3, 3);
    c.font = '7px "Press Start 2P", monospace'; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(A.n, x + 1, y + 11); c.fillStyle = main ? '#ffe08a' : A.c; c.fillText((main ? '◆' : '') + A.n, x, y + 10);
    c.fillStyle = '#e9e4ff'; c.fillText('×' + m.toFixed(2), x, y + 20); });
  // позиции камней
  alPos = {};
  L.rings.forEach(([list, rr, sp, big], ri) => list.forEach((e, i) => { const a = i / Math.max(1, list.length) * Math.PI * 2 + T * sp + ri; alPos[e] = { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * .55, big, depth: Math.sin(a), ring: ri }; }));
  // лучи синергий
  SYN.forEach((y, i) => { const l = sy(i), A = alPos[y.a], B = alPos[y.b]; if (!l || !A || !B) return; const col = EFF[y.a].c;
    c.globalAlpha = .25 + .15 * Math.sin(T * 3 + i); c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
    c.globalAlpha = .9; c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.stroke(); const f = (T * .5 + i * .3) % 1; c.fillStyle = col; c.fillRect(A.x + (B.x - A.x) * f - 2, A.y + (B.y - A.y) * f - 2, 4, 4); c.globalAlpha = 1; });
  // камни за героем (верхняя половина орбиты)
  const drawStone = e => { const P = alPos[e], f = F(e), col = EFF[e].c, big = P.big, sc = big ? 3 : 2, im = alGem(col, f, big), w = im.width * sc, h = im.height * sc, bob = Math.round(Math.sin(T * 2 + e) * 2);
    const gr = c.createRadialGradient(P.x, P.y, 2, P.x, P.y, w); gr.addColorStop(0, col + (f >= 3 ? '88' : '44')); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.fillRect(P.x - w, P.y - w, w * 2, w * 2);
    c.drawImage(im, Math.round(P.x - w / 2), Math.round(P.y - h / 2 + bob), w, h);
    const ic = ICONS[EICON[EFF[e].k] || 'star'], ps = big ? 2 : 1; c.fillStyle = '#fff'; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (ic[j][i] === '#') c.fillRect(Math.round(P.x - ps * 2.5 + i * ps), Math.round(P.y - ps * 2.5 + j * ps + bob), ps, ps);
    if (f && (big || P.ring < 2 || e === alSel)) { c.font = (big ? 8 : 7) + 'px "Press Start 2P", monospace'; c.textAlign = 'center'; const t = f <= 4 ? roman(f) : String(f); c.fillStyle = '#000'; c.fillText(t, P.x + 1, P.y + h / 2 + 10 + bob); c.fillStyle = f >= 4 ? '#ffd84a' : col; c.fillText(t, P.x, P.y + h / 2 + 9 + bob); }
    if (e === alSel) { const o = Math.round(w / 2 + 6), t2 = Math.floor(T * 6) % 2; c.fillStyle = '#ffe08a'; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.fillRect(P.x + dx * o - (dx > 0 ? 4 : 0) - t2 * dx, P.y + dy * o + bob, 5, 1); c.fillRect(P.x + dx * o, P.y + dy * o - (dy > 0 ? 4 : 0) - t2 * dy + bob, 1, 5); } } };
  const ords = Object.keys(alPos).map(Number).sort((a, b) => alPos[a].depth - alPos[b].depth);
  ords.filter(e => alPos[e].depth < 0).forEach(drawStone);
  // пьедестал и герой
  { const pw = Math.min(120, R * .55), py = cy + 26; c.fillStyle = '#000'; c.beginPath(); c.ellipse(cx, py + 6, pw / 2 + 2, 12, 0, 0, 6.283); c.fill();
    c.fillStyle = shade(C.c, -.55); c.beginPath(); c.ellipse(cx, py + 4, pw / 2, 10, 0, 0, 6.283); c.fill(); c.fillStyle = shade(C.c, -.25); c.beginPath(); c.ellipse(cx, py, pw / 2, 9, 0, 0, 6.283); c.fill();
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + T * .8; c.fillStyle = i % 2 ? C.c : '#ffffff'; c.fillRect(Math.round(cx + Math.cos(a) * pw * .42), Math.round(py + Math.sin(a) * 6), 2, 1); }
    const gr = c.createRadialGradient(cx, py - 40, 4, cx, py - 40, 90); gr.addColorStop(0, C.c + '33'); gr.addColorStop(1, C.c + '00'); c.fillStyle = gr; c.fillRect(cx - 90, py - 130, 180, 180);
    const f = formOf(k), pat = heroPortrait(k, f), sc = Math.max(3, Math.floor(Math.min(84, R * .5) / Math.max(pat.height, pat.width))), bob = Math.round(Math.sin(T * 1.6) * 3);
    const spr = pat, sl = sil32(pat, C.c);
    c.globalAlpha = .22 + .1 * Math.sin(T * 3); for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2]]) c.drawImage(sl, Math.round(cx - pat.width * sc / 2) + dx, Math.round(py - pat.height * sc + bob) + dy, pat.width * sc, pat.height * sc); c.globalAlpha = 1;
    c.drawImage(spr, Math.round(cx - pat.width * sc / 2), Math.round(py - pat.height * sc + bob), pat.width * sc, pat.height * sc); }
  ords.filter(e => alPos[e].depth >= 0).forEach(drawStone);
  // искры, поднимающиеся от пьедестала
  for (let i = 0; i < 24; i++) { const ph = (T * .35 + i * .137) % 1, x = cx + Math.sin(i * 7.1 + T) * 40, y = cy + 20 - ph * R * .9; c.globalAlpha = 1 - ph; c.fillStyle = i % 3 ? C.c : '#ffffff'; c.fillRect(Math.round(x), Math.round(y), 2, 2); } c.globalAlpha = 1;
  alRaf = requestAnimationFrame(drawAltar);
}
function renderAltarInfo() {
  $('alsum').innerHTML = `<div><small>УРОН/С</small><b>${fmt(D.hit * D.aps * (1 + D.crit * (D.critM - 1)))}</b></div><div><small>ЗДОРОВЬЕ</small><b>${fmt(D.maxHP)}</b></div><div><small>ЭФФЕКТОВ</small><b>${groups.filter(g => g && stats.some(s => s.e === g.e)).length}</b></div><div><small>СИНЕРГИЙ</small><b>${SYN.filter((y, i) => sy(i)).length}/${SYN.length}</b></div>`;
  const el = $('alinfo'); if (alSel < 0) { el.innerHTML = `<div class="k">Камни вокруг героя — его эффекты: ближе и крупнее — сильнее. Лучи — активные синергии, столпы — атрибуты. Тапни камень.</div>`; return; }
  const e = alSel, E = EFF[e], f = F(e), cnt = stats.filter(s => s.e === e).length, j = ATTR_OF[E.k], th = thrL(E.k), syns = SYN.map((y, i) => ({ y, i })).filter(o => o.y.a === e || o.y.b === e);
  el.innerHTML = `<h3 style="color:${E.c}">${E.n} <span class="tier">${f ? (f <= 4 ? roman(f) : f) : '—'}</span>${th ? ' ' + pxImg('star', '#ffe08a', 8) + th : ''}${D.spec === e ? ' <span style="color:#f2c94c">специализация ×1.5</span>' : ''}</h3>` +
    `<div class="k">${formName(e, f)} · ${cnt} стат(ов) · сила ${fmt(D.T[e])}</div><i class="albar"><u style="width:${Math.round(formProg(e) * 100)}%;background:${E.c}"></u></i><div class="k">до следующей формы: ${Math.round(formProg(e) * 100)}%</div>` +
    `<div>${effVal(e)}</div>` + (j != null ? `<div class="k">атрибут: <span style="color:${ATTRS[j].c}">${ATTRS[j].n} ×${attrMul(j).toFixed(2)}</span></div>` : '') +
    (syns.length ? `<div class="k">синергии: ${syns.map(o => { const p = EFF[o.y.a === e ? o.y.b : o.y.a]; return `<span style="color:${sy(o.i) ? p.c : '#5a5470'}">${o.y.n} (+${p.n})${sy(o.i) ? ' ур.' + sy(o.i) : ''}</span>`; }).join(', ')}</div>` : '');
}
function altarInit() {
  $('alclose').onclick = () => { $('altar').hidden = true; };
  $('allist').onclick = () => { $('altar').hidden = true; S.showList = true; S.allStats = true; updateUI(); };
  $('alview').addEventListener('pointerdown', e => { const r = $('alview').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = -1, bd = 34;
    for (const k in alPos) { const d = Math.hypot(alPos[k].x - x, alPos[k].y - y); if (d < bd) { bd = d; best = +k; } } alSel = best; renderAltarInfo(); });
  setInterval(() => { if (!$('altar').hidden) renderAltarInfo(); }, 700);
  window.addEventListener('resize', () => { if (!$('altar').hidden) sizeAltar(); });
}

/* ---------- подробности по тапу ---------- */
let infoRef = null;
const infoEl = $('info');
infoEl.onclick = () => { infoRef = null; infoEl.hidden = true; };
function showInfo(ref) { infoRef = ref; infoEl.hidden = false; renderInfo(); }
function effVal(e) {
  switch (EFF[e].k) {
    case 'dmg': return 'удар ' + fmt(D.hit);
    case 'hp': return 'макс. HP ' + fmt(D.maxHP);
    case 'aspd': return D.aps.toFixed(2) + ' атак в секунду';
    case 'crit': return 'шанс крита ' + pct(D.crit);
    case 'regen': return pct(D.regen) + ' HP в секунду' + (hero.shield > 0 ? ', щит ' + fmt(hero.shield) : '');
    case 'armor': return 'снижение урона ' + pct(D.armor);
    case 'critd': return 'крит ×' + fmt(D.critM);
    case 'vamp': return pct(D.vamp) + ' HP за удар';
    case 'luck': return 'редкие враги ' + pct(D.rare);
    case 'wis': return 'множитель наград ×' + fmt(D.gainMult);
    case 'move': return 'скорость ' + D.move.toFixed(0);
    case 'cleave': return '+' + D.cleave + ' доп. целей';
    case 'dodge': return 'уворот ' + pct(D.dodge);
    case 'range': return 'дальность ' + D.range.toFixed(1);
    case 'fire': return 'взрыв ' + pct(D.fire) + ' урона, радиус ' + D.fireR.toFixed(0);
    case 'poison': return pct(D.poison) + ' урона ядом в секунду';
    case 'shock': return 'шанс ' + pct(D.shock) + ', цепь до ' + D.chain;
    case 'thorns': return 'отражает ' + pct(D.thorns) + ' удара';
    case 'power': return 'урон ×' + D.power.toFixed(2);
    case 'bleed': return pct(D.bleed) + ' удара уходит в кровотечение';
    case 'frost': return 'замедляет с шансом ' + pct(D.frost) + ', заморозка ' + pct(D.frost * .15);
    case 'exec': return 'казнит врагов ниже ' + pct(D.exec) + ' HP';
    case 'bounce': return D.bounce + ' отскоков удара';
    case 'grav': return 'стягивает врагов, сила ' + pct(D.grav);
    case 'spirit': return D.spirits + ' духов-клинков';
    case 'greed': return '+' + D.greed + ' статов за убийство';
    case 'det': return 'шанс взрыва при убийстве ' + pct(D.det);
    case 'leech': return 'убийство лечит ' + pct(D.leech) + ' HP';
    case 'rage': return '+' + pct(D.rageK) + ' скорости атаки за каждое убийство (до 5)';
    case 'scrit': return 'шанс сверхкрита ' + pct(D.scrit);
    case 'hunt': return 'урон по вожакам и элите ×' + D.hunt.toFixed(2);
    case 'energy': return 'заряд ульты ×' + D.energy.toFixed(2);
    case 'fear': return 'враги рядом бьют на ' + pct(D.fear) + ' слабее';
    case 'trail': return 'след бьёт на ' + pct(D.trail * 1.5) + ' удара в секунду';
    case 'orbs': return D.orbs + ' огненных сфер';
    case 'echo': return 'эхо бьёт на ' + pct(D.echo) + ' удара';
    case 'mark': return 'помеченные получают +' + pct(D.mark) + ' урона';
    case 'horde': return '+' + D.horde + ' врагов на поле';
    case 'blink': return 'шанс скачка к цели ' + pct(D.blink) + ' в секунду';
    case 'dust': return 'шанс пыли за убийство ' + pct(D.dust);
    case 'quake': return 'землетрясение: ' + pct(D.quake * 1.5) + ' удара по кругу';
    case 'beam': return 'каждые 3с луч: ×' + (3 + 12 * D.beam).toFixed(1) + ' удара, лечит ' + pct(.02 + .08 * D.beam) + ' HP';
    case 'clone': return 'каждые 9с двойник на ' + (3 + 4 * D.clone).toFixed(1) + 'с, бьёт на ' + pct(.5 + D.clone) + ' удара';
    case 'hole': return 'каждые 8с дыра стягивает врагов и бьёт ×' + (5 + 25 * D.hole).toFixed(0);
    case 'mirror': return 'щит каждые ' + Math.max(3, 8 - 5 * D.mirror).toFixed(1) + 'с: гасит удар и отвечает ×' + (10 + 40 * D.mirror).toFixed(0);
    case 'crows': return 'воронов: ' + (1 + Math.floor(4 * D.crows)) + ', пике ×' + (1 + 3 * D.crows).toFixed(1);
    case 'ritual': return 'каждые 10с −10% HP → взрыв ×' + (8 + 40 * D.ritual).toFixed(0);
    case 'curio': return 'статы открываются в ' + (1 + D.curious).toFixed(2) + ' раза быстрее';
    case 'barrier': return 'щит ' + pct(D.barrier) + ' HP каждые 6с';
    case 'fury': return 'до ×' + (1 + D.furyK).toFixed(2) + ' урона при низком HP';
  }
}
function formLine(e) {
  const f = F(e), r = D.R[EFF[e].k] || 0, need = formNeed(f + 1);
  const prog = clamp(Math.log10(1 + r) / Math.log10(1 + need), 0, 1);
  return `<span class="k">Форма:</span> ${formName(e, f)}<br><span class="k">Следующая:</span> ${formName(e, f + 1)} · ${Math.floor(prog * 100)}%` +
    (FORM_HINT[EFF[e].k] ? `<br><span class="k">${FORM_HINT[EFF[e].k]}</span>` : '');
}
function renderInfo() {
  if (!infoRef) return;
  let h = '';
  if (infoRef.s) {
    const s = infoRef.s, e = s.e, share = D.T[e] > 0 ? s.v * s.w / D.T[e] : 0;
    h = `<h3 style="color:${EFF[e].c}">${s.name}</h3><span class="k">Усиливает:</span> ${EFF[e].n} (${EFF[e].d})<br>` +
      `<span class="k">Значение:</span> ${fmt(s.v)} × вес ${fmt(s.w)} = ${fmt(s.v * s.w)}<br>` +
      `<span class="k">Доля в эффекте:</span> ${pct(share)}<br><span class="k">Сейчас ${EFF[e].n}:</span> ${effVal(e)}<br>` +
      `<span class="k">До эволюции:</span> ${fmt(Math.max(0, evoAt(s) - s.v))}<br>` + formLine(e);
  } else {
    const e = infoRef.e, fav = biomeOf(S.zone).fav.includes(e);
    h = `<h3 style="color:${EFF[e].c}">${EFF[e].n}${D.spec === e ? ' · ' + SPEC[e] : ''}</h3><span class="k">Сейчас:</span> ${effVal(e)}<br>` +
      `<span class="k">Всего:</span> ${fmt(D.T[e])}${fav ? ' · <span style="color:#5cff8a">зона даёт ×2</span>' : ''}${D.spec === e ? ' · <span style="color:#f2c94c">специализация ×1.5</span>' : ''}<br>` + formLine(e);
  }
  infoEl.innerHTML = h + '<br><span class="k">(тап — закрыть)</span>';
}
const MAX_STATS = 1500;
function checkUnlocks(silent) {
  let added = 0;
  while (stats.length < MAX_STATS && unlockKills(stats.length) <= S.kills) {
    const s = makeStat(stats.length);
    if (S.vals[s.n] !== undefined) s.v = S.vals[s.n];
    else if (ksL(6, 0) && D.gainMult) s.v += zs() * D.gainMult * 10 * ksL(6, 0);
    if (S.lv && S.lv[s.n]) setLvl(s, S.lv[s.n]);
    stats.push(s); addStatRow(s, !silent); added++;
    if (!silent && ntL(6, 0)) giveBurst(zs() * (D.gainMult || 1) * 2 * ntL(6, 0));
    if (!silent) { feed('Новый стат: ' + s.name + ' → ' + EFF[s.e].n, '#f2c94c'); if (added === 1) sfx.unlock(); }
  }
  if (added) D.dirty = true;
  return added;
}
function pickStat() {
  const n = stats.length;
  if (rnd() < .3) return stats[n - 1 - Math.floor(rnd() * Math.min(6, n))];
  return stats[Math.floor(rnd() * n)];
}

