// загрузка игры: нет ошибок в консоли и исключений
const { open } = require('./_lib');
(async () => { const { b, p, errs } = await open(); await p.waitForTimeout(1500);
  console.log(errs.length ? 'FAIL load: ' + errs.join(' | ') : 'ok load'); await b.close(); process.exit(errs.length ? 1 : 0); })();
