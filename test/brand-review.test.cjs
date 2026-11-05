const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {assessBrandbook,brandContrast,parseBrandHex}=require('../ui/brand-review.js');
const {reviewProject}=require('../src/brand-review.cjs');
function state() {
  return {version:1,name:'Review game',genre:'idle',pitch:'Station',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'Keep buttons',brand:{status:'approved',direction:'Матовые панели, тонкая обводка и один спокойный акцент.',palette:'#151E21 — фон\n#FFFFFF — основной текст\n#DDAA77 — акцент',fonts:'Шрифт: res://fonts/Game.ttf\nЗаголовки: 32 px\nОсновной текст: 18 px',avoid:'Не использовать свечение и глянцевые кнопки.'},references:[{id:'menu',name:'Menu.png',file:'.opora/references/menu.png',status:'approved'}],tasks:[],activeTaskId:null};
}
test('Contrast uses sRGB luminance and handles alpha/invalid colors without invented ratios',()=>{
  assert.equal(brandContrast('#000','#fff'),21);
  assert.equal(brandContrast('#fff','#fff'),1);
  assert.ok(Math.abs(brandContrast('#777777','#FFFFFF')-4.478089)<0.00001);
  assert.equal(brandContrast('#FFFFFF80','#000000'),null);
  assert.equal(brandContrast('#invalid','#fff'),null);
  assert.equal(parseBrandHex('#abcd').hex,'#AABBCCDD');
  assert.equal(parseBrandHex('#1234567'),null);
});
test('Complete written rules pass all 9 checks only with available approved reference evidence',()=>{
  const s=state(),before=JSON.stringify(s);
  const r=assessBrandbook(s,{referenceEvidence:{menu:{status:'available'}}});
  assert.equal(r.ready,9);assert.equal(r.total,9);assert.equal(r.findings.length,0);
  assert.equal(r.pairs.length,1);assert.ok(r.pairs[0].ratio>4.5);
  assert.equal(JSON.stringify(s),before);
  const noFileCheck=assessBrandbook(s);
  assert.equal(noFileCheck.ready,8);assert.ok(noFileCheck.findings.some(f=>f.id==='references-unchecked'));
});
test('Low contrast produces actionable numeric evidence and prefers a passing existing palette color',()=>{
  const s=state();s.brand.palette='Основной текст: #444444 на #333333\n#EEDDBB — светлый текст';
  const r=assessBrandbook(s);
  const failure=r.findings.find(f=>f.id==='contrast-444444-333333');
  assert.ok(failure);assert.match(failure.detail,/4.5:1/);
  assert.equal(r.pairs[0].proposal.hex,'#EEDDBB');assert.ok(r.pairs[0].proposal.ratio>=4.5);
});
test('The reviewer never treats arbitrary palette combinations as actual UI text pairs',()=>{
  const s=state();s.brand.palette='#222222 — панели\n#333333 — обводки\n#444444 — акцент';
  const r=assessBrandbook(s);
  assert.equal(r.pairs.length,0);assert.ok(r.findings.some(f=>f.id==='contrast-unspecified'));
  assert.ok(!r.findings.some(f=>f.id.startsWith('contrast-') && f.severity==='error'));
});
test('Generated placeholder descriptions and source-only colors/fonts do not count as established decisions',()=>{
  const s=state();s.brand.status='draft';
  s.brand.direction='Черновик по файлам. Художественное направление и настроение пока не установлены.';
  s.brand.palette='#123456 — объявлен в файлах; ui/theme.tres:4; назначение не утверждено';
  s.brand.fonts='20 px — default_font_size, ui/theme.tres:3';
  s.brand.avoid='Предлагаемые правила: переиспользовать компоненты.';
  const r=assessBrandbook(s);
  for(const id of ['direction-missing','palette-roles','fonts-missing','typography-missing','constraints-missing','approval-pending'])assert.ok(r.findings.some(f=>f.id===id),id);
});
test('Malformed colors, same color for text/background and transparent pairs are handled separately',()=>{
  const s=state();s.brand.palette='#GGGGGG — ошибка\n#1234567 — неверная длина\n#FFFFFF — текст\n#fff — фон';
  const r=assessBrandbook(s);
  assert.ok(r.findings.some(f=>f.id==='palette-invalid'));
  assert.equal(r.pairs[0].ratio,1);
  s.brand.palette='Основной текст: #FFFFFF80 на #000000';
  const transparent=assessBrandbook(s);
  assert.equal(transparent.pairs[0].ratio,null);
  assert.ok(transparent.findings.some(f=>f.title.includes('Полупрозрачную')));
});
test('A deliberate single-size pixel font is not rejected solely for being small',()=>{
  const s=state();s.brand.fonts='Шрифт: Pixel.ttf\nВесь интерфейс: 8 px';
  const r=assessBrandbook(s);
  assert.equal(r.checks.find(c=>c.id==='fonts').status,'pass');
  assert.equal(r.checks.find(c=>c.id==='typography').status,'pass');
  assert.ok(!r.findings.some(f=>/слишком мелк/i.test(f.title)));
});
test('Large-text contrast uses 3:1 only when the user explicitly declares large text',()=>{
  const s=state();s.brand.palette='Заголовок: #777777 на #FFFFFF';
  assert.equal(assessBrandbook(s).pairs[0].status,'issue');
  s.brand.palette='Крупный текст: #777777 на #FFFFFF';
  const r=assessBrandbook(s);assert.equal(r.pairs[0].target,3);assert.equal(r.pairs[0].status,'pass');
});
test('Explicitly inactive text is not falsely flagged as a regular-text contrast error',()=>{
  const s=state();s.brand.palette='Основной текст: #FFFFFF на #111111\nНеактивный текст: #444444 на #333333';
  const r=assessBrandbook(s);
  assert.equal(r.checks.find(c=>c.id==='contrast').status,'pass');
  assert.ok(r.pairs.some(p=>p.status==='excluded'));
  assert.ok(!r.findings.some(f=>f.severity==='error'));
});
test('File-aware review finds missing and symlinked references without changing the project',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-review-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const s=state();
  let r=await reviewProject(root,s);assert.ok(r.findings.some(f=>f.id==='references-unavailable'));
  await fs.mkdir(path.join(root,'.opora/references'),{recursive:true});
  await fs.writeFile(path.join(root,'.opora/references/menu.png'),'reference fixture');
  r=await reviewProject(root,s);assert.equal(r.ready,9);
  await fs.rm(path.join(root,'.opora/references/menu.png'));
  await fs.symlink(path.join(root,'outside.png'),path.join(root,'.opora/references/menu.png'));
  r=await reviewProject(root,s);assert.ok(r.findings.some(f=>f.id==='references-unavailable'));
  await assert.rejects(fs.access(path.join(root,'.opora/project.json')));
});
