extends RefCounted
const Fight = preload("res://scripts/boss_fight.gd")
const BodySkin = preload("res://scripts/boss_skin.gd")
const Rig = preload("res://scripts/rig_view.gd")
const Motion = preload("res://scripts/locomotion.gd")
const SEAL = preload("res://assets/castle_boss_seal.png")
const ATLAS = preload("res://assets/castle_boss.png")
const SIZES = [Vector2i(36,32),Vector2i(35,36),Vector2i(14,28),Vector2i(14,28),Vector2i(14,28),Vector2i(14,28),Vector2i(42,22),Vector2i(13,38)]
static var parts: Array = []
static func textures(look: int) -> Array:
 if parts.is_empty():
  var image = ATLAS.get_image()
  for row in range(3):
   var view: Array = []
   for i in range(8): view.append(ImageTexture.create_from_image(image.get_region(Rect2i(Vector2i(i*64,row*64)+(Vector2i(64,64)-SIZES[i])/2,SIZES[i]))))
   parts.append(view)
  for row in range(3): parts[row][6] = parts[0][6]
 return parts[1 if look==0 else (2 if look==2 else 0)]
static func actor(g, e: Dictionary, dead: bool = false):
 var p = Vector2(e.x,e.y)
 var direction = Vector2(e.get("dx",0),e.get("dy",1))
 var motion = e.get("motion",{})
 var look = Motion.look_index(motion,direction)
 var sign_hand = Motion.hand_sign(look)
 var model = e
 var clock = g.elapsed
 var collapse = 0.0
 if dead:
  model = e.get("bell_snapshot",{}).duplicate(true)
  if model.is_empty(): model = {"x":e.x,"y":e.y,"dx":e.dx,"dy":e.dy,"motion":motion,"state":"chase","state_time":0.0,"bell_attack":"cleave"}
  # Frozen pose stores world-space planted feet; translate it with the moving corpse.
  Motion.shift(model.get("motion",{}),p-Vector2(model.x,model.y))
  model.x = e.x
  model.y = e.y
  clock = float(e.get("bell_clock",0))
  collapse = smoothstep(0,1,minf(1,e.age/0.95))
 var pose = Fight.pose(model,clock)
 var context = {"p":p,"fall":collapse*1.5*sign_hand,"drop":collapse*10,"shift":Vector2.ZERO,"fade":1.0}
 var tint = Color(1.5,1.25,1.05) if not dead and e.get("flash",0)>0 else Color.WHITE
 if not dead and e.get("flash",0)<=0 and Fight.Toll.enabled(e) and e.state in ["strike","recover"]:
  tint=Color.WHITE.lerp(Color(1.2,1.1,0.98),Fight.Toll.energy(e)*0.5)
 # No independent head, torso, arm, leg or chain draws: one full connected skin.
 var front = BodySkin.arm_in_front(pose,look)
 weapon_span(g,textures(look)[6],pose,context,tint,0.0,0.55)
 if not front:weapon_span(g,textures(look)[6],pose,context,tint,0.55,1.0)
 BodySkin.draw(g,model,pose,look,context,tint)
 if not dead:fracture_marks(g,model,pose,look,clock)
 if front:weapon_span(g,textures(look)[6],pose,context,tint,0.55,1.0)
 if not dead and e.state=="strike" and e.get("bell_attack","")=="cleave" and e.state_time<Fight.STRIKE.cleave*0.55:
  var trail = PackedVector2Array()
  for sample in range(6):
   var probe = e.duplicate(true)
   probe.state_time = maxf(0,e.state_time-(5-sample)*0.009)
   var old_pose = Fight.pose(probe,clock)
   trail.append((old_pose.hand+Vector2.from_angle(old_pose.angle)*74).snapped(Vector2(2,2)))
  g.draw_polyline(trail,Color(0.79,0.67,0.44,0.5),4)
static func fracture_glow(e: Dictionary,clock: float) -> float:
 if e.get("bell_phase",1)!=2:return 0.0
 var reveal = Fight.Combat.curve((e.state_time-0.36)/(Fight.FRACTURE_PULSE-0.36)) if e.state=="fracture" else 1.0
 return reveal*(0.76+0.14*sin(clock*4.5))
static func fracture_paths(e: Dictionary,pose: Dictionary,look: int) -> Array:
 var result: Array = []
 var flip = -1.0 if look==3 else 1.0
 for seam in [[Vector2(0,-146),Vector2(6,-138),Vector2(2,-130),Vector2(10,-120),Vector2(4,-114)],[Vector2(2,-130),Vector2(-4,-122)]]:
  var points = PackedVector2Array()
  for point in seam:points.append(BodySkin.point(Vector2(point.x*flip,point.y),e,pose,look).snapped(Vector2(2,2)))
  result.append(points)
 return result
static func fracture_marks(g,e: Dictionary,pose: Dictionary,look: int,clock: float):
 var glow = fracture_glow(e,clock)
 if glow<=0:return
 for points in fracture_paths(e,pose,look):
  g.draw_polyline(points,Color(0.23,0.07,0.04,glow),4)
  g.draw_polyline(points,Color(1.0,0.48,0.16,glow),2)
static func weapon_span(g,texture: Texture2D,pose: Dictionary,context: Dictionary,tint: Color,start: float,end: float):
 var size = texture.get_size()*2
 var uv = PackedVector2Array([Vector2(start,0),Vector2(end,0),Vector2(end,1),Vector2(start,1)])
 var points = PackedVector2Array()
 for xy in uv:points.append(pose.hand+((xy-Vector2(0.12,0.5))*size).rotated(pose.angle))
 Rig.quad(g,texture,points,uv,tint,context)
static func arena(g):
 if g.floor_index!=0 or g.room.type!="boss": return
 g.draw_texture_rect(SEAL,Rect2((g.CENTRE-Vector2(160,100)).snapped(Vector2(2,2)),Vector2(320,200)),false,Color(0.85,0.85,0.85))
static func pixel_arc(g, center: Vector2, radius: float, from: float, to: float, color: Color, width: float = 2.0):
 var segments = maxi(2,int(absf(to-from)*radius/7))
 var previous = (center+Vector2.from_angle(from)*radius).snapped(Vector2(2,2))
 for i in range(1,segments+1):
  var at = (center+Vector2.from_angle(lerpf(from,to,i/float(segments)))*radius).snapped(Vector2(2,2))
  g.draw_line(previous,at,color,width)
  previous = at
static func telegraph(g, e: Dictionary):
 if e.state=="fracture":
  var t = float(e.state_time)
  var after = maxf(0,t-Fight.FRACTURE_PULSE)
  var radius = lerpf(34,68,clampf(t/Fight.FRACTURE_PULSE,0,1))+after*150
  var alpha = 0.5*(1-clampf(after/(Fight.FRACTURE-Fight.FRACTURE_PULSE),0,1))
  pixel_arc(g,Vector2(e.x,e.y),radius,0,TAU,Color(0.85,0.42,0.18,alpha),2)
  return
 if e.state!="windup": return
 var p = Vector2(e.x,e.y)
 var direction = Vector2(e.dx,e.dy)
 var u = clampf(e.state_time/Fight.windup(e),0,1)
 var color = Color(0.95,0.49,0.25,0.3+u*0.55) if e.get("bell_combo_step",0)==1 else Color(0.76,0.52,0.31,0.25+u*0.55)
 match e.get("bell_attack","cleave"):
  "charge":
   var end = p
   for step in range(1,int(ceil((340 if e.get("bell_phase",1)==2 else 295)*Fight.STRIKE.charge/12))+1):
    var at = p+direction*step*12
    if Fight.Charge.enabled(e):
     if g.blocked(at+direction*Fight.Charge.FRONT,28):break
    elif Fight.Combat.occluded(end,at,g.blocks.map(func(b): return b.grow(28))) or not g.room_floor_rect.grow(-28).has_point(at):break
    for side in [-1,1]:
     var dot = (at+direction.orthogonal()*side*29).snapped(Vector2(2,2))
     g.draw_rect(Rect2(dot,Vector2(4,2)),color)
    end = at
  "toll":
   var gap = float(e.get("bell_gap",0))
   pixel_arc(g,p,54,gap+Fight.GAP,gap+TAU-Fight.GAP,color)
   if e.get("bell_phase",1)==2:pixel_arc(g,p,66,gap+Fight.GAP,gap+TAU-Fight.GAP,Color(color,0.2+u*0.3))
   for side in [-1,1]:
    var dir = Vector2.from_angle(gap+side*Fight.GAP)
    g.draw_line((p+dir*40).snapped(Vector2(2,2)),(p+dir*76).snapped(Vector2(2,2)),Color(0.44,0.63,0.54,0.65),2)
  "cleave":
   var preview = e.duplicate(true)
   preview.state = "strike"
   var points = PackedVector2Array()
   for frame in range(13):
    preview.state_time = lerpf(Fight.Combat.CONTACT_RATIO,Fight.Combat.ACTIVE_END,frame/12.0)*Fight.STRIKE.cleave
    var pose = Fight.pose(preview,g.elapsed)
    var tip = (pose.hand+Vector2.from_angle(pose.angle)*74).snapped(Vector2(2,2))
    points.append(tip)
   g.draw_polyline(points,color,2)
static func ring(g, z: Dictionary):
 if float(z.get("age",0))<0:
  var gap = float(z.gap)
  pixel_arc(g,Vector2(z.x,z.y),42,gap+Fight.GAP,gap+TAU-Fight.GAP,Color(0.76,0.57,0.32,0.18),2)
  return
 var p = Vector2(z.x,z.y)
 var radius = Fight.ring_radius(z)
 var fade = clampf(float(z.timer)/0.3,0,1)
 var gap = float(z.gap)
 for r in [radius-Fight.RING_WIDTH,radius,radius+Fight.RING_WIDTH]:
  pixel_arc(g,p,r,gap+Fight.GAP,gap+TAU-Fight.GAP,Color(0.76,0.57,0.32,fade*(0.75 if r==radius else 0.28)),2)
