extends SceneTree
class Proxy extends RefCounted:
 var canvas
 var held
 var elapsed = 1.0
 func draw_polygon(points,colors,uv,tex):
  if tex!=held:canvas.draw_polygon(points,colors,uv,tex)
 func draw_mesh(mesh,tex,transform,color):canvas.draw_mesh(mesh,tex,transform,color)
 func draw_polyline(_p,_c,_w):pass
class Body extends Node2D:
 var renderer
 var model: Dictionary
 var dead = false
 func _draw():
  var proxy = Proxy.new()
  proxy.canvas = self
  proxy.held = renderer.textures(int(model.motion.look))[6]
  renderer.actor(proxy,model,dead)
func _initialize():call_deferred("run")
func run():
 var packs = OS.get_cmdline_user_args()
 for i in range(1,packs.size()):
  if not ProjectSettings.load_resource_pack(packs[i],true):
   push_error("Failed to mount compiled pack: "+packs[i])
   quit(1)
   return
 var renderer = load("res://scripts/boss_view.gd")
 var fight = load("res://scripts/boss_fight.gd")
 var motion = load("res://scripts/locomotion.gd")
 var out = OS.get_cmdline_user_args()[0]
 DirAccess.make_dir_recursive_absolute(out)
 var v = SubViewport.new()
 v.size = Vector2i(480,480)
 v.transparent_bg = true
 v.render_target_update_mode = SubViewport.UPDATE_ALWAYS
 root.add_child(v)
 var body = Body.new()
 body.renderer = renderer
 body.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
 v.add_child(body)
 var cases: Array = []
 for look in range(4):
  for phase in [1,2]:
   for attack in ["cleave","toll","charge"]:
    for state in ["windup","strike","recover"]:
     for ratio in [0.0,0.27,0.65,1.0]:cases.append({"look":look,"phase":phase,"attack":attack,"state":state,"ratio":ratio,"dead":false,"feet":0})
   for offset in [-24,0,24]:cases.append({"look":look,"phase":phase,"attack":"cleave","state":"chase","ratio":0.0,"dead":false,"feet":offset})
   for age in [0.0,0.3,0.7,1.0]:cases.append({"look":look,"phase":phase,"attack":"charge","state":"strike","ratio":0.5,"dead":true,"age":age,"feet":0})
 var count = 0
 for c in cases:
  var p = Vector2(240,320)
  var dir: Vector2 = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][c.look]
  var e = {"x":p.x,"y":p.y,"dx":dir.x,"dy":dir.y,"state":c.state,"state_time":0.0,"bell_phase":c.phase,"bell_attack":c.attack,"motion":motion.initialize(p,1,c.look)}
  var duration = fight.windup(e) if c.state=="windup" else (fight.STRIKE[c.attack] if c.state=="strike" else fight.RECOVERY[c.attack])
  e.state_time = duration*c.ratio
  for i in range(2):
   e.motion.feet[i].x += dir.x*c.feet*(1 if i==0 else -1)
   e.motion.feet[i].y += dir.y*c.feet*(1 if i==0 else -1)
  if not c.dead:
   var wrist = fight.pose(e,1.0).hand
   c["wrist"] = [wrist.x,wrist.y]
  if c.dead:
   e.bell_snapshot = e.duplicate(true)
   e.bell_clock = 1.0
   e.age = c.age
  body.model = e
  body.dead = c.dead
  body.queue_redraw()
  await process_frame
  await RenderingServer.frame_post_draw
  v.get_texture().get_image().save_png(out.path_join("%04d.png"%count))
  count += 1
 var file = FileAccess.open(out.path_join("cases.json"),FileAccess.WRITE)
 file.store_string(JSON.stringify(cases))
 print("RENDERED BODY CASES: ",count)
 quit()
