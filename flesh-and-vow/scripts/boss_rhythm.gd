extends RefCounted
const Motion=preload("res://scripts/locomotion.gd")
const TURN=2.25
const SPEED=48.0
const POISE=0.26
static func enabled(e: Dictionary) -> bool:return e.get("bell_rhythm",false)
static func prepare(e: Dictionary):
 if enabled(e):return
 e.bell_rhythm=true
 e.bell_poise=0.0
 e.bell_aim_time=0.0
 e.bell_walk_speed=0.0
 e.bell_intent=""
 e.bell_last_primary=""
static func select(e: Dictionary,distance: float) -> String:
 if e.bell_phase==2 and e.bell_turn==1:return "toll"
 var last=e.get("bell_last_primary","")
 if distance>300:return ""
 if distance>160:return "charge" if last!="charge" else "toll"
 if distance>105:return "toll" if last!="toll" else ""
 return "cleave" if last!="cleave" else "toll"
static func reset(e: Dictionary):
 e.bell_poise=0.0
 e.bell_aim_time=0.0
 e.bell_walk_speed=0.0
 e.bell_intent=""
static func step(g,e: Dictionary,dt: float,slow: float) -> Dictionary:
 var p=Vector2(e.x,e.y)
 var to=g.player-p
 var direction=Vector2(e.dx,e.dy)
 if direction.length_squared()<0.001:direction=Vector2.DOWN
 var angle=direction.angle()
 var target=to.angle() if to.length_squared()>1 else angle
 var error=angle_difference(angle,target)
 angle+=clampf(error,-TURN*dt,TURN*dt)
 direction=Vector2.from_angle(angle)
 e.dx=direction.x
 e.dy=direction.y
 if e.timer>0:
  reset(e)
  return {"p":p,"attack":""}
 e.bell_aim_time+=dt
 if e.bell_intent=="":e.bell_intent=select(e,to.length())
 if e.bell_intent=="cleave" and to.length()>145:
  e.bell_intent=""
  e.bell_poise=0.0
 var moving=e.bell_intent=="" and absf(angle_difference(angle,target))<0.4
 var target_speed=SPEED*slow if moving else 0.0
 e.bell_walk_speed=move_toward(float(e.bell_walk_speed),target_speed,160*dt)
 if e.bell_walk_speed>0:
  p=g.steer_move(p,direction*e.bell_walk_speed*dt,28)
 if e.bell_intent!="" and e.bell_walk_speed<0.01:
  e.bell_poise+=dt
  if e.bell_poise>=POISE and (absf(angle_difference(angle,target))<0.18 or e.bell_aim_time>=1.2):
   return {"p":p,"attack":e.bell_intent}
 else:e.bell_poise=0.0
 return {"p":p,"attack":""}
