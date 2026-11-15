extends RefCounted
## Shared visual and collision geometry. Coordinates are projected screen-world units.
const Motion = preload("res://scripts/locomotion.gd")
const CONTACT_RATIO = 0.06/0.22
const ACTIVE_END = 0.65
const BASE_REACH = 57.0
const BODY_SHOULDER = Vector2(12,-38)
const ARM_REACH = 21.0
const BLADE_MIN = 7.0
const BLADE_MAX = 34.8
const BLADE_HALF_WIDTH = 9.0

static func curve(value: float) -> float:
	return smoothstep(0,1,clampf(value,0,1))

static func weapon_angle(direction: Vector2, action: int, progress: float, facing: float) -> float:
	var rest = 0.85 if facing>0 else PI-0.85
	var aim = direction.angle()
	var back = aim-facing*1.7
	if action==2: return lerp_angle(rest,back,curve(progress))
	if action!=3: return rest
	if progress<=CONTACT_RATIO: return lerp_angle(back,aim,curve(progress/CONTACT_RATIO))
	if progress<ACTIVE_END: return lerp_angle(aim,aim+facing*0.8,curve((progress-CONTACT_RATIO)/(ACTIVE_END-CONTACT_RATIO)))
	return lerp_angle(aim+facing*0.8,rest,curve((progress-ACTIVE_END)/(1-ACTIVE_END)))

static func weapon_pose(p: Vector2, motion: Dictionary, direction: Vector2, action: int, progress: float, reach: float = BASE_REACH, clock: float = 0) -> Dictionary:
	var facing = Motion.hand_sign(Motion.look_index(motion,direction))
	var phase = float(motion.get("phase",0.0))
	var weight = float(motion.get("walk_weight",0.0))
	var bob = lerpf(sin(clock*2.7)*0.45,-absf(sin(phase*2))*0.8,weight)
	var lean = Vector2.ZERO
	if action==2: lean = -direction*2*curve(progress)
	if action==3:
		if progress<CONTACT_RATIO: lean = direction*lerpf(-2,4,curve(progress/CONTACT_RATIO))
		else: lean = direction*4*(1-curve((progress-CONTACT_RATIO)/(1-CONTACT_RATIO)))
	if action==4: lean = -direction*2*(1-curve(progress))
	var body = p+Vector2(0,bob)+lean
	var angle = weapon_angle(direction,action,progress,facing)
	var sway = sin(phase)*0.15*weight
	if action not in [2,3]: angle += sway*0.4
	elif action==2: angle += sway*0.4*(1-curve(progress))
	elif progress>ACTIVE_END: angle += sway*0.4*curve((progress-ACTIVE_END)/(1-ACTIVE_END))
	if motion.has("weapon_override"): angle = float(motion.weapon_override)
	var shoulder = body+Vector2(BODY_SHOULDER.x*facing,BODY_SHOULDER.y)
	var hand = shoulder+Vector2.from_angle(angle)*ARM_REACH
	var length_scale = 1.0+maxf(0,reach-BASE_REACH)/BLADE_MAX
	return {"body":body,"angle":angle,"shoulder":shoulder,"hand":hand,"scale":length_scale,"hand_sign":facing}

static func blade_polygon(pose: Dictionary) -> PackedVector2Array:
	var points = PackedVector2Array()
	for xy in [Vector2(BLADE_MIN,-BLADE_HALF_WIDTH),Vector2(BLADE_MAX,-BLADE_HALF_WIDTH),Vector2(BLADE_MAX,BLADE_HALF_WIDTH),Vector2(BLADE_MIN,BLADE_HALF_WIDTH)]:
		xy.x *= pose.scale
		points.append(pose.hand+xy.rotated(pose.angle))
	return points

static func hurt_capsule(p: Vector2, type: String = "guard", boss: bool = false) -> Dictionary:
	var rigged = type in ["player","guard"] and not boss
	return {"a":p+Vector2(0,-13 if rigged else -16),"b":p+Vector2(0,-108 if boss else (-53 if rigged else -65)),"radius":20.0 if boss else (18.0 if type=="guard" else 13.0)}

static func polygon_capsule(polygon: PackedVector2Array, capsule: Dictionary) -> Dictionary:
	if Geometry2D.is_point_in_polygon(capsule.a,polygon): return {"hit":true,"point":capsule.a}
	if Geometry2D.is_point_in_polygon(capsule.b,polygon): return {"hit":true,"point":capsule.b}
	for i in range(polygon.size()):
		var closest = Geometry2D.get_closest_points_between_segments(capsule.a,capsule.b,polygon[i],polygon[(i+1)%polygon.size()])
		if closest[0].distance_to(closest[1])<=capsule.radius:
			return {"hit":true,"point":closest[1]}
	return {"hit":false}

static func occluded(a: Vector2, b: Vector2, blocks: Array) -> bool:
	for box in blocks:
		if box.has_point(a) or box.has_point(b): return true
		var corners = [box.position,box.position+Vector2(box.size.x,0),box.end,box.position+Vector2(0,box.size.y)]
		for i in range(4):
			if Geometry2D.segment_intersects_segment(a,b,corners[i],corners[(i+1)%4])!=null: return true
	return false

static func swept_hit(from: Vector2, to: Vector2, motion: Dictionary, direction: Vector2, start: float, end: float, target: Dictionary, reach: float, clock: float = 0) -> Dictionary:
	var facing = Motion.hand_sign(Motion.look_index(motion,direction))
	var angular_distance = absf(angle_difference(weapon_angle(direction,3,start,facing),weapon_angle(direction,3,end,facing)))
	var samples = clampi(int(ceil((angular_distance*(reach+20)+from.distance_to(to))/5.0)),1,64)
	for i in range(samples+1):
		var t = float(i)/samples
		var pose = weapon_pose(from.lerp(to,t),motion,direction,3,lerpf(start,end,t),reach,clock)
		var result = polygon_capsule(blade_polygon(pose),target)
		if result.hit: return result
	return {"hit":false}
