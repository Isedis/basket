extends RefCounted
const Fight = preload("res://scripts/boss_fight.gd")
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
 var flip = -1.0 if look==3 else 1.0
 var art = textures(look)
 var model = e
 var clock = g.elapsed
 var collapse = 0.0
 if dead:
  model = e.get("bell_snapshot",{}).duplicate(true)
  if model.is_empty(): model = {"x":e.x,"y":e.y,"dx":e.dx,"dy":e.dy,"motion":motion,"state":"chase","state_time":0.0,"bell_attack":"cleave"}
  model.x = e.x
  model.y = e.y
  clock = float(e.get("bell_clock",0))
  collapse = smoothstep(0,1,minf(1,e.age/0.95))
 var pose = Fight.pose(model,clock)
 var context = {"p":p,"fall":collapse*1.5*sign_hand,"drop":collapse*10,"shift":Vector2.ZERO,"fade":1.0}
 var tint = Color(1.5,1.25,1.05) if not dead and e.get("flash",0)>0 else Color.WHITE
 var left_foot = Motion.foot_position(motion,0,p)+Vector2(-12,0)
 var right_foot = Motion.foot_position(motion,1,p)+Vector2(12,0)
 var body = pose.body
 for i in range(2):
  var foot = left_foot if i==0 else right_foot
  var hip = pose.hips+Vector2(-17 if i==0 else 17,-48)
  Rig.limb(g,art[4+i],hip,foot,4*sign_hand,flip,tint,context)
 var left_shoulder = body+Vector2(-28*sign_hand,-76)
 var left_hand = left_shoulder+Vector2(-7*sign_hand,43)
 Rig.limb(g,art[2],left_shoulder,left_hand,5*sign_hand,flip,tint,context)
 if look==2: weapon(g,art,pose,flip,tint,context)
 Rig.part(g,art[7],body+Vector2(-23*sign_hand,-100),sin(clock*2)*0.035,flip,tint,context,Vector2(0.5,0))
 Rig.part(g,art[1],body+Vector2(0,-77),pose.twist*0.6,flip,tint,context)
 # The bell remains the same pixels. Its existing fracture physically opens in phase two.
 var broken = int(model.get("bell_phase",1))==2
 var amount = 1.0
 if model.state=="fracture": amount = smoothstep(0,1,model.state_time/Fight.FRACTURE)
 var head = pose.head
 if broken or dead:
  var tex: Texture2D = art[0]
  var gap = (4*amount if broken else 0.0)+collapse*12
  for half in range(2):
   var region = Rect2i(half*SIZES[0].x/2,0,SIZES[0].x/2,SIZES[0].y)
   var piece = AtlasTexture.new()
   piece.atlas = tex
   piece.region = region
   Rig.part(g,piece,head+Vector2((-1 if half==0 else 1)*(SIZES[0].x/2+gap),0),(-0.05 if half==0 else 0.05)*amount,flip,tint,context)
 else: Rig.part(g,art[0],head,-pose.twist*0.18,flip,tint,context)
 if not dead and e.state=="strike" and e.get("bell_attack","")=="cleave" and e.state_time<Fight.STRIKE.cleave*0.55:
  var trail = PackedVector2Array()
  for sample in range(6):
   var probe = e.duplicate(true)
   probe.state_time = maxf(0,e.state_time-(5-sample)*0.009)
   var old_pose = Fight.pose(probe,clock)
   trail.append((old_pose.hand+Vector2.from_angle(old_pose.angle)*74).snapped(Vector2(2,2)))
  g.draw_polyline(trail,Color(0.79,0.67,0.44,0.5),4)
 if look!=2: weapon(g,art,pose,flip,tint,context)
static func arena(g):
 if g.floor_index!=0 or g.room.type!="boss": return
 g.draw_texture_rect(SEAL,Rect2((g.CENTRE-Vector2(160,100)).snapped(Vector2(2,2)),Vector2(320,200)),false,Color(0.85,0.85,0.85))
static func weapon(g, art: Array, pose: Dictionary, flip: float, tint: Color, context: Dictionary):
 Rig.part(g,art[6],pose.hand,pose.angle,1,tint,context,Vector2(0.12,0.5))
 var axis = (pose.hand-pose.elbow).normalized()
 Rig.jointed_limb(g,art[3],pose.shoulder,pose.elbow,pose.hand+axis*5,flip,tint,context,0.85)
static func pixel_arc(g, center: Vector2, radius: float, from: float, to: float, color: Color, width: float = 2.0):
 var segments = maxi(2,int(absf(to-from)*radius/7))
 var previous = (center+Vector2.from_angle(from)*radius).snapped(Vector2(2,2))
 for i in range(1,segments+1):
  var at = (center+Vector2.from_angle(lerpf(from,to,i/float(segments)))*radius).snapped(Vector2(2,2))
  g.draw_line(previous,at,color,width)
  previous = at
static func telegraph(g, e: Dictionary):
 if e.state!="windup": return
 var p = Vector2(e.x,e.y)
 var direction = Vector2(e.dx,e.dy)
 var u = clampf(e.state_time/Fight.windup(e),0,1)
 var color = Color(0.76,0.52,0.31,0.25+u*0.55)
 match e.get("bell_attack","cleave"):
  "charge":
   var end = p
   for step in range(1,int(ceil((340 if e.get("bell_phase",1)==2 else 295)*Fight.STRIKE.charge/12))+1):
    var at = p+direction*step*12
    if Fight.Combat.occluded(end,at,g.blocks.map(func(b): return b.grow(28))) or not g.room_floor_rect.grow(-28).has_point(at): break
    for side in [-1,1]:
     var dot = (at+direction.orthogonal()*side*29).snapped(Vector2(2,2))
     g.draw_rect(Rect2(dot,Vector2(4,2)),color)
    end = at
  "toll":
   var gap = float(e.get("bell_gap",0))
   pixel_arc(g,p,54,gap+Fight.GAP,gap+TAU-Fight.GAP,color)
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
 if float(z.get("age",0))<0: return
 var p = Vector2(z.x,z.y)
 var radius = Fight.ring_radius(z)
 var fade = clampf(float(z.timer)/0.3,0,1)
 var gap = float(z.gap)
 for r in [radius-Fight.RING_WIDTH,radius,radius+Fight.RING_WIDTH]:
  pixel_arc(g,p,r,gap+Fight.GAP,gap+TAU-Fight.GAP,Color(0.76,0.57,0.32,fade*(0.75 if r==radius else 0.28)),2)
