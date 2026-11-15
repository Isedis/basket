// все 16 классов: перки-механики + ульта, 15 игровых секунд каждый — ищем исключения
const { open, QUIET } = require('./_lib');
(async () => { const { b, p, errs } = await open();
  const r = await p.evaluate(`(${QUIET})(); (() => { const out = [];
    for (const k of CLS_KEYS) { S.cls = k; S.perks = {}; PERKS.forEach(x => S.perks[x.k] = 2); D.dirty = true; calcPath(); recalc(); ult = 1e9; ultCd = 0;
      for (let i = 0; i < 30 * 15; i++) { try { if (i % 60 == 0) { ultCd = 0; fireUlt(); } ultFrame(1 / 30); update(1 / 30); if (i % 5 == 0) render(); } catch (e) { out.push(k + ': ' + e.message + ' ' + e.stack.split('\\n')[1]); break; } } }
    return out; })()`);
  const bad = r.length || errs.length; console.log(bad ? 'FAIL smoke:\n' + r.concat(errs).join('\n') : 'ok smoke (16 классов)'); await b.close(); process.exit(bad ? 1 : 0); })();
