extends Node2D

const Catalog = preload("res://scripts/catalog.gd")
const Dungeon = preload("res://scripts/dungeon.gd")
const View = preload("res://scripts/view.gd")
var save_path = "user://run_v1.json"
var profile_path = "user://profile_v1.json"
const DIRECTIONS = [Vector2.UP, Vector2.RIGHT, Vector2.DOWN, Vector2.LEFT]
const CENTRE = Vector2(384,268)
const ENEMY_NAMES = ["guard", "shadow", "skeleton", "assassin", "mage"]

var font = preload("res://assets/regular.ttf")
var bold = preload("res://assets/bold.ttf")
var pixel_font = preload("res://assets/pixel.ttf")
var castle_art: Texture2D
var corpses: Array = []
var hit_stop = 0.0
var death_elapsed = 0.0
var art_probe_active = false
var original_save_path = ""
var original_profile_path = ""
var original_profile: Dictionary = {}
var swing_windup = 0.12
var actors = preload("res://assets/actors.png")
var icons = preload("res://assets/items.png")
var updater
var rng = RandomNumberGenerator.new()
var dungeon: Dictionary = {}
var room: Dictionary = {}
var coords = Vector2i.ZERO
var floor_index = 0
var mode = "title"
var previous_mode = "playing"
var profile = {"unlocks":[], "deaths":0, "wins":0, "best":0}
var character = 0
var player = Vector2(384,320)
var facing = Vector2.DOWN
var hp = 12.0
var max_hp = 12.0
var pain = 0.0
var coins = 0
var keys = 2
var faith = 0
var inventory: Array = []
var active = "vessel"
var charge = 3
var attack_cd = 0.0
var windup = 0.0
var swing = 0.0
var swing_dir = Vector2.DOWN
var combo = 0
var invincible = 0.0
var dash_time = 0.0
var dash_cd = 0.0
var dash_dir = Vector2.ZERO
var active_cd = 0.0
var elapsed = 0.0
var anim = 0.0
var moving = false
var shake = 0.0
var hurt_flash = 0.0
var transition_cd = 0.0
var message = ""
var message_time = 0.0
var item_popup = ""
var popup_time = 0.0
var save_time = 0.0
var seed_value = 0
var kills = 0
var rooms_cleared = 0
var enemies: Array = []
var bullets: Array = []
var drops: Array = []
var blood: Array = []
var particles: Array = []
var zones: Array = []
var blocks: Array = []
var hazards: Array = []
var menu_hover = -1
var help_open = false
var journal_open = false
var last_error = ""
var end_quote = ""
var room_texture: Texture2D

func _ready():
	updater = preload("res://scripts/updater.gd").new()
	add_child(updater)
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	pixel_font.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	var castle_image = preload("res://assets/castle_room.png").get_image()
	castle_image.resize(352,182,Image.INTERPOLATE_NEAREST)
	castle_art = ImageTexture.create_from_image(castle_image)
	bind_controls()
	rng.randomize()
	load_profile()
	get_tree().auto_accept_quit = false
	queue_redraw()

func bind_controls():
	var bindings = {"left":KEY_A, "right":KEY_D, "up":KEY_W, "down":KEY_S,
		"hit_left":KEY_LEFT,"hit_right":KEY_RIGHT,"hit_up":KEY_UP,"hit_down":KEY_DOWN,
		"interact":KEY_E,"active":KEY_SPACE,"dash":KEY_SHIFT,"pause_run":KEY_ESCAPE,"journal":KEY_TAB}
	for action in bindings:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		var ev = InputEventKey.new()
		ev.physical_keycode = bindings[action]
		InputMap.action_add_event(action,ev)

func _notification(what):
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if mode in ["playing","paused"]:
			save_run()
		get_tree().quit()

func _unhandled_input(event):
	if mode == "title" and art_probe_active: leave_art_probe()
	if updater != null and updater.is_open(): return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F11:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)
		if event.keycode == KEY_F1:
			help_open = not help_open
			if mode == "playing":
				mode = "paused"
			queue_redraw()
			return
		if help_open:
			if event.keycode in [KEY_ESCAPE,KEY_ENTER]:
				help_open = false
			return
		if event.is_action_pressed("pause_run"):
			if mode == "playing":
				mode = "paused"
				save_run()
			elif mode == "paused":
				mode = "playing"
				journal_open = false
			return
		if event.is_action_pressed("journal") and mode in ["playing","paused"]:
			journal_open = not journal_open
			mode = "paused" if journal_open else "playing"
			return
		if mode == "title":
			if event.keycode == KEY_ENTER:
				if FileAccess.file_exists(save_path):
					load_run()
				else:
					new_run()
			elif event.keycode == KEY_N:
				if FileAccess.file_exists(save_path): mode = "confirm_new"
				else: new_run()
			elif event.keycode == KEY_C and "boss1" in profile.unlocks:
				character = 1 - character
		elif mode in ["dead","victory"] and event.keycode == KEY_ENTER:
			mode = "title"
		elif mode == "playing":
			if event.is_action_pressed("interact"):
				interact()
			if event.is_action_pressed("active"):
				use_active()
			if event.is_action_pressed("dash") and has_item("blink") and dash_cd <= 0:
				dash_dir = Input.get_vector("left","right","up","down")
				if dash_dir == Vector2.ZERO:
					dash_dir = facing
				dash_time = 0.16
				dash_cd = 1.8
				invincible = maxf(invincible,0.23)
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		for i in range(menu_buttons().size()):
			if menu_buttons()[i].rect.has_point(get_global_mouse_position()):
				menu_action(menu_buttons()[i].action)
				break

func menu_buttons() -> Array:
	if help_open:
		return [{"rect":Rect2(340,438,280,40),"text":"ПОНЯТНО  ·  ENTER", "action":"help_close"}]
	if journal_open:
		return [{"rect":Rect2(340,466,280,36),"text":"ВЕРНУТЬСЯ  ·  TAB", "action":"journal_close"}]
	if mode == "title":
		var arr: Array = []
		if FileAccess.file_exists(save_path):
			arr.append({"rect":Rect2(72,296,320,42),"text":"ПРОДОЛЖИТЬ  ·  ENTER", "action":"continue"})
		arr.append({"rect":Rect2(72,346,320,42),"text":"НОВЫЙ ЗАБЕГ  ·  N", "action":"new_confirm" if FileAccess.file_exists(save_path) else "new"})
		arr.append({"rect":Rect2(72,396,320,36),"text":"КАК ИГРАТЬ  ·  F1", "action":"help"})
		arr.append({"rect":Rect2(420,440,300,32),"text":"ИСПЫТАТЬ НОВЫЙ БОЙ", "action":"art_probe"})
		arr.append({"rect":Rect2(72,440,320,32),"text":"ПРОВЕРИТЬ ОБНОВЛЕНИЯ", "action":"updates"})
		if "boss1" in profile.unlocks:
			arr.append({"rect":Rect2(72,480,320,26),"text":"ГЕРОЙ: "+("УЗНИК" if character==0 else "ОТСТУПНИК")+"  ·  C", "action":"character"})
		return arr
	if mode == "confirm_new":
		return [{"rect":Rect2(260,305,210,40),"text":"НАЧАТЬ ЗАНОВО", "action":"new"},{"rect":Rect2(490,305,210,40),"text":"ОТМЕНА", "action":"cancel_new"}]
	if mode == "paused":
		return [{"rect":Rect2(330,250,300,40),"text":"ПРОДОЛЖИТЬ  ·  ESC", "action":"resume"},
			{"rect":Rect2(330,302,300,40),"text":"СОХРАНИТЬ И В МЕНЮ", "action":"title"},
			{"rect":Rect2(330,354,300,36),"text":"КАК ИГРАТЬ", "action":"help"}]
	if mode == "dead" and death_elapsed<0.85: return []
	if mode in ["dead","victory"]:
		return [{"rect":Rect2(330,386,300,42),"text":"К ОБЕТУ  ·  ENTER", "action":"end"}]
	return []

func menu_action(action: String):
	match action:
		"art_probe":
			original_save_path = save_path
			original_profile_path = profile_path
			original_profile = profile.duplicate(true)
			save_path += ".art-probe"
			profile_path += ".art-probe"
			art_probe_active = true
			new_run()
			player = Vector2(316,330)
			invincible = 0
			facing = Vector2.RIGHT
			spawn_enemy("guard",Vector2(450,325),false)
			spawn_enemy("guard",Vector2(590,300),false)
			room.clear = false
			notify("Зал проверки: WASD — шаг, стрелки — тесак.",5)
			save_run()
		"updates": updater.open()
		"new": new_run()
		"new_confirm": mode = "confirm_new"
		"cancel_new": mode = "title"
		"continue": load_run()
		"resume": mode = "playing"
		"title":
			save_run()
			mode = "title"
		"help": help_open = true
		"help_close": help_open = false
		"journal_close":
			journal_open = false
			mode = "playing"
		"character": character = 1 - character
		"end": mode = "title"

func leave_art_probe():
	if not art_probe_active: return
	delete_run()
	if FileAccess.file_exists(profile_path): DirAccess.remove_absolute(profile_path)
	save_path = original_save_path
	profile_path = original_profile_path
	profile = original_profile.duplicate(true)
	art_probe_active = false

func new_run(fixed_seed: int = -1):
	seed_value = fixed_seed if fixed_seed >= 0 else int(Time.get_unix_time_from_system()) ^ randi()
	rng.seed = seed_value
	floor_index = 0
	hp = 12.0 if character == 0 else 8.0
	max_hp = hp
	pain = 0.0
	faith = 0 if character == 0 else -3
	coins = 0
	keys = 2
	inventory = [] if character == 0 else ["bloodwave"]
	active = "vessel" if character == 0 else "storm"
	charge = 3
	elapsed = 0
	hit_stop = 0
	kills = 0
	rooms_cleared = 0
	attack_cd = 0
	windup = 0
	swing = 0
	invincible = 1
	dash_cd = 0
	dash_time = 0
	active_cd = 0
	combo = 0
	journal_open = false
	help_open = false
	new_floor()
	mode = "playing"
	notify("Ты не помнишь своего имени. Тело помнит всё.",5)
	save_run()

func new_floor():
	dungeon = Dungeon.generate(rng,floor_index)
	coords = Vector2i.ZERO
	enter_room(coords,Vector2(384,320),false)

func enter_room(where: Vector2i, spawn: Vector2, store: bool = true):
	if store and not room.is_empty():
		store_room()
	coords = where
	room = dungeon.rooms[Dungeon.key(coords)]
	room.visited = true
	if not room.has("corpses"): room.corpses = []
	corpses = room.corpses.duplicate(true)
	player = spawn
	enemies = room.enemies.duplicate(true)
	drops = room.drops.duplicate(true)
	blood = room.blood.duplicate(true)
	bullets.clear()
	particles.clear()
	zones.clear()
	windup = 0
	swing = 0
	transition_cd = 0.45
	setup_geometry()
	if blocked(player,9):
		for candidate in [CENTRE,Vector2(384,320),Vector2(384,210),Vector2(130,300),Vector2(620,300)]:
			if not blocked(candidate,9):
				player = candidate
				break
	if not room.spawned:
		room.spawned = true
		populate_room()
	make_floor_texture()
	if room.type == "boss" and not room.clear:
		notify(Catalog.FLOORS[floor_index].boss,3)
	elif room.type == "secret":
		notify("Стены сохранили то, от чего отказались люди.",4)
	save_run()

func store_room():
	room.enemies = enemies.duplicate(true)
	room.drops = drops.duplicate(true)
	room.blood = blood.duplicate(true)
	room.corpses = corpses.duplicate(true)

func setup_geometry():
	blocks.clear()
	hazards.clear()
	if room.type not in ["combat","boss"]:
		return
	# Six authored obstacle arrangements; central door lanes stay open.
	var templates = [
		[Rect2(172,176,48,36),Rect2(548,328,48,36)],
		[Rect2(205,164,36,48),Rect2(527,164,36,48),Rect2(205,334,36,48),Rect2(527,334,36,48)],
		[Rect2(286,182,44,30),Rect2(438,334,44,30)],
		[Rect2(168,184,80,24),Rect2(520,338,80,24)],
		[Rect2(240,180,32,32),Rect2(496,180,32,32),Rect2(240,330,32,32),Rect2(496,330,32,32)],
		[Rect2(170,172,48,48),Rect2(550,316,48,48)]
	]
	if room.type != "boss":
		blocks = templates[int(room.layout)].duplicate()
	var hazard_types = ["spikes","fire","water","pit"]
	var kind = hazard_types[(int(room.layout)+floor_index)%4]
	var rect = Rect2(300,350,52,32) if int(room.layout)%2==0 else Rect2(424,160,52,32)
	hazards.append({"rect":rect,"type":kind,"phase":float(int(room.seed)%7)})
	if floor_index > 1:
		hazards.append({"rect":Rect2(548,184,40,32),"type":"fire","phase":2.0})

func make_floor_texture():
	var local = RandomNumberGenerator.new()
	local.seed = int(room.seed)
	var img = Image.create(688,336,false,Image.FORMAT_RGB8)
	var tint = Color(Catalog.FLOORS[floor_index].color)
	for y in range(336):
		for x in range(688):
			var seam = x%32==0 or (y+(16 if (x/32)%2==0 else 0))%32==0
			var noise_value = local.randf_range(-0.015,0.015)
			var c = tint * (0.23 if seam else 0.32 + noise_value)
			if local.randf()<0.006:
				c = tint*0.46
			img.set_pixel(x,y,Color(c.r,c.g,c.b,1))
	room_texture = ImageTexture.create_from_image(img)

func populate_room():
	match room.type:
		"combat":
			var n = rng.randi_range(3,4)+floor_index
			for i in range(n):
				spawn_enemy(ENEMY_NAMES[rng.randi_range(0,mini(4,2+floor_index))],free_spawn(),false)
		"boss": spawn_enemy("boss"+str(floor_index),Vector2(384,195),true)
		"treasure","reliquary","secret":
			room.clear = true
			var count_items = 2 if room.type == "secret" else 1
			for i in range(count_items):
				add_drop("item",Vector2(350+i*68,260),1,choose_item())
			if room.type == "secret":
				add_drop("key",Vector2(384,310),1)
		"shop":
			room.clear = true
			add_drop("item",Vector2(330,250),1,choose_item(),8+floor_index*2)
			add_drop("heal",Vector2(438,250),4,"",4)
			add_drop("key",Vector2(384,320),1,"",3)
		_ : room.clear = true

func free_spawn() -> Vector2:
	for attempt in range(80):
		var p = Vector2(rng.randf_range(130,640),rng.randf_range(155,365))
		if p.distance_to(player)>100 and not blocked(p,15):
			return p
	return Vector2(600,300)

func spawn_enemy(type: String, p: Vector2, boss: bool):
	var health = (65.0+floor_index*32) if boss else (9.0+floor_index*4)
	if type == "shadow": health *= 0.7
	if type == "guard": health *= 1.35
	enemies.append({"type":type,"x":p.x,"y":p.y,"hp":health,"max":health,"boss":boss,
		"timer":rng.randf_range(0.5,1.7),"state":"chase","state_time":0.0,"dx":0.0,"dy":1.0,
		"flash":0.0,"burn":0.0,"poison":0.0,"slow":0.0,"tick":0.0,"phase":0})

func _process(delta):
	if mode == "title" and art_probe_active: leave_art_probe()
	anim += delta
	if mode == "dead": death_elapsed += delta
	menu_hover = -1
	var buttons = menu_buttons()
	for i in range(buttons.size()):
		if buttons[i].rect.has_point(get_global_mouse_position()): menu_hover = i
	if mode == "playing" and not help_open:
		if hit_stop>0: hit_stop = maxf(0,hit_stop-delta)
		else: update_game(minf(delta,0.04))
	queue_redraw()

func update_game(dt: float):
	elapsed += dt
	for c in corpses: c.age = minf(1.0,c.age+dt)
	save_time += dt
	for prop in ["attack_cd","invincible","dash_cd","active_cd","transition_cd","message_time","popup_time","hurt_flash"]:
		set(prop,maxf(0.0,float(get(prop))-dt))
	shake = move_toward(shake,0,dt*20)
	pain = maxf(0,pain-dt*0.18)
	moving = false
	var movement = Input.get_vector("left","right","up","down")
	var speed = 154.0*(1.0+count_item("haste")*0.15)
	for hazard in hazards:
		if hazard.type == "water" and hazard.rect.has_point(player): speed *= 0.64
	if windup>0: speed *= 0.65
	if dash_time>0:
		dash_time -= dt
		movement = dash_dir
		speed = 560
		emit_particle(player,Color("8ca9cd"),Vector2.ZERO,0.23,9)
	if movement.length()>0:
		moving = true
		if absf(movement.x)>absf(movement.y): facing = Vector2(signf(movement.x),0)
		else: facing = Vector2(0,signf(movement.y))
		player = move_body(player,movement*speed*dt,9)
	var aim = Vector2.ZERO
	for pair in [["hit_up",Vector2.UP],["hit_down",Vector2.DOWN],["hit_left",Vector2.LEFT],["hit_right",Vector2.RIGHT]]:
		if Input.is_action_pressed(pair[0]): aim = pair[1]
	if aim != Vector2.ZERO and attack_cd <= 0 and windup <= 0:
		begin_attack(aim)
	if windup>0:
		windup -= dt
		if windup <= 0: perform_attack()
	swing = maxf(0,swing-dt)
	update_enemies(dt)
	if mode != "playing": return
	update_bullets(dt)
	if mode != "playing": return
	update_zones(dt)
	update_particles(dt)
	update_drops(dt)
	if mode != "playing": return
	check_hazards()
	if mode != "playing": return
	check_doors()
	if not room.clear and enemies.is_empty(): clear_room()
	if has_item("orbit"):
		var orb = player + Vector2.from_angle(anim*3.2)*42
		for enemy in enemies:
			if Vector2(enemy.x,enemy.y).distance_to(orb)<19 and float(enemy.flash)<=0:
				damage_enemy(enemy,2.0,orb,false)
	if save_time>15:
		save_run()
		save_time = 0

func blocked(p: Vector2, radius: float) -> bool:
	if p.x<50+radius or p.x>718-radius or p.y<176+radius or p.y>425-radius:
		return true
	for block in blocks:
		if block.grow(radius).has_point(p): return true
	for hazard in hazards:
		if hazard.type == "pit" and hazard.rect.grow(radius*0.35).has_point(p): return true
	return false

func move_body(p: Vector2, by: Vector2, radius: float) -> Vector2:
	# Axis separation and small steps prevent tunnelling during dashes.
	var steps = maxi(1,int(ceil(by.length()/5.0)))
	var step = by/steps
	for i in range(steps):
		if not blocked(p+Vector2(step.x,0),radius): p.x+=step.x
		if not blocked(p+Vector2(0,step.y),radius): p.y+=step.y
	return p

func begin_attack(direction: Vector2):
	swing_dir = direction
	facing = direction
	swing_windup = 0.12 + count_item("heavy")*0.045
	windup = swing_windup
	attack_cd = maxf(0.13,(0.40+count_item("heavy")*0.12)/(1.0+count_item("haste")*0.27))
	combo = (combo+1)%3

func attack_range() -> float:
	return 57.0+count_item("cleaver")*22+count_item("heavy")*12

func attack_damage() -> float:
	var result = 4.8+count_item("heavy")*3.6+count_item("rage")*pain*0.11
	result *= 1.0+pain*0.0035
	if has_item("pact"): result *= 1.0+(1.0-hp/max_hp)*1.5
	if faith<0: result *= 1.0+absf(faith)*0.035
	if has_item("martyr") and faith>0: result *= 1.0+faith*0.09
	if combo==0: result *= 1.25
	return result

func perform_attack():
	swing = 0.22
	var reach = attack_range()
	for enemy in enemies.duplicate():
		var rel = Vector2(enemy.x,enemy.y)-player
		if rel.length()<reach+(20 if enemy.boss else 10) and (rel.normalized().dot(swing_dir)>0.15 or rel.length()<22):
			damage_enemy(enemy,attack_damage(),player,true)
	if has_item("bloodwave"):
		fire_bullet(player+swing_dir*16,swing_dir*235,3.5,"ally",1.6)
	if has_item("echo"):
		zones.append({"x":player.x+swing_dir.x*38,"y":player.y+swing_dir.y*38,"radius":40.0,"timer":0.23,"kind":"echo","damage":attack_damage()*0.7})
	# Stone responds only after the room is safe, encouraging observation.
	if room.clear:
		for i in range(4):
			var next = coords+Vector2i(DIRECTIONS[i])
			var k = Dungeon.key(next)
			if dungeon.rooms.has(k) and dungeon.rooms[k].type == "secret" and not dungeon.rooms[k].revealed:
				var centre = door_position(i)
				if player.distance_to(centre)<75 and swing_dir.dot(DIRECTIONS[i])>0.8:
					dungeon.rooms[k].cracks += 1
					burst(centre,Color("b4a28b"),12)
					if dungeon.rooms[k].cracks>=3:
						dungeon.rooms[k].revealed = true
						notify("Камень уступил. Проход открыт.",3)
						save_run()
					else: notify("Из трещины доносится дыхание…",2)

func damage_enemy(enemy: Dictionary, amount: float, origin: Vector2, effects: bool):
	if enemy.hp<=0: return
	enemy.hp -= amount
	enemy.flash = 0.13
	hit_stop = maxf(hit_stop,0.035 if not enemy.boss else 0.055)
	var spray = (Vector2(enemy.x,enemy.y)-origin).normalized()
	for n in range(7):
		emit_particle(Vector2(enemy.x,enemy.y)-Vector2(0,25),Color("a82a32"),spray.rotated(rng.randf_range(-0.6,0.6))*rng.randf_range(70,180),0.4,2+rng.randi_range(0,2))
	for n in range(3):
		blood.append({"x":enemy.x+spray.x*rng.randf_range(10,35),"y":enemy.y+spray.y*rng.randf_range(10,35),"size":rng.randf_range(3,7),"bone":false})
	var p = Vector2(enemy.x,enemy.y)
	var push = (p-origin).normalized()*(4 if enemy.boss else 12)
	p = move_body(p,push,15 if enemy.boss else 10)
	enemy.x = p.x
	enemy.y = p.y
	if effects:
		if has_item("ember"): enemy.burn = 3.0
		if has_item("rot"): enemy.poison = 4.0
		if has_item("frost"): enemy.slow = 2.2
	burst(p,Color("ae3f51"),4)
	if enemy.hp<=0:
		kill_enemy(enemy)

func kill_enemy(enemy: Dictionary):
	if not enemies.has(enemy): return
	var p = Vector2(enemy.x,enemy.y)
	var spray_dir = (p-player).normalized()
	corpses.append({"type":enemy.type,"x":p.x,"y":p.y,"dx":spray_dir.x,"dy":spray_dir.y,"age":0.0})
	if corpses.size()>24: corpses.pop_front()
	hit_stop = 0.07
	enemies.erase(enemy)
	kills += 1
	shake = 2 if not enemy.boss else 7
	for i in range(5 if not enemy.boss else 15):
		blood.append({"x":p.x+rng.randf_range(-19,19),"y":p.y+rng.randf_range(-10,12),"size":rng.randf_range(5,15),"bone":i%4==0})
	if blood.size()>160: blood = blood.slice(blood.size()-160)
	burst(p,Color("bd5260"),20 if not enemy.boss else 50)
	if rng.randf()<0.65 or enemy.boss:
		add_drop("coin",p,1 if not enemy.boss else 7)
	if has_item("leech") and rng.randf()<0.24: heal(0.5)
	if has_item("harvest"):
		zones.append({"x":p.x,"y":p.y,"radius":65.0,"timer":0.15,"kind":"echo","damage":5.0})
	if has_item("void"):
		for other in enemies:
			other.slow = maxf(float(other.slow),1.0)
	if enemy.boss:
		var unlock = "boss"+str(floor_index+1) if floor_index<3 else "victory"
		unlock_content(unlock)
		add_drop("item",Vector2(384,210),1,choose_item())

func update_enemies(dt: float):
	for enemy in enemies.duplicate():
		if not enemies.has(enemy): continue
		var p = Vector2(enemy.x,enemy.y)
		var to = player-p
		var dist = to.length()
		enemy.flash = maxf(0,float(enemy.flash)-dt)
		for status in ["burn","poison","slow"]:
			enemy[status] = maxf(0,float(enemy[status])-dt)
		enemy.tick += dt
		if float(enemy.tick)>0.5:
			enemy.tick = 0.0
			if enemy.burn>0 or enemy.poison>0:
				damage_enemy(enemy,(1.5 if enemy.burn>0 else 0)+(1.0 if enemy.poison>0 else 0),p,false)
				if not enemies.has(enemy): continue
		enemy.timer -= dt
		enemy.state_time += dt
		var slow = 0.48 if enemy.slow>0 else 1.0
		if enemy.boss:
			update_boss(enemy,dt,slow)
			continue
		var speed = {"guard":55,"shadow":85,"skeleton":47,"assassin":78,"mage":37}[enemy.type]*(1+floor_index*0.08)*slow
		if enemy.state == "windup":
			if enemy.state_time>0.52:
				enemy.state = "strike"
				enemy.state_time = 0.0
				if enemy.type in ["skeleton","mage"]:
					var dir = Vector2(enemy.dx,enemy.dy)
					for angle in ([-0.24,0.0,0.24] if enemy.type=="mage" else [0.0]):
						fire_bullet(p,dir.rotated(angle)*145,1.5,"enemy",4)
				elif enemy.type == "shadow":
					zones.append({"x":p.x,"y":p.y,"radius":44.0,"timer":0.1,"kind":"hostile","damage":2.0})
		elif enemy.state == "strike":
			if enemy.type in ["guard","assassin"]:
				p = move_body(p,Vector2(enemy.dx,enemy.dy)*dt*(310 if enemy.type=="assassin" else 185),10)
				if p.distance_to(player)<25: hurt(2.0,p)
			if enemy.state_time>0.25:
				enemy.state = "recover"
				enemy.state_time = 0.0
		elif enemy.state == "recover":
			if enemy.state_time>0.6:
				enemy.state = "chase"
				enemy.timer = rng.randf_range(0.6,1.6)
		else:
			var dir = to.normalized()
			if enemy.type in ["mage","skeleton"]:
				if dist<145: dir = -dir
				elif dist<210: dir = dir.rotated(1.4)*0.4
			# Local separation keeps groups readable without costly pathfinding.
			for other in enemies:
				if other == enemy: continue
				var away = p-Vector2(other.x,other.y)
				if away.length()<24 and away.length()>0.1: dir += away.normalized()*0.9
			p = steer_move(p,dir.normalized()*speed*dt,10)
			if enemy.timer<=0 and (dist<100 or enemy.type in ["skeleton","mage"]):
				enemy.state = "windup"
				enemy.state_time = 0.0
				enemy.dx = to.normalized().x
				enemy.dy = to.normalized().y
			if dist<18 and enemy.type=="shadow": hurt(1.0,p)
		enemy.x = p.x
		enemy.y = p.y

func steer_move(p: Vector2, by: Vector2, radius: float) -> Vector2:
	var next = move_body(p,by,radius)
	if next.distance_to(p)<by.length()*0.25:
		next = move_body(p,by.rotated(PI/2),radius)
	return next

func update_boss(enemy: Dictionary, dt: float, slow: float):
	var p = Vector2(enemy.x,enemy.y)
	var to = player-p
	var enraged = enemy.hp < enemy.max*0.45
	var index = int(enemy.type.trim_prefix("boss"))
	if enemy.state == "windup":
		if enemy.state_time>0.85:
			enemy.state = "strike"
			enemy.state_time = 0.0
			match index:
				0:
					for a in range(8 if not enraged else 12):
						var angle = a*TAU/(8 if not enraged else 12)
						fire_bullet(p,Vector2.from_angle(angle)*115,2,"enemy",4)
				1:
					for offset in [-1,0,1]:
						var spot = player+Vector2(offset*65,0)
						zones.append({"x":spot.x,"y":spot.y,"radius":40.0,"timer":0.8,"kind":"blast","damage":2.0})
				2:
					for a in range(10):
						fire_bullet(p,Vector2.from_angle(a*TAU/10+anim)*100,2,"rot",4)
					if enemies.size()<5: spawn_enemy("shadow",free_spawn(),false)
				3:
					for a in range(14):
						fire_bullet(p,Vector2.from_angle(a*TAU/14)*135,2,"enemy",4)
					zones.append({"x":player.x,"y":player.y,"radius":50.0,"timer":0.9,"kind":"blast","damage":3.0})
	elif enemy.state == "strike":
		if index in [0,3]:
			p = move_body(p,Vector2(enemy.dx,enemy.dy)*dt*250,20)
			if p.distance_to(player)<35: hurt(3,p)
		if enemy.state_time>0.5:
			enemy.state = "recover"
			enemy.state_time = 0
	elif enemy.state == "recover":
		if enemy.state_time>0.85:
			enemy.state = "chase"
			enemy.timer = 0.9 if enraged else 1.6
	else:
		p = steer_move(p,to.normalized()*dt*(40 if index==1 else 58)*slow,20)
		if enemy.timer<=0:
			enemy.state = "windup"
			enemy.state_time = 0
			enemy.dx = to.normalized().x
			enemy.dy = to.normalized().y
	enemy.x = p.x
	enemy.y = p.y

func fire_bullet(p: Vector2, velocity: Vector2, damage: float, type: String, life: float):
	bullets.append({"x":p.x,"y":p.y,"vx":velocity.x,"vy":velocity.y,"damage":damage,"type":type,"life":life})

func update_bullets(dt: float):
	for b in bullets.duplicate():
		b.life -= dt
		b.x += b.vx*dt
		b.y += b.vy*dt
		var p = Vector2(b.x,b.y)
		if b.life<=0 or blocked(p,2):
			bullets.erase(b)
			continue
		if b.type == "ally":
			for enemy in enemies.duplicate():
				if p.distance_to(Vector2(enemy.x,enemy.y))<(23 if enemy.boss else 14):
					damage_enemy(enemy,b.damage,player,true)
					bullets.erase(b)
					break
		elif p.distance_to(player)<12:
			hurt(b.damage,p)
			bullets.erase(b)

func update_zones(dt: float):
	for z in zones.duplicate():
		z.timer -= dt
		if z.timer<=0:
			var p = Vector2(z.x,z.y)
			if z.kind=="echo":
				for enemy in enemies.duplicate():
					if p.distance_to(Vector2(enemy.x,enemy.y))<z.radius:
						damage_enemy(enemy,z.damage,p,false)
				burst(p,Color("b49cda"),12)
			else:
				if p.distance_to(player)<z.radius+8: hurt(z.damage,p)
				burst(p,Color("dd8c64"),18)
			zones.erase(z)

func check_hazards():
	for hazard in hazards:
		if hazard.rect.has_point(player):
			if hazard.type=="fire": hurt(1.0,player)
			if hazard.type=="spikes" and fmod(anim+hazard.phase,2.5)<1.2: hurt(1.5,player)

func hurt(amount: float, origin: Vector2):
	if invincible>0 or mode!="playing": return
	hp = maxf(0,hp-amount)
	pain = minf(100,pain+amount*9)
	invincible = 0.85
	hurt_flash = 0.2
	shake = 5
	player = move_body(player,(player-origin).normalized()*15,9)
	burst(player,Color("bd445a"),12)
	if has_item("thorns"):
		for enemy in enemies.duplicate():
			if Vector2(enemy.x,enemy.y).distance_to(player)<90: damage_enemy(enemy,5,player,false)
	if hp<=0: die()

func heal(amount: float):
	hp = minf(max_hp,hp+amount*(1.0+maxi(0,faith)*0.035))

func die():
	mode = "dead"
	death_elapsed = 0
	profile.deaths += 1
	profile.best = maxi(int(profile.best),floor_index+1)
	end_quote = Catalog.FLOORS[floor_index].thought
	delete_run()
	save_profile()

func clear_room():
	room.clear = true
	rooms_cleared += 1
	charge = mini(3,charge+1)
	pain = maxf(0,pain-5)
	bullets.clear()
	zones.clear()
	if room.type=="boss":
		heal(3)
		notify("Обет разорван. Забери дар и подойди к печати. [E]",5)
	else:
		if rng.randf()<0.24: add_drop("heal",Vector2(384,270),2)
		if rng.randf()<0.28: add_drop("key",Vector2(410,270),1)
		if drops.is_empty(): add_drop("coin",Vector2(384,270),1)
	save_run()

func has_item(id: String) -> bool:
	return id in inventory

func count_item(id: String) -> int:
	return inventory.count(id)

func choose_item() -> String:
	var pool = Catalog.pool(profile.unlocks)
	var fresh = pool.filter(func(id): return id not in inventory and id!=active)
	if fresh.is_empty(): fresh = pool
	return fresh[rng.randi_range(0,fresh.size()-1)]

func add_drop(type: String, p: Vector2, amount: float = 1, id: String = "", price: int = 0):
	drops.append({"type":type,"x":p.x,"y":p.y,"amount":amount,"id":id,"price":price})

func update_drops(_dt: float):
	for drop in drops.duplicate():
		if drop.type=="item" or drop.price>0: continue
		if player.distance_to(Vector2(drop.x,drop.y))<20:
			if drop.type == "heal" and hp>=max_hp: continue
			collect_drop(drop)

func collect_drop(drop: Dictionary):
	match drop.type:
		"coin": coins += int(drop.amount)
		"key": keys += int(drop.amount)
		"heal": heal(drop.amount)
		"item":
			if drop.id in ["vessel","storm"]:
				var old = active
				active = drop.id
				charge = 3
				add_drop("item",Vector2(drop.x+35,drop.y),1,old)
			else:
				inventory.append(drop.id)
			item_popup = drop.id
			popup_time = 4
			if drop.id=="blink": notify("Получен шаг сквозь пустоту. [Shift]",4)
	burst(Vector2(drop.x,drop.y),Color("d4b77e"),12)
	drops.erase(drop)

func interact():
	if not room.clear:
		notify("Сначала заставь комнату замолчать.",2)
		return
	for drop in drops.duplicate():
		if player.distance_to(Vector2(drop.x,drop.y))<47 and (drop.type=="item" or drop.price>0):
			if coins<drop.price:
				notify("Не хватает монет.",2)
				return
			coins -= int(drop.price)
			collect_drop(drop)
			save_run()
			return
	if player.distance_to(CENTRE)>65: return
	if room.type=="boss" and room.clear:
		if floor_index==3:
			mode = "victory"
			profile.wins += 1
			end_quote = "Тебя создали как орудие. Ты ушёл как человек."
			unlock_content("victory")
			delete_run()
			save_profile()
		else:
			floor_index += 1
			new_floor()
			notify(Catalog.FLOORS[floor_index].thought,5)
		return
	if room.used: return
	match room.type:
		"torture":
			if max_hp<=4 or hp<=2:
				notify("Тело больше не выдержит этой цены.",3)
				return
			max_hp -= 2
			hp = minf(hp,max_hp)
			pain = minf(100,pain+30)
			faith = maxi(-6,faith-1)
			room.used = true
			add_drop("item",CENTRE+Vector2(0,45),1,choose_item())
			notify("Два деления плоти отданы навсегда. В этом забеге.",4)
		"oracle":
			# Two opposing altars: left renounces faith, right embraces it.
			faith = clampi(faith+(-2 if player.x<384 else 2),-6,6)
			if player.x<384:
				coins += 5
				notify("Ты отверг ответ. Пять монет и шаг во тьму.",4)
			else:
				heal(3)
				notify("Ты принял ответ. Плоть исцелена, вера крепнет.",4)
			room.used = true
		"reliquary":
			if coins<3:
				notify("Зеркало просит три монеты за новое отражение.",3)
				return
			coins-=3
			for drop in drops:
				if drop.type=="item": drop.id = choose_item()
			room.used = true
			notify("Отражение изменилось.",3)
	save_run()

func use_active():
	if charge<3 or active_cd>0:
		notify("Чаша пуста. Зачисти ещё %d комн." % (3-charge),2)
		return
	if active=="vessel":
		if hp>=max_hp:
			notify("Плоть пока цела.",2)
			return
		heal(4)
		burst(player,Color("d4bd88"),25)
	else:
		for enemy in enemies.duplicate(): damage_enemy(enemy,14,player,true)
		bullets.clear()
		shake = 6
		burst(player,Color("b8b2e4"),40)
	charge = 0
	active_cd = 0.4
	save_run()

func door_position(index: int) -> Vector2:
	return [Vector2(384,180),Vector2(715,268),Vector2(384,426),Vector2(52,268)][index]

func check_doors():
	if not room.clear or transition_cd>0: return
	for i in range(4):
		var next = coords+Vector2i(DIRECTIONS[i])
		var k = Dungeon.key(next)
		if not dungeon.rooms.has(k): continue
		var dest = dungeon.rooms[k]
		if not dest.revealed: continue
		if player.distance_to(door_position(i))<28:
			if not dest.opened:
				if keys<=0:
					notify("Нужен ключ.",2)
					transition_cd = 1
					return
				keys -= 1
				dest.opened = true
			var spawns = [Vector2(384,393),Vector2(80,268),Vector2(384,210),Vector2(688,268)]
			enter_room(next,spawns[i])
			return

func interaction_text() -> String:
	if not room.clear: return "ДВЕРИ ЗАПЕЧАТАНЫ"
	for drop in drops:
		if (drop.type=="item" or drop.price>0) and player.distance_to(Vector2(drop.x,drop.y))<47:
			var name = Catalog.item(drop.id).name if drop.type=="item" else ("Лечение" if drop.type=="heal" else "Ключ")
			return "[E] "+name+("  ·  %d монет"%drop.price if drop.price>0 else "")
	if player.distance_to(CENTRE)<65:
		if room.type=="boss": return "[E] "+("РАЗОРВАТЬ ПОСЛЕДНИЙ ОБЕТ" if floor_index==3 else "СПУСТИТЬСЯ ГЛУБЖЕ")
		if not room.used:
			match room.type:
				"torture": return "[E] ДАР ЗА 2 МАКСИМАЛЬНОЙ ПЛОТИ"
				"oracle": return "[E] "+("ОТВЕРГНУТЬ: −2 ВЕРЫ, +5 МОНЕТ" if player.x<384 else "ПРИНЯТЬ: +2 ВЕРЫ, ЛЕЧЕНИЕ")
				"reliquary": return "[E] ЗАМЕНИТЬ ДАР  ·  3 МОНЕТЫ"
	return ""

func notify(text: String, duration: float = 3):
	message = text
	message_time = duration

func emit_particle(p: Vector2, color: Color, velocity: Vector2, life: float, size: float):
	particles.append({"x":p.x,"y":p.y,"vx":velocity.x,"vy":velocity.y,"life":life,"max":life,"size":size,"color":color})

func burst(p: Vector2, color: Color, count: int):
	for i in range(count):
		emit_particle(p,color,Vector2.from_angle(rng.randf()*TAU)*rng.randf_range(20,100),rng.randf_range(0.2,0.6),rng.randf_range(2,4))

func update_particles(dt: float):
	for p in particles.duplicate():
		p.life -= dt
		p.x += p.vx*dt
		p.y += p.vy*dt
		p.vx *= 1.0-dt*5
		p.vy *= 1.0-dt*5
		if p.life<=0: particles.erase(p)
	if particles.size()>400: particles = particles.slice(particles.size()-400)

func unlock_content(id: String):
	if id not in profile.unlocks:
		profile.unlocks.append(id)
		save_profile()
		if id=="boss1": notify("Открыты Отступник и новый предмет для будущих забегов.",5)

func load_profile():
	if FileAccess.file_exists(profile_path):
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(profile_path))
		if parsed is Dictionary and parsed.get("unlocks") is Array:
			profile.merge(parsed,true)

func save_profile():
	var f = FileAccess.open(profile_path,FileAccess.WRITE)
	if f: f.store_string(JSON.stringify(profile))

func save_run():
	if dungeon.is_empty() or mode in ["dead","victory"]: return
	store_room()
	var data = {"version":1,"seed":seed_value,"rng_state":str(rng.state),"floor":floor_index,
		"dungeon":dungeon,"coords":[coords.x,coords.y],"player":[player.x,player.y],"facing":[facing.x,facing.y],
		"hp":hp,"max_hp":max_hp,"pain":pain,"coins":coins,"keys":keys,"faith":faith,"inventory":inventory,
		"active":active,"charge":charge,"elapsed":elapsed,"kills":kills,"rooms":rooms_cleared,"character":character,
		"bullets":bullets,"zones":zones,"invincible":invincible,"dash_cd":dash_cd,"attack_cd":attack_cd}
	# Replace only after a complete write, preserving the previous checkpoint on failure.
	var f = FileAccess.open(save_path+".tmp",FileAccess.WRITE)
	if not f:
		notify("Не удалось сохранить забег: проверь доступ к папке сохранений.",5)
		return
	f.store_string(JSON.stringify(data))
	f.flush()
	f.close()
	var err = DirAccess.rename_absolute(save_path+".tmp",save_path)
	if err!=OK: notify("Ошибка записи сохранения: "+str(err),5)

func load_run() -> bool:
	if not FileAccess.file_exists(save_path): return false
	var data = JSON.parse_string(FileAccess.get_file_as_string(save_path))
	if not data is Dictionary or data.get("version",0)!=1 or not data.has("dungeon"):
		notify("Сохранение не читается. Можно начать новый забег.",5)
		return false
	for field in ["hp","max_hp","pain","coins","keys","faith","inventory","active","charge","elapsed","kills","character"]:
		set(field,data[field])
	seed_value = int(data.seed)
	rng.seed = seed_value
	rng.state = int(data.rng_state)
	floor_index = int(data.floor)
	dungeon = data.dungeon
	coords = Vector2i(int(data.coords[0]),int(data.coords[1]))
	rooms_cleared = int(data.rooms)
	var position = Vector2(data.player[0],data.player[1])
	enter_room(coords,position,false)
	facing = Vector2(data.facing[0],data.facing[1])
	bullets = data.get("bullets",[])
	zones = data.get("zones",[])
	invincible = float(data.get("invincible",0.0))
	dash_cd = float(data.get("dash_cd",0.0))
	attack_cd = float(data.get("attack_cd",0.0))
	windup = 0
	swing = 0
	dash_time = 0
	help_open = false
	journal_open = false
	mode = "playing"
	notify("Тело помнит, где ты остановился.",3)
	save_run()
	return true

func delete_run():
	if FileAccess.file_exists(save_path): DirAccess.remove_absolute(save_path)

func _draw():
	View.render(self)
