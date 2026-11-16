extends RefCounted
## Native material art and illumination are composed before drawing the actors.
const Doors = preload("res://scripts/door_view.gd")
const Light = preload("res://scripts/castle_light.gd")
const ATLAS = preload("res://assets/castle_masonry.png")
const DETAILS = preload("res://assets/castle_tiles.png")
const CELL = 48
const FLOOR_RECT = Rect2(48,168,672,264)
const FLOOR_SIZE = Vector2i(336,132)
const TINTS = [Color.WHITE,Color("a5c2c7"),Color("adc098"),Color("cabda3")]
const TORCHES = [Vector2(248,142),Vector2(520,142)]
const PROP_SIZES = [Vector2i(32,24),Vector2i(18,12),Vector2i(18,16),Vector2i(16,16),Vector2i(16,20),Vector2i(10,14),Vector2i(16,24),Vector2i(20,20)]
const WALLS = [[3,1,0,6,0,0,4,3],[3,7,0,6,0,0,2,3],[3,2,0,6,0,0,1,3],[3,4,0,6,0,0,7,3]]
static var stone_textures: Dictionary = {}
static var room_textures: Dictionary = {}
static var glow_texture: Texture2D

static func source(column: int, row: int) -> Rect2:
 var size = Vector2(CELL,CELL)
 if row==2 and column in [4,5]: size = Vector2(24,40)
 if row==2 and column in [6,7]: size = Vector2(48,16)
 return Rect2(Vector2(column*CELL,row*CELL),size)

static func floor_choices(seed_value: int, columns: int = 11, rows: int = 5) -> PackedInt32Array:
 var local = RandomNumberGenerator.new()
 local.seed = seed_value
 var result = PackedInt32Array()
 for _i in range(columns*rows): result.append([2,5,2,3,0,1,4,6,7][local.randi_range(0,8)])
 return result

static func light_color(material: Color, world: Vector2, floor_index: int, wall: bool = false, torches: Array = TORCHES) -> Color:
 return Light.sample(material,world,floor_index,wall,torches)

static func room_materials(seed_value: int, floor_index: int, floor_box: Rect2, torches: Array) -> Array:
 var key = str([seed_value,floor_index,floor_box,torches])
 if not room_textures.has(key):
  if room_textures.size()>=16: room_textures.erase(room_textures.keys()[0])
  room_textures[key] = [bake_floor(seed_value,floor_index,floor_box,torches),bake_wall(seed_value,floor_index,floor_box,torches)]
 return room_textures[key]

static func bake_floor(seed_value: int, floor_index: int, floor_box: Rect2 = FLOOR_RECT, torches: Array = TORCHES) -> Texture2D:
 var image_size = Vector2i(floor_box.size/2)
 var columns = ceili(image_size.x/32.0)
 var rows = ceili(image_size.y/32.0)
 var choices = floor_choices(seed_value,columns,rows)
 var atlas = ATLAS.get_image()
 var sums = PackedVector3Array()
 var weights = PackedFloat32Array()
 sums.resize(image_size.x*image_size.y)
 weights.resize(sums.size())
 # Overlapping material patches hide the square tile lattice without scaling pixels.
 for tile_y in range(rows):
  for tile_x in range(columns):
   var column = choices[tile_y*columns+tile_x]
   var mirror = (seed_value+tile_x*13+tile_y*7)%2==0
   for y in range(CELL):
    var dy = tile_y*32+y-8
    if dy<0 or dy>=image_size.y: continue
    var wy = clampf(minf(y+0.5,CELL-y-0.5)/8.0,0,1)
    for x in range(CELL):
     var dx = tile_x*32+x-8
     if dx<0 or dx>=image_size.x: continue
     var weight = wy*clampf(minf(x+0.5,CELL-x-0.5)/8.0,0,1)
     var color = atlas.get_pixel(column*CELL+(CELL-1-x if mirror else x),CELL+y)
     var index = dy*image_size.x+dx
     sums[index] += Vector3(color.r,color.g,color.b)*weight
     weights[index] += weight
 var image = Image.create(image_size.x,image_size.y,false,Image.FORMAT_RGBA8)
 for y in range(image_size.y):
  for x in range(image_size.x):
   var index = y*image_size.x+x
   var sample = sums[index]/maxf(0.001,weights[index])
   var material = Color(0.035+sample.x*0.95,0.04+sample.y*0.95,0.042+sample.z*0.95)
   var edge = minf(minf(x,image_size.x-1-x),minf(y,image_size.y-1-y))
   material *= lerpf(0.55,1,clampf(edge/14.0,0,1))
   material.a = 1
   var lit = light_color(material,floor_box.position+Vector2(x,y)*2,floor_index,false,torches)
   var luminance = lit.get_luminance()
   if luminance>0.22: lit *= 0.22/luminance
   lit.a = 1
   image.set_pixel(x,y,lit)
 return ImageTexture.create_from_image(image)

static func bake_wall(seed_value: int, floor_index: int, floor_box: Rect2 = FLOOR_RECT, torches: Array = TORCHES) -> Texture2D:
 var width = int(floor_box.size.x/2)+16
 var image = Image.create(width,46,false,Image.FORMAT_RGBA8)
 var atlas = ATLAS.get_image()
 var pattern: Array = WALLS[posmod(seed_value,4)]
 var count = ceili((width+16)/48.0)
 for x in range(width):
  var column = (x+16)/CELL
  var sx = (x+16)%CELL
  var kind = pattern[column%pattern.size()]
  if width>=592: kind = [3,2,0,1,0,4,0,5,0,2,0,7,3][column%13]
  if column==0 or column==count-1: kind = 3
  if column>0 and column<count-1:
   for torch in torches:
    if absf(floor_box.position.x-32+column*96+48-torch.x)<48 and torch.y<176: kind = 0
  for y in range(46):
   var material = atlas.get_pixel(kind*CELL+sx,y+2)
   image.set_pixel(x,y,light_color(material,Vector2(floor_box.position.x-16+x*2,84+y*2),floor_index,true,torches))
 return ImageTexture.create_from_image(image)

static func prop(g, column: int, at: Vector2, tint: Color = Color.WHITE):
 var size: Vector2i = PROP_SIZES[column]
 g.draw_texture_rect_region(DETAILS,Rect2(at,Vector2(size)*2),Rect2(Vector2(column*32,96),Vector2(size)),tint)

static func outer_rect(floor_box: Rect2) -> Rect2:
 return Rect2(floor_box.position.x-16,84,floor_box.size.x+32,floor_box.end.y-84+16)

static func background(g):
 var floor_box: Rect2 = g.room_floor_rect
 var outer = outer_rect(floor_box)
 var torches: Array = g.room_torches
 g.draw_rect(outer,Color("080e10"))
 if g.room_texture: g.draw_texture_rect(g.room_texture,floor_box,false)
 if g.room_wall_texture: g.draw_texture_rect(g.room_wall_texture,Rect2(outer.position,Vector2(outer.size.x,92)),false)
 for y in range(176,int(floor_box.end.y),48):
  var height = mini(48,int(floor_box.end.y)-y)
  var left_tint = light_color(Color.WHITE,Vector2(outer.position.x+16,y),g.floor_index,true,torches)
  var right_tint = light_color(Color.WHITE,Vector2(floor_box.end.x,y),g.floor_index,true,torches)
  g.draw_texture_rect_region(ATLAS,Rect2(outer.position.x,y,16,height),Rect2(0,12,8,height/2.0),left_tint)
  g.draw_texture_rect_region(ATLAS,Rect2(floor_box.end.x,y,16,height),Rect2(40,12,8,height/2.0),right_tint)
 for x in range(int(outer.position.x),int(outer.end.x),48):
  var width = mini(48,int(outer.end.x)-x)
  g.draw_texture_rect_region(ATLAS,Rect2(x,floor_box.end.y,width,16),Rect2(0,0,width/2.0,8),light_color(Color.WHITE,Vector2(x,floor_box.end.y),g.floor_index,true,torches))
 if not g.authored_room:
  var variant = posmod(int(g.room.seed),3)
  if variant==0: prop(g,3,Vector2(112,342),Color("4c5b59"))
  if variant==1: prop(g,7,Vector2(616,354),Color("4c5b59"))
  for side in range(2):
   var p = Vector2(102 if side==0 else 624,156)
   prop(g,2 if side==0 else 1,p,light_color(Color.WHITE,p,g.floor_index,true,torches))
 for band in range(5):
  g.draw_rect(Rect2(floor_box.position.x,176+band*2,floor_box.size.x,2),Color(0,0,0,0.18-band*0.03))

static func door_state(room_clear: bool, destination: Dictionary) -> String:
 if destination.is_empty() or not destination.get("revealed",true): return "wall"
 if not room_clear: return "barred"
 return "locked" if not destination.get("opened",true) else "open"

static func doorway(g, index: int, state: String):
 Doors.draw(g,index,state)

static func secret_crack(g, index: int, visible: bool):
 var p: Vector2 = g.door_position(index)
 var direction = g.door_direction(index)
 var line = PackedVector2Array([Vector2(-6,-12),Vector2(2,-4),Vector2(-2,2),Vector2(5,10)])
 if direction==0: p.y = 148
 if direction==2: p.y = g.room_floor_rect.end.y+2
 for i in range(line.size()-1):
  var a = line[i]
  var b = line[i+1]
  if direction%2==1:
   a = Vector2(a.y,a.x)
   b = Vector2(b.y,b.x)
  g.draw_line(p+a,p+b,Color("b0a88c") if visible else Color("59605a"),2)

static func lights(g):
 if glow_texture==null:
  var image = Image.create(192,192,false,Image.FORMAT_RGBA8)
  for y in range(192):
   for x in range(192):
    var strength = pow(maxf(0,1-Vector2(x-96,y-96).length()/96.0),2)
    image.set_pixel(x,y,Color(0.95,0.52,0.19,strength*0.075))
  glow_texture = ImageTexture.create_from_image(image)
 var room_box = outer_rect(g.room_floor_rect)
 for i in range(g.room_torches.size()):
  var p: Vector2 = g.room_torches[i]
  var phase = int(g.anim*(7.5+i*0.9)+i*1.7)%4
  var flicker = 0.28+0.09*sin(g.anim*(6.7+i)+i*1.9)+0.05*sin(g.anim*13.3+i)
  var glow_box = Rect2(p-Vector2(192,192),Vector2(384,384))
  var clipped = glow_box.intersection(room_box)
  if clipped.has_area(): g.draw_texture_rect_region(glow_texture,clipped,Rect2((clipped.position-glow_box.position)/2,clipped.size/2),Color(1,1,1,flicker))
  prop(g,5,p-Vector2(10,8),light_color(Color.WHITE,p,g.floor_index,true,g.room_torches))
  var tip = p+Vector2([-2,0,2,0][phase],[-14,-18,-16,-12][phase])
  var shape = PackedVector2Array()
  for v in [Vector2(0,0),Vector2(4,6),Vector2(4,10),Vector2(6,12),Vector2(4,18),Vector2(-4,18),Vector2(-6,12),Vector2(-2,6)]: shape.append(tip+v)
  g.draw_colored_polygon(shape,Color("b7632f"))
  g.draw_rect(Rect2(tip+Vector2(-2,6),Vector2(4,10)),Color("e8b45f"))
  g.draw_rect(Rect2(tip+Vector2(0,10),Vector2(2,6)),Color("f7db9f"))

static func stone(g, box: Rect2):
 g.draw_rect(Rect2(box.position+Vector2(-2,4),box.size+Vector2(4,4)),Color(0,0,0,0.5))
 # Preserve edge pixels on obstacles of different sizes; no fractional scaling.
 var size = Vector2i((box.size/2).round())
 if not stone_textures.has(size):
  var image = Image.create(size.x,size.y,false,Image.FORMAT_RGBA8)
  var atlas = DETAILS.get_image()
  for y in range(size.y):
   for x in range(size.x):
    var sx = x if x<4 else (32-(size.x-x) if x>=size.x-4 else 4+(x-4)%24)
    var sy = y if y<4 else (24-(size.y-y) if y>=size.y-4 else 4+(y-4)%16)
    image.set_pixel(x,y,atlas.get_pixel(sx,96+sy))
  stone_textures[size] = ImageTexture.create_from_image(image)
 g.draw_texture_rect(stone_textures[size],Rect2(box.position.snapped(Vector2(2,2)),Vector2(size)*2),false)
