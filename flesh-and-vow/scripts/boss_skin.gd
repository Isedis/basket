extends RefCounted
## One continuous full-body texture and one connected deforming mesh.
const ATLAS = preload("res://assets/boss_body.png")
const Charge = preload("res://scripts/boss_charge.gd")
const Motion = preload("res://scripts/locomotion.gd")
const Combat = preload("res://scripts/combat.gd")
const FRAME = Vector2i(128,96)
const STEP = 2
static var retained: Dictionary = {}
static var source: PackedVector2Array = PackedVector2Array()
static var indices: PackedInt32Array = PackedInt32Array()
static var uv_sets: Array = []
static var body_groups: Array = []
static func prepare():
 if not source.is_empty():return
 var image = ATLAS.get_image()
 var lookup: Dictionary = {}
 for y in range(0,FRAME.y,STEP):
  for x in range(0,FRAME.x,STEP):
   var used = false
   for row in range(3):
    for dy in range(STEP):
     for dx in range(STEP):used = used or image.get_pixel(row*128+x+dx,y+dy).a>0.0
   if not used:continue
   var quad: Array = []
   for offset in [Vector2i(0,0),Vector2i(STEP,0),Vector2i(0,STEP),Vector2i(STEP,STEP)]:
    var grid = Vector2i(x,y)+offset
    if not lookup.has(grid):
     lookup[grid] = source.size()
     source.append(Vector2((grid.x-64)*2,(grid.y-90)*2))
    quad.append(lookup[grid])
   indices.append_array(PackedInt32Array([quad[0],quad[1],quad[2],quad[1],quad[3],quad[2]]))
 for view in range(3):
  var uv = PackedVector2Array()
  for p in source:uv.append(Vector2((view*128+p.x/2+64)/384.0,(p.y/2+90)/96.0))
  uv_sets.append(uv)
 for look in range(4):
  var arm_indices = PackedInt32Array()
  var core_indices = PackedInt32Array()
  var side = Motion.hand_sign(look)
  var flip = -1.0 if look==3 else 1.0
  for i in range(0,indices.size(),3):
   var center = (source[indices[i]]+source[indices[i+1]]+source[indices[i+2]])/3
   var weight = smoothstep(17,29,center.x*flip*side)*(1-smoothstep(12,23,absf(center.y+86)))
   var triangle = PackedInt32Array([indices[i],indices[i+1],indices[i+2]])
   if weight>0.15:arm_indices.append_array(triangle)
   else:core_indices.append_array(triangle)
  body_groups.append({"arm":arm_indices,"core":core_indices})
static func arm_in_front(pose: Dictionary, look: int) -> bool:
 # The visible weapon arm crosses the chest in front/side views. From behind,
 # an upward strike goes away from the camera and is covered by the torso.
 return look!=2 or pose.hand.y>pose.shoulder.y+4
static func draw_indices(pose: Dictionary,look: int,selection: String = "all") -> PackedInt32Array:
 prepare()
 if selection=="arm":return body_groups[look].arm
 if selection=="core":return body_groups[look].core
 var result = PackedInt32Array()
 var front = arm_in_front(pose,look)
 result.append_array(body_groups[look].core if front else body_groups[look].arm)
 result.append_array(body_groups[look].arm if front else body_groups[look].core)
 return result
static func view_index(look: int) -> int:return 0 if look==0 else (2 if look==2 else 1)
static func parameters(e: Dictionary, pose: Dictionary, look: int) -> Dictionary:
 var p = Vector2(e.x,e.y)
 var core = pose.body-p
 var feet: Array = []
 for i in range(2):
  var raw = Motion.foot_position(e.get("motion",{}),i,p)-(p+Vector2(-6 if i==0 else 6,0))
  feet.append(Vector2(clampf(raw.x,-8,8),clampf(raw.y,-5,4)))
 for i in range(2):feet[i].x+=(-1 if i==0 else 1)*float(pose.get("intro_spread",0))
 if pose.get("charge_rig",false):feet = Charge.visual_feet(e)
 var arms: Array = []
 var view = view_index(look)
 for side in [-1.0,1.0]:
  var shoulder: Vector2
  var elbow: Vector2
  var hand: Vector2
  if side==Motion.hand_sign(look):
   shoulder = pose.shoulder-p
   elbow = pose.elbow-p
   hand = pose.hand-p
  else:
   shoulder = (Vector2(side*25,-86)-Vector2(0,-77)).rotated(pose.torso_angle)+Vector2(0,-77)+core
   hand = shoulder+Vector2(side*6,40)
   elbow = shoulder+Combat.arm_elbow(Vector2.ZERO,(hand-shoulder)/2,side)*2
  var pivot = 23.0 if view==1 else 25.0
  var middle = 42.0 if view==1 else 48.0
  var wrist = 60.0 if view==1 else 72.0
  var upper = elbow-shoulder
  var lower = hand-elbow
  arms.append({"side":side,"shoulder":shoulder,"elbow":elbow,"pivot":pivot,"middle":middle,"upper":upper/(middle-pivot),"lower":lower/(wrist-middle),"upper_normal":Vector2(-upper.y,upper.x).normalized()*side,"lower_normal":Vector2(-lower.y,lower.x).normalized()*side})
 return {"p":p,"core":core,"angle":pose.torso_angle,"head":pose.head-(pose.body+Vector2(0,-130)),"feet":feet,"arms":arms,"toll_rock":float(pose.get("toll_rock",0)),"toll_chain":float(pose.get("toll_chain",0))}
static func mapped_point(v: Vector2, info: Dictionary) -> Vector2:
 var torso_weight = smoothstep(0,45,-v.y)
 var q = v.lerp((v-Vector2(0,-77)).rotated(info.angle)+Vector2(0,-77),torso_weight)+info.core*torso_weight
 q += info.head*smoothstep(100,125,-v.y)
 if absf(info.toll_rock)>0.00001:
  var pivot=Vector2(0,-112)+info.core+info.head
  q=q.lerp(pivot+(q-pivot).rotated(info.toll_rock),smoothstep(100,125,-v.y))
 q.x += info.toll_chain*smoothstep(32,48,-v.y)*(1-smoothstep(72,88,-v.y))*(1-smoothstep(20,30,absf(v.x)))
 q += info.feet[0].lerp(info.feet[1],smoothstep(-6,6,v.x))*(1-smoothstep(8,48,-v.y))
 for item in info.arms:
  var u = v.x*item.side
  var weight = smoothstep(17,29,u)*(1-smoothstep(12,23,absf(v.y+86)))
  if weight>0:
   var a = item.shoulder+item.upper*(u-item.pivot)+item.upper_normal*(v.y+86)
   var b = item.elbow+item.lower*(u-item.middle)+item.lower_normal*(v.y+86)
   q = q.lerp(a.lerp(b,smoothstep(item.middle-5,item.middle+5,u)),weight)
 return info.p+q
static func point(v: Vector2, e: Dictionary, pose: Dictionary, look: int) -> Vector2:
 return mapped_point(v,parameters(e,pose,look))
static func mesh(e: Dictionary, pose: Dictionary, look: int, context: Dictionary, selection: String = "all") -> ArrayMesh:
 prepare()
 var vertices = PackedVector3Array()
 var flip = -1.0 if look==3 else 1.0
 var root: Vector2 = context.p
 var info = parameters(e,pose,look)
 for original in source:
  var mapped = mapped_point(Vector2(original.x*flip,original.y),info)
  mapped = root+(mapped-root).rotated(context.fall)+Vector2(0,context.drop)
  vertices.append(Vector3(mapped.x,mapped.y,0))
 var arrays = []
 arrays.resize(Mesh.ARRAY_MAX)
 arrays[Mesh.ARRAY_VERTEX] = vertices
 arrays[Mesh.ARRAY_TEX_UV] = uv_sets[view_index(look)]
 arrays[Mesh.ARRAY_INDEX] = draw_indices(pose,look,selection)
 var result = ArrayMesh.new()
 result.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
 return result
static func draw(g,e: Dictionary,pose: Dictionary,look: int,context: Dictionary,tint: Color,selection: String = "all"):
 var result = mesh(e,pose,look,context,selection)
 if DisplayServer.get_name()!="headless":
  var frame = Engine.get_process_frames()
  if not retained.has(frame):retained[frame] = []
  retained[frame].append(result)
  for old in retained.keys():
   if int(old)<frame-2:retained.erase(old)
 g.draw_mesh(result,ATLAS,Transform2D.IDENTITY,tint)
