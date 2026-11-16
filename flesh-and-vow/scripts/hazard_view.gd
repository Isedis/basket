extends RefCounted
## One simulation-clock state drives rendering and damage; ambient time is irrelevant.
const ATLAS = preload("res://assets/castle_hazards.png")
const Light = preload("res://scripts/castle_light.gd")
const PERIOD = 2.5
const ACTIVE_TIME = 1.2
const WARNING_TIME = 0.3
const SIZES = [Vector2i(32,22),Vector2i(30,20),Vector2i(30,20),Vector2i(30,20),Vector2i(26,16),Vector2i(26,16),Vector2i(26,16),Vector2i(26,16),Vector2i(5,6),Vector2i(3,3),Vector2i(3,2),Vector2i(26,16),Vector2i(26,24),Vector2i(26,24),Vector2i(26,24),Vector2i(26,24)]
const SOCKET_X = [7,12,18,23]
const SOCKET_Y = [6,10,15]
static var textures: Array = []
static var glow: Texture2D

static func load_parts():
 if not textures.is_empty(): return
 var image = ATLAS.get_image()
 for i in range(16): textures.append(ImageTexture.create_from_image(image.get_region(Rect2i(Vector2i((i%4)*32,(i/4)*32),SIZES[i]))))
 var light = Image.create(48,32,false,Image.FORMAT_RGBA8)
 for y in range(32):
  for x in range(48):
   var distance = Vector2((x-24)/24.0,(y-16)/16.0).length()
   light.set_pixel(x,y,Color(0.95,0.43,0.12,pow(maxf(0,1-distance),2)*0.09))
 glow = ImageTexture.create_from_image(light)

static func state(hazard: Dictionary, time: float) -> Dictionary:
 var phase = fposmod(time+float(hazard.get("phase",0)),PERIOD)
 var result = {"phase":phase,"name":"rest","height":0,"damage":0.0,"frame":posmod(int(floor(time*7+float(hazard.get("phase",0)))),4)}
 if hazard.type=="fire":
  result.damage = 1.0
  result.name = "burning"
 elif hazard.type=="spikes":
  if phase<ACTIVE_TIME:
   var rise = clampf(phase/0.1,0,1) if phase<0.1 else (clampf((ACTIVE_TIME-phase)/0.14,0,1) if phase>=1.06 else 1.0)
   result.height = maxi(1,ceili(6*rise))
   result.damage = 1.5
   result.name = "rising" if phase<0.1 else ("lowering" if phase>=1.06 else "raised")
  elif phase>=PERIOD-WARNING_TIME: result.name = "warning"
 return result

static func damage(hazard: Dictionary, time: float) -> float:
 return float(state(hazard,time).damage)

static func blocks(hazard: Dictionary, point: Vector2, radius: float) -> bool:
 return hazard.type=="pit" and hazard.rect.grow(radius*0.35).has_point(point)

static func speed_factor(hazard: Dictionary, point: Vector2) -> float:
 return 0.64 if hazard.type=="water" and hazard.rect.has_point(point) else 1.0

static func sprite(g, index: int, at: Vector2, tint: Color = Color.WHITE):
 load_parts()
 g.draw_texture_rect(textures[index],Rect2(at.snapped(Vector2(2,2)),Vector2(SIZES[index])*2),false,tint)

static func socket(hazard: Dictionary, column: int, row: int) -> Vector2:
 return hazard.rect.position+Vector2(SOCKET_X[column]-2+(2 if row==1 else 0),SOCKET_Y[row]-2)*2

static func floor_layer(g, hazard: Dictionary):
 load_parts()
 var box: Rect2 = hazard.rect
 var base: int = {"pit":0,"water":1,"spikes":2,"fire":3}.get(hazard.type,0)
 var at = box.get_center()-Vector2(SIZES[base])
 var tint = Light.sample(Color.WHITE,box.get_center(),g.floor_index,true,g.room_torches)
 if hazard.type=="water": tint = tint.lerp(Color(0.7,0.9,0.92),0.28)
 sprite(g,base,at,tint)
 var phase = state(hazard,g.elapsed)
 if hazard.type=="water":
  var alpha = 0.8 if box.has_point(g.player) and g.moving else 0.65
  sprite(g,4+phase.frame,box.position,Color(0.7,0.88,0.88,alpha))
 elif hazard.type=="spikes":
  for row in range(3):
   for col in range(4):
    var p = socket(hazard,col,row)
    if phase.height==0: sprite(g,10,p-Vector2(3,2),tint)
    if phase.name=="warning":
     var pulse = 0.45+0.45*sin((phase.phase-(PERIOD-WARNING_TIME))/WARNING_TIME*PI)
     sprite(g,9,p-Vector2(3,3),Color(1,0.9,0.65,pulse))
 elif hazard.type=="fire":
  var flicker = 0.7+0.25*sin(g.elapsed*9+hazard.get("phase",0))
  g.draw_texture_rect(glow,Rect2(box.get_center()-Vector2(48,40),Vector2(96,64)),false,Color(1,1,1,flicker))

static func layers(hazard: Dictionary, time: float) -> Array:
 var result: Array = []
 if hazard.type=="fire": result.append({"type":"hazard_fx","x":hazard.rect.get_center().x,"y":hazard.rect.end.y-4,"hazard":hazard,"row":0})
 elif hazard.type=="spikes" and state(hazard,time).height>0:
  for row in range(3): result.append({"type":"hazard_fx","x":hazard.rect.get_center().x,"y":socket(hazard,0,row).y,"hazard":hazard,"row":row})
 return result

static func effect_layer(g, entity: Dictionary):
 var hazard: Dictionary = entity.hazard
 var phase = state(hazard,g.elapsed)
 if hazard.type=="fire":
  sprite(g,12+phase.frame,Vector2(hazard.rect.position.x,hazard.rect.end.y-4)-Vector2(0,48))
 elif hazard.type=="spikes":
  load_parts()
  var height: int = phase.height
  if height<=0: return
  var tint = Light.sample(Color.WHITE,hazard.rect.get_center(),g.floor_index,true,g.room_torches).lerp(Color(0.85,0.88,0.9),0.28)
  for col in range(4):
   var p = socket(hazard,col,int(entity.row))
   g.draw_texture_rect_region(textures[8],Rect2((p-Vector2(5,height*2)).snapped(Vector2(2,2)),Vector2(10,height*2)),Rect2(0,0,5,height),tint)
