extends RefCounted

const Rig = preload("res://scripts/rig_view.gd")
const ATLAS = preload("res://assets/actors_v3.png")
static var hero_sheet: Texture2D
static var guard_sheet: Texture2D
const TYPES = ["player","guard","shadow","skeleton","assassin","mage","boss0","boss1","boss2","boss3"]

static func direction_index(v: Vector2) -> int:
	if absf(v.x)>absf(v.y): return 1 if v.x>0 else 3
	return 0 if v.y>=0 else 2

static func pose(g, type: String, p: Vector2, direction: Vector2, action: int, frame: int, tint: Color = Color.WHITE):
	if type in ["player","guard"]:
		Rig.draw(g,type,p,{},direction,action,frame/7.0,tint)
		return
	var actor_index = maxi(0,TYPES.find(type))
	var scale = 3 if type.begins_with("boss") else 2
	var source = Rect2((direction_index(direction)*8+clampi(frame,0,7))*64,(actor_index*6+action)*64,64,64)
	var dest = Rect2((p-Vector2(32,55)*scale).snapped(Vector2(2,2)),Vector2(64,64)*scale)
	g.draw_texture_rect_region(ATLAS,dest,source,tint)

static func actor(g, type: String, p: Vector2, _old_frame: int, _scale: float, flash: bool, tint: Color, entity: Dictionary = {}):
	if type in ["player","guard"]:
		Rig.actor(g,type,p,flash,tint,entity)
		return
	var direction = g.facing
	var action = 0
	var frame = int(g.elapsed*5)%8
	if type=="player":
		if g.moving:
			action = 1
			frame = int(g.elapsed*13)%8
		if g.windup>0:
			action = 2
			direction = g.swing_dir
			frame = clampi(int((1-g.windup/g.swing_windup)*7),0,7)
		elif g.swing>0:
			action = 3
			direction = g.swing_dir
			frame = clampi(int((1-g.swing/0.22)*8),0,7)
		elif g.hurt_flash>0:
			action = 4
			frame = int((1-g.hurt_flash/0.2)*7)
	else:
		for e in g.enemies:
			if e.type!=type or Vector2(e.x,e.y).distance_to(p)>1: continue
			direction = g.player-p
			match e.state:
				"chase":
					action = 1 if e.get("motion",{}).get("moving",false) else 0
					frame = int(e.get("motion",{}).get("phase",0.0)/TAU*8)%8
				"windup":
					action = 2
					direction = Vector2(e.dx,e.dy)
					frame = mini(7,int(e.state_time/(0.85 if e.boss else 0.52)*8))
				"strike":
					action = 3
					direction = Vector2(e.dx,e.dy)
					frame = mini(7,int(e.state_time/(0.5 if e.boss else 0.25)*8))
				"recover":
					action = 3
					frame = 7
			if e.flash>0:
				action = 4
				frame = 2
			break
	if type=="player" and g.mode=="dead":
		action = 5
		frame = mini(7,int(g.death_elapsed/0.085))
		tint = Color.WHITE
	if flash: tint = Color(1.65,1.4,1.15)
	pose(g,type,p,direction,action,frame,tint)

static func corpses(g):
	for c in g.corpses:
		var frame = mini(7,int(c.age/0.085))
		if c.type in ["player","guard"]:
			Rig.draw(g,c.type,Vector2(c.x,c.y),c.get("motion",{}),Vector2(c.dx,c.dy),5,minf(1,c.age/0.68),Color("b7aaa0") if c.age>0.7 else Color.WHITE)
		else: pose(g,c.type,Vector2(c.x,c.y),Vector2(c.dx,c.dy),5,frame,Color("b7aaa0") if c.age>0.7 else Color.WHITE)

static func stone(g, b: Rect2):
	g.draw_rect(b.grow(4),Color(0.01,0.015,0.012,0.7))
	g.draw_rect(b,Color("2e3129"))
	for y in range(int(b.position.y),int(b.end.y),16):
		for x in range(int(b.position.x),int(b.end.x),16):
			var width = minf(16,b.end.x-x)
			var height = minf(16,b.end.y-y)
			g.draw_texture_rect_region(g.castle_art,Rect2(x,y,width,height),Rect2(60,12,width/2,height/2),Color("c5bca1"))
	g.draw_line(b.position,b.position+Vector2(b.size.x,0),Color("766c50"),2)
	g.draw_line(b.position+Vector2(0,b.size.y),b.end,Color("0c110e"),3)

static func light(g):
	# Discrete low-alpha pixel rings add torch pools without blurring the atlas.
	for p in [Vector2(303,154),Vector2(465,154)]:
		var flicker = sin(g.anim*11+p.x)*0.008
		for radius in [58,44,28,14]:
			g.draw_circle(p,radius,Color(1.0,0.47,0.12,0.012+flicker*0.4))
		var height = 10+int(sin(g.anim*14+p.x)*3)
		g.draw_rect(Rect2(p.x-3,p.y-height,6,height),Color("cf6e28"))
		g.draw_rect(Rect2(p.x-1,p.y-height+3,2,height-2),Color("f8d68c"))

static func rune_border(g, b: Rect2):
	g.draw_rect(b,Color("080e0d"))
	g.draw_line(b.position,b.position+Vector2(b.size.x,0),Color("514634"),1)
	g.draw_line(b.position+Vector2(0,b.size.y-1),b.end,Color("302e24"),1)
	for p in [b.position,b.position+Vector2(b.size.x-4,0),b.position+Vector2(0,b.size.y-4),b.end-Vector2(4,4)]:
		g.draw_rect(Rect2(p,Vector2(4,4)),Color("7b6a46"))

static func pixel_text(g, p: Vector2, value: String, color: Color = Color("c1b18e")):
	g.draw_string(g.pixel_font,p,value,HORIZONTAL_ALIGNMENT_LEFT,-1,8,color)
