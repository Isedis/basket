extends RefCounted
## New charges opt in at preparation; already saved charges retain their original motion.
const Motion = preload("res://scripts/locomotion.gd")
const Combat = preload("res://scripts/combat.gd")
const DURATION = 0.72
const ACCEL = 0.10
const BRAKE = 0.22
const WALL_RECOVERY = 1.35
const FRONT = 24.0
static func enabled(e: Dictionary) -> bool:
 return e.get("bell_charge_rig",false) and e.get("bell_attack","")=="charge"
static func integral(time: float) -> float:
 var t = clampf(time,0,DURATION)
 var cruise_end = DURATION-BRAKE
 if t<ACCEL:return t*t/(2*ACCEL)
 if t<cruise_end:return t-ACCEL/2
 var b = t-cruise_end
 return cruise_end-ACCEL/2+b-b*b/(2*BRAKE)
static func distance(e: Dictionary,from: float,to: float) -> float:
 var speed = 340.0 if e.get("bell_phase",1)==2 else 295.0
 return speed*DURATION/(DURATION-(ACCEL+BRAKE)/2)*(integral(to)-integral(from))
static func offsets(e: Dictionary) -> Array:
 var p = Vector2(e.x,e.y)
 var result: Array=[]
 for i in range(2):
  var f = e.motion.feet[i]
  result.append({"x":float(f.x)-p.x,"y":float(f.y)-p.y,"lift":float(f.lift)})
 return result
static func prepare(e: Dictionary):
 e.bell_charge_rig = true
 e.bell_charge_wall = false
 e.bell_charge_braked = false
 e.bell_charge_steps = 0
 e.bell_charge_plant = offsets(e)
 e.erase("bell_charge_stop_feet")
 e.erase("bell_charge_stopping")
 e.erase("bell_charge_contact_time")
static func launch(e: Dictionary):
 e.motion.started = true
 e.motion.phase = 0.0
 for i in range(2):
  var f = e.motion.feet[i]
  f.stance = i==0
  f.sx = f.x
  f.sy = f.y
static func posture(e: Dictionary) -> Dictionary:
 var t = float(e.state_time)
 var lean = 0.0
 var crouch = 0.0
 var tuck = 0.0
 if e.state=="windup":
  var duration = 1.12*(0.82 if e.get("bell_phase",1)==2 else 1.0)
  var u = clampf(t/duration,0,1)
  var load = Combat.curve(u/0.65)
  var push = Combat.curve((u-0.62)/0.38)
  lean = -6*load+18*push
  crouch = 8*load
  tuck = load
 elif e.state=="strike":
  var brake = Combat.curve((t-(DURATION-BRAKE))/BRAKE)
  lean = lerpf(12,16,Combat.curve(t/ACCEL))*(1-brake)-4*brake
  crouch = lerpf(8,6,brake)
  tuck = 1.0
 elif e.state=="recover":
  var settle = Combat.curve(t/0.36)
  lean = lerpf(float(e.get("bell_charge_stop_lean",-4)),0,settle)
  lean -= sin(clampf(t/0.28,0,1)*PI)*(8 if e.get("bell_charge_wall",false) else 3)
  crouch = lerpf(float(e.get("bell_charge_stop_crouch",6)),0,settle)
  tuck = 1-settle
 return {"lean":lean,"crouch":crouch,"tuck":tuck}
static func stop(e: Dictionary,wall: bool):
 var held = posture(e)
 e.bell_charge_stop_lean = held.lean
 e.bell_charge_stop_crouch = held.crouch
 e.bell_charge_wall = wall
 e.bell_charge_stopping = true
 e.state = "recover"
 e.state_time = 0.0
static func travel(g,e: Dictionary,from: Vector2,dt: float,slow: float) -> Vector2:
 var dir = Vector2(e.dx,e.dy)
 var amount = distance(e,maxf(0,e.state_time-dt),e.state_time)*slow
 var target = from+dir*amount
 var safe = from
 # Substeps and refinement preserve the first contact, even against thin cover.
 for i in range(1,maxi(1,int(ceil(amount/3)))+1):
  var at = from.lerp(target,i/float(maxi(1,int(ceil(amount/3)))))
  if g.blocked(at+dir*FRONT,28):
   var low = safe
   var high = at
   for _j in range(9):
    var mid = (low+high)/2
    if g.blocked(mid+dir*FRONT,28):high=mid
    else:low=mid
   var start_time = maxf(0,e.state_time-dt)
   var low_time = start_time
   var high_time = float(e.state_time)
   var covered = from.distance_to(low)/maxf(0.001,slow)
   for _j in range(12):
    var mid_time = (low_time+high_time)/2
    if distance(e,start_time,mid_time)<covered:low_time=mid_time
    else:high_time=mid_time
   e.state_time = (low_time+high_time)/2
   e.bell_charge_contact_time = e.state_time
   stop(e,true)
   impact(g,e,low,dir)
   return low
  safe = at
 if e.state_time>=DURATION:stop(e,false)
 return target
static func visual_feet(e: Dictionary) -> Array:
 var p = Vector2(e.x,e.y)
 var result: Array=[]
 for i in range(2):
  var f = e.motion.feet[i]
  var raw = Vector2(float(f.x)-p.x-(-6 if i==0 else 6),(float(f.y)-p.y)*0.55-float(f.lift)*1.65)
  result.append(Vector2(clampf(raw.x,-16,16),clampf(raw.y,-14,9)))
 return result
static func step(g,e: Dictionary,i: int):
 e.bell_charge_steps = int(e.get("bell_charge_steps",0))+1
 var dir = Vector2(e.dx,e.dy)
 var p = Vector2(e.x,e.y)+Vector2(-20 if i==0 else 20,0)+visual_feet(e)[i]
 for n in range(5):g.emit_particle(p,Color("716954"),-dir*(18+n*4)+Vector2((n-2)*8,-12),0.18+n*0.02,2)
 g.shake = maxf(g.shake,0.65)
 g.shake_axis = Vector2.DOWN
 g.BossFight.sound(g,"step")
static func gait(g,e: Dictionary,before: Vector2,p: Vector2,dt: float):
 var old = e.motion.get("feet",[]).duplicate(true)
 var stride = 56.0 if e.state=="strike" and e.state_time>DURATION-BRAKE else 88.0
 e.motion = Motion.update(e.motion,before,p,dt,stride,18)
 if e.state=="windup" and e.has("bell_charge_plant"):
  var duration = 1.12*(0.82 if e.get("bell_phase",1)==2 else 1.0)
  var blend = Combat.curve(e.state_time/(duration*0.45))
  var dir = Vector2(e.dx,e.dy)
  for i in range(2):
   var initial = e.bell_charge_plant[i]
   var target = Vector2(-6 if i==0 else 6,0)+dir*(-8 if i==0 else 6)
   var at = Vector2(initial.x,initial.y).lerp(target,blend)
   e.motion.feet[i].x = p.x+at.x
   e.motion.feet[i].y = p.y+at.y
   e.motion.feet[i].lift = lerpf(float(initial.lift),0,blend)
 elif e.state=="recover":
  if e.get("bell_charge_stopping",false):
   e.bell_charge_stop_feet = offsets(e)
   e.bell_charge_stopping = false
  if e.has("bell_charge_stop_feet"):
   var blend = Combat.curve(e.state_time/0.32)
   for i in range(2):
    var initial = e.bell_charge_stop_feet[i]
    var at = Vector2(initial.x,initial.y).lerp(Vector2(-6 if i==0 else 6,0),blend)
    var f = e.motion.feet[i]
    f.x = p.x+at.x
    f.y = p.y+at.y
    f.lift = float(initial.lift)*(1-blend)
    if blend>=1:
     f.stance = true
     f.sx = f.x
     f.sy = f.y
 else:
  for i in range(2):
   if old.size()==2 and e.motion.feet[i].stance and not old[i].stance:step(g,e,i)
static func impact(g,e: Dictionary,p: Vector2,dir: Vector2):
 var point = p+dir*(28+FRONT)-Vector2(0,24)
 g.hit_stop = maxf(g.hit_stop,0.075)
 g.shake = maxf(g.shake,4.8)
 g.shake_axis = dir
 g.melee_contacts.append({"point":point,"life":0.2,"total":0.2,"axis":dir,"power":2.0,"material":"stone","armored":true})
 for i in range(14):g.emit_particle(point,Color("b6a486") if i%3==0 else Color("777264"),-dir*(35+i*4)+Vector2((i%5-2)*17,-35),0.22+(i%3)*0.04,2 if i%3==0 else 3)
 g.BossFight.sound(g,"stone")
