extends RefCounted
## Native-pixel character parts; animation changes joints, never the artwork.
const EnemyPose = preload("res://scripts/enemy_pose.gd")
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
const Style = preload("res://scripts/character_style.gd")
const ATLAS = preload("res://assets/castle_characters.png")
const ENEMY_ATLAS = preload("res://assets/castle_enemies.png")
static var parts: Array = []
static var vertical_parts: Array = []

static func load_parts():
	if not parts.is_empty(): return
	for actor in range(Style.TYPES.size()):
		var image = ATLAS.get_image() if actor<3 else ENEMY_ATLAS.get_image()
		var views: Array = []
		for view in range(3):
			var components: Array = []
			for part_index in range(8):
				components.append(ImageTexture.create_from_image(image.get_region(Style.region(actor,view,part_index))))
			views.append(components)
		# All views hold the same weapon object, with one physical grip point.
		var held = views[1][6] if Style.TYPES[actor]=="mage" else views[0][6]
		for view in views: view[6] = held
		parts.append(views[0])
		vertical_parts.append(views[1])
		vertical_parts.append(views[2])

static func textures_for(type: String, look: int) -> Array:
	load_parts()
	var actor = Style.index(type)
	if look==0: return vertical_parts[actor*2]
	if look==2: return vertical_parts[actor*2+1]
	return parts[actor]

static func armed_layers(g, textures: Array, weapon: Dictionary, hand_sign: float, texture_flip: float, tint: Color, context: Dictionary, type: String = ""):
	if type in EnemyPose.TYPES:
		var axis = (weapon.hand-weapon.elbow).normalized()
		if type=="skeleton": part(g,textures[6],weapon.hand,weapon.angle,1,tint,context,Vector2(0.2,0.5))
		jointed_limb(g,textures[3],weapon.shoulder,weapon.elbow,weapon.hand+axis*3,texture_flip,tint,context,0.9)
		if type=="shadow": part(g,textures[6],weapon.hand+axis*3,weapon.angle,1,tint,context,Vector2(0,0.5))
		if type=="mage":
			part(g,textures[6],weapon.hand,0,1,tint,context)
			var charge = float(weapon.get("cast_charge",0))
			if charge>0:
				for corner in [Vector2(-8,-6),Vector2(6,-6),Vector2(-8,6),Vector2(6,6)]:
					g.draw_rect(Rect2((weapon.hand+corner).snapped(Vector2(2,2)),Vector2(2,2)),Color(0.55,0.78,0.64,charge*0.85))
		return
	# Draw the handle behind the closed fist. The cleaver's handle sits above its blade.
	var grip = Vector2(0.13,0.3 if textures[6]==parts[0][6] else 0.5)
	weapon_part(g,textures[6],weapon,grip,hand_sign,tint,context)
	var forearm_axis = (weapon.hand-weapon.elbow).normalized()
	var fingertips = weapon.hand+forearm_axis*3
	var arm_width = 0.85 if textures[6]==parts[0][6] else 0.9
	jointed_limb(g,textures[3],weapon.shoulder,weapon.elbow,fingertips,texture_flip,tint,context,arm_width)

static func weapon_part(g, tex: Texture2D, pose: Dictionary, grip: Vector2, edge_sign: float, tint: Color, context: Dictionary):
	var size = tex.get_size()*2
	# Keep the grip and neck fixed when an item lengthens the blade.
	var neck_u = grip.x+Combat.BLADE_MIN/size.x
	for span in [Vector2(0,neck_u),Vector2(neck_u,1)]:
		var points = PackedVector2Array()
		var uv = PackedVector2Array([Vector2(span.x,0),Vector2(span.y,0),Vector2(span.y,1),Vector2(span.x,1)])
		for xy in uv:
			var rel = (xy-grip)*size
			if rel.x>Combat.BLADE_MIN: rel.x = Combat.BLADE_MIN+(rel.x-Combat.BLADE_MIN)*pose.scale
			rel.y *= edge_sign
			points.append(pose.hand+rel.rotated(pose.angle))
		quad(g,tex,points,uv,tint,context)

static func jointed_limb(g, tex: Texture2D, shoulder: Vector2, elbow: Vector2, fingertips: Vector2, flip: float, tint: Color, context: Dictionary, width_scale: float):
	var joints = [shoulder,elbow,fingertips]
	var upper_normal = (elbow-shoulder).normalized().orthogonal()
	var lower_normal = (fingertips-elbow).normalized().orthogonal()
	var middle_normal = (upper_normal+lower_normal).normalized()
	var width = float(tex.get_width())*width_scale
	# A joint narrows at the elbow; extending a miter here made a sharp triangular spur.
	var normals = [upper_normal*width,middle_normal*width*0.86,lower_normal*width*0.9]
	for i in range(2):
		var a = joints[i]
		var b = joints[i+1]
		var u = 0.0 if flip>0 else 1.0
		quad(g,tex,PackedVector2Array([a-normals[i],a+normals[i],b+normals[i+1],b-normals[i+1]]),PackedVector2Array([Vector2(u,i*0.5),Vector2(1-u,i*0.5),Vector2(1-u,(i+1)*0.5),Vector2(u,(i+1)*0.5)]),tint,context)

static func smooth_curve(value: float) -> float:
	return smoothstep(0,1,clampf(value,0,1))

static func weapon_angle(direction: Vector2, action: int, progress: float, facing: float) -> float:
	return Combat.weapon_angle(direction,action,progress,facing)

static func vertices(points: PackedVector2Array, context: Dictionary) -> PackedVector2Array:
	if context.fall==0 and context.get("shift",Vector2.ZERO)==Vector2.ZERO: return points
	var result = PackedVector2Array()
	for point in points:
		result.append(context.p+(point-context.p).rotated(context.fall)+Vector2(0,context.drop)+context.get("shift",Vector2.ZERO))
	return result

static func quad(g, tex: Texture2D, points: PackedVector2Array, uv: PackedVector2Array, tint: Color, context: Dictionary):
	var color = Color(tint,tint.a*float(context.get("fade",1.0)))
	g.draw_polygon(vertices(points,context),PackedColorArray([color]),uv,tex)

static func part(g, tex: Texture2D, at: Vector2, angle: float, flip: float, tint: Color, context: Dictionary, pivot: Vector2 = Vector2(0.5,0.5), scale_x: float = 1.0):
	var size = tex.get_size()*2
	size.x *= scale_x
	var points = PackedVector2Array()
	for xy in [Vector2.ZERO,Vector2(1,0),Vector2.ONE,Vector2(0,1)]:
		var rel = (xy-pivot)*size
		rel.x *= flip
		points.append(at+rel.rotated(angle))
	quad(g,tex,points,PackedVector2Array([Vector2.ZERO,Vector2(1,0),Vector2.ONE,Vector2(0,1)]),tint,context)

static func limb(g, tex: Texture2D, start: Vector2, end: Vector2, bend: float, flip: float, tint: Color, context: Dictionary):
	var normal = (end-start).normalized().orthogonal()
	var middle = start.lerp(end,0.52)+normal*bend
	var points = [start,middle,end]
	var half_width = tex.get_width()
	for i in range(2):
		var a = points[i]
		var b = points[i+1]
		var n = normal*half_width
		var left_uv = 0.0 if flip>0 else 1.0
		var right_uv = 1.0-left_uv
		quad(g,tex,PackedVector2Array([a-n,a+n,b+n,b-n]),PackedVector2Array([Vector2(left_uv,i*0.5),Vector2(right_uv,i*0.5),Vector2(right_uv,(i+1)*0.5),Vector2(left_uv,(i+1)*0.5)]),tint,context)

static func draw(g, type: String, p: Vector2, motion: Dictionary, direction: Vector2, action: int, progress: float, tint: Color):
	load_parts()
	if not motion.has("feet"):
		var normalized = Motion.initialize(p,1.0 if direction.x>=0 else -1.0,Motion.direction_index(direction))
		normalized.merge(motion,true)
		motion = normalized
	var look = Motion.look_index(motion,direction)
	var facing = Motion.hand_sign(look)
	var texture_flip = -1.0 if look==3 else 1.0
	var textures = textures_for(type,look)
	var phase = float(motion.get("phase",0.0))
	var walking = bool(motion.get("moving",false))
	var walk_weight = float(motion.get("walk_weight",1.0 if walking else 0.0))
	var clock = g.elapsed if g.mode!="title" else g.anim
	var reach = g.attack_range() if type=="player" else Combat.BASE_REACH
	var stance = Vector2(facing*2,6) if type=="assassin" else Vector2.ZERO
	var pose_action = int(motion.get("death_action",0)) if action==5 and type in EnemyPose.TYPES else action
	var pose_progress = float(motion.get("death_progress",0)) if action==5 and type in EnemyPose.TYPES else progress
	var pose_aim = Vector2(motion.get("death_dx",direction.x),motion.get("death_dy",direction.y)) if action==5 and type in EnemyPose.TYPES else direction
	if action==5 and type in EnemyPose.TYPES: clock = float(motion.get("death_clock",0))
	var weapon = EnemyPose.pose(type,p,motion,pose_aim,pose_action,pose_progress,clock) if type in EnemyPose.TYPES else Combat.weapon_pose(p+stance,motion,direction,action,progress,reach,clock)
	var collapse = smooth_curve(progress) if action==5 else 0.0
	var context = {"p":p,"fall":collapse*facing*1.35,"drop":collapse*5,"shift":Vector2.ZERO,"fade":1-collapse*0.65 if type=="shadow" else 1.0}
	var body = weapon.body
	var left_foot = Motion.foot_position(motion,0,p)
	var right_foot = Motion.foot_position(motion,1,p)
	var hips = [weapon.hips+Vector2(-6,-19),weapon.hips+Vector2(6,-19)]
	var knee = 4.0 if type=="assassin" else 2.0
	component(context,type,collapse,4)
	limb(g,textures[5 if look==0 else 4],hips[0],left_foot,knee*facing,texture_flip,tint,context)
	component(context,type,collapse,5)
	limb(g,textures[4 if look==0 else 5],hips[1],right_foot,knee*facing,texture_flip,tint,context)
	var sway = sin(phase)*0.15*walk_weight
	var chest = Vector2(0,-31)
	var left_shoulder = body+chest+(Vector2(-12*facing,Combat.BODY_SHOULDER.y)-chest).rotated(weapon.twist)
	var counterbalance = Vector2(-facing*(3+sin(phase)*2*walk_weight),21)-direction*weapon.drive*2+Vector2(0,-weapon.coil*2)
	var left_hand = EnemyPose.free_hand(type,left_shoulder,weapon,direction,counterbalance) if type in EnemyPose.TYPES else left_shoulder+counterbalance.limit_length(21.5)
	component(context,type,collapse,2)
	limb(g,textures[2],left_shoulder,left_hand,3*facing,texture_flip,tint,context)
	component(context,type,collapse,3)
	if look==2: armed_layers(g,textures,weapon,facing,texture_flip,tint,context,type)
	component(context,type,collapse,7)
	if look!=2: part(g,textures[7],body+Vector2(-7*facing,-35),sway,texture_flip,tint,context,Vector2(0.5,0))
	component(context,type,collapse,1)
	part(g,textures[1],body+Vector2(0,-31),weapon.twist,texture_flip,tint,context)
	if look==2: part(g,textures[7],body+Vector2(0,-38),sway,1,tint,context,Vector2(0.5,0))
	component(context,type,collapse,0)
	part(g,textures[0],weapon.head+Vector2(facing if look in [1,3] else 0,0),-weapon.twist*0.2,texture_flip,tint,context)
	component(context,type,collapse,3)
	if look!=2: armed_layers(g,textures,weapon,facing,texture_flip,tint,context,type)

static func component(context: Dictionary, type: String, collapse: float, index: int):
	context.shift = Vector2.ZERO
	if type=="skeleton":
		var offsets = [Vector2(-17,-8),Vector2(2,4),Vector2(-16,8),Vector2(19,3),Vector2(-12,12),Vector2(17,13),Vector2(22,5),Vector2(-5,7)]
		context.shift = offsets[index]*collapse
	elif type=="shadow": context.shift = Vector2((index%3-1)*9,4+index)*collapse

static func actor(g, type: String, p: Vector2, flash: bool, tint: Color, entity: Dictionary = {}):
	var direction = g.facing
	var motion: Dictionary = g.player_motion if type=="player" else {}
	var action = 0
	var progress = 0.0
	if type=="player":
		if g.windup>0:
			action = 2
			direction = g.swing_dir
			progress = 1-g.windup/g.swing_windup
		elif g.swing>0:
			action = 3
			direction = g.swing_dir
			progress = 1-g.swing/g.swing_duration
		elif g.hurt_flash>0:
			action = 4
			progress = 1-g.hurt_flash/0.2
			direction = -g.player_recoil_direction
		if g.mode=="dead":
			action = 5
			progress = minf(1,g.death_elapsed/0.68)
			tint = Color.WHITE
	else:
		for enemy in ([entity] if not entity.is_empty() else g.enemies):
			if enemy.type!=type or Vector2(enemy.x,enemy.y).distance_to(p)>1: continue
			motion = enemy.get("motion",{})
			direction = Vector2(enemy.dx,enemy.dy)
			if enemy.state=="windup":
				action = 2
				progress = enemy.state_time/0.52
			elif enemy.state=="strike":
				action = 3
				progress = enemy.state_time/0.25
			elif enemy.state=="stagger":
				action = 4
				direction = Vector2(enemy.get("stagger_dir_x",enemy.dx),enemy.get("stagger_dir_y",enemy.dy))
				progress = 1-float(enemy.get("stagger",0))/maxf(0.001,float(enemy.get("stagger_total",0.2)))
				motion = motion.duplicate(true)
				motion.weapon_override = lerp_angle(float(enemy.get("stagger_angle",0)),Combat.weapon_angle(direction,0,0,Motion.hand_sign(Motion.look_index(motion,direction))),Combat.curve(progress))
			elif enemy.state=="recover":
				action = 3
				progress = 1.0
			break
	if flash: tint = Color(1.6,1.3,1.15)
	draw(g,type,p,motion,direction,action,progress,tint)
