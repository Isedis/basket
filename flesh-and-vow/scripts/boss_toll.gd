extends RefCounted
## Planted toll posture. Released wave age drives both visual recoil and sound.
const Motion = preload("res://scripts/locomotion.gd")
const Combat = preload("res://scripts/combat.gd")
const SECOND = 0.6
static func enabled(e: Dictionary) -> bool:
 return e.get("bell_toll_rig",false) and e.get("bell_attack","")=="toll"
static func prepare(e: Dictionary):
 e.bell_toll_rig = true
 e.bell_toll_serial = int(e.get("bell_toll_serial",0))+1
 e.bell_toll_token = "%s:%s:%s"%[e.bell_toll_serial,e.x,e.y]
 e.bell_toll_clock = -1.0
 e.bell_toll_pulses = 0
 e.bell_toll_plant = []
 for f in e.motion.feet:e.bell_toll_plant.append({"x":float(f.x)-e.x,"y":float(f.y)-e.y,"lift":float(f.lift)})
static func curve(u: float) -> float:return Combat.curve(u)
static func impulse(age: float) -> float:
 if age<0 or age>=0.24:return 0.0
 return sin(age/0.24*PI)*exp(-age*5)
static func energy(e: Dictionary) -> float:
 var t = float(e.get("bell_toll_clock",-1))
 var count = int(e.get("bell_toll_pulses",0))
 return (impulse(t) if count>=1 else 0.0)+(impulse(t-SECOND) if count>=2 else 0.0)
static func last_pulse(e: Dictionary) -> float:return SECOND if e.get("bell_phase",1)==2 else 0.0
static func posture(e: Dictionary) -> Dictionary:
 var load = 0.0
 var spread = 0.0
 var rock = 0.0
 var chain = 0.0
 if e.state=="windup":
  var duration = 1.15*(0.82 if e.get("bell_phase",1)==2 else 1.0)
  var u = clampf(e.state_time/duration,0,1)
  load = curve(u/0.85)
  spread = curve(u/0.55)
 else:
  var t = maxf(0,float(e.get("bell_toll_clock",0)))
  load = 1-curve(t/0.45)
  if e.get("bell_phase",1)==2:
   var second = curve((t-(SECOND-0.24))/0.24) if t<=SECOND else 1-curve((t-SECOND)/0.45)
   load = maxf(load,second)
  spread = 1-curve((t-last_pulse(e)-0.28)/0.36)
  for i in range(mini(2,int(e.get("bell_toll_pulses",0)))):
   var age = t-i*SECOND
   if age<0:continue
   rock += sin(age*40)*exp(-age*8)*0.035
   chain += sin(age*34)*exp(-age*7)*2.2
 return {"load":load,"crouch":8*load-10*energy(e),"spread":spread,"rock":rock,"chain":chain}
static func gait(e: Dictionary,before: Vector2,p: Vector2,dt: float):
 e.motion = Motion.update(e.motion,before,p,dt,96,24)
 var weight = posture(e)
 for i in range(2):
  var side = -1.0 if i==0 else 1.0
  var at = Vector2(side*(6+8*weight.spread),0)
  var lift = 0.0
  if e.state=="windup" and e.has("bell_toll_plant"):
   var duration = 1.15*(0.82 if e.get("bell_phase",1)==2 else 1.0)
   var blend = curve(e.state_time/(duration*0.45))
   var initial = e.bell_toll_plant[i]
   at = Vector2(initial.x,initial.y).lerp(at,blend)
   lift = float(initial.lift)*(1-blend)
  var f = e.motion.feet[i]
  f.x = p.x+at.x
  f.y = p.y+at.y
  f.lift = lift
  f.stance = true
  f.sx = f.x
  f.sy = f.y
static func sync(g,z: Dictionary):
 if not z.has("toll_token"):return # Legacy pending waves are never given a new pulse.
 var owner: Dictionary = {}
 for e in g.enemies:
  if e.type=="boss0" and enabled(e) and e.get("bell_toll_token","")==z.toll_token and e.state in ["strike","recover"]:
   owner=e
   break
 if not owner.is_empty():owner.bell_toll_clock=maxf(0,float(z.age)+float(z.pulse_delay))
 if z.age<0 or z.get("pulse_spent",false):return
 z.pulse_spent = true
 if owner.is_empty():return
 owner.bell_toll_pulses=maxi(int(owner.get("bell_toll_pulses",0)),int(z.pulse)+1)
 g.hit_stop=maxf(g.hit_stop,0.055 if int(z.pulse)==1 else 0.045)
 g.shake=maxf(g.shake,3.4 if int(z.pulse)==1 else 2.8)
 g.shake_axis=Vector2.DOWN
 var p=Vector2(owner.x,owner.y)
 for i in range(8):g.emit_particle(p+Vector2((i%2*2-1)*24,0),Color("8b795a"),Vector2((i-3.5)*12,-12-(i%3)*8),0.18+(i%3)*0.03,2)
 g.BossFight.sound(g,"bell",0.92 if int(z.pulse)==1 else 1.0)
