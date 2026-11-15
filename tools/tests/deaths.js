// как умирает герой: N жизней автоигрой, ход HP за последние 60 с, причина смерти. node deaths.js [жизней=4] [таланты 0..1=0]
const { open, QUIET, TALENTS } = require('./_lib');
const N = +process.argv[2] || 4, T = +process.argv[3] || 0;
(async () => { const { b, p, errs } = await open();
  console.log(await p.evaluate(`(${QUIET})(true); if (${T}) (${TALENTS})(${T}); (() => { const out = []; let why = '';
    const ohd = heroDeath; heroDeath = function () { if (deathT <= 0) why = bossAlive ? (mobs.some(m => m.boss && m.fury) ? 'ярость' : 'вожак') : 'толпа'; return ohd(); };
    for (let L = 0; L < ${N}; L++) { const r0 = S.meta.rebirths; let t = 0, hist = [];
      for (let i = 0; i < 30 * 600 && S.meta.rebirths === r0; i++) { update(1 / 30); if (US) ultFrame(1 / 30); t += 1 / 30; if (i % 6 === 0 && deathT <= 0) hist.push([t, Math.max(0, hero.hp) / D.maxHP]); }
      let l90 = 0; for (const [tt, h] of hist) if (h > .9) l90 = tt;
      out.push((L + 1) + ': жизнь ' + t.toFixed(0) + 'с, лучшая зона ' + S.meta.best + ', ' + (why || 'жив') + ', от 90% до смерти ' + (t - l90).toFixed(1) + 'с');
      out.push('   HP за 60с: ' + hist.filter(q => q[0] > t - 60).filter((q, i) => i % 10 === 0).map(q => Math.round(q[1] * 100)).join(' ')); why = ''; }
    return out.join('\\n'); })()`));
  if (errs.length) console.log('ERR', errs); await b.close(); })();
