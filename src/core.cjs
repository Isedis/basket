const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const START = '<!-- OPORA:START -->';
const END = '<!-- OPORA:END -->';
const INSTRUCTIONS = `${START}
## Общий контекст игры — Opora

Перед работой прочитай .opora/CONTEXT.md и указанные там визуальные эталоны.
Если подключён MCP Opora, сначала вызови opora_get_project и проверь путь игры,
затем opora_get_context: он возвращает последние сохранённые данные.
В MCP-запросах используй project_id этого проекта; для отчётов — актуальную revision.
В начале новой задачи перечитай этот файл: он может измениться вне текущего чата.
Используй его как описание замысла и критериев задачи, сохраняя остальные инструкции проекта.
Если пользователь прямо изменил решение, следуй его новому указанию и сообщи о расхождении с памяткой.
Не придумывай отсутствующие правила брендбука и не меняй соседние экраны, механику,
шрифты, палитру или архитектуру без необходимости для выбранной задачи.
Если стиль ещё не утверждён, отмечай новые визуальные решения как предложения.
При конфликте с выбранным эталоном уточни решение; независимую работу продолжай.
После работы перечисли изменения, выполненные проверки и оставшиеся расхождения.
Не выдавай отсутствие визуальной проверки за соответствие брендбуку.
${END}`;

function mergeInstructions(existing) {
  const starts = existing.split(START).length - 1;
  const ends = existing.split(END).length - 1;
  if (starts === 0 && ends === 0) return `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${existing ? '\n' : ''}${INSTRUCTIONS}\n`;
  if (starts !== 1 || ends !== 1 || existing.indexOf(END) < existing.indexOf(START)) {
    throw new Error('В файле инструкций повреждён или повторяется блок Opora. Исправьте его вручную; файл не изменён.');
  }
  return existing.slice(0, existing.indexOf(START)) + INSTRUCTIONS + existing.slice(existing.indexOf(END) + END.length);
}

const {validateState, contextMarkdown, taskBrief} = require('../ui/context.js');

async function readText(file) {
  try { return await fs.readFile(file, 'utf8'); } catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}

async function assertSafePath(root, relative) {
  const realRoot = await fs.realpath(root);
  const parts = relative.split('/');
  let cursor = realRoot;
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) throw new Error(`Opora не записывает через символические ссылки: ${relative}`);
      if (i < parts.length - 1 && !stat.isDirectory()) throw new Error(`Ожидалась папка: ${relative}`);
    } catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
}

async function projectInfo(root) {
  const source = await readText(path.join(root, 'project.godot'));
  if (source === null) throw new Error('В выбранной папке нет project.godot. Выберите корень игры Godot.');
  return {name: source.match(/^config\/name="(.*)"\s*$/m)?.[1]?.replace(/\\"/g, '"') || path.basename(root)};
}

async function loadProject(root) {
  const info = await projectInfo(root);
  await assertSafePath(root, '.opora/project.json');
  const data = await readText(path.join(root, '.opora/project.json'));
  return {root, info, state: data === null ? null : validateState(JSON.parse(data))};
}

async function saveProject(root, state) {
  validateState(state);
  await projectInfo(root);
  await assertSafePath(root, '.opora/project.json');
  await fs.mkdir(path.join(root, '.opora'), {recursive: true});
  const temp = path.join(root, `.opora/project-${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, JSON.stringify(state, null, 2) + '\n', {flag:'wx'});
    await fs.rename(temp, path.join(root, '.opora/project.json'));
  } finally { await fs.rm(temp, {force:true}); }
}

async function previewSync(root, state) {
  validateState(state);
  await projectInfo(root);
  const files = [
    {file:'.opora/CONTEXT.md', content:contextMarkdown(state)},
    {file:'.opora/project.json', content:JSON.stringify(state, null, 2) + '\n'}
  ];
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    await assertSafePath(root, file);
    const existing = await readText(path.join(root, file));
    files.push({file, content:mergeInstructions(existing || ''), existing:existing !== null});
  }
  return files;
}

async function syncProject(root, state) {
  const files = await previewSync(root, state);
  const originals = [];
  const backupId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0,8);
  const backup = `.opora/backups/${backupId}`;
  for (const entry of files) {
    await assertSafePath(root, entry.file);
    originals.push({file:entry.file, content:await readText(path.join(root, entry.file))});
  }
  await assertSafePath(root, backup);
  await fs.mkdir(path.join(root, backup), {recursive:true});
  for (const entry of originals) {
    if (entry.content !== null) {
      const dest = path.join(root, backup, entry.file);
      await fs.mkdir(path.dirname(dest), {recursive:true});
      await fs.writeFile(dest, entry.content, {flag:'wx'});
    }
  }
  const written = [];
  try {
    for (const entry of files) {
      const dest = path.join(root, entry.file);
      await fs.mkdir(path.dirname(dest), {recursive:true});
      const temp = dest + '.' + crypto.randomUUID() + '.tmp';
      try {
        await fs.writeFile(temp, entry.content, {flag:'wx'});
        await fs.rename(temp, dest);
      } finally { await fs.rm(temp, {force:true}); }
      written.push(entry.file);
    }
  } catch (err) {
    const failures = [];
    for (const file of written.reverse()) {
      const old = originals.find(o => o.file === file);
      try {
        if (old.content === null) await fs.rm(path.join(root, file), {force:true});
        else await fs.writeFile(path.join(root, file), old.content);
      } catch { failures.push(file); }
    }
    throw new Error(`Синхронизация не завершена: ${err.message}. Резервная копия: ${backup}.${failures.length ? ' Не удалось восстановить: ' + failures.join(', ') : ' Записанные файлы восстановлены.'}`);
  }
  return {files:files.map(f => f.file), backup, syncedAt:new Date().toISOString()};
}

module.exports = {mergeInstructions, validateState, contextMarkdown, taskBrief, loadProject, saveProject, previewSync, syncProject, assertSafePath};
