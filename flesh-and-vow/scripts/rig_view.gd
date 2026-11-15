extends RefCounted
## One set of immutable body parts per actor. Animation changes joints, never artwork.
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
const SOURCE = preload("res://assets/rig_parts.png")
const VERTICAL_SOURCE = preload("res://assets/rig_vertical_parts.png")
const SIZES = [Vector2i(14,14),Vector2i(16,13),Vector2i(7,12),Vector2i(7,12),Vector2i(7,11),Vector2i(7,11),Vector2i(20,10),Vector2i(7,15)]
const PALETTE = [Color("151a15"),Color("252c22"),Color("3a3a2a"),Color("514934"),Color("6b5a40"),Color("86704e"),Color("a48a61"),Color("c5ad83"),Color("d9c39a"),Color("262d2e"),Color("414b46"),Color("626a5d"),Color("89917c"),Color("b5b8a1"),Color("321d20"),Color("54272c"),Color("733538"),Color("93464a"),Color("b35e59"),Color("ce8171"),Color("392c23"),Color("60442e"),Color("8e633e"),Color("c39b58")]
static var parts: Array = []
static var vertical_parts: Array = []

static func pixel_part(region: Image, size: Vector2i) -> Image:
	# Coverage resampling preserves thin arms; final pixels are opaque and palette-locked.
	region.resize(size.x,size.y,Image.INTERPOLATE_LANCZOS)
	for y in range(size.y):
		for x in range(size.x):
			var c = region.get_pixel(x,y)
			if c.a<0.35:
				region.set_pixel(x,y,Color.TRANSPARENT)
				continue
			var best = PALETTE[0]
			var distance = INF
			for candidate in PALETTE:
				var d = pow(c.r-candidate.r,2)*0.3+pow(c.g-candidate.g,2)*0.59+pow(c.b-candidate.b,2)*0.11
				if d<distance:
					distance = d
					best = candidate
			region.set_pixel(x,y,best)
	# Remove disconnected one/two-pixel generation specks, keeping holes and torn cloth.
	var visited: Dictionary = {}
	for y in range(size.y):
		for x in range(size.x):
			var start = Vector2i(x,y)
			if visited.has(start) or region.get_pixel(x,y).a==0: continue
			var component: Array[Vector2i] = [start]
			visited[start] = true
			var cursor = 0
			while cursor<component.size():
				var p = component[cursor]
				cursor += 1
				for step in [Vector2i.UP,Vector2i.RIGHT,Vector2i.DOWN,Vector2i.LEFT]:
					var q = p+step
					if q.x<0 or q.y<0 or q.x>=size.x or q.y>=size.y or visited.has(q): continue
					if region.get_pixel(q.x,q.y).a==0: continue
					visited[q] = true
					component.append(q)
			if component.size()<=2:
				for p in component: region.set_pixel(p.x,p.y,Color.TRANSPARENT)
	var used = region.get_used_rect()
	if used.has_area():
		region = region.get_region(used)
		region.resize(size.x,size.y,Image.INTERPOLATE_NEAREST)
	return region

static func extract_parts(texture: Texture2D, rows: int) -> Array:
	var source = texture.get_image()
	source.convert(Image.FORMAT_RGBA8)
	var bytes = source.get_data()
	for i in range(3,bytes.size(),4): bytes[i] = 255 if bytes[i]>=160 else 0
	source = Image.create_from_data(source.get_width(),source.get_height(),false,Image.FORMAT_RGBA8,bytes)
	var result: Array = []
	for row in range(rows):
		var actor_parts: Array = []
		for col in range(8):
			var x = roundi(col*source.get_width()/8.0)
			var y = roundi(row*source.get_height()/float(rows))
			var end = Vector2i(roundi((col+1)*source.get_width()/8.0),roundi((row+1)*source.get_height()/float(rows)))
			var region = source.get_region(Rect2i(Vector2i(x,y),end-Vector2i(x,y)))
			# Ignore isolated alpha specks; all views use the same canonical part dimensions.
			var columns: Array[int] = []
			var lines: Array[int] = []
			columns.resize(region.get_width())
			lines.resize(region.get_height())
			columns.fill(0)
			lines.fill(0)
			var rgba = region.get_data()
			for py in range(region.get_height()):
				for px in range(region.get_width()):
					if rgba[(py*region.get_width()+px)*4+3]>0:
						columns[px] += 1
						lines[py] += 1
			var low = Vector2i(region.get_width(),region.get_height())
			var high = Vector2i(-1,-1)
			for px in range(columns.size()):
				if columns[px]>=maxi(2,int(region.get_height()*0.02)):
					low.x = mini(low.x,px)
					high.x = maxi(high.x,px)
			for py in range(lines.size()):
				if lines[py]>=maxi(2,int(region.get_width()*0.02)):
					low.y = mini(low.y,py)
					high.y = maxi(high.y,py)
			if high.x>=low.x and high.y>=low.y: region = region.get_region(Rect2i(low,high-low+Vector2i.ONE))
			region = pixel_part(region,SIZES[col])
			actor_parts.append(ImageTexture.create_from_image(region))
		result.append(actor_parts)
	return result

static func load_parts():
	if not parts.is_empty(): return
	parts = extract_parts(SOURCE,2)
	vertical_parts = extract_parts(VERTICAL_SOURCE,4)
	# A cleaver remains the same object as the actor turns; only body views change.
	for i in range(4): vertical_parts[i][6] = parts[i/2][6]

static func textures_for(type: String, look: int) -> Array:
	load_parts()
	var actor = 0 if type=="player" else 1
	if look==0: return vertical_parts[actor*2]
	if look==2: return vertical_parts[actor*2+1]
	return parts[actor]

static func armed_layers(g, textures: Array, weapon: Dictionary, hand_sign: float, texture_flip: float, tint: Color, context: Dictionary):
	# Draw the handle behind the closed fist. The cleaver's handle sits above its blade.
	var grip = Vector2(0.13,0.3 if textures[6]==parts[0][6] else 0.5)
	weapon_part(g,textures[6],weapon,grip,hand_sign,tint,context)
	var forearm_axis = (weapon.hand-weapon.elbow).normalized()
	var fingertips = weapon.hand+forearm_axis*3
	jointed_limb(g,textures[3],weapon.shoulder,weapon.elbow,fingertips,texture_flip,tint,context)

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

static func jointed_limb(g, tex: Texture2D, shoulder: Vector2, elbow: Vector2, fingertips: Vector2, flip: float, tint: Color, context: Dictionary):
	var joints = [shoulder,elbow,fingertips]
	var upper_normal = (elbow-shoulder).normalized().orthogonal()
	var lower_normal = (fingertips-elbow).normalized().orthogonal()
	var middle_normal = (upper_normal+lower_normal).normalized()
	var width = float(tex.get_width())
	var normals = [upper_normal*width,middle_normal*width/maxf(0.7,middle_normal.dot(upper_normal)),lower_normal*width]
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
	if context.fall==0: return points
	var result = PackedVector2Array()
	for point in points:
		result.append(context.p+(point-context.p).rotated(context.fall)+Vector2(0,context.drop))
	return result

static func quad(g, tex: Texture2D, points: PackedVector2Array, uv: PackedVector2Array, tint: Color, context: Dictionary):
	g.draw_polygon(vertices(points,context),PackedColorArray([tint]),uv,tex)

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
	var weapon = Combat.weapon_pose(p,motion,direction,action,progress,reach,clock)
	var collapse = smooth_curve(progress) if action==5 else 0.0
	var context = {"p":p,"fall":collapse*facing*1.35,"drop":collapse*5}
	var body = weapon.body
	var left_foot = Motion.foot_position(motion,0,p)
	var right_foot = Motion.foot_position(motion,1,p)
	var hips = [body+Vector2(-6,-19),body+Vector2(6,-19)]
	limb(g,textures[5 if look==0 else 4],hips[0],left_foot,2*facing,texture_flip,tint,context)
	limb(g,textures[4 if look==0 else 5],hips[1],right_foot,2*facing,texture_flip,tint,context)
	var sway = sin(phase)*0.15*walk_weight
	var left_shoulder = body+Vector2(-12*facing,-38)
	var left_hand = left_shoulder+Vector2(-facing*(3+sin(phase)*2*walk_weight),21)
	limb(g,textures[2],left_shoulder,left_hand,3*facing,texture_flip,tint,context)
	if look==2: armed_layers(g,textures,weapon,facing,texture_flip,tint,context)
	if look!=2: part(g,textures[7],body+Vector2(-7*facing,-35),sway,texture_flip,tint,context,Vector2(0.5,0))
	part(g,textures[1],body+Vector2(0,-31),0,texture_flip,tint,context)
	if look==2: part(g,textures[7],body+Vector2(0,-38),sway,1,tint,context,Vector2(0.5,0))
	part(g,textures[0],body+Vector2(facing if look in [1,3] else 0,-53),0,texture_flip,tint,context)
	if look!=2: armed_layers(g,textures,weapon,facing,texture_flip,tint,context)

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
