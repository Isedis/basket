// лист спрайтов героев: облики I–IV, шаг, замах. node sprites.js [классы через запятую] → sprites.png рядом
const path = require('path'), fs = require('fs'); const { open } = require('./_lib');
const KS = (process.argv[2] || 'war,mage,arch,monk').split(',');
(async () => { const { b, p } = await open();
  const url = await p.evaluate((KS) => { const S2 = 5, cw = 38 * S2, c = document.createElement('canvas'); c.width = cw * 9; c.height = KS.length * 40 * S2; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#3a3550'; x.fillRect(0, 0, c.width, c.height);
    KS.forEach((k, j) => { const cols = heroCols(k, 2, '#ffe08a');
      const list = [evoPat(k, 1), evoPat(k, 2), evoPat(k, 3), evoPat(k, 4), pat16(k, 1, 'walk', null, false, 10), pat16(k, 1, 'walk2', null, false, 10), pat16(k, 1, 'atk', -105, true, 10), pat16(k, 1, 'atk', 30, true, 10), pat16(k, 1, 'atk', 120, true, 10)];
      list.forEach((P, i) => { const sp = sprite(P, cols, 'sheet' + k + i); x.drawImage(sp, i * cw + (cw - P[0].length * S2) / 2, j * 40 * S2 + 39 * S2 - P.length * S2, P[0].length * S2, P.length * S2); }); });
    return c.toDataURL(); }, KS);
  const out = path.resolve(process.cwd(), 'sprites.png'); fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('сохранено', out); await b.close(); })();
