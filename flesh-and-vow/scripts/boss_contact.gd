extends RefCounted
## Contact geometry and material feedback for the Bell Executioner's axe.
const Combat = preload("res://scripts/combat.gd")
const Props = preload("res://scripts/castle_props.gd")
static func box_polygon(box: Rect2) -> PackedVector2Array:
 return PackedVector2Array([box.position,box.position+Vector2(box.size.x,0),box.end,box.position+Vector2(0,box.size.y)])
static func surfaces(g) -> Array:
 var result: Array = []
 for block in g.blocks:
  var visible: Rect2 = block
  for prop in g.room_props:
   if not prop.get("solid",false) or prop.get("sheet","")=="special":continue
   var p = Vector2(prop.x,prop.y)
   if block.grow(2).has_point(p):
    var size = Vector2(Props.SIZES[int(prop.kind)])*2
    visible = Rect2(p-Vector2(size.x/2,size.y-5),size).grow(-2)
    break
  result.append(visible)
 var floor_box: Rect2 = g.room_floor_rect
 result.append(Rect2(floor_box.position-Vector2(24,100),Vector2(floor_box.size.x+48,104)))
 result.append(Rect2(Vector2(floor_box.position.x-24,floor_box.end.y-2),Vector2(floor_box.size.x+48,100)))
 result.append(Rect2(floor_box.position-Vector2(24,100),Vector2(26,floor_box.size.y+200)))
 result.append(Rect2(Vector2(floor_box.end.x-2,floor_box.position.y-100),Vector2(26,floor_box.size.y+200)))
 return result
static func nearest_on_polygon(polygon: PackedVector2Array, from: Vector2) -> Vector2:
 var closest: Vector2 = polygon[0]
 for i in range(polygon.size()):
  var candidate = Geometry2D.get_closest_point_to_segment(from,polygon[i],polygon[(i+1)%polygon.size()])
  if candidate.distance_squared_to(from)<closest.distance_squared_to(from):closest = candidate
 return closest
static func at(g, polygon: PackedVector2Array, hand: Vector2, boxes: Array, player_visible: bool) -> Dictionary:
 var best: Dictionary = {}
 var distance = INF
 for box in boxes:
  for overlap in Geometry2D.intersect_polygons(polygon,box_polygon(box)):
   if overlap.size()<3:continue
   var point = nearest_on_polygon(overlap,hand)
   var d = point.distance_squared_to(hand)
   if d<distance:
    distance = d
    best = {"kind":"stone","point":point}
 if player_visible:
  var hit = Combat.polygon_capsule(polygon,Combat.hurt_capsule(g.player,"player"))
  if hit.hit and hit.point.distance_squared_to(hand)<distance:
   best = {"kind":"flesh","point":hit.point}
 return best
static func feedback(g,e: Dictionary,contact: Dictionary) -> bool:
 e.strike_hit = true
 var kind: String = contact.kind
 var point: Vector2 = contact.point
 var away = (g.player-Vector2(e.x,e.y)).normalized() if kind=="flesh" else (point-Vector2(e.x,e.y)).normalized()
 if away.length_squared()<0.001:away = Vector2(e.dx,e.dy)
 if kind=="flesh":
  var hp = g.hp
  g.hurt(3,Vector2(e.x,e.y))
  if g.hp==hp:return false
  g.player_knockback += away*65
  g.player_stagger = maxf(g.player_stagger,0.13)
 e.bell_hit_kind = kind
 e.bell_hit_u = contact.progress
 e.bell_hit_age = 0.0
 e.bell_hit_dx = away.x
 e.bell_hit_dy = away.y
 e.bell_hit_x = point.x
 e.bell_hit_y = point.y
 g.hit_stop = maxf(g.hit_stop,0.065 if kind=="stone" else 0.05)
 g.shake = maxf(g.shake,3.8 if kind=="stone" else 5.4)
 g.shake_axis = away
 g.melee_contacts.append({"point":point,"life":0.2,"total":0.2,"axis":away,"power":2.0,"material":kind,"armored":kind=="stone"})
 for i in range(12):
  var fan = (i-5.5)*0.13
  var speed = 75+(i%4)*28
  var color = Color("dfbd7c") if kind=="stone" and i%3==0 else (Color("8e8976") if kind=="stone" else Color("a83440"))
  g.emit_particle(point,color,away.rotated(fan)*speed+Vector2(0,-25),0.23+(i%3)*0.045,2 if kind=="stone" else 3)
 var floor_point = g.player+away*6 if kind=="flesh" else point+Vector2(0,12)
 if kind=="stone":
  for prop in g.room_props:
   if not prop.get("solid",false) or prop.get("sheet","")=="special":continue
   var size=Vector2(Props.SIZES[int(prop.kind)])*2
   var anchor=Vector2(prop.x,prop.y)
   if Rect2(anchor-Vector2(size.x/2,size.y-5),size).has_point(point):
    floor_point=Vector2(point.x,prop.y+9)
    break
 for i in range(3):
  g.blood.append({"x":floor_point.x+(i-1)*5,"y":floor_point.y+abs(i-1)*3,"size":5 if kind=="stone" else 7,"bone":kind=="stone","kind":kind})
 if g.blood.size()>160:g.blood = g.blood.slice(g.blood.size()-160)
 return true
