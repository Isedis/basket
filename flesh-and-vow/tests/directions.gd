extends SceneTree
const Motion = preload("res://scripts/locomotion.gd")
const Combat = preload("res://scripts/combat.gd")
const Rig = preload("res://scripts/rig_view.gd")
var checks = 0
var failures = 0
func check(ok: bool, label: String):
	checks += 1
	if not ok:
		failures += 1
		push_error(label)
func _initialize(): call_deferred("run")
func run():
	var dirs = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT]
	var p = Vector2(400,320)
	var motion = Motion.initialize(p)
	for i in range(4):
		var phase = motion.phase
		var left = Motion.foot_position(motion,0,p)
		Motion.set_look(motion,dirs[i])
		check(motion.look==i,"Explicit cardinal look "+str(i))
		check(motion.phase==phase and Motion.foot_position(motion,0,p)==left,"Turning cannot reset gait or move planted foot")
		var geometry = Combat.weapon_pose(p,motion,dirs[i],3,Combat.CONTACT_RATIO)
		check(Vector2.from_angle(geometry.angle).dot(dirs[i])>0.9999,"Contact is aimed correctly in view "+str(i))
		check(signf(geometry.shoulder.x-geometry.body.x)==Motion.hand_sign(i),"Anatomical right hand has the correct screen side")
	var previous = 1
	for i in range(40):
		previous = Motion.direction_index(Vector2(0.71+(0.005 if i%2==0 else -0.005),0.71),previous)
		check(previous==1,"Diagonal hysteresis prevents pose flicker")
	var game = load("res://main.tscn").instantiate()
	game.save_path = "user://test-directions-run.json"
	game.profile_path = "user://test-directions-profile.json"
	root.add_child(game)
	await process_frame
	game.new_run(401)
	check(game.player_motion.look==0,"New run has one stable front-facing idle pose")
	game.update_game(1.0/60)
	check(game.player_motion.look==0,"Idle does not spontaneously turn sideways")
	game.player = Vector2(709,185)
	game.player_motion = Motion.initialize(game.player)
	Input.action_press("up")
	game.update_game(1.0/60)
	Input.action_release("up")
	check(game.player_motion.look==2 and not game.moving,"Actor turns toward blocked input without walking in place")
	game.player = p
	game.player_motion = Motion.initialize(p)
	for i in range(4):
		game.attack_cd = 0
		game.windup = 0
		game.swing = 0
		game.begin_attack(dirs[i])
		Input.action_press("left" if i!=3 else "right")
		game.update_game(1.0/60)
		Input.action_release("left" if i!=3 else "right")
		check(game.player_motion.look==i,"Movement cannot replace the locked attack view")
	game.save_run()
	var look = game.player_motion.look
	game.load_run()
	check(game.player_motion.look==look and game.attack_look==look,"View and attack direction survive save/load together")
	# Assets share physical joint dimensions. A weapon is one object, not a new image per view.
	Rig.load_parts()
	for type in ["player","guard"]:
		var canonical = Rig.textures_for(type,1)
		for view in range(4):
			var textures = Rig.textures_for(type,view)
			for i in range(8):
				check(textures[i].get_size()==canonical[i].get_size(),"Canonical part size is invariant across views")
				check(textures[i].get_image().get_used_rect().has_area(),"A directional body part must not be empty")
			check(textures[6]==canonical[6],"Weapon artwork is shared across all views")
		check(Rig.textures_for(type,0)[0]!=Rig.textures_for(type,2)[0],"Front and back have separate face/back-of-head art")
	game.new_run(402)
	game.enemies.clear()
	game.spawn_enemy("guard",Vector2(480,320),false)
	var guard = game.enemies[0]
	guard.motion = Motion.initialize(Vector2(guard.x,guard.y))
	guard.state = "windup"
	guard.state_time = 0.1
	guard.dx = 0.0
	guard.dy = -1.0
	game.update_enemies(0.01)
	check(guard.motion.look==2,"Guard looks along its telegraphed attack")
	game.player = Vector2(580,320)
	game.update_enemies(0.01)
	check(guard.motion.look==2,"Circling the guard cannot rotate an already telegraphed attack")
	game.damage_enemy(guard,1,game.player,true,1.4,Vector2.LEFT)
	check(guard.state=="stagger" and guard.motion.look==2,"Stagger preserves the existing body view")
	game.windup = 0
	game.swing = 0
	game.facing = Vector2.UP
	game.player_motion.erase("look")
	game.save_run()
	game.load_run()
	check(game.player_motion.look==2,"Older motion saves migrate from their recorded look direction")
	var old_guard = game.enemies[0]
	old_guard.state = "recover"
	old_guard.dx = 0.0
	old_guard.dy = -1.0
	old_guard.motion.erase("look")
	old_guard.motion.vx = 1.0
	old_guard.motion.vy = 0.0
	game.save_run()
	game.load_run()
	check(game.enemies[0].motion.look==2,"Old guard recovery pose migrates from attack direction, not stale movement")
	game.menu_action("art_probe")
	check(game.player_motion.look==1,"Art probe starts with the intended right-facing view")
	for foot in game.player_motion.feet:
		check(Vector2(foot.x,foot.y).distance_to(game.player)<12,"Art probe teleport also relocates both foot anchors")
	game.leave_art_probe()
	game.new_run(403)
	var press = InputEventKey.new()
	press.keycode = KEY_UP
	press.physical_keycode = KEY_UP
	press.pressed = true
	Input.parse_input_event(press)
	await create_timer(0.03).timeout
	var release = InputEventKey.new()
	release.keycode = KEY_UP
	release.physical_keycode = KEY_UP
	release.pressed = false
	Input.parse_input_event(release)
	await create_timer(0.06).timeout
	check(game.attack_look==2 and (game.windup>0 or game.swing>0),"A real short keyboard event selects and starts the back-facing attack")
	game.delete_run()
	if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
	print("DIRECTION CHECKS: %d | FAILURES: %d"%[checks,failures])
	quit(1 if failures else 0)
