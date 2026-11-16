extends RefCounted
const ATLAS = preload("res://assets/castle_props.png")
const SIZES = [Vector2i(26,48),Vector2i(28,23),Vector2i(31,48),Vector2i(40,26),Vector2i(34,42),Vector2i(31,19),Vector2i(36,25),Vector2i(29,37)]
const COLORS = ["080d10","11171a","1c2426","2a3130","343b37","41443b","4b4c40","585645","64604c","716951","7e755c","8c8269","9b9076","ada184","c0b294","cfc2a4","2c3328","414734","535740","1e171e","33212a","4c2b33","673640","82434a","9a5c58","353f46","566369","81908d"]
static func region(index: int) -> Rect2:
 return Rect2(Vector2((index%4)*64,(index/4)*64),Vector2(SIZES[index]))
static func draw(g, entry: Dictionary):
 if entry.get("sheet","")=="special":
  preload("res://scripts/castle_special.gd").draw(g,entry)
  return
 var size: Vector2 = Vector2(SIZES[entry.kind])*2
 var p = Vector2(entry.x,entry.y)
 if entry.get("solid",false):
  g.draw_rect(Rect2(p-Vector2(size.x*0.45,3),Vector2(size.x*0.9,10)),Color(0,0,0,0.38))
 var tint = preload("res://scripts/castle_view.gd").light_color(Color.WHITE,p-Vector2(0,size.y*0.5),g.floor_index,true,g.room_torches)
 g.draw_texture_rect_region(ATLAS,Rect2((p-Vector2(size.x/2,size.y-5)).snapped(Vector2(2,2)),size),region(entry.kind),tint)
