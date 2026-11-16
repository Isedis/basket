extends RefCounted
const ATLAS = preload("res://assets/castle_doors.png")
const Light = preload("res://scripts/castle_light.gd")
const Motion = preload("res://scripts/door_motion.gd")
const SIZES = [[Vector2i(56,56),Vector2i(32,56),Vector2i(64,28),Vector2i(32,56)],[Vector2i(30,40),Vector2i(8,28),Vector2i(40,12),Vector2i(8,28)],[Vector2i(30,40),Vector2i(10,28),Vector2i(40,12),Vector2i(10,28)]]
const OFFSETS = [[Vector2.ZERO,Vector2.ZERO,Vector2.ZERO,Vector2.ZERO],[Vector2(13,12),Vector2(16,14),Vector2(12,12),Vector2(8,14)],[Vector2(13,12),Vector2(15,14),Vector2(12,12),Vector2(8,14)]]
static var textures: Dictionary = {}

static func origin(g, index: int) -> Vector2:
 var p: Vector2 = g.door_position(index)
 match g.door_direction(index):
  0: return Vector2(p.x-56,84)
  1: return Vector2(g.room_floor_rect.end.x-48,p.y-56)
  2: return Vector2(p.x-64,g.room_floor_rect.end.y-40)
  _: return Vector2(g.room_floor_rect.position.x-16,p.y-56)

static func texture(g, index: int, part: int) -> Texture2D:
 var direction = g.door_direction(index)
 var start = origin(g,index)+OFFSETS[part][direction]*2
 var key = str([direction,part,g.floor_index,start,g.room_torches])
 if not textures.has(key):
  var size: Vector2i = SIZES[part][direction]
  var image = ATLAS.get_image().get_region(Rect2i(Vector2i(direction*64,part*64),size))
  var frame = ATLAS.get_image() if direction==0 and part>0 else null
  for y in range(size.y):
   for x in range(size.x):
    var color = image.get_pixel(x,y)
    if frame!=null:
     var edge = frame.get_pixel(x+13,y+12)
     if edge.a>0.5 and edge.get_luminance()>0.2: color = Color.TRANSPARENT
    image.set_pixel(x,y,Light.sample(color,start+Vector2(x,y)*2,g.floor_index,true,g.room_torches))
  textures[key] = ImageTexture.create_from_image(image)
 return textures[key]

static func wooden_leaves(g, tex: Texture2D, at: Vector2, openness: float):
 if openness>=0.999: return
 var size = tex.get_size()*2
 var projection = cos(openness*PI/2)
 var depth = sin(openness*PI/2)*5
 for side in range(2):
  var hinge = at+Vector2(0 if side==0 else size.x,0)
  var edge = hinge+Vector2(size.x*0.5*projection*(1 if side==0 else -1),depth)
  var points = PackedVector2Array([hinge,edge,edge+Vector2(0,size.y),hinge+Vector2(0,size.y)])
  var u = 0.0 if side==0 else 1.0
  var uv = PackedVector2Array([Vector2(u,0),Vector2(0.5,0),Vector2(0.5,1),Vector2(u,1)])
  g.draw_polygon(points,PackedColorArray([Color(1,1,1,1-openness*0.4)]),uv,tex)

static func draw(g, index: int, state: String):
 if state=="wall": return
 var p: Vector2 = g.door_position(index)
 var direction = g.door_direction(index)
 var at = origin(g,index)
 # The opening is inset into the masonry, including when its alpha is transparent.
 if direction==0:
  var opening = PackedVector2Array([Vector2(-30,12),Vector2(-30,-42),Vector2(-22,-58),Vector2(0,-74),Vector2(22,-58),Vector2(30,-42),Vector2(30,12)])
  for i in range(opening.size()): opening[i] += p
  g.draw_colored_polygon(opening,Color("070d10"))
 elif direction==2:
  g.draw_rect(Rect2(p.x-40,g.room_floor_rect.end.y-16,80,32),Color("070d10"))
 else:
  g.draw_rect(Rect2(at.x,p.y-24,64,48),Color("070d10"))
 g.draw_texture_rect(texture(g,index,0),Rect2(at,Vector2(SIZES[0][direction])*2),false)
 var visual = Motion.visual(g,index,state)
 var openness = smoothstep(0,1,float(visual.open))
 if openness>=0.999: return
 var part = 2 if visual.kind=="locked" else 1
 var tex = texture(g,index,part)
 var insert_at = at+OFFSETS[part][direction]*2
 if part==2:
  wooden_leaves(g,tex,insert_at,openness)
 else:
  # Crop the top of a translated gate: its teeth rise into the existing lintel.
  var lift = floori(openness*tex.get_height())
  var height = tex.get_height()-lift
  if height>0: g.draw_texture_rect_region(tex,Rect2(insert_at,Vector2(tex.get_width(),height)*2),Rect2(0,lift,tex.get_width(),height))
