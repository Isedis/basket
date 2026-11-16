extends "res://scripts/game.gd"
## Authored playable standard room: 18x10 floor cells at the existing world scale.
const FLOOR_TILES = Vector2i(18,10)
const TILE_WORLD = 64

func _init():
 room_floor_rect = Rect2(Vector2(48,168),Vector2(FLOOR_TILES)*TILE_WORLD)
 CENTRE = room_floor_rect.get_center()
 authored_room = true
 room_torches = [Vector2(224,142),Vector2(432,142),Vector2(816,142),Vector2(1024,142),Vector2(56,388),Vector2(1192,388)]
 save_path = "user://castle-hall-design-run.json"
 profile_path = "user://castle-hall-design-profile.json"

func _ready():
 super._ready()
 mode = "playing"
 new_run(16423)
 message_time = 0
 room_camera = desired_camera()

func new_floor():
 var rooms: Dictionary = {}
 rooms["0,0"] = Dungeon.make_room(Vector2i.ZERO,"combat",rng)
 for direction in DIRECTIONS:
  var at = Vector2i(direction)
  rooms[Dungeon.key(at)] = Dungeon.make_room(at,"combat",rng)
 dungeon = {"rooms":rooms,"floor":0}
 coords = Vector2i.ZERO
 enter_room(coords,CENTRE+Vector2(0,48),false)

func add_prop(kind: int, p: Vector2, solid: bool = false, footprint: Vector2 = Vector2.ZERO):
 room_props.append({"type":"scenery","kind":kind,"x":p.x,"y":p.y,"solid":solid,"boss":false})
 if solid: blocks.append(Rect2(p-Vector2(footprint.x/2,footprint.y/2),footprint))

func setup_geometry():
 blocks.clear()
 hazards.clear()
 room_props.clear()
 # Four columns define generous central and side routes; their bases are solid.
 for p in [Vector2(304,360),Vector2(944,360),Vector2(304,664),Vector2(944,664)]:
  add_prop(0,p,true,Vector2(44,22))
 for p in [Vector2(112,248),Vector2(1136,248)]: add_prop(2,p,true,Vector2(46,20))
 add_prop(4,Vector2(116,624),true,Vector2(58,20))
 add_prop(3,Vector2(1096,616),true,Vector2(70,24))
 add_prop(7,Vector2(128,752),true,Vector2(48,22))
 add_prop(1,Vector2(1104,748),true,Vector2(46,20))
 for p in [Vector2(172,286),Vector2(1072,294),Vector2(88,694),Vector2(1152,672),Vector2(256,780),Vector2(1016,784)]: add_prop(5,p)
 add_prop(6,Vector2(176,592))
 add_prop(6,Vector2(1040,762))

func populate_room():
 spawn_enemy("guard",Vector2(832,404),false)
 spawn_enemy("assassin",Vector2(504,636),false)
 spawn_enemy("guard",Vector2(840,680),false)

