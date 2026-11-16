extends RefCounted
## Castle boss: persisted state machine, shared visible/physical attack geometry.
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
const INTRO = 1.6
const FRACTURE = 1.4
const STRIKE = {"cleave":0.56,"toll":0.35,"charge":0.72}
const RECOVERY = {"cleave":0.95,"toll":1.05,"charge":1.2}
const RING_SPEED = 185.0
const RING_WIDTH = 12.0
const GAP = 0.68
static func ensure(e: Dictionary):
 if e.has("bell_phase"): return
 e.bell_phase = 1
 e.bell_turn = 0
 e.bell_attack = "cleave"
 # Legacy bosses resume safely with a fresh preparation, retaining their HP.
 if e.state not in ["chase","intro"]:
  e.state = "chase"
  e.state_time = 0.0
  e.timer = 0.65
static func windup(e: Dictionary) -> float:
 var value = {"cleave":0.98,"toll":1.15,"charge":1.12}[e.get("bell_attack","cleave")]
 return value*(0.82 if e.get("bell_phase",1)==2 else 1.0)
static func pose(e: Dictionary, clock: float) -> Dictionary:
 var p = Vector2(e.x,e.y)
 var direction = Vector2(e.get("dx",0),e.get("dy",1)).normalized()
 if direction.length_squared()<0.001: direction = Vector2.DOWN
 var motion = e.get("motion",{})
 var action = 0
 var progress = 0.0
 var attack = e.get("bell_attack","cleave")
 if attack=="cleave":
  if e.state=="windup":
   action = 2
   progress = e.state_time/windup(e)
  elif e.state=="strike":
   action = 3
   progress = e.state_time/STRIKE.cleave
  elif e.state=="recover":
   action = 3
   progress = 1.0
 var base = Combat.weapon_pose(p,motion,direction,action,progress,Combat.BASE_REACH,clock)
 for key in ["body","hips","head","shoulder","elbow","hand"]: base[key] = p+(base[key]-p)*2
 base.head = base.body+Vector2(0,-130)
 if attack=="charge" and e.state in ["windup","strike"]:
  var coil = Combat.curve(e.state_time/windup(e)) if e.state=="windup" else 1.0
  var shift = direction*coil*10+Vector2(0,coil*8)
  for key in ["body","hips","head","shoulder","elbow","hand"]: base[key] += shift
 if attack=="toll" and e.state in ["windup","strike"]:
  var u = Combat.curve(e.state_time/windup(e)) if e.state=="windup" else 1.0
  base.head += Vector2(sin(clock*22)*u*1.6,-u*5)
 if e.state=="intro": base.head += Vector2(0,12*(1-Combat.curve(e.state_time/INTRO)))
 if e.state=="fracture": base.head += Vector2(sin(e.state_time*28)*2,4*sin(e.state_time*PI/FRACTURE))
 return base
static func blade(e: Dictionary, clock: float) -> PackedVector2Array:
 var weapon = pose(e,clock)
 var result = PackedVector2Array()
 for xy in [Vector2(42,-18),Vector2(74,-18),Vector2(74,18),Vector2(42,18)]: result.append(weapon.hand+xy.rotated(weapon.angle))
 return result
static func ring_radius(z: Dictionary) -> float: return maxf(0,float(z.get("age",0)))*RING_SPEED+12
static func ring_hits(z: Dictionary, p: Vector2, previous_radius: float) -> bool:
 var offset = p-Vector2(z.x,z.y)
 if absf(angle_difference(offset.angle(),float(z.gap)))<GAP: return false
 return offset.length()+8>=previous_radius-RING_WIDTH and offset.length()-8<=ring_radius(z)+RING_WIDTH
static func stop_sounds(g):
 for child in g.get_children():
  if child is AudioStreamPlayer and child.has_meta("castle_boss_sfx"):
   child.stop()
   child.stream = null
   child.queue_free()
static func sound(g, kind: String):
 if DisplayServer.get_name()=="headless": return
 var player = AudioStreamPlayer.new()
 player.set_meta("castle_boss_sfx",true)
 player.stream = load("res://assets/boss_"+kind+".wav")
 player.volume_db = -11 if kind=="bell" else -14
 g.add_child(player)
 player.finished.connect(player.queue_free)
 player.play()
static func ring(g, e: Dictionary, delay: float = 0.0):
 g.zones.append({"kind":"boss_ring","x":e.x,"y":e.y,"age":-delay,"timer":2.1+delay,"radius":12.0,"damage":2.0,"gap":e.get("bell_gap",0.0),"spent":false})
static func update(g, e: Dictionary, dt: float, slow: float):
 ensure(e)
 var p = Vector2(e.x,e.y)
 var before = p
 if e.hp<=e.max*0.5 and e.bell_phase==1 and e.state!="strike":
  g.zones = g.zones.filter(func(z): return z.kind!="boss_ring")
  e.bell_phase = 2
  e.state = "fracture"
  e.state_time = 0.0
  g.shake = maxf(g.shake,3.5)
  g.burst(p+Vector2(0,-120),Color("b99c60"),24)
  sound(g,"break")
 if e.state=="intro" and g.player.distance_to(p)>230: e.state_time = 0.0
 if e.state in ["intro","fracture"]:
  if e.state_time> (INTRO if e.state=="intro" else FRACTURE):
   e.state = "chase"
   e.state_time = 0.0
   e.timer = 0.5
 elif e.state=="windup":
  if e.state_time>=windup(e):
   e.state = "strike"
   e.state_time = 0.0
   e.strike_hit = false
   if e.bell_attack=="toll":
    ring(g,e)
    if e.bell_phase==2: ring(g,e,0.6)
    g.shake = maxf(g.shake,2.5)
    sound(g,"bell")
   elif e.bell_attack=="charge": sound(g,"impact")
 elif e.state=="strike":
  if e.bell_attack=="charge":
   var direction = Vector2(e.dx,e.dy)
   var next = p+direction*dt*(340 if e.bell_phase==2 else 295)*slow
   if not g.blocked(next,28): p = next
   else: e.state_time = STRIKE.charge
   var closest = Geometry2D.get_closest_point_to_segment(g.player,before,p)
   if not e.get("strike_hit",false) and closest.distance_to(g.player)<45:
    g.hurt(3,p)
    e.strike_hit = true
   if p.distance_to(before)<dt*30: e.state_time = STRIKE.charge
   if int(e.state_time*24)!=int((e.state_time-dt)*24): g.emit_particle(p,Color("70634d"),-direction*25,0.3,3)
  elif e.bell_attack=="cleave":
   var start = maxf(Combat.CONTACT_RATIO,(e.state_time-dt)/STRIKE.cleave)
   var end = minf(Combat.ACTIVE_END,e.state_time/STRIKE.cleave)
   if end>=start and not e.get("strike_hit",false) and not Combat.occluded(p,g.player,g.blocks):
    var probe = e.duplicate(true)
    for sample in range(9):
     probe.state_time = lerpf(start,end,sample/8.0)*STRIKE.cleave
     if Combat.polygon_capsule(blade(probe,g.elapsed),Combat.hurt_capsule(g.player,"player")).hit:
      g.hurt(3,p)
      e.strike_hit = true
      break
   if e.state_time>=STRIKE.cleave*Combat.CONTACT_RATIO and not e.get("bell_impact",false):
    e.bell_impact = true
    g.shake = maxf(g.shake,2.0)
    sound(g,"impact")
  if e.state_time>=STRIKE[e.bell_attack]:
   e.state = "recover"
   e.state_time = 0.0
 elif e.state=="recover":
  if e.state_time>=RECOVERY[e.bell_attack]:
   e.state = "chase"
   e.state_time = 0.0
   e.timer = 0.5 if e.bell_phase==2 else 0.8
 else:
  var to = g.player-p
  if to.length()>90: p = g.steer_move(p,to.normalized()*dt*43*slow,28)
  if e.timer<=0:
   var cycle = ["cleave","toll","charge","cleave"]
   e.bell_attack = cycle[int(e.bell_turn)%cycle.size()]
   e.bell_turn += 1
   e.bell_impact = false
   e.state = "windup"
   e.state_time = 0.0
   var direction = to.normalized() if to.length()>0.01 else Vector2.DOWN
   e.dx = direction.x
   e.dy = direction.y
   # Gap faces the player at preparation start; it never tracks during release.
   e.bell_gap = direction.angle()
   Motion.set_look(e.get("motion",{}),direction)
 e.x = p.x
 e.y = p.y
 e.motion = Motion.update(e.get("motion",{}),before,p,dt)
