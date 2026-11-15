extends "res://scripts/game.gd"
## Isolated scene: F6 in Godot. No access to regular run/profile files.
var dummy_mode = true
var heavy_mode = false
var dummy_look = 3
var respawn_clock = 0.0

func _ready():
	save_path = "user://combat-lab-run.json"
	profile_path = "user://combat-lab-profile.json"
	super._ready()
	reset_lab()

func reset_lab():
	new_run(176)
	place_player(Vector2(320,330),Vector2.RIGHT)
	invincible = 0
	message_time = 0
	dungeon.rooms = {"0,0":room}
	blocks.clear()
	hazards.clear()
	drops.clear()
	corpses.clear()
	blood.clear()
	enemies.clear()
	if heavy_mode: inventory = ["heavy"]
	spawn_target()
	debug_combat = true

func spawn_target():
	spawn_enemy("guard",Vector2(420,330),false)
	var target = enemies.back()
	target.hp = 32.0
	target.max = 32.0
	target.training_dummy = dummy_mode
	target.motion = Motion.initialize(Vector2(target.x,target.y),-1,dummy_look if dummy_mode else 3)
	var dir = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][dummy_look] if dummy_mode else Vector2.LEFT
	target.dx = dir.x
	target.dy = dir.y
	room.clear = false
	respawn_clock = 0

func _process(delta):
	super._process(delta)
	if mode!="playing": return
	if enemies.is_empty():
		respawn_clock += delta
		if respawn_clock>0.8:
			drops.clear()
			spawn_target()

func _unhandled_input(event):
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode>=KEY_1 and event.keycode<=KEY_4:
			if mode=="playing" and windup<=0 and swing<=0 and hurt_flash<=0:
				var dir = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][int(event.keycode-KEY_1)]
				facing = dir
				Motion.set_look(player_motion,dir)
			return
		if event.keycode==KEY_F4:
			if dummy_mode:
				dummy_look = (dummy_look+1)%4
				for e in enemies:
					if e.state in ["stagger","windup","strike"]: continue
					var dir = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][dummy_look]
					Motion.set_look(e.motion,dir)
					e.dx = dir.x
					e.dy = dir.y
			return
		if event.keycode==KEY_F2:
			debug_combat = not debug_combat
			return
		if event.keycode==KEY_F3:
			dummy_mode = not dummy_mode
			reset_lab()
			return
		if event.keycode==KEY_Q:
			heavy_mode = not heavy_mode
			reset_lab()
			return
		if event.keycode==KEY_R:
			reset_lab()
			return
	super._unhandled_input(event)

func _draw():
	super._draw()
	draw_rect(Rect2(30,73,706,17),Color(0.015,0.02,0.015,0.96))
	var weapon = "ТЯЖЁЛЫЙ ТЕСАК" if heavy_mode else "ТЕСАК"
	var target = "МИШЕНЬ" if dummy_mode else "СТРАЖНИК"
	draw_string(font,Vector2(42,85),"ПРОБА БОЯ  ·  "+weapon+"  ·  "+target+"     F2 геометрия  ·  F3 противник  ·  Q оружие  ·  R сброс",HORIZONTAL_ALIGNMENT_LEFT,-1,9,Color("c3ad83"))

	draw_rect(Rect2(30,505,706,25),Color(0.015,0.02,0.015,0.96))
	draw_string(font,Vector2(42,522),"1 / 2 / 3 / 4 — ракурс героя      F4 — повернуть мишень",HORIZONTAL_ALIGNMENT_LEFT,-1,10,Color("a19479"))
