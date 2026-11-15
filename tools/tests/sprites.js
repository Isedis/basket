// лист героев 32×32: облики I–IV, бег, замах, удар. node sprites.js [классы через запятую] → sprites.png рядом
const path = require('path'), fs = require('fs'); const { open } = require('./_lib');
const KS = (process.argv[2] || 'war,mage,arch,monk').split(',');
(async () => { const { b, p } = await open();
  const url = await p.evaluate((KS) => { const S2 = 4, CW = 40, c = document.createElement('canvas'); c.width = 7 * CW * S2; c.height = KS.length * 44 * S2; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#3a4a3a'; x.fillRect(0, 0, c.width, c.height);
    const poses = [1, 2, 3, 4].map(f => [f, {}]).concat([[1, { legs: 'walk', crouch: 1, lean: 1 }], [1, { ang: -35, atk: true, lean: -1 }], [1, { ang: 135, atk: true, lean: 2, crouch: 1, legs: 'lunge' }]]);
    KS.forEach((k, j) => poses.forEach(([f, P], i) => { const h = hero32(k, f, Object.assign({ ang: null, atk: false, lean: 0, crouch: 0, legs: null }, P)); x.drawImage(h, 12, 12, 40, 44, i * CW * S2, j * 44 * S2, 40 * S2, 44 * S2); }));
    return c.toDataURL(); }, KS);
  const out = path.resolve(process.cwd(), 'sprites.png'); fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('сохранено', out); await b.close(); })();
