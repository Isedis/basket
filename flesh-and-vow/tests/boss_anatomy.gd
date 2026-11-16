extends SceneTree
const View = preload("res://scripts/boss_view.gd")
const BodySkin = preload("res://scripts/boss_skin.gd")
const Fight = preload("res://scripts/boss_fight.gd")
class Surface extends RefCounted:
 var elapsed = 1.0
 var meshes: Array = []
 var polygons: Array = []
 var order: Array = []
 func draw_mesh(mesh,texture,transform,color):
  meshes.append({"mesh":mesh,"texture":texture})
  order.append("body")
 func draw_polygon(points,colors,uv,texture):
  polygons.append(texture)
  order.append("weapon")
 func draw_polyline(_p,_c,_w):pass
var checks = 0
var failures = 0
func check(ok: bool,label: String):
 checks += 1
 if not ok:
  failures += 1
  push_error(label)
func entity(look: int) -> Dictionary:
 var aim: Vector2 = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][look]
 return {"x":200.0,"y":210.0,"dx":aim.x,"dy":aim.y,"state":"chase","state_time":0.0,"bell_phase":1,"bell_attack":"cleave","motion":Fight.Motion.initialize(Vector2(200,210),1,look)}
func inspect(e: Dictionary,dead: bool = false):
 var surface = Surface.new()
 View.actor(surface,e,dead)
 check(surface.meshes.size()==1 and surface.meshes[0].texture==BodySkin.ATLAS,"Entire body must use one full connected skin")
 var held = View.textures(int(e.motion.look))[6]
 check(surface.polygons.size()==2 and surface.polygons.all(func(tex): return tex==held),"Only the held axe may be drawn independently")
 var arrays = surface.meshes[0].mesh.surface_get_arrays(0)
 var valid = true
 for v in arrays[Mesh.ARRAY_VERTEX]:valid = valid and is_finite(v.x) and is_finite(v.y)
 check(valid and arrays[Mesh.ARRAY_INDEX].size()==BodySkin.indices.size(),"Depth ordering preserves every triangle and shared vertex")
 check(BodySkin.body_groups[int(e.motion.look)].arm.size()>0 and BodySkin.body_groups[int(e.motion.look)].core.size()>0,"Depth groups contain the arm and connected torso")
 if not dead:
  var pose = Fight.pose(e,1.0)
  var side = Fight.Motion.hand_sign(int(e.motion.look))
  var wrist = 60.0 if int(e.motion.look) in [1,3] else 72.0
  var front = BodySkin.arm_in_front(pose,int(e.motion.look))
  check(surface.order==(["weapon","body","weapon"] if front else ["weapon","weapon","body"]),"Axe handle stays under fist; blade follows the visible arm depth")
  var mapped = BodySkin.point(Vector2(side*wrist,-86),e,pose,int(e.motion.look))
  check(mapped.distance_to(pose.hand)<0.01,"Whole skin wrist coincides with weapon grip and contact geometry")
func _initialize():call_deferred("run")
func run():
 for look in range(4):
  for attack in ["cleave","charge","toll"]:
   for phase in [1,2]:
    for state in ["chase","windup","strike","recover"]:
     for ratio in [0.0,0.5,1.0]:
      var e=entity(look)
      e.bell_phase=phase
      e.bell_attack=attack
      e.state=state
      var duration=Fight.windup(e) if state=="windup" else (Fight.STRIKE[attack] if state=="strike" else Fight.RECOVERY[attack])
      e.state_time=duration*ratio
      inspect(e)
  for time in [0.0,0.2,0.4,0.58,0.8,1.1,1.4]:
   var fracture=entity(look)
   fracture.bell_phase=2
   fracture.state="fracture"
   fracture.state_time=time
   inspect(fracture)
  for state in ["windup","strike","recover"]:
   for ratio in [0.0,0.25,0.5,0.75,1.0]:
    var combo=entity(look)
    combo.bell_phase=2
    combo.bell_combo_step=1
    combo.state=state
    var duration=Fight.windup(combo) if state=="windup" else (Fight.STRIKE.cleave if state=="strike" else Fight.recovery(combo))
    combo.state_time=duration*ratio
    inspect(combo)
  for wall in [false,true]:
   for state in ["windup","strike","recover"]:
    for ratio in [0.0,0.2,0.4,0.6,0.8,1.0]:
     var heavy=entity(look)
     heavy.bell_phase=2
     heavy.bell_attack="charge"
     heavy.bell_charge_rig=true
     heavy.bell_charge_wall=wall
     heavy.bell_charge_stop_lean=16 if wall else -4
     heavy.bell_charge_stop_crouch=8 if wall else 6
     heavy.state=state
     heavy.state_time=ratio*(Fight.windup(heavy) if state=="windup" else (Fight.STRIKE.charge if state=="strike" else Fight.recovery(heavy)))
     heavy.motion.phase=ratio*TAU
     heavy.motion.walk_weight=1.0 if state=="strike" else 0.0
     for i in range(2):
      var at=sin(heavy.motion.phase+i*PI)*18
      heavy.motion.feet[i].x=heavy.x+(-6 if i==0 else 6)+heavy.dx*at
      heavy.motion.feet[i].y=heavy.y+heavy.dy*at
      heavy.motion.feet[i].lift=maxf(0,sin(heavy.motion.phase+i*PI))*4
     inspect(heavy)
  for phase in [1,2]:
   var e=entity(look)
   e.bell_phase=phase
   e.state="strike"
   e.state_time=0.3
   e.bell_snapshot=e.duplicate(true)
   e.bell_clock=1.0
   for age in [0.0,0.3,1.0]:
    e.age=age
    inspect(e,true)
  for kind in ["flesh","stone"]:
   for age in [0.0,0.06,0.12,0.35]:
    var contact=entity(look)
    contact.state="recover" if kind=="stone" else "strike"
    contact.state_time=age if kind=="stone" else 0.35*Fight.STRIKE.cleave
    contact.bell_hit_kind=kind
    contact.bell_hit_u=0.35
    contact.bell_hit_age=age
    contact.bell_hit_dx=contact.dx
    contact.bell_hit_dy=contact.dy
    inspect(contact)
  var e=entity(look)
  e.bell_snapshot=e.duplicate(true)
  e.bell_clock=1.0
  e.age=0.35
  var first=Surface.new()
  View.actor(first,e,true)
  var delta=Vector2(180,-35)
  e.x+=delta.x
  e.y+=delta.y
  Fight.Motion.shift(e.motion,delta)
  var second=Surface.new()
  View.actor(second,e,true)
  var a=first.meshes[0].mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
  var b=second.meshes[0].mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
  var stable=true
  for i in range(a.size()):stable=stable and Vector2(b[i].x-a[i].x,b[i].y-a[i].y).distance_to(delta)<0.01
  check(stable,"Sliding corpse moves the complete skin together")
 print("BOSS ANATOMY CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
