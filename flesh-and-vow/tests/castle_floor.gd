extends SceneTree
const Dungeon = preload("res://scripts/dungeon.gd")
const Layout = preload("res://scripts/castle_layout.gd")
const Motion = preload("res://scripts/locomotion.gd")
var checks = 0
var failures = 0
func check(ok: bool, label: String):
 checks += 1
 if not ok:
  failures += 1
  push_error(label)
func _initialize(): call_deferred("run")
func run():
 var rng = RandomNumberGenerator.new()
 var horizontal = 0
 var vertical = 0
 for seed_value in range(300):
  rng.seed = seed_value
  var map = Dungeon.generate(rng,0)
  var seen = ["0,0"]
  var queue = ["0,0"]
  while not queue.is_empty():
   var anchor = queue.pop_front()
   for port in Dungeon.ports(map,map.rooms[anchor]):
    if not port.target.is_empty() and port.target not in seen:
     seen.append(port.target)
     queue.append(port.target)
  check(seen.size()==map.rooms.size(),"Merged floor remains connected, seed %d"%seed_value)
  var occupied = 0
  var valid = true
  var reciprocal = true
  for anchor in map.rooms:
   var room: Dictionary = map.rooms[anchor]
   var size = Dungeon.span(room)
   horizontal += int(size==Vector2i(2,1))
   vertical += int(size==Vector2i(1,2))
   occupied += size.x*size.y
   for y in range(size.y):
    for x in range(size.x): valid = valid and Dungeon.owner(map,Vector2i(room.x+x,room.y+y))==anchor
   for port in Dungeon.ports(map,room):
    valid = valid and Dungeon.owner(map,port.from)==anchor and port.target!=anchor
    if port.target.is_empty(): continue
    reciprocal = reciprocal and Dungeon.ports(map,map.rooms[port.target]).any(func(back): return back.from==port.to and back.to==port.from)
  check(valid and occupied==map.cells.size(),"No overlap, dangling cell or internal door, seed %d"%seed_value)
  check(reciprocal,"Every physical exit has a matching return entrance, seed %d"%seed_value)
  for type in ["start","boss","treasure","shop","torture","oracle","reliquary","secret"]:
   check(map.rooms.values().filter(func(r): return r.type==type).size()==1,"Special room survives merging: "+type)
 check(horizontal>0 and vertical>0,"Both double-room orientations appear across seeds")
 var game = load("res://main.tscn").instantiate()
 game.save_path = "user://test-castle-floor-run.json"
 game.profile_path = "user://test-castle-floor-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 game.new_run(71)
 var center_room = game.room
 for shape in [Vector2i.ONE,Vector2i(2,1),Vector2i(1,2)]:
  for layout in range(6):
   game.room.span_x = shape.x
   game.room.span_y = shape.y
   game.room.layout = layout
   game.room.type = "combat"
   Layout.configure(game)
   game.setup_geometry()
   check(game.room_floor_rect.size==Vector2(shape)*Vector2(1152,640),"Room area is exactly one or two standard cells")
   var clear_routes = not game.blocked(game.CENTRE,15)
   # Traverse both central axes of every occupied cell, across the seam as well.
   for x in range(shape.x):
    for y in range(208,int(game.room_floor_rect.end.y)-24,24):
     clear_routes = clear_routes and not game.blocked(Vector2(48+(x+0.5)*1152,y),15)
   for y in range(shape.y):
    for x in range(88,int(game.room_floor_rect.end.x)-24,24):
     clear_routes = clear_routes and not game.blocked(Vector2(x,168+(y+0.5)*640),15)
   check(clear_routes,"Authored layout preserves every entrance lane and the unbroken double-room seam")
 game.new_run(19)
 # Traverse every real port in both double orientations and verify entry location.
 var doubles: Array = []
 for r in game.dungeon.rooms.values():
  if Dungeon.span(r)!=Vector2i.ONE: doubles.append(r)
 check(not doubles.is_empty(),"Ordinary run includes double rooms")
 for room in doubles:
  var ports = Dungeon.ports(game.dungeon,room)
  for index in range(ports.size()):
   if ports[index].target.is_empty(): continue
   game.enter_room(Vector2i(room.x,room.y),Vector2.INF)
   game.enemies.clear()
   game.room.clear = true
   var dest = game.door_destination(index)
   dest.revealed = true
   dest.opened = true
   game.DoorMotion.reset(game)
   var exit: Dictionary = game.room_ports[index]
   game.place_player(game.door_position(index)-game.DIRECTIONS[game.door_direction(index)]*20)
   game.transition_cd = 0
   game.check_doors()
   check(game.coords==Vector2i(dest.x,dest.y) and not game.blocked(game.player,9),"Double-room exit enters the intended adjacent room safely")
   var matching = game.room_ports.filter(func(p): return p.from==exit.to and p.to==exit.from)
   check(matching.size()==1,"Entry comes through the matching physical cell, not the room center")
 # Migrate a real old checkpoint shape without changing progression or body proportions.
 game.new_run(331)
 game.inventory = ["echo","ember"]
 game.coins = 17
 game.hp = 7
 game.save_run()
 var data = JSON.parse_string(FileAccess.get_file_as_string(game.save_path))
 data.erase("room_geometry")
 data.player = [384,300]
 data.player_motion = Motion.initialize(Vector2(384,300),1,0)
 var old_feet = Motion.foot_position(data.player_motion,0,Vector2(384,300))-Vector2(384,300)
 var file = FileAccess.open(game.save_path,FileAccess.WRITE)
 file.store_string(JSON.stringify(data))
 file.close()
 check(game.load_run(),"Legacy checkpoint loads into the enlarged room")
 check(game.coins==17 and game.hp==7 and game.inventory==["echo","ember"],"Legacy migration preserves run progression")
 check((Motion.foot_position(game.player_motion,0,game.player)-game.player).distance_to(old_feet)<0.001,"Migration moves the character without stretching limbs")
 var migrated = game.player
 check(game.load_run() and game.player.distance_to(migrated)<0.001,"Checkpoint geometry is migrated exactly once")
 game.delete_run()
 if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
 print("CASTLE FLOOR CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
