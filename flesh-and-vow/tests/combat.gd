extends SceneTree
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
var failures = 0
var checks = 0
var game
func check(ok: bool, label: String):
	checks += 1
	if not ok:
		failures += 1
		push_error(label)
func _initialize(): call_deferred("run")
func target(p: Vector2, boss: bool = false) -> Dictionary:
	game.spawn_enemy("boss0" if boss else "guard",p,boss)
	var e = game.enemies.back()
	e.hp = 100.0
	e.max = 100.0
	e.training_dummy = true
	e.motion = Motion.initialize(p,-1)
	return e
func prepare():
	game.new_run(808)
	game.blocks.clear()
	game.hazards.clear()
	game.enemies.clear()
	game.player = Vector2(380,320)
	game.player_motion = Motion.initialize(game.player)
	game.invincible = 0
	game.message_time = 0
func strike(dir: Vector2):
	game.begin_attack(dir)
	game.advance_player_attack(game.swing_windup)
	game.advance_player_attack(game.swing_duration*Combat.CONTACT_RATIO)
func run():
	game = load("res://main.tscn").instantiate()
	game.save_path = "user://test-combat-run.json"
	game.profile_path = "user://test-combat-profile.json"
	root.add_child(game)
	await process_frame
	for dir in [Vector2.RIGHT,Vector2.LEFT,Vector2.UP,Vector2.DOWN]:
		prepare()
		var e = target(game.player+dir*44)
		strike(dir)
		check(e.hp<100,"Visible blade hits forward body: "+str(dir))
		var first = e.hp
		game.advance_player_attack(0.2)
		check(e.hp==first,"Only one hit per target and swing")
		prepare()
		e = target(game.player-dir*50)
		strike(dir)
		game.advance_player_attack(0.2)
		check(e.hp==100,"No damage behind player: "+str(dir))
	# Reach is real, and cover blocks contact.
	prepare()
	var e = target(game.player+Vector2(112,0))
	strike(Vector2.RIGHT)
	game.advance_player_attack(0.2)
	check(e.hp==100,"Out-of-reach attack misses")
	prepare()
	game.inventory = ["cleaver","heavy"]
	e = target(game.player+Vector2(90,0))
	strike(Vector2.RIGHT)
	check(e.hp<100,"Long weapon has matching extended collision")
	prepare()
	e = target(game.player+Vector2(44,0))
	game.blocks = [Rect2(game.player+Vector2(20,-12),Vector2(10,24))]
	strike(Vector2.RIGHT)
	check(e.hp==100,"Stone prevents a hit through cover")
	# Armor preserves a windup against a light hit; strong impact cancels it.
	prepare()
	e = target(game.player+Vector2(44,0))
	e.state = "windup"
	e.state_time = 0.3
	game.damage_enemy(e,1,game.player,true,1.0,Vector2.RIGHT)
	check(e.state=="windup","Armor holds against a light interruption")
	game.damage_enemy(e,1,game.player,true,1.4,Vector2.RIGHT)
	check(e.state=="stagger" and e.stagger>0,"Strong hit interrupts guard windup")
	var x = e.x
	game.update_enemies(1.0/60)
	check(e.x>x and e.x-x<8,"Knockback is an impulse, not a teleport")
	check(e.state=="stagger","Interrupted guard cannot strike on next tick")
	# Damage over time does not shove or freeze the whole game.
	prepare()
	e = target(game.player+Vector2(44,0))
	game.hit_stop = 0
	game.damage_enemy(e,1,Vector2(e.x,e.y),false)
	check(e.get("knock_x",0)==0 and game.hit_stop==0,"Poison/burn tick does not induce impact jitter")
	# Bosses resist displacement and cannot be stun-locked.
	prepare()
	e = target(game.player+Vector2(60,0),true)
	game.damage_enemy(e,1,game.player,true,2.0,Vector2.RIGHT)
	check(e.state!="stagger" and e.knock_x<190,"Boss retains poise")
	# A hit must stay consumed across a save/load in the active part of a swing.
	prepare()
	e = target(game.player+Vector2(44,0))
	strike(Vector2.RIGHT)
	var once = e.hp
	game.save_run()
	game.load_run()
	game.advance_player_attack(0.02)
	check(game.enemies[0].hp==once,"Saving mid-swing cannot deal the same hit twice")
	# Held attacks remain responsive, but never replace an unfinished swing.
	prepare()
	game.attack_cd = 0.07
	game.queue_attack(Vector2.RIGHT)
	for i in range(6): game.update_game(1.0/60)
	check(game.combo==1 and game.windup>0,"Short tap is buffered until recovery finishes")
	prepare()
	game.inventory = ["haste","haste","haste"]
	game.begin_attack(Vector2.RIGHT)
	check(game.swing_duration<0.22 and game.swing_windup<0.12,"Haste accelerates visual and physical phases together")
	game.player_motion.facing = 1.0
	Input.action_press("left")
	game.update_game(1.0/60)
	Input.action_release("left")
	check(game.player_motion.facing==game.attack_facing,"Strafing cannot flip an unfinished attack")
	# Guard damage comes from its drawn sword, not foot proximity.
	prepare()
	e = target(game.player+Vector2(52,0))
	e.training_dummy = false
	e.state = "strike"
	e.state_time = 0.25*Combat.CONTACT_RATIO-0.01
	e.dx = -1.0
	e.dy = 0.0
	var hp = game.hp
	game.update_enemies(0.02)
	check(game.hp<hp,"Guard sword contacts the player's body")
	var hit_once = game.hp
	game.invincible = 0
	game.update_enemies(0.02)
	check(game.hp==hit_once,"Guard cannot hit twice within one swing")
	# Solid body spacing must not accidentally disable contact enemies.
	prepare()
	game.spawn_enemy("shadow",game.player+Vector2(30,0),false)
	var shadow = game.enemies.back()
	shadow.timer = 100.0
	var previous_hp = game.hp
	game.update_enemies(1.0/60)
	check(game.hp<previous_hp,"Shadow still hurts at the solid contact distance")
	prepare()
	game.spawn_enemy("assassin",game.player+Vector2(31,0),false)
	var assassin = game.enemies.back()
	assassin.state = "strike"
	assassin.state_time = 0.07
	assassin.dx = -1.0
	assassin.dy = 0.0
	previous_hp = game.hp
	game.update_enemies(1.0/60)
	check(game.hp<previous_hp,"Assassin lunge still hurts at body contact")
	# Open-space damping is independent of simulation frequency.
	var results: Array = []
	for fps in [60,120]:
		prepare()
		e = target(Vector2(500,320))
		game.damage_enemy(e,1,game.player,true,1.0,Vector2.RIGHT)
		for i in range(fps/2): game.update_enemies(1.0/fps)
		results.append(e.x)
	check(absf(results[0]-results[1])<0.01,"Impulse damping is frame-rate independent")
	prepare()
	game.hit_stop = 0.01
	var before_clock = game.elapsed
	game.advance_frame(0.016)
	check(absf(game.elapsed-before_clock-0.006)<0.00001,"Hit stop consumes exact time instead of an extra whole frame")
	game.delete_run()
	if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
	print("COMBAT CHECKS: %d | FAILURES: %d"%[checks,failures])
	quit(1 if failures else 0)
