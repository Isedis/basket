// темп прокачки классов: N жизней автоигрой, уровни мастерства. node classes.js [жизней=10]
const { open, QUIET } = require('./_lib');
const N = +process.argv[2] || 10;
(async () => { const { b, p, errs } = await open();
  console.log(await p.evaluate(`(${QUIET})(true); (() => { const out = []; let gt = 0;
    for (let L = 0; L < ${N}; L++) { const r0 = S.meta.rebirths, k = S.cls, lv0 = cm(k).lv; let t = 0;
      for (let i = 0; i < 30 * 900 && S.meta.rebirths === r0; i++) { update(1 / 30); if (US) ultFrame(1 / 30); t += 1 / 30; }
      gt += t; out.push((L + 1) + ': ' + k + ' ур. ' + lv0 + '→' + cm(k).lv + ' за ' + t.toFixed(0) + 'с, лучшая зона ' + S.meta.best + ', всего ' + (gt / 60).toFixed(0) + ' мин'); }
    out.push('уровни: ' + Object.entries(S.meta.cl).map(([k, c]) => k + ':' + c.lv).join(' ')); return out.join('\\n'); })()`));
  if (errs.length) console.log('ERR', errs); await b.close(); })();
