extends SceneTree

var game
var checks = 0
var failures: Array = []

func check(value: bool, label: String):
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func _initialize():
	call_deferred("run")

func run():
	var D = preload("res://scripts/dungeon.gd")
	var random = RandomNumberGenerator.new()
	for seed_number in range(300):
		random.seed = seed_number
		var map = D.generate(random,seed_number%4)
		var reached = ["0,0"]
		var queue = ["0,0"]
		while not queue.is_empty():
			var k = queue.pop_front()
			var r = map.rooms[k]
			for direction in D.DIRS:
				var next = D.key(Vector2i(r.x,r.y)+direction)
				if map.rooms.has(next) and next not in reached:
					reached.append(next)
					queue.append(next)
		check(reached.size()==map.rooms.size(),"Connected seed %d"%seed_number)
		for type in ["boss","treasure","shop","torture","oracle","reliquary","secret"]:
			check(map.rooms.values().filter(func(r): return r.type==type).size()==1,"Room %s seed %d"%[type,seed_number])
	game = load("res://main.tscn").instantiate()
	game.save_path = "user://test_run_v1.json"
	game.profile_path = "user://test_profile_v1.json"
	for path in [game.save_path,game.profile_path]:
		if FileAccess.file_exists(path): DirAccess.remove_absolute(path)
	root.add_child(game)
	await process_frame
	game.new_run(71991)
	check(game.mode=="playing" and game.hp==12,"New run")
	check(game.room.type=="start" and game.room.clear,"Start room safe")
	# Persistent item, status, position and exact hostile state round trip.
	game.inventory = ["ember","echo","blink","bloodwave"]
	game.hp = 7.5
	game.pain = 23.0
	game.coins = 17
	game.keys = 3
	game.faith = -2
	game.player = Vector2(392,305)
	game.fire_bullet(Vector2(400,300),Vector2(80,0),2,"enemy",2)
	game.save_run()
	game.hp = 1
	game.inventory = []
	game.bullets.clear()
	check(game.load_run(),"Load run")
	check(game.hp==7.5 and game.inventory.size()==4 and game.coins==17 and game.keys==3,"Stats persist")
	check(game.faith==-2 and game.player==Vector2(392,305),"Position and faith persist")
	check(game.bullets.size()==1,"Projectiles persist")
	# Basic combat and meaningful synergy.
	game.enemies.clear()
	game.spawn_enemy("guard",Vector2(420,305),false)
	var e = game.enemies[0]
	var old_hp = e.hp
	game.swing_dir = Vector2.RIGHT
	game.perform_attack()
	check(e.hp<old_hp and e.burn>0,"Melee applies damage and item effects")
	check(game.zones.size()>0 and game.bullets.size()>1,"Echo and blood wave compose")
	game.invincible = 0
	var hp_before = game.hp
	game.hurt(2,Vector2(400,305))
	check(game.hp==hp_before-2 and game.pain>23,"Flesh and pain")
	game.hurt(2,Vector2(400,305))
	check(game.hp==hp_before-2,"Damage grace period")
	# Special room costs cannot kill or reduce below the minimum capacity.
	for k in game.dungeon.rooms:
		if game.dungeon.rooms[k].type=="torture":
			game.enter_room(Vector2i(game.dungeon.rooms[k].x,game.dungeon.rooms[k].y),game.CENTRE)
			break
	var old_max = game.max_hp
	game.interact()
	check(game.max_hp==old_max-2 and game.room.used,"Torture permanently trades run capacity")
	var max_after = game.max_hp
	game.interact()
	check(game.max_hp==max_after,"Torture once per room")
	# Secret walls require three outward attacks and persist their opening.
	game.new_run(42)
	var secret_key = ""
	for k in game.dungeon.rooms:
		if game.dungeon.rooms[k].type=="secret": secret_key=k
	var s = game.dungeon.rooms[secret_key]
	var secret_pos = Vector2i(s.x,s.y)
	for i in range(4):
		var parent = secret_pos-Vector2i(game.DIRECTIONS[i])
		if game.dungeon.rooms.has(D.key(parent)):
			game.enter_room(parent,game.door_position(i)-game.DIRECTIONS[i]*21)
			game.room.clear = true
			game.enemies.clear()
			game.swing_dir = game.DIRECTIONS[i]
			for j in range(3): game.perform_attack()
			check(s.revealed,"Secret revealed by three wall strikes")
			break
	# Locked treasure uses exactly one key; re-entry is free.
	game.new_run(299)
	for k in game.dungeon.rooms:
		var r = game.dungeon.rooms[k]
		if r.type=="treasure":
			var target = Vector2i(r.x,r.y)
			for i in range(4):
				var parent = target-Vector2i(game.DIRECTIONS[i])
				if game.dungeon.rooms.has(D.key(parent)):
					game.enter_room(parent,game.door_position(i)-game.DIRECTIONS[i]*20)
					game.room.clear = true
					game.enemies.clear()
					game.keys = 0
					game.transition_cd = 0
					game.check_doors()
					check(game.coords==parent and not r.opened,"Locked door rejects missing key")
					game.keys = 2
					game.transition_cd = 0
					game.check_doors()
					check(game.coords==target and game.keys==1 and r.opened,"Treasure consumes one key")
					break
			break
	# All enemy state machines and rendering exercise over deterministic simulation.
	game.new_run(1024)
	for floor_number in range(4):
		game.floor_index = floor_number
		game.new_floor()
		var boss_key = ""
		for k in game.dungeon.rooms:
			if game.dungeon.rooms[k].type=="boss": boss_key=k
		var boss_room = game.dungeon.rooms[boss_key]
		game.enter_room(Vector2i(boss_room.x,boss_room.y),Vector2(384,330))
		for type in game.ENEMY_NAMES: game.spawn_enemy(type,game.free_spawn(),false)
		for frame in range(240):
			game.invincible = 100
			game.update_game(1.0/60)
			if frame%60==0: await process_frame
		check(game.enemies.size()>=6,"Boss and enemy simulation floor %d"%floor_number)
		for enemy in game.enemies.duplicate(): game.damage_enemy(enemy,99999,game.player,true)
		game.clear_room()
		check(game.room.clear and game.enemies.is_empty(),"Boss clear floor %d"%floor_number)
		game.player = game.CENTRE
		game.interact()
		check(game.mode=="victory" if floor_number==3 else game.floor_index==floor_number+1,"Floor exit %d"%floor_number)
	check(not FileAccess.file_exists(game.save_path),"Victory deletes run")
	check("victory" in game.profile.unlocks,"Victory unlock persists")
	game.new_run(88)
	game.hp = 1
	game.invincible = 0
	game.hurt(2,game.player)
	check(game.mode=="dead" and not FileAccess.file_exists(game.save_path),"Permadeath removes run")
	check(game.profile.deaths>0,"Profile survives death")
	# Save and restore an enemy in windup, then verify the exact pending state.
	game.new_run(777)
	game.spawn_enemy("assassin",Vector2(500,300),false)
	game.enemies[0].state = "windup"
	game.enemies[0].state_time = 0.3
	game.save_run()
	game.enemies.clear()
	game.load_run()
	check(game.enemies.size()==1 and game.enemies[0].state=="windup" and game.enemies[0].state_time==0.3,"Enemy windup saves exactly")
	# Poll real input actions through the running process loop.
	game.new_run(501)
	var initial_position = game.player
	Input.action_press("right")
	await create_timer(0.25).timeout
	Input.action_release("right")
	check(game.player.x>initial_position.x+20,"WASD input drives movement")
	Input.action_press("hit_right")
	await create_timer(0.2).timeout
	Input.action_release("hit_right")
	check(game.attack_cd>0 and game.combo==1,"Held arrow input starts melee")
	var pause_event = InputEventKey.new()
	pause_event.physical_keycode = KEY_ESCAPE
	pause_event.keycode = KEY_ESCAPE
	pause_event.pressed = true
	game._unhandled_input(pause_event)
	check(game.mode=="paused","Escape opens pause")
	game._unhandled_input(pause_event)
	check(game.mode=="playing","Escape resumes")
	# UI paths and paused rendering.
	for state in ["playing","paused","dead","victory","title","confirm_new"]:
		game.mode = state
		game.queue_redraw()
		await process_frame
	game.help_open = true
	game.queue_redraw()
	await process_frame
	game.help_open = false
	game.journal_open = true
	game.inventory = preload("res://scripts/catalog.gd").ITEMS.map(func(i): return i.id)
	game.queue_redraw()
	await process_frame
	print("CHECKS: %d | FAILURES: %d"%[checks,failures.size()])
	game.delete_run()
	DirAccess.remove_absolute(game.profile_path)
	quit(0 if failures.is_empty() else 1)
