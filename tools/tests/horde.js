// орда у сильного героя: сколько врагов, убийств в секунду, прогресс зоны, мс на кадр
const { open, QUIET, TALENTS } = require('./_lib');
(async () => { const { b, p, errs } = await open();
  await p.evaluate(`(${QUIET})(); (${TALENTS})(.5); for (let i = 0; i < 30 * 120; i++) update(1 / 30); S.zone = Math.max(20, S.zone - 15); S.zk = 0; mobs.length = 0; buildGround();`);
  console.table(await p.evaluate(() => { const out = []; for (let s = 0; s < 6; s++) { const t0 = performance.now(), k0 = S.kills, zk0 = S.zk; for (let i = 0; i < 300; i++) update(1 / 30);
    out.push({ zone: S.zone, HK: +HK.toFixed(2), mobs: mobs.length, killsPerSec: +((S.kills - k0) / 10).toFixed(1), msPerUpdate: +((performance.now() - t0) / 300).toFixed(2) }); } return out; }));
  console.log('мс на кадр отрисовки:', await p.evaluate(() => { const t = performance.now(); for (let i = 0; i < 30; i++) render(); return ((performance.now() - t) / 30).toFixed(2); }));
  if (errs.length) console.log('ERR', errs); await b.close(); })();
