extends RefCounted
const ATLAS = preload("res://assets/castle_special.png")
const Light = preload("res://scripts/castle_light.gd")
const SIZES = [Vector2i(44,44),Vector2i(32,38),Vector2i(32,28),Vector2i(32,28),Vector2i(26,44),Vector2i(24,18),Vector2i(34,30),Vector2i(28,38)]
static func draw(g, entry: Dictionary):
 var kind: int = entry.kind
 var p = Vector2(entry.x,entry.y)
 var size = Vector2(SIZES[kind])*2
 var tint = Light.sample(Color.WHITE,p-Vector2(0,size.y/2),g.floor_index,true,g.room_torches)
 g.draw_texture_rect_region(ATLAS,Rect2((p-Vector2(size.x/2,size.y-4)).snapped(Vector2(2,2)),size),Rect2(Vector2((kind%4)*64,(kind/4)*64),Vector2(SIZES[kind])),tint)
