// Прогон баланса: несколько независимых игр параллельно в быстром режиме (SIM), автоигра, метрики → светофор по balance-targets.json.
// node tools/balance.js [--min 60] [--runs 3] [--talents 0] [--v — список жизней]     (--min ≥ 240 — с вознесением)
const path = require('path'), fs = require('fs'); const { open, QUIET, TALENTS } = require('./tests/_lib');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const MIN = arg('min', 60), RUNS = arg('runs', 3), TAL = arg('talents', 0), VERB = process.argv.includes('--v');
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'balance-targets.json'), 'utf8'));

// внутри страницы: хуки на смерть/перерождение, сбор истории
const SETUP = `(${QUIET})(true); SIM = true; requestAnimationFrame = () => 0; if (${TAL}) (${TALENTS})(${TAL});
  window.__B = { gt: 0, lifeT0: 0, zoneT: {}, lives: [], why: '', hist: [], lv0: cm(S.cls).lv, cls: S.cls, asc: [] };
  const B = __B, ohd = heroDeath;
  heroDeath = function () { if (deathT <= 0) B.why = bossAlive ? (mobs.some(m => m.boss && m.fury) ? 'ярость' : 'вожак') : 'толпа'; return ohd(); };
  const orb = rebirth;
  rebirth = function (fa) { let l90 = B.lifeT0, run = 0, pt = null; for (const [t, h] of B.hist) { run = h > .9 ? run + (pt === null ? 0 : t - pt) : 0; pt = t; if (run >= 1) l90 = t; }   // HP > 90% держалось ≥ 1 с
    B.lives.push({ len: B.gt - B.lifeT0, why: B.why || (fa ? 'вознесение' : 'сброс'), d90: B.gt - l90, best: S.meta.best, cls: B.cls, gain: cm(B.cls).lv - B.lv0 });
    B.why = ''; B.hist = []; const r = orb(fa); B.lifeT0 = B.gt; B.cls = S.cls; B.lv0 = cm(S.cls).lv; return r; };`;
// одна игровая минута
const STEP = `(() => { const B = __B; let nan = null; if (!B.nanDone) { S.vals = stats.map(s => s.v); S.lv = stats.map(s => s.lvl); B.snap = JSON.stringify(S); }
  for (let i = 0; i < 30 * 60; i++) { update(1 / 30); if (US) ultFrame(1 / 30); B.gt += 1 / 30;
    if (!B.nanDone && !(Number.isFinite(D.hit) && Number.isFinite(hero.hp) && Number.isFinite(hero.x) && Number.isFinite(D.maxHP))) { B.nanDone = 1;
      nan = { i, z: S.zone, lt: S.lt, asc: S.meta.asc, D: Object.keys(D).filter(k => typeof D[k] === 'number' && !Number.isFinite(D[k])), hero: Object.keys(hero).filter(k => typeof hero[k] === 'number' && !Number.isFinite(hero[k])), st: stats.filter(s => !Number.isFinite(s.v)).map(s => s.e), snap: B.snap }; }
    if (i % 6 === 0 && deathT <= 0) { B.hist.push([B.gt, Math.max(0, hero.hp) / D.maxHP]); if (B.hist.length > 400) B.hist.shift(); }
    for (const z of [25, 50]) if (S.meta.best >= z && B.zoneT[z] === undefined) B.zoneT[z] = B.gt; }
  // вознесение как в автоигре: Страж побеждён, прогресс встал на 15 мин
  S.meta.cycB = Math.max(S.meta.cycB || 0, S.zone); if (S.meta.cycB !== B.lb) { B.lb = S.meta.cycB; B.lbT = B.gt; }
  if (canAsc() && sparksFor() > 0 && deathT <= 0 && B.gt - (B.lbT || 0) > 900 && (B.ascT || 0) + 600 < B.gt) { B.ascT = B.gt; ascend(); S.meta.cycB = 0; B.lbT = B.gt; B.asc.push(B.gt); skyBest(); $('sky').hidden = true; }
  let dg = null; if (B.gt - B.lifeT0 > 1200 && B.dgL !== B.lifeT0) { B.dgL = B.lifeT0; dg = JSON.stringify({ z: S.zone, mobs: mobs.length, alive: mobs.filter(m => !m.dead).length, boss: bossAlive, bossM: mobs.filter(m => m.boss).length, hp: hero.hp / D.maxHP, pool: hero.pool, hit: D.hit, zhp: zoneHP(S.zone), kills: S.kills, wave: S.wave, need: typeof zoneNeed === 'function' ? zoneNeed(S.zone) : 0, prog: S.prog, deathT, EV: !!EV, US: !!US, lt: S.lt, thr: threatM(), fast: S.fastTo, hx: hero.x, hy: hero.y, iframe: hero.iframe }); }
  return { gt: B.gt, best: S.meta.best, lives: B.lives.length, asc: S.meta.asc || 0, cz: cycZ(), dg, nan }; })()`;

async function run(id) {
  const { b, p, errs } = await open({ phone: false });
  await p.evaluate(SETUP);
  for (let m = 0; m < MIN; m++) { const r = await p.evaluate(STEP); if (r.dg) process.stderr.write(`  ЗАЛИП игра ${id}: ${r.dg}\n`); if (r.nan) { fs.writeFileSync(path.join(require('os').tmpdir(), 'nan_snap_' + id + '.json'), r.nan.snap); delete r.nan.snap; process.stderr.write(`  NaN игра ${id} (мин ${m}): ${JSON.stringify(r.nan)}\n`); } if (m % 15 === 14) process.stderr.write(`  игра ${id}: ${m + 1} мин, лучшая зона ${r.best}, вознесений ${r.asc}, цикл до ${r.cz}, жизней ${r.lives}\n`); }
  const B = await p.evaluate(() => { const B = __B; return { zoneT: B.zoneT, lives: B.lives, asc: B.asc, gt: B.gt, lifeT0: B.lifeT0 }; });
  await b.close(); return { ...B, errs };
}
const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
(async () => {
  const t0 = Date.now(); process.stderr.write(`Прогон: ${RUNS} игр × ${MIN} игр. мин${TAL ? ', таланты ' + TAL : ''}\n`);
  const R = await Promise.all(Array.from({ length: RUNS }, (_, i) => run(i + 1)));
  const lives = R.flatMap(r => r.lives), deaths = lives.filter(l => ['толпа', 'вожак', 'ярость'].includes(l.why));
  const stuck = R.reduce((a, r) => a + r.lives.filter(l => l.len > 720).length + (r.gt - r.lifeT0 > 720 ? 1 : 0), 0);
  const M = {
    life_med: med(lives.map(l => l.len / 60)),
    t_zone25: med(R.map(r => r.zoneT[25]).filter(x => x !== undefined).map(x => x / 60)),
    t_zone50: med(R.map(r => r.zoneT[50]).filter(x => x !== undefined).map(x => x / 60)),
    death90_med: med(deaths.map(l => l.d90)),
    fury_share: deaths.length ? deaths.filter(l => l.why === 'ярость').length / deaths.length * 100 : NaN,
    stuck_lives: stuck,
    cls_gain_med: med(lives.filter(l => l.len > 60).map(l => l.gain)),
    t_asc1: MIN >= 240 ? med(R.map(r => r.asc[0]).filter(x => x !== undefined).map(x => x / 60)) : NaN,
    errors: R.reduce((a, r) => a + r.errs.length, 0),
  };
  const light = (k, v) => { const t = T[k]; if (isNaN(v)) return '⚪'; const inn = ([a, b]) => v >= a && v <= b; return inn(t.green) ? '🟢' : inn(t.yellow) ? '🟡' : '🔴'; };
  const fmtv = v => isNaN(v) ? '—' : Number.isInteger(v) || Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
  console.log(`\nБаланс: ${RUNS} ${RUNS === 1 ? 'игра' : RUNS < 5 ? 'игры' : 'игр'} × ${MIN} мин, жизней ${lives.length}, смертей ${deaths.length} (толпа ${deaths.filter(l => l.why === 'толпа').length} / вожак ${deaths.filter(l => l.why === 'вожак').length} / ярость ${deaths.filter(l => l.why === 'ярость').length}), лучшие зоны ${R.map(r => r.lives.length ? Math.max(...r.lives.map(l => l.best)) : 0).join(', ')}`);
  for (const k of Object.keys(T)) if (k[0] !== '_') { const t = T[k]; console.log(`${light(k, M[k])} ${t.name}: ${fmtv(M[k])} ${t.unit}  (цель ${t.green[0]}–${t.green[1]})`); }
  if (M.errors) console.log('Ошибки:', [...new Set(R.flatMap(r => r.errs))].slice(0, 5).join(' | '));
  if (VERB) R.forEach((r, i) => console.log(`игра ${i + 1}: ` + r.lives.map(l => `${(l.len / 60).toFixed(1)}м z${l.best} ${l.why}${l.why !== 'сброс' ? ' ' + l.d90.toFixed(0) + 'с' : ''}`).join(' | ') + (r.gt - r.lifeT0 > 60 ? ` | идёт ${((r.gt - r.lifeT0) / 60).toFixed(1)}м` : '')));
  R.forEach((r, i) => r.asc.length && console.log(`игра ${i + 1}: вознесения на ` + r.asc.map(t => (t / 60).toFixed(0)).join(', ') + ' мин'));
  console.log(`(реальное время ${((Date.now() - t0) / 60000).toFixed(1)} мин)`);
})();
