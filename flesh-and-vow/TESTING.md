# Проверка прототипа 0.1

Проверено в Godot 4.6.3 stable на Linux.

Команда из папки проекта:

```
godot --headless --path . --script res://tests/smoke.gd
```

Тест использует отдельные `test_run_v1.json` и `test_profile_v1.json`.
Обычный текущий забег и профиль игрока не затрагиваются.

Результат: 2436 проверок, 0 ошибок.

- Связность графа на 300 seed; наличие босса и всех шести специальных комнат.
- Новая игра; восстановление координат, плоти, боли, ресурсов, веры и предметов.
- Восстановление летящих снарядов и врага в середине замаха.
- Ближний удар и сочетание огня, повторного удара и кровавой волны.
- Урон, накопление боли и неуязвимость после попадания.
- Единовременная жертва максимальной плоти в комнате пыток.
- Секретный проход открывается после трёх направленных ударов.
- Сокровищница требует ключ и расходует его при первом входе.
- Симуляция пяти обычных врагов и каждого из четырёх боссов.
- Завершение каждого этажа, победа, открытия и удаление законченного забега.
- Смерть удаляет текущий забег и сохраняет профиль.
- Нажатие/удержание ввода движения и атаки через игровой цикл; пауза по Esc.
- Проход отрисовки игрового экрана, меню, паузы, смерти, победы, помощи и журнала.

Через OpenGL Compatibility / Mesa llvmpipe получены и просмотрены снимки
главного меню, боя, босса, помощи и журнала с двадцатью предметами.
Самостоятельная Linux-сборка успешно запущена без редактора.

Windows x86_64 EXE экспортирован официальным шаблоном Godot 4.6.3.
Проверены PE-заголовок, встроенный PCK и целостность архива.
Запуск на настоящей Windows 11 здесь не проверялся.
Сложность, длительность и удовольствие от боя требуют живого плейтеста.


0.3.0 additional checks: tests/art.gd verifies corpse/blood persistence,
impact stop, migration of old saves from a now-blocked north wall,
and advancement of the player death animation and isolation of the art probe from regular progress (10 checks).
The combat preview movie is a capture of the running Godot scene with input
injected for the demonstration; it is not an animation composited in a video editor.
New atlas north/south poses and other zone environments are not final.

0.5.2: tests/enemies.gd checks native dimensions, hard alpha and palettes,
shared held objects, continuous release/recovery poses, anatomical reach,
colliders, actual AI volley sizes and projectile physics, hand launch offsets,
material-specific debris, pre-stagger death snapshots, practice roster and
JSON save/load compatibility. The preview uses deterministic walk/cast states
in the actual game renderer and the original projectile simulation.

0.6.0: tests/boss.gd covers isolated boss practice/retry, ordinary-save
preservation, native parts, encounter camera, introduction visibility and
immunity, committed attack cycle, locked aim and gaps, exact windup timing,
recovery, one-time fracture, double waves, safe/harmful wave geometry and
actual one-hit damage, drawn blade contact, charge cover, save/load of phase
and pending waves, death cleanup, rewards/unlocks and old-boss migration.
Private movie capture uses the real AI and movement with scripted survival
and health changes for an art review; it is not an unassisted balance test.
