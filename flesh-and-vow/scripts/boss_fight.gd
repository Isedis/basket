extends RefCounted
## Castle boss: persisted state machine, shared visible/physical attack geometry.
const Charge = preload("res://scripts/boss_charge.gd")
const Contact = preload("res://scripts/boss_contact.gd")
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
const INTRO = 1.6
const FRACTURE = 1.4
const FRACTURE_PULSE = 0.58
const FOLLOWUP_WINDUP = 0.72
const CHARGE_LINK = 0.48
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
 if e.get("bell_combo_step",0)==1 and e.get("bell_attack","")=="cleave":return FOLLOWUP_WINDUP
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
 # A blocked blade withdraws from the exact contact pose instead of completing its sweep.
 if attack=="cleave" and e.state=="recover" and e.get("bell_hit_kind","")=="stone":
  var contact = Combat.weapon_pose(p,motion,direction,3,float(e.bell_hit_u),Combat.BASE_REACH,clock)
  var rest = Combat.weapon_pose(p,motion,direction,0,0,Combat.BASE_REACH,clock)
  var settle = Combat.curve((e.state_time-0.1)/0.36)
  for key in ["body","hips","head","shoulder","elbow","hand"]:base[key] = contact[key].lerp(rest[key],settle)
  base.angle = lerp_angle(contact.angle,rest.angle,settle)
  for key in ["twist","coil","drive"]:base[key] = lerpf(contact[key],rest[key],settle)
 for key in ["body","hips","head","shoulder","elbow","hand"]: base[key] = p+(base[key]-p)*2
 # Shoulder line follows the whole skin; weapon contact uses this same wrist.
 for key in ["shoulder","elbow","hand"]: base[key] += Vector2(0,-14)
 base.head = base.body+Vector2(0,-130)
 if Charge.enabled(e) and e.state in ["windup","strike","recover"]:
  var weight = Charge.posture(e)
  var shift = direction*weight.lean+Vector2(0,weight.crouch)
  for key in ["body","hips","head","shoulder","elbow","hand"]:base[key] += shift
  base.angle = lerp_angle(base.angle,-PI/2+Motion.hand_sign(Motion.look_index(motion,direction))*0.08,weight.tuck)
  base.twist += Motion.hand_sign(Motion.look_index(motion,direction))*weight.crouch*0.003
  base.charge_rig = true
 elif attack=="charge" and e.state in ["windup","strike","recover"]:
  var coil = Combat.curve(e.state_time/windup(e)) if e.state=="windup" else (1-Combat.curve(e.state_time/0.25) if e.state=="recover" else 1.0)
  var shift = direction*coil*10+Vector2(0,coil*8)
  for key in ["body","hips","head","shoulder","elbow","hand"]: base[key] += shift
 if attack=="toll" and e.state in ["windup","strike","recover"]:
  var u = Combat.curve(e.state_time/windup(e)) if e.state=="windup" else (1-Combat.curve(e.state_time/0.25) if e.state=="recover" else 1.0)
  base.head += Vector2(sin(clock*22)*u*1.6,-u*5)
 if e.state=="intro": base.head += Vector2(0,12*(1-Combat.curve(e.state_time/INTRO)))
 if e.state=="fracture":
  var brace = sin(clampf(e.state_time/FRACTURE,0,1)*PI)
  # The complete skin braces together; never pull the helmet off the neck.
  for key in ["body","hips","head","shoulder","elbow","hand"]:base[key] += Vector2(0,brace*6)
  base.head += Vector2(sin(e.state_time*28)*brace*1.5,0)
  base.angle += Motion.hand_sign(Motion.look_index(motion,direction))*brace*0.06
 if attack=="cleave" and e.get("bell_hit_kind","") in ["flesh","stone"]:
  var age = float(e.get("bell_hit_age",1.0))
  var duration = 0.24 if e.bell_hit_kind=="stone" else 0.16
  var recoil = sin(clampf(age/duration,0,1)*PI)*pow(1-clampf(age/duration,0,1),0.5)
  var axis = Vector2(e.get("bell_hit_dx",direction.x),e.get("bell_hit_dy",direction.y))
  var shift = -axis*recoil*(6 if e.bell_hit_kind=="stone" else 2.5)
  for key in ["body","hips","head","shoulder","elbow","hand"]:base[key] += shift
  base.angle -= Motion.hand_sign(Motion.look_index(motion,direction))*recoil*(0.18 if e.bell_hit_kind=="stone" else 0.08)
 base.torso = base.body+Vector2(0,-77)
 base.torso_angle = base.twist*0.6
 return base
static func blade(e: Dictionary, clock: float) -> PackedVector2Array:
 var weapon = pose(e,clock)
 var result = PackedVector2Array()
 for xy in [Vector2(42,-18),Vector2(74,-18),Vector2(74,18),Vector2(42,18)]: result.append(weapon.hand+xy.rotated(weapon.angle))
 return result
static func recovery(e: Dictionary) -> float:
 var attack = e.get("bell_attack","cleave")
 if Charge.enabled(e) and e.get("bell_charge_wall",false):return Charge.WALL_RECOVERY
 if attack=="charge" and e.get("bell_followup_pending",false):return CHARGE_LINK
 return RECOVERY[attack]+(0.3 if e.get("bell_combo_step",0)==1 else 0.0)+(0.25 if attack=="cleave" and e.get("bell_hit_kind","")=="stone" else 0.0)
static func begin_attack(g,e: Dictionary,attack: String,followup: bool = false):
 e.bell_attack = attack
 if attack=="charge":Charge.prepare(e)
 else:e.bell_charge_rig = false
 e.bell_combo_step = 1 if followup else 0
 e.bell_followup_pending = attack=="charge" and e.get("bell_phase",1)==2
 e.bell_impact = false
 e.bell_hit_kind = ""
 e.bell_hit_age = 2.0
 e.strike_hit = false
 e.state = "windup"
 e.state_time = 0.0
 var to = g.player-Vector2(e.x,e.y)
 var direction = to.normalized() if to.length()>0.01 else Vector2.DOWN
 e.dx = direction.x
 e.dy = direction.y
 # Aim and safe wedge commit once, including the separately warned follow-up.
 e.bell_gap = direction.angle()
 Motion.set_look(e.get("motion",{}),direction)
static func contact_at(g,probe: Dictionary,progress: float,boxes: Array,player_visible: bool) -> Dictionary:
 probe.state_time = progress*STRIKE.cleave
 var weapon = pose(probe,g.elapsed)
 var hit = Contact.at(g,blade(probe,g.elapsed),weapon.hand,boxes,player_visible)
 if not hit.is_empty():hit.progress = progress
 return hit
static func sweep_contact(g,e: Dictionary,start: float,end: float) -> Dictionary:
 var boxes = Contact.surfaces(g)
 var visible = not Combat.occluded(Vector2(e.x,e.y),g.player,g.blocks)
 var probe = e.duplicate(true)
 probe.bell_hit_kind = ""
 probe.state_time = start*STRIKE.cleave
 var a = pose(probe,g.elapsed).angle
 probe.state_time = end*STRIKE.cleave
 var b = pose(probe,g.elapsed).angle
 var samples = clampi(int(ceil(absf(angle_difference(a,b))*150/3)),1,64)
 var previous = start
 for i in range(samples+1):
  var u = lerpf(start,end,i/float(samples))
  var hit = contact_at(g,probe,u,boxes,visible)
  if not hit.is_empty():
   var low = previous
   var high = u
   for _refine in range(7):
    var middle = (low+high)*0.5
    var candidate = contact_at(g,probe,middle,boxes,visible)
    if candidate.is_empty():low = middle
    else:
     high = middle
     hit = candidate
   return hit
  previous = u
 return {}
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
 player.volume_db = {"bell":-11,"flesh":-8,"stone":-10,"swing":-18,"step":-22,"launch":-14,"brake":-19}.get(kind,-14)
 g.add_child(player)
 player.finished.connect(player.queue_free)
 player.play()
static func ring(g, e: Dictionary, delay: float = 0.0):
 g.zones.append({"kind":"boss_ring","x":e.x,"y":e.y,"age":-delay,"timer":2.1+delay,"radius":12.0,"damage":2.0,"gap":e.get("bell_gap",0.0),"spent":false})
static func update(g, e: Dictionary, dt: float, slow: float):
 ensure(e)
 if e.has("bell_hit_age"):e.bell_hit_age = minf(2,float(e.bell_hit_age)+dt)
 var p = Vector2(e.x,e.y)
 var before = p
 if e.hp<=e.max*0.5 and e.bell_phase==1 and e.state!="strike":
  g.zones = g.zones.filter(func(z): return z.kind!="boss_ring")
  e.bell_phase = 2
  e.state = "fracture"
  e.state_time = 0.0
  e.bell_fracture_hit = false
  e.bell_combo_step = 0
  e.bell_followup_pending = false
  e.bell_hit_kind = ""
 if e.state=="fracture" and not e.get("bell_fracture_hit",true) and e.state_time>=FRACTURE_PULSE:
  e.bell_fracture_hit = true
  g.hit_stop = maxf(g.hit_stop,0.075)
  g.shake = maxf(g.shake,4.5)
  g.shake_axis = Vector2(0,1)
  g.burst(p+Vector2(0,-130),Color("e3a35d"),18)
  sound(g,"break")
 if e.state=="intro" and g.player.distance_to(p)>230: e.state_time = 0.0
 if e.state in ["intro","fracture"]:
  if e.state_time> (INTRO if e.state=="intro" else FRACTURE):
   e.state = "chase"
   e.state_time = 0.0
   e.timer = 0.5
   if e.bell_phase==2:e.bell_turn = 1 # Start the new phase with the double toll.
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
   elif e.bell_attack=="charge":
    if Charge.enabled(e):
     Charge.launch(e)
     sound(g,"launch")
    else:sound(g,"impact")
   elif e.bell_attack=="cleave":sound(g,"swing")
 elif e.state=="strike":
  if e.bell_attack=="charge":
   var direction = Vector2(e.dx,e.dy)
   if Charge.enabled(e):
    if e.state_time>=STRIKE.charge-Charge.BRAKE and not e.get("bell_charge_braked",false):
     e.bell_charge_braked = true
     sound(g,"brake")
    p = Charge.travel(g,e,p,dt,slow)
   else:
    var next = p+direction*dt*(340 if e.bell_phase==2 else 295)*slow
    if not g.blocked(next,28):p = next
    else:e.state_time = STRIKE.charge
   var closest = Geometry2D.get_closest_point_to_segment(g.player,before,p)
   if not e.get("strike_hit",false) and closest.distance_to(g.player)<45 and not Combat.occluded(closest,g.player,g.blocks):
    g.hurt(3,p)
    e.strike_hit = true
   if not Charge.enabled(e):
    if p.distance_to(before)<dt*30:e.state_time = STRIKE.charge
    if int(e.state_time*24)!=int((e.state_time-dt)*24):g.emit_particle(p,Color("70634d"),-direction*25,0.3,3)
  elif e.bell_attack=="cleave":
   var start = maxf(Combat.CONTACT_RATIO,(e.state_time-dt)/STRIKE.cleave)
   var end = minf(Combat.ACTIVE_END,e.state_time/STRIKE.cleave)
   if end>=start and not e.get("strike_hit",false):
    var contact = sweep_contact(g,e,start,end)
    if not contact.is_empty():
     var old_time = e.state_time
     e.state_time = contact.progress*STRIKE.cleave
     if Contact.feedback(g,e,contact):
      sound(g,contact.kind)
      if contact.kind=="stone":
       e.state = "recover"
       e.state_time = 0.0
     else:e.state_time = old_time
  if e.state=="strike" and e.state_time>=STRIKE[e.bell_attack]:
   e.state = "recover"
   e.state_time = 0.0
 elif e.state=="recover":
  if e.state_time>=recovery(e):
   if e.bell_attack=="charge" and e.get("bell_followup_pending",false):
    begin_attack(g,e,"cleave",true)
   else:
    e.state = "chase"
    e.state_time = 0.0
    e.timer = 0.5 if e.bell_phase==2 else 0.8
 else:
  var to = g.player-p
  if to.length()>90: p = g.steer_move(p,to.normalized()*dt*43*slow,28)
  if e.timer<=0:
   var cycle = ["cleave","toll","charge","cleave"]
   var attack = cycle[int(e.bell_turn)%cycle.size()]
   e.bell_turn += 1
   begin_attack(g,e,attack)
 e.x = p.x
 e.y = p.y
 if Charge.enabled(e) and e.state in ["windup","strike","recover"]:Charge.gait(g,e,before,p,dt)
 else:e.motion = Motion.update(e.get("motion",{}),before,p,dt,96,24)
