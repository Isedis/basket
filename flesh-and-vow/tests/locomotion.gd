extends SceneTree
const Motion = preload("res://scripts/locomotion.gd")
const Rig = preload("res://scripts/rig_view.gd")
var failures = 0
var checks = 0
func check(ok: bool, label: String):
	checks += 1
	if not ok:
		failures += 1
		push_error(label)
func _initialize(): call_deferred("run")
func run():
	# Stance contacts remain fixed in world coordinates over a real walk.
	var state: Dictionary = {}
	var p = Vector2(300,320)
	for i in range(180):
		var before = state.duplicate(true)
		var next = p+Vector2(2.0,0)
		state = Motion.update(state,p,next,1.0/60)
		if not before.is_empty():
			for j in range(2):
				if before.feet[j].stance and state.feet[j].stance:
					check(Vector2(before.feet[j].x,before.feet[j].y).is_equal_approx(Vector2(state.feet[j].x,state.feet[j].y)),"Planted foot stays fixed")
		p = next
	var phase = state.phase
	var foot = Vector2(state.feet[0].x,state.feet[0].y)
	for i in range(60): state = Motion.update(state,p,p,1.0/60)
	check(state.phase==phase and not state.moving,"No motion means no gait advancement")
	check(Vector2(state.feet[0].x,state.feet[0].y)==foot,"Stopped foot remains planted")
	# Same distance produces the same gait phase at different frame rates.
	var other: Dictionary = {}
	var q = Vector2(300,320)
	for i in range(360):
		other = Motion.update(other,q,q+Vector2(1,0),1.0/120)
		q.x += 1
	check(absf(float(other.phase)-float(state.phase))<0.0001,"Gait phase is frame-rate independent")
	var previous = Vector2(state.feet[0].x,state.feet[0].y)
	Motion.shift(state,Vector2(15,0))
	check(Vector2(state.feet[0].x,state.feet[0].y)==previous+Vector2(15,0),"Knockback translates anchors without restarting gait")
	# Weapon is continuous at state boundaries and aimed at the actual contact time.
	for dir in [Vector2.RIGHT,Vector2.LEFT,Vector2.UP,Vector2.DOWN]:
		var face = -1.0 if dir.x<0 else 1.0
		var a = Rig.weapon_angle(dir,2,1,face)
		var b = Rig.weapon_angle(dir,3,0,face)
		check(Vector2.from_angle(a).distance_to(Vector2.from_angle(b))<0.0001,"Windup/strike boundary is continuous")
		var contact = Rig.weapon_angle(dir,3,0.06/0.22,face)
		check(Vector2.from_angle(contact).dot(dir)>0.9999,"Blade points at hit direction on contact")
		var rest = Rig.weapon_angle(dir,0,0,face)
		check(Vector2.from_angle(Rig.weapon_angle(dir,3,1,face)).distance_to(Vector2.from_angle(rest))<0.0001,"Recovery returns to same idle pose")
	var game = load("res://main.tscn").instantiate()
	game.save_path = "user://test-motion-run.json"
	game.profile_path = "user://test-motion-profile.json"
	root.add_child(game)
	await process_frame
	game.new_run(97)
	game.player = Vector2(game.room_floor_rect.end.x-11,320)
	Input.action_press("right")
	game.update_game(1.0/60)
	Input.action_release("right")
	check(not game.moving and not game.player_motion.moving,"Held movement into wall does not animate walking")
	game.enemies.clear()
	game.player = Vector2(360,320)
	game.player_motion = Motion.initialize(game.player)
	game.spawn_enemy("guard",Vector2(400,320),false)
	var target = game.enemies[0]
	var health = target.hp
	game.begin_attack(Vector2.RIGHT)
	game.advance_player_attack(game.swing_windup)
	check(target.hp==health and game.attack_contact_pending,"Windup ends without early damage")
	var contact_time = game.swing_duration*(0.06/0.22)
	game.advance_player_attack(contact_time-0.01)
	check(target.hp==health,"No damage before the contact point")
	game.advance_player_attack(0.01)
	check(target.hp<health and not game.attack_contact_pending,"Damage occurs at the blade's contact point")
	var once = target.hp
	game.advance_player_attack(0.1)
	check(target.hp==once,"One contact per swing")
	game.save_run()
	var saved_phase = game.player_motion.phase
	var saved_swing = game.swing
	game.load_run()
	check(is_equal_approx(float(game.player_motion.phase),float(saved_phase)) and is_equal_approx(game.swing,saved_swing),"Save/load preserves gait and attack phase")
	game.delete_run()
	if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
	print("LOCOMOTION CHECKS: %d | FAILURES: %d"%[checks,failures])
	quit(1 if failures else 0)
