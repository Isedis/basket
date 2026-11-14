// скриншоты боя: начало игры и сильный герой (40% талантов) → shot1.png, shot2.png в текущей папке
const path = require('path'); const { open, QUIET, TALENTS } = require('./_lib');
(async () => { const { b, p, errs } = await open({ scale: 2 });
  await p.evaluate(`(${QUIET})()`); await p.waitForTimeout(2500); await p.screenshot({ path: path.resolve(process.cwd(), 'shot1.png') });
  await p.evaluate(`(${TALENTS})(.4); for (let i = 0; i < 30 * 120; i++) update(1 / 30);`); await p.waitForTimeout(2500); await p.screenshot({ path: path.resolve(process.cwd(), 'shot2.png') });
  console.log('сохранено shot1.png, shot2.png', errs.length ? errs : ''); await b.close(); })();
