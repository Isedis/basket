/* Shared context format for desktop and demo. No network or filesystem access. */
function validateState(state) {
  if (!state || state.version !== 1 || typeof state.name !== 'string' || !state.name.trim()) throw new Error('Укажите название игры.');
  for (const key of ['genre', 'pitch', 'experience', 'goal', 'pillars', 'rules']) {
    if (typeof state[key] !== 'string') throw new Error(`Некорректное поле: ${key}`);
  }
  if (!state.brand || !['draft', 'approved'].includes(state.brand.status)) throw new Error('Некорректный статус брендбука.');
  for (const key of ['palette', 'fonts', 'direction', 'avoid']) if (typeof state.brand[key] !== 'string') throw new Error(`Некорректное поле стиля: ${key}`);
  if (!Array.isArray(state.tasks) || !Array.isArray(state.references)) throw new Error('Повреждены задачи или эталоны.');
  const ids = new Set();
  for (const task of state.tasks) {
    if (!task || typeof task.id !== 'string' || ids.has(task.id) || typeof task.title !== 'string' || typeof task.acceptance !== 'string' || !['backlog', 'active', 'done'].includes(task.status)) throw new Error('Некорректная задача.');
    ids.add(task.id);
  }
  if (state.activeTaskId && !ids.has(state.activeTaskId)) throw new Error('Выбранная задача не найдена.');
  for (const ref of state.references) {
    if (!ref || typeof ref.id !== 'string' || typeof ref.name !== 'string' || !/^\.opora\/references\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(ref.file) || !['draft', 'approved'].includes(ref.status)) throw new Error('Некорректный визуальный эталон.');
  }
  return state;
}

function contextMarkdown(state) {
  validateState(state);
  const s = state;
  const brandStatus = s.brand.status === 'approved' ? 'УТВЕРЖДЁН пользователем' : 'ЧЕРНОВИК — окончательные визуальные решения не утверждены';
  const active = s.tasks.find(t => t.id === s.activeTaskId && t.status !== 'done');
  const text = v => v.trim() || 'Не задано. Не считать это принятым решением.';
  return `# ${s.name}: общий контекст игры

Эту памятку создаёт Opora. Меняйте решения через приложение; изменения здесь могут быть заменены при следующей синхронизации.
Актуальность: ${s.updatedAt || 'не указана'}. Движок: Godot.

## Игра
Жанр: ${text(s.genre)}

Замысел: ${text(s.pitch)}

Ощущение игрока: ${text(s.experience)}

## Основы, которые нужно сохранять
${text(s.pillars)}

## Текущая цель
${text(s.goal)}

## Брендбук
Статус: ${brandStatus}

### Визуальное направление
${text(s.brand.direction)}

### Палитра
${text(s.brand.palette)}

### Шрифты и типографика
${text(s.brand.fonts)}

### Не использовать
${text(s.brand.avoid)}

### Эталоны (пути от корня проекта)
${s.references.length ? s.references.map(r => `- [${r.status === 'approved' ? 'УТВЕРЖДЁН' : 'КАНДИДАТ, не эталон'}] ${r.name}: ${r.file}`).join('\n') : 'Эталоны ещё не добавлены. Не заявлять визуальное соответствие без эталонов.'}

## Постоянные замечания пользователя
${text(s.rules)}

## Выбранная задача
${active ? `${active.title}\n\nКритерии готовности:\n${text(active.acceptance)}` : 'Нет выбранной незавершённой задачи. Уточнить конкретный запрос пользователя.'}

## Остальные задачи
${s.tasks.filter(t => t.id !== active?.id).map(t => `- [${({backlog:'в очереди', active:'в работе', done:'готово'})[t.status]}] ${t.title}`).join('\n') || 'Нет.'}

## Завершение работы
Проверь критерии выбранной задачи, сохрани существующие решения вне её рамок.
Сообщи, что изменилось, что проверено и что требует просмотра в Godot.
Эта памятка не доказывает, что агент её прочёл или что результат соответствует стилю.
`;
}

function taskBrief(state) {
  return `Работаем над проектом Godot «${state.name}».
Сначала перечитай AGENTS.md или CLAUDE.md, затем .opora/CONTEXT.md и перечисленные визуальные эталоны.
Выполни выбранную в памятке задачу по её критериям готовности.
Если выбранной задачи нет, сначала уточни конкретную задачу.
Ниже — текущая версия контекста на случай, если файлы ещё не синхронизированы.

${contextMarkdown(state)}`;
}


const OporaContext = {validateState, contextMarkdown, taskBrief};
if (typeof module !== 'undefined' && module.exports) module.exports = OporaContext;
