const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {scanProject,applyDraft}=require('../src/brandbook.cjs');
const {loadProject,saveProject,contextMarkdown}=require('../src/core.cjs');

async function fixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-brand-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'ui'));
  await fs.mkdir(path.join(root,'fonts'));
  await fs.writeFile(path.join(root,'project.godot'),'config_version=5\n[application]\nconfig/name="Brand game"\n[display]\nwindow/size/viewport_width=1280\nwindow/size/viewport_height=720\nwindow/stretch/mode="canvas_items"\n');
  await fs.writeFile(path.join(root,'ui/theme.tres'),'[gd_resource type="Theme" load_steps=3 format=3]\n[ext_resource type="FontFile" path="res://fonts/Game.ttf" id="1"]\n[sub_resource type="StyleBoxFlat" id="Box"]\nbg_color = Color(0.1, 0.2, 0.3, 1)\ncorner_radius_top_left = 8\n[resource]\ndefault_font_size = 20\n');
  await fs.writeFile(path.join(root,'ui/menu.tscn'),'[gd_scene format=3]\n[node name="Menu" type="Control"]\ntheme_override_colors/font_color = Color(0.1, 0.2, 0.3, 1)\n');
  await fs.writeFile(path.join(root,'fonts/Game.ttf'),'font fixture, not decoded');
  const state={version:1,name:'Brand game',genre:'idle',pitch:'Existing pitch',experience:'Calm',goal:'Menu',pillars:'Progress',rules:'Keep buttons',brand:{status:'approved',direction:'MY STYLE',palette:'MY COLORS',fonts:'MY FONT',avoid:'MY RULES'},references:[],tasks:[],activeTaskId:null};
  return {root,state};
}
test('Scanner extracts exact tokens with sources, settings, fonts and metrics without changing files',async t=>{
  const {root}=await fixture(t);
  const before=await fs.readFile(path.join(root,'ui/theme.tres'));
  const report=await scanProject(root);
  const color=report.colors.find(c=>c.hex==='#1A334D');
  assert.equal(color.count,2);assert.equal(color.sources.find(s=>s.file==='ui/theme.tres').line,4);
  assert.equal(report.stats.themes,1);assert.equal(report.stats.scenes,1);
  assert.equal(report.settings['display/window/size/viewport_width'],1280);
  assert.equal(report.settings['display/window/stretch/mode'],'canvas_items');
  assert.equal(report.fonts[0].file,'fonts/Game.ttf');
  assert.equal(report.fonts[0].sources[0].file,'ui/theme.tres');
  assert.equal(report.fontSizes[0].value,20);
  assert.equal(report.metrics[0].value,8);
  assert.match(report.draft.palette,/#1A334D/);
  assert.match(report.draft.direction,/настроение пока не установлены/);
  assert.deepEqual(await fs.readFile(path.join(root,'ui/theme.tres')),before);
  await assert.rejects(fs.access(path.join(root,'.opora')));
});
test('Comments, quoted examples, docstrings, transparent and HDR colors do not become palette values',async t=>{
  const {root}=await fixture(t);
  await fs.writeFile(path.join(root,'colors.gd'),`# Color(1,0,0)\nconst EXAMPLE = "Color(0,1,0)"\n"""\nColor(0,0,1)\nres://fonts/Game.ttf\n"""\n# res://fonts/Game.ttf\nconst ACTUAL = Color8(255, 128, 0, 255) # comment\nconst ALPHA = Color(1, 1, 1, 0.5)\nconst HTML = Color.html("abc")\nconst BLACK = Color.BLACK\nconst NONE = Color(1, 0, 1, 0)\nconst HDR = Color(8, 8, 8, 1)\n`);
  const report=await scanProject(root);
  const hexes=report.colors.map(c=>c.hex);
  for(const expected of ['#FF8000','#FFFFFF80','#AABBCC','#000000'])assert.ok(hexes.includes(expected),expected);
  for(const absent of ['#FF0000','#00FF00','#0000FF','#FF00FF'])assert.ok(!hexes.includes(absent),absent);
  assert.equal(report.fonts[0].sources.length,1);
});
test('Image-only project gets explicitly approximate colors and draft candidates',async t=>{
  const {root,state}=await fixture(t);
  await fs.rm(path.join(root,'ui/theme.tres'));await fs.rm(path.join(root,'ui/menu.tscn'));
  await fs.writeFile(path.join(root,'ui/menu.png'),'image-fixture');
  const report=await scanProject(root,{readImage:async buffer=>{assert.equal(buffer.toString(),'image-fixture');return {thumbnail:'data:image/png;base64,AA==',colors:[{hex:'#aabbcc'}]};}});
  assert.equal(report.colors.length,0);
  assert.match(report.draft.palette,/приблизительно из изображения/);
  const next=await applyDraft(root,state,report,{fields:['palette'],assets:['ui/menu.png']});
  assert.equal(next.brand.status,'draft');
  assert.equal(next.references[0].status,'draft');
  assert.equal(next.references[0].source,'ui/menu.png');
  assert.ok(!JSON.stringify(next.brand.analysis).includes('base64'));
});
test('Repeat application preserves user fields, approved references and avoids duplicate copies',async t=>{
  const {root,state}=await fixture(t);
  await fs.writeFile(path.join(root,'ui/button.png'),'image-fixture');
  const report=await scanProject(root);
  const first=await applyDraft(root,state,report,{fields:['palette'],assets:['ui/button.png']});
  assert.equal(first.brand.direction,'MY STYLE');assert.equal(first.brand.fonts,'MY FONT');assert.equal(first.pitch,'Existing pitch');assert.equal(first.rules,'Keep buttons');
  first.references[0].status='approved';first.brand.status='approved';
  const next=await applyDraft(root,first,report,{fields:[],assets:['ui/button.png']});
  assert.equal(next.references.length,1);assert.equal(next.references[0].status,'approved');assert.equal(next.brand.status,'approved');
  await saveProject(root,next);
  const loaded=await loadProject(root);
  assert.match(contextMarkdown(loaded.state),/Основание автоматического черновика/);
  assert.match(contextMarkdown(loaded.state),/ui\/theme.tres:4/);
});
test('Changed images and unknown selections cannot overwrite approved state',async t=>{
  const {root,state}=await fixture(t);
  await fs.writeFile(path.join(root,'ui/menu.png'),'first');
  const report=await scanProject(root);
  await fs.writeFile(path.join(root,'ui/menu.png'),'other');
  await assert.rejects(applyDraft(root,state,report,{fields:['palette'],assets:['ui/menu.png']}),/изменился/);
  await assert.rejects(applyDraft(root,state,report,{fields:['name'],assets:[]}),/выбор полей/);
  await assert.rejects(applyDraft(root,state,report,{fields:[],assets:['../outside.png']}),/неизвестный/);
  assert.equal(state.brand.palette,'MY COLORS');assert.equal(state.brand.status,'approved');
});
test('Caches, Opora output, symlinks and large files are excluded with visible limits',async t=>{
  const {root}=await fixture(t);
  for(const dir of ['.opora','.godot','node_modules']) {
    await fs.mkdir(path.join(root,dir));await fs.writeFile(path.join(root,dir,'noise.gd'),'const BAD = Color(1,0,1)');
  }
  await fs.symlink(path.join(root,'ui'),path.join(root,'linked-ui'));
  await fs.writeFile(path.join(root,'large.gd'),' '.repeat(3000)+'Color(1,0,1)');
  const report=await scanProject(root,{maxTextBytes:1024});
  assert.ok(!report.colors.some(c=>c.hex==='#FF00FF'));
  assert.equal(report.stats.symlinks,1);assert.equal(report.stats.omitted,1);
  const limited=await scanProject(root,{maxFiles:1});
  assert.equal(limited.stats.limited,true);assert.ok(limited.warnings.some(w=>/не полностью/.test(w)));
});
test('An empty Godot project produces honest missing-data findings, without invented colors or fonts',async t=>{
  const {root}=await fixture(t);
  await fs.rm(path.join(root,'ui'),{recursive:true});await fs.rm(path.join(root,'fonts'),{recursive:true});
  const report=await scanProject(root);
  assert.equal(report.draft.palette,'');assert.equal(report.draft.fonts,'');
  assert.ok(report.warnings.some(w=>/шрифтов не найдены/.test(w)));
  assert.ok(report.warnings.some(w=>/цвета не найдены/.test(w)));
});
