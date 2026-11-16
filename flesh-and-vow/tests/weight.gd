extends SceneTree
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
var checks = 0
var failures = 0
var game
func check(ok: bool, label: String):
	checks += 1
	if not ok:
		failures += 1
		push_error(label)
func _initialize(): call_deferred("run")
func prepare():
	game.new_run(991)
	game.blocks.clear()
	game.hazards.clear()
	game.enemies.clear()
	game.melee_contacts.clear()
	game.place_player(Vector2(384,320),Vector2.RIGHT)
	game.invincible = 0
func run():
	for dir in [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT]:
		var view = Motion.direction_index(dir)
		var hand = Motion.hand_sign(view)
		var u = Combat.CONTACT_RATIO
		var before = absf(angle_difference(Combat.weapon_angle(dir,3,u-0.001,hand),Combat.weapon_angle(dir,3,u,hand)))/0.001
		var after = absf(angle_difference(Combat.weapon_angle(dir,3,u,hand),Combat.weapon_angle(dir,3,u+0.001,hand)))/0.001
		check(before>6 and after>6,"Blade retains speed through contact instead of easing to a stop")
		check(after/before>0.7 and after/before<1.3,"Blade velocity stays continuous through the contact point")
		var return_peak = 0.0
		for sample in range(100):
			var a = lerpf(Combat.ACTIVE_END,1,sample/100.0)
			var b = lerpf(Combat.ACTIVE_END,1,(sample+1)/100.0)
			return_peak = maxf(return_peak,absf(angle_difference(Combat.weapon_angle(dir,3,a,hand),Combat.weapon_angle(dir,3,b,hand)))/(b-a))
		check(return_peak<before*0.8,"Recovery cannot snap the cleaver back faster than the cutting stroke")
		check(absf(angle_difference(Combat.weapon_angle(dir,2,0.85,hand),Combat.weapon_angle(dir,2,1,hand)))<0.001,"Anticipation finishes with a brief deliberate hold")
		for mass in [1.0,1.28,2.06]:
			var motion = Motion.initialize(Vector2.ZERO,hand,view)
			motion.attack_weight = mass
			var raised = Combat.weapon_pose(Vector2.ZERO,motion,dir,2,1)
			var start = Combat.weapon_pose(Vector2.ZERO,motion,dir,3,0)
			check(raised.hand.distance_to(start.hand)<0.001 and raised.body.distance_to(start.body)<0.001,"Anticipation joins the stroke without wrist or body jumps")
			var contact = Combat.weapon_pose(Vector2.ZERO,motion,dir,3,u)
			check(absf(contact.twist)>0.1 and contact.hips.distance_to(contact.body)>2,"Contact transfers weight through hips and torso")
			var stable = true
			var previous = start
			for sample in range(1,201):
				var pose = Combat.weapon_pose(Vector2.ZERO,motion,dir,3,sample/200.0)
				stable = stable and pose.hand.distance_to(previous.hand)<4 and absf(pose.elbow.distance_to(pose.hand)-Combat.FOREARM)<0.001
				previous = pose
			check(stable,"Weighted animation preserves bone lengths and continuous wrist movement")
			motion.walk_weight = 1.0
			var idle = Combat.weapon_pose(Vector2.ZERO,motion,dir,0,0)
			var beginning = Combat.weapon_pose(Vector2.ZERO,motion,dir,2,0)
			var ending = Combat.weapon_pose(Vector2.ZERO,motion,dir,3,1)
			check(idle.hand.distance_to(beginning.hand)<0.001 and idle.hand.distance_to(ending.hand)<0.001,"Walking joins and leaves the attack without a wrist snap")
	game = load("res://main.tscn").instantiate()
	game.save_path = "user://test-weight-run.json"
	game.profile_path = "user://test-weight-profile.json"
	root.add_child(game)
	await process_frame
	game.set_process(false)
	prepare()
	game.begin_attack(Vector2.RIGHT)
	var normal = [game.swing_windup,game.swing_duration,game.attack_cd,float(game.player_motion.attack_weight)]
	check(normal[2]<0.55,"Normal attack keeps a responsive cadence")
	prepare()
	game.inventory = ["heavy"]
	game.begin_attack(Vector2.RIGHT)
	check(game.swing_windup>normal[0]*1.4 and game.swing_duration>normal[1]*1.2 and game.player_motion.attack_weight>normal[3],"Heavy cleaver has distinct loading, recovery and body weight")
	prepare()
	game.combo = 2
	game.begin_attack(Vector2.RIGHT)
	check(game.combo==0 and game.swing_windup>normal[0] and game.swing_duration>normal[1],"Third strike has a visibly heavier cadence")
	game.save_run()
	game.combo = 1
	game.load_run()
	check(game.combo==0 and game.player_motion.attack_weight>1,"Finisher and body weight survive a saved windup")
	var travel: Array = []
	for fps in [60,120]:
		prepare()
		var anchor = Motion.foot_position(game.player_motion,0,game.player)
		game.begin_attack(Vector2.RIGHT)
		for tick in range(fps): game.update_game(1.0/fps)
		travel.append(game.player.x)
		check(absf(game.player.x-389)<0.01,"Attack makes a small bounded forward step")
		check(Motion.foot_position(game.player_motion,0,game.player).distance_to(anchor)<0.01,"Support foot stays planted during the attack step")
		check(game.hit_stop==0 and game.melee_contacts.is_empty(),"A miss has no fake impact freeze or hit flash")
	check(absf(travel[0]-travel[1])<0.01,"Attack step is independent of simulation frequency")
	prepare()
	var wall_x = game.room_floor_rect.end.x-11
	game.place_player(Vector2(wall_x,185),Vector2.RIGHT)
	game.begin_attack(Vector2.RIGHT)
	for tick in range(40): game.update_game(1.0/60)
	check(game.player.x==wall_x and not game.player_motion.moving,"Attack step cannot move through a wall or animate sliding feet")
	prepare()
	game.spawn_enemy("guard",game.player+Vector2(44,0),false)
	var target = game.enemies.back()
	target.hp = 100.0
	target.max = 100.0
	target.training_dummy = true
	game.begin_attack(Vector2.RIGHT)
	game.advance_player_attack(game.swing_windup+game.swing_duration*Combat.CONTACT_RATIO)
	check(game.hit_stop>=0.049 and not game.melee_contacts.is_empty() and game.player_motion.impact_age==0,"Real contact creates freeze, local impact flash and wrist recoil")
	var freeze = game.hit_stop
	game.advance_frame(freeze/2)
	check(game.player_motion.impact_age==0,"Contact pose remains held for the full hit stop")
	game.advance_frame(freeze/2+0.01)
	check(game.player_motion.impact_age>0,"Recoil begins after the impact hold")
	prepare()
	check(not game.toggle_practice_weapon(),"Practice controls cannot change weapons in a regular run")
	var original_path = game.save_path
	var original_save = FileAccess.get_file_as_string(original_path)
	game.menu_action("art_probe")
	check(game.toggle_practice_weapon() and game.has_item("heavy"),"Practice room can compare normal and heavy weapons immediately")
	game.start_practice_round(true)
	check(game.original_save_path==original_path and game.enemies.size()==2 and game.has_item("heavy"),"Practice retry preserves its weapon and original save reference")
	game.leave_art_probe()
	check(game.save_path==original_path and FileAccess.get_file_as_string(original_path)==original_save,"Practice switching and retry never overwrite the ordinary run")
	game.delete_run()
	if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
	print("WEIGHT CHECKS: %d | FAILURES: %d"%[checks,failures])
	quit(1 if failures else 0)
