extends SceneTree
const View = preload("res://scripts/boss_view.gd")
const Fight = preload("res://scripts/boss_fight.gd")
class Surface extends RefCounted:
 var elapsed = 1.0
 var calls: Array = []
 func draw_polygon(points, colors, uv, tex): calls.append({"points":points,"uv":uv,"texture":tex})
 func draw_polyline(_points,_color,_width): pass
var checks = 0
var failures = 0
var images: Dictionary = {}
func check(ok: bool, label: String):
 checks += 1
 if not ok:
  failures += 1
  if failures<=12: push_error(label)
func opaque(call: Dictionary, point: Vector2) -> bool:
 for indices in [[0,1,2],[0,2,3]]:
  var a: Vector2 = call.points[indices[0]]
  var b: Vector2 = call.points[indices[1]]-a
  var c: Vector2 = call.points[indices[2]]-a
  var det = b.cross(c)
  if absf(det)<0.001: continue
  var q = point-a
  var u = q.cross(c)/det
  var v = b.cross(q)/det
  if u<0 or v<0 or u+v>1: continue
  var uv: Vector2 = call.uv[indices[0]]*(1-u-v)+call.uv[indices[1]]*u+call.uv[indices[2]]*v
  var tex = call.texture
  if not images.has(tex): images[tex] = tex.get_image()
  var image: Image = images[tex]
  var xy = Vector2i(uv*Vector2(image.get_size()))
  xy.x = clampi(xy.x,0,image.get_width()-1)
  xy.y = clampi(xy.y,0,image.get_height()-1)
  return image.get_pixelv(xy).a>0.5
 return false
func bounds(call: Dictionary) -> Rect2:
 var rect = Rect2(call.points[0],Vector2.ZERO)
 for p in call.points: rect = rect.expand(p)
 return rect
func overlap(a: Dictionary, b: Dictionary) -> int:
 var rect = bounds(a).intersection(bounds(b))
 if not rect.has_area(): return 0
 var count = 0
 for y in range(int(floor(rect.position.y)),int(ceil(rect.end.y)),2):
  for x in range(int(floor(rect.position.x)),int(ceil(rect.end.x)),2):
   var p = Vector2(x+1,y+1)
   if opaque(a,p) and opaque(b,p): count += 1
 return count
func entity(look: int) -> Dictionary:
 var aim: Vector2 = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][look]
 return {"x":200.0,"y":210.0,"dx":aim.x,"dy":aim.y,"state":"chase","state_time":0.0,"bell_phase":1,"bell_attack":"cleave","motion":Fight.Motion.initialize(Vector2(200,210),1,look)}
func inspect(e: Dictionary, dead: bool = false):
 var canvas = Surface.new()
 View.actor(canvas,e,dead)
 var art = View.textures(int(e.motion.look))
 var torso = canvas.calls.filter(func(c): return c.texture==art[1])[0]
 var whole_bells = canvas.calls.filter(func(c): return c.texture==art[0])
 check(whole_bells.size()==1,"Bell must remain one intact sprite: "+str([e.motion.look,e.state,e.bell_phase,dead]))
 for leg in [4,5]:
  var quads = canvas.calls.filter(func(c): return c.texture==art[leg])
  check(not quads.is_empty() and overlap(torso,quads[0])>=3,"Opaque thigh must overlap torso, not float below cloth: "+str([e.motion.look,e.state,e.bell_attack,e.state_time,leg,dead]))
func _initialize(): call_deferred("run")
func run():
 for look in range(4):
  for attack in ["cleave","charge","toll"]:
   for phase in [1,2]:
    for state in ["chase","windup","strike","recover"]:
     for ratio in [0.0,0.5,1.0]:
      var e = entity(look)
      e.bell_attack = attack
      e.bell_phase = phase
      e.state = state
      var duration = Fight.windup(e) if state=="windup" else (Fight.STRIKE[attack] if state=="strike" else Fight.RECOVERY[attack])
      e.state_time = ratio*duration
      inspect(e)
   var e = entity(look)
   e.bell_attack = attack
   e.state = "strike"
   e.state_time = Fight.STRIKE[attack]
   var end = Fight.pose(e,1.0)
   e.state = "recover"
   e.state_time = 0.0
   var recovery = Fight.pose(e,1.0)
   check(end.body.distance_to(recovery.body)<0.01 and end.head.distance_to(recovery.head)<0.01,"Body and helmet cannot snap at recovery: "+attack)
  for offset in [-48.0,0.0,48.0]:
   var e = entity(look)
   e.state = "strike"
   e.bell_attack = "charge"
   e.state_time = 0.4
   var direction = Vector2(e.dx,e.dy)
   for i in range(2):
    e.motion.feet[i].x += direction.x*offset
    e.motion.feet[i].y += direction.y*offset
   var pose = Fight.pose(e,1.0)
   for i in range(2):
    var leg = Fight.leg_pose(e,pose,i)
    check(absf(leg.hip.distance_to(leg.knee)-28)<0.01 and absf(leg.knee.distance_to(leg.foot)-28)<0.01,"Leg bone lengths remain fixed at stride extremes")
    check(leg.hip.distance_to(leg.foot)<=55.801,"Charge cannot stretch or detach a leg")
   inspect(e)
  for phase in [1,2]:
   var e = entity(look)
   e.bell_phase = phase
   e.state = "windup"
   e.state_time = 0.3
   e.bell_snapshot = e.duplicate(true)
   e.bell_clock = 1.0
   for age in [0.0,0.3,1.0]:
    e.age = age
    inspect(e,true)
 # Sliding corpses retain their frozen local anatomy instead of leaving the feet behind.
 for look in range(4):
  var e = entity(look)
  e.state = "strike"
  e.bell_attack = "charge"
  e.state_time = 0.4
  e.bell_snapshot = e.duplicate(true)
  e.bell_clock = 1.0
  e.age = 0.35
  var first = Surface.new()
  View.actor(first,e,true)
  var delta = Vector2(180,-35)
  e.x += delta.x
  e.y += delta.y
  Fight.Motion.shift(e.motion,delta)
  var moved = Surface.new()
  View.actor(moved,e,true)
  var stable = first.calls.size()==moved.calls.size()
  for i in range(mini(first.calls.size(),moved.calls.size())):
   for j in range(4): stable = stable and moved.calls[i].points[j].distance_to(first.calls[i].points[j]+delta)<0.01
  check(stable,"Sliding corpse translates all body and foot vertices together")
  check(e.bell_snapshot.x==200 and e.bell_snapshot.y==210,"Drawing must not mutate the frozen saved death pose")
 print("BOSS ANATOMY CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
