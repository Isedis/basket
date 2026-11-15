extends RefCounted
## Distance-driven gait. All stored values are JSON-compatible.
const STRIDE = 48.0
const SPREAD = 6.0
const REACH = 12.0

static func direction_index(direction: Vector2, previous: int = 1) -> int:
	previous = clampi(previous,0,3)
	if direction.length_squared()<0.0001: return previous
	var dir = direction.normalized()
	if absf(dir.x)>absf(dir.y)+0.08: return 1 if dir.x>0 else 3
	if absf(dir.y)>absf(dir.x)+0.08: return 0 if dir.y>0 else 2
	# Hysteresis: diagonal steering cannot alternate poses from tiny float noise.
	var old = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][clampi(previous,0,3)]
	if old.dot(dir)>0.5: return previous
	return 0 if dir.y>0 else 2

static func look_index(state: Dictionary, fallback: Vector2 = Vector2.RIGHT) -> int:
	var look = int(state.get("look",-1))
	if look>=0 and look<4: return look
	return direction_index(fallback,1 if float(state.get("facing",1.0))>0 else 3)

static func hand_sign(look: int) -> float:
	# Front: the anatomical right hand is on screen-left. Back: screen-right.
	return -1.0 if look in [0,3] else 1.0

static func set_look(state: Dictionary, direction: Vector2):
	state.look = direction_index(direction,look_index(state))
	if state.look in [1,3]: state.facing = 1.0 if state.look==1 else -1.0

static func initialize(p: Vector2, facing: float = 1.0, look: int = -1) -> Dictionary:
	return {"phase":PI*0.5,"distance":0.0,"moving":false,"speed":0.0,"vx":0.0,"vy":0.0,"facing":facing,"look":look if look>=0 else (1 if facing>0 else 3),
		"started":false,"walk_weight":0.0,"feet":[{"x":p.x-SPREAD,"y":p.y,"lift":0.0,"stance":true,"sx":p.x-SPREAD,"sy":p.y},
		{"x":p.x+SPREAD,"y":p.y,"lift":0.0,"stance":true,"sx":p.x+SPREAD,"sy":p.y}]}

static func update(state: Dictionary, previous: Vector2, p: Vector2, dt: float) -> Dictionary:
	if not state.has("feet"):
		var normalized = initialize(previous,float(state.get("facing",1.0)))
		normalized.merge(state,true)
		state = normalized
	if not state.has("look"): state.look = direction_index(Vector2(state.get("vx",0),state.get("vy",0)),1 if float(state.get("facing",1))>0 else 3)
	var displacement = p-previous
	var distance = displacement.length()
	state.moving = distance>0.001
	state.speed = distance/maxf(dt,0.0001)
	state.walk_weight = move_toward(float(state.get("walk_weight",0.0)),1.0 if state.moving else 0.0,dt*10)
	if not state.moving:
		for foot in state.feet: foot.lift = move_toward(float(foot.lift),0,dt*50)
		return state
	var dir = displacement.normalized()
	if not state.get("started",false):
		state.started = true
		state.feet[1].stance = false
		state.feet[1].sx = previous.x+SPREAD-dir.x*REACH
		state.feet[1].sy = previous.y-dir.y*REACH
	state.vx = dir.x
	state.vy = dir.y
	set_look(state,dir)
	state.distance += distance
	state.phase = fmod(float(state.phase)+distance/STRIDE*TAU,TAU)
	for i in range(2):
		var foot = state.feet[i]
		var phase = fmod(float(state.phase)+i*PI,TAU)
		var stance = phase<PI
		var side = Vector2(-SPREAD if i==0 else SPREAD,0)
		if stance:
			if not foot.stance:
				foot.x = p.x+side.x+dir.x*REACH
				foot.y = p.y+dir.y*REACH
			foot.lift = 0.0
		else:
			if foot.stance:
				foot.sx = foot.x
				foot.sy = foot.y
			var u = (phase-PI)/PI
			var target = p+side+dir*REACH
			var xy = Vector2(foot.sx,foot.sy).lerp(target,smoothstep(0,1,u))
			foot.x = xy.x
			foot.y = xy.y
			foot.lift = move_toward(float(foot.lift),sin(u*PI)*4.0,dt*60)
		foot.stance = stance
	return state

static func shift(state: Dictionary, amount: Vector2):
	if not state.has("feet"): return
	for foot in state.feet:
		foot.x += amount.x
		foot.y += amount.y
		foot.sx += amount.x
		foot.sy += amount.y

static func foot_position(state: Dictionary, i: int, p: Vector2) -> Vector2:
	if not state.has("feet"): return p+Vector2(-SPREAD if i==0 else SPREAD,0)
	var foot = state.feet[i]
	return Vector2(foot.x,foot.y-float(foot.lift))
