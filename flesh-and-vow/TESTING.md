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

0.6.2: tests/boss_anatomy.gd reproduces the old detached-thigh and split-bell
failures using the actual draw polygons and native texture alpha. It checks
opaque overlap of each thigh with the torso in four directions, both phases,
all attacks and recovery, stride extremes, and corpse poses. It also checks
one intact bell, fixed leg segment lengths and continuous recovery.
The old release failed 475 of the initial 948 checks; the corrected code
passes the expanded suite, including extreme saved foot placements.

0.6.4 supersedes the earlier joint-overlap proof. The previous renderer
still produced disconnected full-body silhouettes despite those checks.
tests/boss_silhouette.gd renders the actual complete body, excluding the
separately held axe, for 344 cases. tests/boss_silhouette.py performs an
8-neighbor flood fill on the captured alpha and rejects detached regions
of eight or more rendered pixels. CI runs this with software OpenGL under
Xvfb. tests/boss_anatomy.gd checks one complete body mesh, shared valid
vertices, wrist-to-weapon binding and coherent corpse translation.

0.6.5: the graphics suite also renders arm-only and core-only reference masks
for sixteen windup/contact poses in all four directions. At every opaque
overlap with distinct colors, the complete mesh must match the correct
foreground surface. It reproduces the old index order as a regression
reference. The CPU suite checks triangle preservation, nonempty depth groups
and axe-handle/body/blade command order while retaining one connected skin.


0.6.6: tests/boss_contact.gd covers misses, flesh and stone contact in four
directions, invulnerability, actual blade/capsule overlap, single damage,
hit-stop freezing, knockback, exact blocked pose, recovery, JSON persistence,
visible tall-prop bounds and contact-time stability at 60/120 Hz (60 checks).
The silhouette suite adds 64 real impact/recoil poses: 408 connected
silhouettes, plus the existing depth-mask checks. The anatomy suite checks
the same new poses without changing shared vertices or wrist binding.
Private capture uses three controlled situations in the actual running game
(miss, flesh, column); it does not establish balance or subjective feel.


0.6.7: tests/boss_phase.gd covers the half-health transition, delayed single
pulse, hit-stop clock, pending/consumed pulse saves, finite immunity, initial
double toll, harmless pending-wave warning, phase-one preservation, charge
braking and one follow-up with a full locked warning, actual blade damage,
consumed-hit reloads, longer final recovery and legacy missing fields.
It also checks seam binding and opaque native helmet pixels (57 checks).
The complete-body GPU suite now renders 496 poses including fracture and
follow-up; CPU anatomy suite performs 2548 checks. Private video shows the
continuous actual AI after controlled threshold damage, with scripted
dodging and player immunity for visual review; it is not a balance test.


0.6.8: tests/boss_charge.gd verifies planted preparation, continuous launch
and stop poses, acceleration/braking, preserved distance at 60/120 Hz,
actual braking footfalls, settled stance, first contact against thin cover
in four directions, damage occlusion, single wall feedback, hit-stop,
longer wall recovery, warning before the follow-up, save/load of motion
and consumed steps, legacy constant-speed charges and foot bounds
(133 checks). The complete-body graphics suite renders 700 silhouettes;
the CPU anatomy suite performs 3412 checks. Real gameplay capture exercises
normal braking and column impact with the actual world drawing proxy and
audio; capture logs must be free of script errors. Private footage uses
controlled encounter setup and is not a balance test.


0.6.9: tests/boss_toll.gd verifies harmless planted preparation, posture
continuity, wave-driven pulse timing, shared hit-stop, separate second
feedback, pending/consumed pulse persistence, caster movement, locked safe
wedges, damping, foot settling, death cancellation, legacy waves, token
isolation, 60/120 Hz game clocks and grip binding (75 checks).
The complete-body graphics suite now renders 848 silhouettes, including
both toll impulses and their frozen corpse poses. CPU anatomy performs
4228 checks. Private real-game capture shows one and two waves, bell audio,
recoil and safe wedges in controlled encounters; it is not a balance test.
