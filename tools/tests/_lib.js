// общие помощники для тестов: путь к игре, браузер «как телефон», тихий режим (без подсказок и тостов)
const path = require('path');
const { chromium, devices } = require('playwright');
const GAME = 'file://' + path.resolve(__dirname, '../../index.html');
async function open({ phone = true, scale = 1 } = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'], deviceScaleFactor: scale } : {});
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|Fetch API cannot load file/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(GAME); await p.waitForTimeout(500);
  await p.click('#mok').catch(() => {});
  return { b, p, errs };
}
// тихий режим: без подсказок, тостов и окна приветствия; по желанию автоигра
const QUIET = (auto) => { S.tips = new Proxy({}, { get: () => 1 }); toast = () => {}; tip = () => {}; const m = document.getElementById('modal'); if (m) m.hidden = true;
  if (auto) ['autoPerk', 'autoUlt', 'autoTal', 'autoPath'].forEach(k => S.meta[k] = true); };
// часть талантов вкачать (0..1) — быстрый «сильный герой»
const TALENTS = (f) => { for (const nd of TN) { if (nd.alt != null && nd.alt < nd.id) continue; S.meta.nodes[nd.id] = Math.floor(nMax(nd) * f); } calcTal(); recalc(); };
module.exports = { open, GAME, QUIET: QUIET.toString(), TALENTS: TALENTS.toString() };
