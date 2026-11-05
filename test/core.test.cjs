const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const core = require('../src/core.cjs');

function state() {
  return {version:1,name:'Пробная игра',genre:'idle',pitch:'Восстановить станцию',experience:'Спокойствие',goal:'Меню',pillars:'Один акцент',rules:'Не менять шрифт',brand:{status:'draft',direction:'Матовые панели',palette:'#123456 — фон',fonts:'Шрифт не выбран',avoid:'Неон'},tasks:[{id:'menu',title:'Собрать меню',acceptance:'Навигация с клавиатуры',status:'active'},{id:'save',title:'Загрузка игры',acceptance:'Сохранение читается',status:'backlog'}],activeTaskId:'menu',references:[{id:'sample',name:'Меню.png',file:'.opora/references/sample.png',status:'draft'}],updatedAt:'2026-11-05T00:00:00Z'};
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'opora-test-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.writeFile(path.join(root,'project.godot'),'config_version=5\n[application]\nconfig/name="Тестовая игра"\n');
  return root;
}

test('Instructions preserve existing content and replace only one managed block', () => {
  const original = '# Rules\nDo not modify assets.\n';
  const once = core.mergeInstructions(original);
  assert.ok(once.startsWith(original));
  const surrounding = once + '\n## Other instructions\nUse Godot 4.\n';
  assert.equal(core.mergeInstructions(surrounding),surrounding);
  assert.equal((surrounding.match(/OPORA:START/g)||[]).length,1);
});
test('Malformed and duplicate markers are rejected rather than overwriting instructions', () => {
  for (const text of ['<!-- OPORA:START -->','<!-- OPORA:END -->','<!-- OPORA:END --><!-- OPORA:START -->',core.mergeInstructions('')+core.mergeInstructions('')]) {
    assert.throws(()=>core.mergeInstructions(text),/повреждён/);
  }
});
test('Context distinguishes drafts, approved references and the selected task', () => {
  const data = state();
  const markdown = core.contextMarkdown(data);
  assert.match(markdown,/ЧЕРНОВИК/);
  assert.match(markdown,/КАНДИДАТ, не эталон/);
  assert.match(markdown,/Навигация с клавиатуры/);
  assert.match(markdown,/Не менять шрифт/);
  data.brand.status = 'approved'; data.references[0].status='approved';
  assert.match(core.contextMarkdown(data),/УТВЕРЖДЁН пользователем/);
  data.tasks[0].status='done';
  assert.match(core.contextMarkdown(data),/Нет выбранной незавершённой задачи/);
});
test('Whole workflow: load Godot, save, preview, sync, update, backup, reopen', async t => {
  const root = await fixture(t);
  const scene = '[gd_scene format=3]\n[node name="Menu" type="Control"]\n';
  await fs.writeFile(path.join(root,'menu.tscn'),scene);
  await fs.writeFile(path.join(root,'AGENTS.md'),'# User rules\nKeep my scenes.\n');
  const loaded = await core.loadProject(root);
  assert.equal(loaded.info.name,'Тестовая игра'); assert.equal(loaded.state,null);
  const data = state();
  await core.saveProject(root,data);
  assert.deepEqual((await core.loadProject(root)).state,data);
  const preview = await core.previewSync(root,data);
  assert.equal(preview.length,4);
  await assert.rejects(fs.access(path.join(root,'CLAUDE.md')));
  const first = await core.syncProject(root,data);
  assert.equal(await fs.readFile(path.join(root,first.backup,'AGENTS.md'),'utf8'),'# User rules\nKeep my scenes.\n');
  assert.match(await fs.readFile(path.join(root,'CLAUDE.md'),'utf8'),/\.opora\/CONTEXT.md/);
  data.rules='Не менять иконки';
  const second = await core.syncProject(root,data);
  assert.notEqual(first.backup,second.backup);
  assert.match(await fs.readFile(path.join(root,'.opora/CONTEXT.md'),'utf8'),/Не менять иконки/);
  assert.match(await fs.readFile(path.join(root,second.backup,'.opora/CONTEXT.md'),'utf8'),/Не менять шрифт/);
  const agents=await fs.readFile(path.join(root,'AGENTS.md'),'utf8');
  assert.equal((agents.match(/OPORA:START/g)||[]).length,1);
  assert.ok(agents.startsWith('# User rules\nKeep my scenes.\n'));
  assert.equal(await fs.readFile(path.join(root,'menu.tscn'),'utf8'),scene);
  assert.deepEqual((await core.loadProject(root)).state,data);
});
test('A broken instruction file blocks the entire sync before writes', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root,'CLAUDE.md'),'user content <!-- OPORA:START -->');
  await assert.rejects(core.syncProject(root,state()),/повреждён/);
  await assert.rejects(fs.access(path.join(root,'.opora/CONTEXT.md')));
  await assert.rejects(fs.access(path.join(root,'AGENTS.md')));
  assert.equal(await fs.readFile(path.join(root,'CLAUDE.md'),'utf8'),'user content <!-- OPORA:START -->');
});
test('Symlinked instructions and state folders are not overwritten', async t => {
  const root = await fixture(t);
  const outside=await fs.mkdtemp(path.join(os.tmpdir(),'opora-outside-'));
  t.after(()=>fs.rm(outside,{recursive:true,force:true}));
  const target=path.join(outside,'rules.md'); await fs.writeFile(target,'untouched');
  await fs.symlink(target,path.join(root,'AGENTS.md'));
  await assert.rejects(core.syncProject(root,state()),/символические ссылки/);
  assert.equal(await fs.readFile(target,'utf8'),'untouched');
  await fs.rm(path.join(root,'AGENTS.md'));
  await fs.symlink(outside,path.join(root,'.opora'));
  await assert.rejects(core.saveProject(root,state()),/символические ссылки/);
});
test('Non-Godot folders and malformed project data fail explicitly', async t => {
  const root=await fixture(t);
  await fs.rm(path.join(root,'project.godot'));
  await assert.rejects(core.loadProject(root),/нет project.godot/);
  const data=state(); data.references[0].file='../../outside.png';
  assert.throws(()=>core.contextMarkdown(data),/Некорректный визуальный эталон/);
  const bad=state(); bad.tasks.push({...bad.tasks[0]});
  assert.throws(()=>core.validateState(bad),/Некорректная задача/);
});
