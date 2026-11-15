extends SceneTree
var game
var failures = 0
func check(ok: bool, label: String):
	if not ok:
		failures += 1
		push_error(label)
func _initialize(): call_deferred("run")
func run():
	game = load("res://main.tscn").instantiate()
	game.save_path = "user://test-art-run.json"
	game.profile_path = "user://test-art-profile.json"
	root.add_child(game)
	await process_frame
	game.new_run(67)
	game.player = Vector2(360,320)
	game.spawn_enemy("guard",Vector2(400,320),false)
	game.damage_enemy(game.enemies[0],999,game.player,true)
	check(game.enemies.is_empty(),"Killed enemy removed")
	check(game.corpses.size()==1 and game.blood.size()>0,"Death leaves corpse and blood")
	check(game.hit_stop>0,"Lethal impact pauses simulation briefly")
	game.corpses[0].age = 0.8
	game.save_run()
	game.corpses.clear()
	game.blood.clear()
	game.load_run()
	check(game.corpses.size()==1 and game.corpses[0].age==0.8,"Corpse survives save/load")
	check(not game.blood.is_empty(),"Blood survives save/load")
	game.player = Vector2(384,142)
	game.save_run()
	game.load_run()
	check(not game.blocked(game.player,9),"Old save inside redesigned north wall recovers safely")
	game.hp = 1
	game.invincible = 0
	game.hurt(2,game.player)
	check(game.mode=="dead" and game.death_elapsed==0,"Player starts death animation")
	game._process(0.2)
	check(game.death_elapsed>0,"Player death animation advances independently of combat")
	game.delete_run()
	if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
	print("ART CHECKS: 8 | FAILURES: %d"%failures)
	quit(1 if failures else 0)
