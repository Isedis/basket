extends Node2D

const BossFight = preload("res://scripts/boss_fight.gd")
const EnemyPose = preload("res://scripts/enemy_pose.gd")
const Hazards = preload("res://scripts/hazard_view.gd")
const RoomLayout = preload("res://scripts/castle_layout.gd")
const DoorMotion = preload("res://scripts/door_motion.gd")
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
const Catalog = preload("res://scripts/catalog.gd")
const Dungeon = preload("res://scripts/dungeon.gd")
const View = preload("res://scripts/view.gd")
var save_path = "user://run_v1.json"
var profile_path = "user://profile_v1.json"
const DIRECTIONS = [Vector2.UP, Vector2.RIGHT, Vector2.DOWN, Vector2.LEFT]
var CENTRE = Vector2(384,268)
const ENEMY_NAMES = ["guard", "shadow", "skeleton", "assassin", "mage"]

var font = preload("res://assets/regular.ttf")
var bold = preload("res://assets/bold.ttf")
var pixel_font = preload("res://assets/pixel.ttf")
var castle_art: Texture2D
var corpses: Array = []
var hit_stop = 0.0
var death_elapsed = 0.0
var art_probe_active = false
var boss_practice = false
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
var player_motion: Dictionary = {}
var attack_contact_pending = false
var swing_duration = 0.22
var attack_serial = 0
var attack_facing = 1.0
var attack_look = 1
var attack_buffer = Vector2.ZERO
var attack_buffer_time = 0.0
var player_knockback = Vector2.ZERO
var player_stagger = 0.0
var player_recoil_direction = Vector2.ZERO
var shake_axis = Vector2.RIGHT
var debug_combat = false
var melee_contacts: Array = []
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
var room_floor_rect = Rect2(48,168,1152,640)
var room_torches: Array = [Vector2(248,142),Vector2(520,142)]
var room_props: Array = []
var room_ports: Array = []
var camera_position = Vector2.ZERO
var door_visuals: Array = []
var room_camera = Vector2.ZERO
var authored_room = false
var room_wall_texture: Texture2D
var room_texture: Texture2D
var world_viewport: SubViewport

func _ready():
	updater = preload("res://scripts/updater.gd").new()
	add_child(updater)
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	pixel_font.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	var castle_image = preload("res://assets/castle_room.png").get_image()
	castle_image.resize(352,182,Image.INTERPOLATE_NEAREST)
	castle_art = ImageTexture.create_from_image(castle_image)
	world_viewport = SubViewport.new()
	world_viewport.name = "PixelWorld"
	world_viewport.size = Vector2i(352,182)
	world_viewport.disable_3d = true
	world_viewport.transparent_bg = true
	world_viewport.gui_disable_input = true
	world_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(world_viewport)
	var painter = preload("res://scripts/pixel_world.gd").new()
	painter.state = self
	painter.scale = Vector2(0.5,0.5)
	painter.position = Vector2(-16,-42)
	painter.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	world_viewport.add_child(painter)
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

func _exit_tree():
	BossFight.stop_sounds(self)

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
		if art_probe_active and event.keycode==KEY_R and mode in ["playing","dead","victory"]:
			start_boss_round(has_item("heavy")) if boss_practice else start_practice_round(has_item("heavy"))
			return
		if art_probe_active and event.keycode==KEY_Q and mode=="playing":
			toggle_practice_weapon()
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
			for binding in [["hit_up",Vector2.UP],["hit_down",Vector2.DOWN],["hit_left",Vector2.LEFT],["hit_right",Vector2.RIGHT]]:
				if event.is_action_pressed(binding[0]): queue_attack(binding[1])
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
		arr.append({"rect":Rect2(420,478,300,30),"text":"ИСПЫТАТЬ БОССА", "action":"boss_probe"})
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
			if not art_probe_active:
				original_save_path = save_path
				original_profile_path = profile_path
				original_profile = profile.duplicate(true)
				save_path += ".art-probe"
				profile_path += ".art-probe"
				art_probe_active = true
			start_practice_round()
		"boss_probe":
			menu_action("art_probe")
			start_boss_round()
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

func start_practice_round(use_heavy: bool = false):
	boss_practice = false
	if not art_probe_active: return
	new_run()
	if use_heavy: inventory.append("heavy")
	place_player(CENTRE+Vector2(-110,40),Vector2.RIGHT)
	invincible = 0
	spawn_enemy("guard",CENTRE+Vector2(24,35),false)
	spawn_enemy("assassin",CENTRE+Vector2(164,10),false)
	spawn_enemy("skeleton",Vector2(840,232),false)
	spawn_enemy("shadow",Vector2(1100,610),false)
	spawn_enemy("mage",Vector2(160,300),false)
	room.clear = false
	notify("WASD — шаг, стрелки — удар. Q — оружие, R — заново.",5)
	save_run()

func start_boss_round(use_heavy: bool = false):
	if not art_probe_active: return
	boss_practice = true
	new_run(711)
	if use_heavy: inventory.append("heavy")
	for r in dungeon.rooms.values():
		if r.type=="boss":
			enter_room(Vector2i(int(r.x),int(r.y)),Vector2.INF)
			break
	place_player(CENTRE+Vector2(0,110),Vector2.UP)
	invincible = 0
	notify("Колокольный палач. R — повторить, Q — сменить тесак.",4)
	save_run()

func toggle_practice_weapon() -> bool:
	if not art_probe_active or mode!="playing": return false
	if windup>0 or swing>0:
		notify("Сначала закончи удар.",1)
		return false
	if has_item("heavy"): inventory = inventory.filter(func(id): return id!="heavy")
	else: inventory.append("heavy")
	notify("Тяжёлый тесак" if has_item("heavy") else "Тесак",2)
	save_run()
	return true

func leave_art_probe():
	if not art_probe_active: return
	BossFight.stop_sounds(self)
	delete_run()
	if FileAccess.file_exists(profile_path): DirAccess.remove_absolute(profile_path)
	save_path = original_save_path
	profile_path = original_profile_path
	profile = original_profile.duplicate(true)
	art_probe_active = false
	boss_practice = false

func new_run(fixed_seed: int = -1):
	BossFight.stop_sounds(self)
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
	attack_serial = 0
	swing_duration = 0.22
	attack_facing = 1.0
	attack_look = 0
	facing = Vector2.DOWN
	melee_contacts.clear()
	hit_stop = 0
	player_motion = {}
	attack_contact_pending = false
	attack_buffer_time = 0
	player_knockback = Vector2.ZERO
	player_stagger = 0
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
	enter_room(coords,Vector2.INF,false)

func place_player(position: Vector2, look_direction: Vector2 = Vector2.ZERO):
	player = position
	if look_direction!=Vector2.ZERO: facing = look_direction
	var look = Motion.direction_index(facing,Motion.look_index(player_motion,facing))
	var side = signf(facing.x) if absf(facing.x)>0.1 else float(player_motion.get("facing",1.0))
	player_motion = Motion.initialize(player,side,look)
	player_knockback = Vector2.ZERO
	player_stagger = 0

func enter_room(where: Vector2i, spawn: Vector2, store: bool = true):
	if store and not room.is_empty():
		store_room()
	coords = where
	var anchor = Dungeon.owner(dungeon,where)
	if anchor.is_empty(): return
	room = dungeon.rooms[anchor]
	coords = Vector2i(int(room.x),int(room.y))
	RoomLayout.configure(self)
	room.visited = true
	if not room.has("corpses"): room.corpses = []
	corpses = room.corpses.duplicate(true)
	player = CENTRE+Vector2(0,48) if spawn==Vector2.INF else spawn
	player_motion = {}
	attack_contact_pending = false
	enemies = room.enemies.duplicate(true)
	for e in enemies:
		var direction = Vector2(e.dx,e.dy)
		if not e.has("motion"):
			e.motion = Motion.initialize(Vector2(e.x,e.y),1.0 if direction.x>=0 else -1.0,Motion.direction_index(direction))
		elif not e.motion.has("look"):
			if e.state=="chase" and Vector2(e.motion.get("vx",0),e.motion.get("vy",0)).length_squared()>0.001:
				direction = Vector2(e.motion.vx,e.motion.vy)
			Motion.set_look(e.motion,direction)
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
		for candidate in [CENTRE,CENTRE+Vector2(0,64),CENTRE-Vector2(0,96),Vector2(128,CENTRE.y),Vector2(room_floor_rect.end.x-128,CENTRE.y)]:
			if not blocked(candidate,9):
				player = candidate
				break
	place_player(player,facing)
	for enemy in enemies:
		var old = Vector2(enemy.x,enemy.y)
		var recovered = safe_position(old,15)
		enemy.x = recovered.x
		enemy.y = recovered.y
		Motion.shift(enemy.get("motion",{}),recovered-old)
	if not room.spawned:
		room.spawned = true
		populate_room()
	make_floor_texture()
	DoorMotion.reset(self)
	camera_position = desired_camera()
	room_camera = camera_position.snapped(Vector2(2,2))
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
	RoomLayout.setup(self)
	RoomLayout.special(self)

func safe_position(p: Vector2, radius: float) -> Vector2:
	if not blocked(p,radius): return p
	for ring in range(1,13):
		for step in range(16):
			var candidate = p+Vector2.from_angle(step*TAU/16)*ring*12
			if not blocked(candidate,radius): return candidate
	return CENTRE

func desired_camera() -> Vector2:
	for e in enemies:
		if e.type!="boss0": continue
		var low = minf(player.y-72,e.y-170)-12
		var high = maxf(player.y+12,e.y+12)+12
		var y = clampf((low+high)*0.5-266,player.y-410,player.y-170)
		var x = clampf((player.x+e.x)*0.5-384,player.x-650,player.x-110)
		return Vector2(clampf(x,0,maxf(0,room_floor_rect.size.x-672)),clampf(y,0,maxf(0,room_floor_rect.size.y-264)))
	return Vector2(clampf(player.x-384,0,maxf(0,room_floor_rect.size.x-672)),clampf(player.y-300,0,maxf(0,room_floor_rect.size.y-264)))

func make_floor_texture():
	var materials = preload("res://scripts/castle_view.gd").room_materials(int(room.seed),floor_index,room_floor_rect,room_torches)
	room_texture = materials[0]
	room_wall_texture = materials[1]

func populate_room():
	match room.type:
		"combat":
			var n = rng.randi_range(3,4)+floor_index+2*(Dungeon.span(room).x*Dungeon.span(room).y-1)
			for i in range(n):
				spawn_enemy(ENEMY_NAMES[rng.randi_range(0,mini(4,2+floor_index))],free_spawn(),false)
		"boss": spawn_enemy("boss"+str(floor_index),CENTRE-Vector2(0,24 if floor_index==0 else 116),true)
		"treasure","reliquary","secret":
			room.clear = true
			var count_items = 2 if room.type == "secret" else 1
			for i in range(count_items):
				add_drop("item",CENTRE+Vector2(-34+i*68,-8),1,choose_item())
			if room.type == "secret":
				add_drop("key",CENTRE+Vector2(0,42),1)
		"shop":
			room.clear = true
			add_drop("item",CENTRE+Vector2(-54,-18),1,choose_item(),8+floor_index*2)
			add_drop("heal",CENTRE+Vector2(54,-18),4,"",4)
			add_drop("key",CENTRE+Vector2(0,52),1,"",3)
		_ : room.clear = true

func free_spawn() -> Vector2:
	for attempt in range(100):
		var p = Vector2(rng.randf_range(room_floor_rect.position.x+80,room_floor_rect.end.x-80),rng.randf_range(224,room_floor_rect.end.y-64))
		if p.distance_to(player)>160 and not blocked(p,18): return p
	return safe_position(CENTRE,18)

func spawn_enemy(type: String, p: Vector2, boss: bool):
	var health = (65.0+floor_index*32) if boss else (9.0+floor_index*4)
	if type == "shadow": health *= 0.7
	if type == "guard": health *= 1.35
	enemies.append({"type":type,"x":p.x,"y":p.y,"hp":health,"max":health,"boss":boss,
		"timer":rng.randf_range(0.5,1.7),"state":"chase","state_time":0.0,"dx":0.0,"dy":1.0,
		"flash":0.0,"burn":0.0,"poison":0.0,"slow":0.0,"tick":0.0,"phase":0})
	if type=="boss0":
		var e = enemies.back()
		e.hp = 165.0
		e.max = 165.0
		e.state = "intro"
		e.motion = Motion.initialize(p,1,0)
		BossFight.ensure(e)

func _process(delta):
	if mode == "title" and art_probe_active: leave_art_probe()
	anim += delta
	if mode == "dead": death_elapsed += delta
	menu_hover = -1
	var buttons = menu_buttons()
	for i in range(buttons.size()):
		if buttons[i].rect.has_point(get_global_mouse_position()): menu_hover = i
	if mode == "playing" and not help_open:
		advance_frame(delta)
	if not room.is_empty() and mode not in ["title","confirm_new"]:
		camera_position = camera_position.lerp(desired_camera(),1-exp(-delta*8))
		room_camera = camera_position.snapped(Vector2(2,2))
	queue_redraw()

func advance_frame(delta: float):
	var remaining = maxf(0,delta)
	if hit_stop>0:
		var frozen = minf(hit_stop,remaining)
		hit_stop -= frozen
		remaining -= frozen
	if remaining>0:
		update_game(minf(remaining,0.04))
		DoorMotion.advance(self,minf(remaining,0.04))

func update_game(dt: float):
	elapsed += dt
	if player_motion.has("impact_age"): player_motion.impact_age = minf(1,float(player_motion.impact_age)+dt)
	for c in corpses:
		c.age = minf(1.0,c.age+dt)
		var velocity = Vector2(c.get("vx",0),c.get("vy",0))
		if velocity.length_squared()>0.1:
			var decay = exp(-12*dt)
			var old = Vector2(c.x,c.y)
			var next = move_body(old,velocity*(1-decay)/12,9)
			Motion.shift(c.get("motion",{}),next-old)
			c.x = next.x
			c.y = next.y
			c.vx = velocity.x*decay
			c.vy = velocity.y*decay
	for contact in melee_contacts.duplicate():
		contact.life -= dt
		if contact.life<=0: melee_contacts.erase(contact)
	save_time += dt
	for prop in ["attack_cd","invincible","dash_cd","active_cd","transition_cd","message_time","popup_time","hurt_flash"]:
		set(prop,maxf(0.0,float(get(prop))-dt))
	shake = move_toward(shake,0,dt*20)
	pain = maxf(0,pain-dt*0.18)
	attack_buffer_time = maxf(0,attack_buffer_time-dt)
	player_stagger = maxf(0,player_stagger-dt)
	if player_knockback.length_squared()>0.1:
		var decay = exp(-12*dt)
		var before = player
		player = move_body(player,player_knockback*(1-decay)/12,9)
		Motion.shift(player_motion,player-before)
		player_knockback *= decay
	moving = false
	var previous_player = player
	var movement = Input.get_vector("left","right","up","down")
	var speed = 154.0*(1.0+count_item("haste")*0.15)
	for hazard in hazards:
		speed *= Hazards.speed_factor(hazard,player)
	var mass = float(player_motion.get("attack_weight",1.0))
	if windup>0: speed *= maxf(0.4,0.68-(mass-1)*0.3)
	elif swing>0:
		var u = 1-swing/swing_duration
		speed *= lerpf(maxf(0.24,0.4-(mass-1)*0.16),1,Combat.curve((u-Combat.ACTIVE_END)/(1-Combat.ACTIVE_END)))
	if player_stagger>0: speed *= 0.4
	var was_dashing = dash_time>0
	if was_dashing:
		dash_time -= dt
		movement = dash_dir
		speed = 560
		emit_particle(player,Color("8ca9cd"),Vector2.ZERO,0.23,9)
	if movement.length()>0:
		if absf(movement.x)>absf(movement.y): facing = Vector2(signf(movement.x),0)
		else: facing = Vector2(0,signf(movement.y))
		player = move_player(movement*speed*dt)
	if not was_dashing and (windup>0 or swing>0):
		var available = maxf(0,dt-windup) if windup>0 else dt
		var from = 1-swing/swing_duration if swing>0 else 0.0
		var to = minf(1,from+available/swing_duration)
		var step = (Combat.step_progress(to)-Combat.step_progress(from))*(5+(mass-1)*4)
		if step>0: player = move_player(swing_dir*step)
	player_motion = Motion.update(player_motion,previous_player,player,dt)
	moving = player_motion.moving
	if windup>0 or swing>0:
		player_motion.facing = attack_facing
		player_motion.look = attack_look
	elif movement.length_squared()>0:
		Motion.set_look(player_motion,movement)
	var aim = Vector2.ZERO
	for pair in [["hit_up",Vector2.UP],["hit_down",Vector2.DOWN],["hit_left",Vector2.LEFT],["hit_right",Vector2.RIGHT]]:
		if Input.is_action_pressed(pair[0]): aim = pair[1]
	if aim != Vector2.ZERO: queue_attack(aim)
	if attack_buffer_time>0 and attack_cd<=0 and windup<=0 and swing<=0 and player_stagger<=0:
		begin_attack(attack_buffer)
		attack_buffer_time = 0
	advance_player_attack(dt,previous_player)
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
	if p.x<room_floor_rect.position.x+2+radius or p.x>room_floor_rect.end.x-2-radius or p.y<176+radius or p.y>room_floor_rect.end.y-7-radius:
		return true
	for block in blocks:
		if block.grow(radius).has_point(p): return true
	for hazard in hazards:
		if Hazards.blocks(hazard,p,radius): return true
	return false

func move_body(p: Vector2, by: Vector2, radius: float) -> Vector2:
	# Axis separation and small steps prevent tunnelling during dashes.
	var steps = maxi(1,int(ceil(by.length()/5.0)))
	var step = by/steps
	for i in range(steps):
		if not blocked(p+Vector2(step.x,0),radius): p.x+=step.x
		if not blocked(p+Vector2(0,step.y),radius): p.y+=step.y
	return p

func move_player(by: Vector2) -> Vector2:
	var p = player
	var steps = maxi(1,int(ceil(by.length()/4.0)))
	for i in range(steps):
		var step = by/steps
		for axis in [Vector2(step.x,0),Vector2(0,step.y)]:
			var next = move_body(p,axis,9)
			var accepted = true
			for enemy in enemies:
				var e = Vector2(enemy.x,enemy.y)
				var minimum = 42.0 if enemy.boss else 30.0
				if next.distance_to(e)<minimum and next.distance_to(e)<p.distance_to(e):
					accepted = false
					break
			if accepted: p = next
	return p

func queue_attack(direction: Vector2):
	attack_buffer = direction
	attack_buffer_time = 0.12

func begin_attack(direction: Vector2):
	swing_dir = direction
	facing = direction
	attack_facing = signf(direction.x) if absf(direction.x)>0.1 else float(player_motion.get("facing",1.0))
	attack_look = Motion.direction_index(direction,Motion.look_index(player_motion))
	if not player_motion.is_empty():
		player_motion.facing = attack_facing
		player_motion.look = attack_look
	var attack_speed = 1.0+count_item("haste")*0.27
	combo = (combo+1)%3
	var heavy = mini(3,count_item("heavy"))
	var finisher = combo==0
	player_motion.attack_weight = 1.0+heavy*0.28+(0.22 if finisher else 0.0)
	player_motion.impact_age = 1.0
	swing_windup = (0.14+heavy*0.07+(0.03 if finisher else 0.0))/attack_speed
	swing_duration = (0.28+heavy*0.08+(0.04 if finisher else 0.0))/attack_speed
	windup = swing_windup
	attack_cd = swing_windup+swing_duration+0.04/attack_speed
	attack_serial += 1

func advance_player_attack(dt: float, previous_position: Vector2 = Vector2.INF):
	var remaining = dt
	if windup>0:
		var used = minf(windup,remaining)
		windup -= used
		remaining -= used
		if windup<=0.000001:
			windup = 0
			swing = swing_duration
			attack_contact_pending = true
	if swing>0 and remaining>0:
		var start = 1-swing/swing_duration
		swing = maxf(0,swing-remaining)
		var end = 1-swing/swing_duration
		if attack_contact_pending and end>=Combat.CONTACT_RATIO-0.00001:
			perform_attack(false)
		if end>=Combat.CONTACT_RATIO and start<=Combat.ACTIVE_END:
			resolve_player_sweep(maxf(start,Combat.CONTACT_RATIO),minf(end,Combat.ACTIVE_END),player if previous_position==Vector2.INF else previous_position)

func resolve_player_sweep(start: float, end: float, previous_position: Vector2):
	if end<start: return
	for enemy in enemies.duplicate():
		if int(enemy.get("last_player_swing",-1))==attack_serial: continue
		var e = Vector2(enemy.x,enemy.y)
		if Combat.occluded(player,e,blocks): continue
		var hit = Combat.swept_hit(previous_position,player,player_motion,swing_dir,start,end,Combat.hurt_capsule(e,enemy.type,enemy.boss),attack_range(),elapsed)
		if hit.hit:
			enemy.last_player_swing = attack_serial
			var strength = 1.0+count_item("heavy")*0.7+(0.4 if combo==0 else 0.0)
			player_motion.impact_age = 0.0
			player_motion.impact_power = minf(2.2,strength)
			damage_enemy(enemy,attack_damage(),player,true,strength,swing_dir,hit.point)
			melee_contacts.append({"point":hit.point,"life":0.14,"axis":swing_dir,"power":minf(2.2,strength),"armored":enemy.type=="guard"})

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

func perform_attack(reset_swing: bool = true):
	if reset_swing:
		attack_serial += 1
		swing = swing_duration*(1-Combat.CONTACT_RATIO)
		resolve_player_sweep(Combat.CONTACT_RATIO,Combat.CONTACT_RATIO,player)
	attack_contact_pending = false
	if has_item("bloodwave"):
		fire_bullet(player+swing_dir*16,swing_dir*235,3.5,"ally",1.6)
	if has_item("echo"):
		zones.append({"x":player.x+swing_dir.x*38,"y":player.y+swing_dir.y*38,"radius":40.0,"timer":0.23,"kind":"echo","damage":attack_damage()*0.7})
	# Secret entrances are tied to exterior ports, including the second cell of a hall.
	if room.clear:
		for i in range(room_ports.size()):
			var dest = door_destination(i)
			if dest.get("type")=="secret" and not dest.revealed:
				var centre = door_position(i)
				if player.distance_to(centre)<75 and swing_dir.dot(DIRECTIONS[door_direction(i)])>0.8:
					dest.cracks += 1
					burst(centre,Color("b4a28b"),12)
					if dest.cracks>=3:
						dest.revealed = true
						notify("Камень уступил. Проход открыт.",3)
						save_run()
					else: notify("Из трещины доносится дыхание…",2)

func enemy_weapon_angle(enemy: Dictionary) -> float:
	var action = 0
	var progress = 0.0
	if enemy.state=="windup":
		action = 2
		progress = enemy.state_time/0.52
	elif enemy.state=="strike":
		action = 3
		progress = enemy.state_time/0.25
	var motion = enemy.get("motion",{})
	var direction = Vector2(enemy.dx,enemy.dy)
	var current = Combat.weapon_pose(Vector2(enemy.x,enemy.y),motion,direction,action,progress).angle
	if enemy.state=="stagger":
		var u = 1-float(enemy.get("stagger",0))/maxf(0.001,float(enemy.get("stagger_total",0.2)))
		current = lerp_angle(float(enemy.get("stagger_angle",current)),Combat.weapon_angle(direction,0,0,Motion.hand_sign(Motion.look_index(motion,direction))),Combat.curve(u))
	return current

func damage_enemy(enemy: Dictionary, amount: float, origin: Vector2, effects: bool, impact: float = -1, impact_direction: Vector2 = Vector2.ZERO, hit_point: Vector2 = Vector2.INF):
	if enemy.hp<=0: return
	if enemy.type=="boss0" and enemy.state in ["intro","fracture"]: return
	if impact<0: impact = 1.0 if effects else 0.0
	if enemy.type in EnemyPose.TYPES and enemy.hp<=amount:
		var snapshot = enemy.get("motion",{}).duplicate(true)
		snapshot.death_action = 2 if enemy.state=="windup" else (3 if enemy.state=="strike" else 0)
		snapshot.death_progress = clampf(enemy.state_time/(0.52 if enemy.state=="windup" else 0.25),0,1)
		snapshot.death_dx = enemy.dx
		snapshot.death_dy = enemy.dy
		snapshot.death_clock = elapsed
		enemy.motion = snapshot
	var p = Vector2(enemy.x,enemy.y)
	var wound_color = Color("b3a282") if enemy.type=="skeleton" else (Color("44676a") if enemy.type=="shadow" else Color("a82a32"))
	var spray = impact_direction if impact_direction!=Vector2.ZERO else (p-origin).normalized()
	var point = hit_point if hit_point!=Vector2.INF else p-Vector2(0,34)
	enemy.hp -= amount
	enemy.flash = 0.10 if impact>0 else 0.04
	enemy.last_impact = impact
	if impact>0:
		hit_stop = maxf(hit_stop,minf(0.085,0.034+impact*0.016))
		shake = maxf(shake,minf(4,impact*1.5))
		shake_axis = spray
		var resistance = 0.2 if enemy.boss else 1.0
		enemy.knock_x = float(enemy.get("knock_x",0))+spray.x*190*impact*resistance
		enemy.knock_y = float(enemy.get("knock_y",0))+spray.y*190*impact*resistance
		var threshold = 1.25 if enemy.type=="guard" else 0.9
		if not enemy.boss and (impact>=threshold or enemy.state not in ["windup","strike"]):
			var previous_angle = enemy_weapon_angle(enemy)
			enemy.state = "stagger"
			enemy.state_time = 0.0
			enemy.stagger_total = minf(0.30,0.10+impact*0.055)
			enemy.stagger = enemy.stagger_total
			enemy.stagger_angle = previous_angle
			enemy.stagger_dir_x = -spray.x
			enemy.stagger_dir_y = -spray.y
	if enemy.type=="guard" and enemy.state=="windup" and impact>0 and impact<1.25:
		for n in range(5):
			emit_particle(point,Color("d9bd80"),spray.rotated(rng.randf_range(-1.0,1.0))*rng.randf_range(80,150),0.16,2)
	for n in range(int(6+impact*4) if impact>0 else 2):
		emit_particle(point,wound_color,spray.rotated(rng.randf_range(-0.6,0.6))*rng.randf_range(70,180),0.4,2+rng.randi_range(0,2))
	for n in range(3 if impact>0 else 1):
		blood.append({"x":enemy.x+spray.x*rng.randf_range(10,35),"y":enemy.y+spray.y*rng.randf_range(10,35),"size":rng.randf_range(3,7),"bone":enemy.type=="skeleton","kind":"ash" if enemy.type=="shadow" else "blood"})
	if effects:
		if has_item("ember"): enemy.burn = 3.0
		if has_item("rot"): enemy.poison = 4.0
		if has_item("frost"): enemy.slow = 2.2
	burst(point,wound_color,4)
	if enemy.hp<=0: kill_enemy(enemy)

func kill_enemy(enemy: Dictionary):
	if not enemies.has(enemy): return
	var p = Vector2(enemy.x,enemy.y)
	var wound_color = Color("b3a282") if enemy.type=="skeleton" else (Color("44676a") if enemy.type=="shadow" else Color("a82a32"))
	var spray_dir = (p-player).normalized()
	var corpse_motion = enemy.get("motion",{}).duplicate(true)
	corpse_motion.weapon_override = enemy_weapon_angle(enemy)
	if enemy.type in EnemyPose.TYPES and not corpse_motion.has("death_clock"):
		corpse_motion.death_action = 2 if enemy.state=="windup" else (3 if enemy.state=="strike" else 0)
		corpse_motion.death_progress = clampf(enemy.state_time/(0.52 if enemy.state=="windup" else 0.25),0,1)
		corpse_motion.death_dx = enemy.dx
		corpse_motion.death_dy = enemy.dy
		corpse_motion.death_clock = elapsed
	var bell_snapshot = enemy.duplicate(true) if enemy.type=="boss0" else {}
	corpses.append({"bell_snapshot":bell_snapshot,"bell_clock":elapsed,"type":enemy.type,"x":p.x,"y":p.y,"dx":spray_dir.x,"dy":spray_dir.y,"age":0.0,"vx":float(enemy.get("knock_x",0)),"vy":float(enemy.get("knock_y",0)),"motion":corpse_motion})
	if corpses.size()>24: corpses.pop_front()
	if enemy.get("last_impact",0)>0: hit_stop = maxf(hit_stop,0.07)
	enemies.erase(enemy)
	kills += 1
	if enemy.get("last_impact",0)>0: shake = maxf(shake,3.5 if not enemy.boss else 7)
	for i in range(5 if not enemy.boss else 15):
		blood.append({"x":p.x+rng.randf_range(-19,19),"y":p.y+rng.randf_range(-10,12),"size":rng.randf_range(5,15),"bone":enemy.type=="skeleton" or (enemy.type!="shadow" and i%4==0),"kind":"ash" if enemy.type=="shadow" else "blood"})
	if blood.size()>160: blood = blood.slice(blood.size()-160)
	burst(p,wound_color,20 if not enemy.boss else 50)
	if rng.randf()<0.65 or enemy.boss:
		add_drop("coin",p,1 if not enemy.boss else 7)
	if has_item("leech") and rng.randf()<0.24: heal(0.5)
	if has_item("harvest"):
		zones.append({"x":p.x,"y":p.y,"radius":65.0,"timer":0.15,"kind":"echo","damage":5.0})
	if has_item("void"):
		for other in enemies:
			other.slow = maxf(float(other.slow),1.0)
	if enemy.type=="boss0":
		zones = zones.filter(func(z): return z.kind!="boss_ring")
		BossFight.sound(self,"break")
	if enemy.boss:
		var unlock = "boss"+str(floor_index+1) if floor_index<3 else "victory"
		unlock_content(unlock)
		add_drop("item",CENTRE-Vector2(0,58),1,choose_item())

func update_enemies(dt: float):
	for enemy in enemies.duplicate():
		if not enemies.has(enemy): continue
		var p = Vector2(enemy.x,enemy.y)
		var knock = Vector2(enemy.get("knock_x",0),enemy.get("knock_y",0))
		if knock.length_squared()>0.1:
			var decay = exp(-12*dt)
			var next = move_body(p,knock*(1-decay)/12,15 if enemy.boss else 10)
			Motion.shift(enemy.get("motion",{}),next-p)
			p = next
			enemy.x = p.x
			enemy.y = p.y
			enemy.knock_x = knock.x*decay
			enemy.knock_y = knock.y*decay
		var previous_enemy = p
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
		if enemy.state=="stagger":
			enemy.stagger = maxf(0,float(enemy.get("stagger",0))-dt)
			enemy.motion = Motion.update(enemy.get("motion",{}),p,p,dt)
			if enemy.stagger<=0:
				enemy.state = "recover"
				enemy.state_time = 0.0
			continue
		if enemy.get("training_dummy",false):
			enemy.motion = Motion.update(enemy.get("motion",{}),p,p,dt)
			continue
		var slow = 0.48 if enemy.slow>0 else 1.0
		if enemy.boss:
			update_boss(enemy,dt,slow)
			continue
		var speed = {"guard":55,"shadow":85,"skeleton":47,"assassin":78,"mage":37}[enemy.type]*(1+floor_index*0.08)*slow
		if enemy.state == "windup":
			if enemy.state_time>0.52:
				enemy.state = "strike"
				enemy.state_time = 0.0
				enemy.strike_hit = false
				if enemy.type in ["skeleton","mage"]:
					var dir = Vector2(enemy.dx,enemy.dy)
					for angle in ([-0.24,0.0,0.24] if enemy.type=="mage" else [0.0]):
						var launch = EnemyPose.pose(enemy.type,p,enemy.get("motion",{}),dir,3,0,elapsed).hand-p
						fire_bullet(p,dir.rotated(angle)*145,1.5,"enemy",4,"bone" if enemy.type=="skeleton" else "curse",launch)
				elif enemy.type == "shadow":
					zones.append({"x":p.x,"y":p.y,"radius":44.0,"timer":0.1,"kind":"hostile","damage":2.0})
		elif enemy.state == "strike":
			if enemy.type in ["guard","assassin"]:
				p = move_body(p,Vector2(enemy.dx,enemy.dy)*dt*(310 if enemy.type=="assassin" else 185),10)
				if p.distance_to(player)<30 and p.distance_to(player)<previous_enemy.distance_to(player): p = previous_enemy
				if enemy.type=="guard" and not enemy.get("strike_hit",false):
					var end = minf(Combat.ACTIVE_END,enemy.state_time/0.25)
					var start = maxf(Combat.CONTACT_RATIO,(enemy.state_time-dt)/0.25)
					if end>=start and not Combat.occluded(p,player,blocks):
						var hit = Combat.swept_hit(previous_enemy,p,enemy.get("motion",{}),Vector2(enemy.dx,enemy.dy),start,end,Combat.hurt_capsule(player,"player"),Combat.BASE_REACH,elapsed)
						if hit.hit:
							enemy.strike_hit = true
							hurt(2.0,p)
				elif enemy.type=="assassin" and 0.06<=enemy.state_time and enemy.state_time<=0.18 and p.distance_to(player)<33: hurt(2.0,p)
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
			if dist<33 and enemy.type=="shadow": hurt(1.0,p)
		if p.distance_to(player)<30 and p.distance_to(player)<previous_enemy.distance_to(player): p = previous_enemy
		enemy.motion = Motion.update(enemy.get("motion",{}),previous_enemy,p,dt)
		if enemy.state in ["windup","strike"]:
			Motion.set_look(enemy.motion,Vector2(enemy.dx,enemy.dy))
		enemy.x = p.x
		enemy.y = p.y

func steer_move(p: Vector2, by: Vector2, radius: float) -> Vector2:
	var next = move_body(p,by,radius)
	if next.distance_to(p)<by.length()*0.25:
		next = move_body(p,by.rotated(PI/2),radius)
	return next

func update_boss(enemy: Dictionary, dt: float, slow: float):
	if enemy.type=="boss0":
		BossFight.update(self,enemy,dt,slow)
		return
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

func fire_bullet(p: Vector2, velocity: Vector2, damage: float, type: String, life: float, visual: String = "", launch: Vector2 = Vector2.ZERO):
	bullets.append({"x":p.x,"y":p.y,"vx":velocity.x,"vy":velocity.y,"damage":damage,"type":type,"life":life,"visual":visual,"lx":launch.x,"ly":launch.y,"age":0.0})

func update_bullets(dt: float):
	for b in bullets.duplicate():
		b.life -= dt
		b.age = float(b.get("age",0))+dt
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
		if z.kind=="boss_ring":
			var previous = BossFight.ring_radius(z)
			z.age = float(z.get("age",0))+dt
			z.timer -= dt
			z.radius = BossFight.ring_radius(z)
			BossFight.Toll.sync(self,z)
			if z.age>=0 and not z.get("spent",false) and BossFight.ring_hits(z,player,previous):
				hurt(z.damage,Vector2(z.x,z.y))
				z.spent = true
			if z.timer<=0: zones.erase(z)
			continue
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
			var amount = Hazards.damage(hazard,elapsed)
			if amount>0: hurt(amount,player)

func hurt(amount: float, origin: Vector2):
	if invincible>0 or mode!="playing": return
	hp = maxf(0,hp-amount)
	pain = minf(100,pain+amount*9)
	invincible = 0.85
	hurt_flash = 0.2
	shake = 5
	player_recoil_direction = (player-origin).normalized()
	player_knockback += player_recoil_direction*170
	player_stagger = maxf(player_stagger,0.08)
	shake_axis = (player-origin).normalized()
	burst(player,Color("bd445a"),12)
	if has_item("thorns"):
		for enemy in enemies.duplicate():
			if Vector2(enemy.x,enemy.y).distance_to(player)<90: damage_enemy(enemy,5,player,false)
	if hp<=0: die()

func heal(amount: float):
	hp = minf(max_hp,hp+amount*(1.0+maxi(0,faith)*0.035))

func die():
	var action = 2 if windup>0 else (3 if swing>0 else 0)
	var u = 1-windup/swing_windup if windup>0 else (1-swing/swing_duration if swing>0 else 0.0)
	player_motion.weapon_override = Combat.weapon_pose(player,player_motion,swing_dir,action,u,attack_range(),elapsed).angle
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
		if rng.randf()<0.24: add_drop("heal",CENTRE,2)
		if rng.randf()<0.28: add_drop("key",CENTRE+Vector2(26,0),1)
		if drops.is_empty(): add_drop("coin",CENTRE,1)
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
			faith = clampi(faith+(-2 if player.x<CENTRE.x else 2),-6,6)
			if player.x<CENTRE.x:
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

func door_direction(index: int) -> int:
	return int(room_ports[index].dir)

func door_destination(index: int) -> Dictionary:
	var anchor = Dungeon.owner(dungeon,room_ports[index].to)
	return dungeon.rooms.get(anchor,{})

func door_position(index: int) -> Vector2:
	var port: Dictionary = room_ports[index]
	var offset: Vector2i = port.from-Vector2i(int(room.x),int(room.y))
	match int(port.dir):
		0: return Vector2(48+(offset.x+0.5)*1152,180)
		1: return Vector2(room_floor_rect.end.x-5,168+(offset.y+0.5)*640)
		2: return Vector2(48+(offset.x+0.5)*1152,room_floor_rect.end.y-6)
		_: return Vector2(52,168+(offset.y+0.5)*640)

func check_doors():
	if not room.clear or transition_cd>0: return
	for i in range(room_ports.size()):
		var dest = door_destination(i)
		if dest.is_empty() or not dest.revealed or player.distance_to(door_position(i))>=28: continue
		if not dest.opened:
			if keys<=0:
				notify("Нужен ключ.",2)
				transition_cd = 0.5
				return
			keys -= 1
			dest.opened = true
			DoorMotion.unlock(self,i)
			notify("Замок открыт.",1.5)
			save_run()
			return
		if not DoorMotion.ready(self,i): continue
		var exit: Dictionary = room_ports[i]
		var target = Vector2i(int(dest.x),int(dest.y))
		var target_ports = Dungeon.ports(dungeon,dest)
		var entry = -1
		for j in range(target_ports.size()):
			if target_ports[j].from==exit.to and target_ports[j].to==exit.from: entry = j
		if entry<0: continue
		enter_room(target,Vector2.INF)
		place_player(door_position(entry)-DIRECTIONS[door_direction(entry)]*34)
		camera_position = desired_camera()
		room_camera = camera_position.snapped(Vector2(2,2))
		save_run()
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
				"oracle": return "[E] "+("ОТВЕРГНУТЬ: −2 ВЕРЫ, +5 МОНЕТ" if player.x<CENTRE.x else "ПРИНЯТЬ: +2 ВЕРЫ, ЛЕЧЕНИЕ")
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
	var data = {"version":1,"room_geometry":2,"seed":seed_value,"rng_state":str(rng.state),"floor":floor_index,
		"dungeon":dungeon,"coords":[coords.x,coords.y],"player":[player.x,player.y],"facing":[facing.x,facing.y],
		"hp":hp,"max_hp":max_hp,"pain":pain,"coins":coins,"keys":keys,"faith":faith,"inventory":inventory,
		"active":active,"charge":charge,"elapsed":elapsed,"kills":kills,"rooms":rooms_cleared,"character":character,
		"attack_serial":attack_serial,"attack_facing":attack_facing,"attack_look":attack_look,"combo":combo,"swing_duration":swing_duration,"player_knockback":[player_knockback.x,player_knockback.y],"player_stagger":player_stagger,
		"player_motion":player_motion,"attack_contact_pending":attack_contact_pending,"saved_swing":swing,"saved_windup":windup,"saved_windup_total":swing_windup,"swing_dir":[swing_dir.x,swing_dir.y],
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
	RoomLayout.upgrade_save(data)
	Dungeon.rebuild_cells(data.dungeon)
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
	attack_serial = int(data.get("attack_serial",0))
	attack_facing = float(data.get("attack_facing",1.0))
	swing_duration = float(data.get("swing_duration",0.22))
	var knockback = data.get("player_knockback",[0,0])
	player_knockback = Vector2(knockback[0],knockback[1])
	player_stagger = float(data.get("player_stagger",0))
	attack_buffer_time = 0
	player_motion = data.get("player_motion",{}) if player.distance_to(position)<1 else {}
	windup = float(data.get("saved_windup",0))
	swing = float(data.get("saved_swing",0))
	combo = int(data.get("combo",1 if windup>0 or swing>0 else 0))
	swing_windup = float(data.get("saved_windup_total",0.12))
	attack_contact_pending = bool(data.get("attack_contact_pending",false))
	var saved_direction = data.get("swing_dir",[0,1])
	swing_dir = Vector2(saved_direction[0],saved_direction[1])
	attack_look = int(data.get("attack_look",Motion.direction_index(swing_dir)))
	if player_motion.is_empty(): player_motion = Motion.initialize(player,attack_facing,Motion.direction_index(facing))
	elif not player_motion.has("look"): Motion.set_look(player_motion,facing)
	if windup>0 or swing>0: player_motion.look = attack_look
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
