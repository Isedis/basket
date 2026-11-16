extends SceneTree
const View = preload("res://scripts/boss_view.gd")
const BodySkin = preload("res://scripts/boss_skin.gd")
const Fight = preload("res://scripts/boss_fight.gd")
class Surface extends RefCounted:
 var elapsed = 1.0
 var meshes: Array = []
 var polygons: Array = []
 func draw_mesh(mesh,texture,transform,color):meshes.append({"mesh":mesh,"texture":texture})
 func draw_polygon(points,colors,uv,texture):polygons.append(texture)
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
 check(surface.polygons.size()==1 and surface.polygons[0]==held,"Only the held axe may be drawn independently")
 var arrays = surface.meshes[0].mesh.surface_get_arrays(0)
 var valid = true
 for v in arrays[Mesh.ARRAY_VERTEX]:valid = valid and is_finite(v.x) and is_finite(v.y)
 check(valid and arrays[Mesh.ARRAY_INDEX].size()>0,"Deformed body mesh has valid shared vertices")
 if not dead:
  var pose = Fight.pose(e,1.0)
  var side = Fight.Motion.hand_sign(int(e.motion.look))
  var wrist = 60.0 if int(e.motion.look) in [1,3] else 72.0
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
