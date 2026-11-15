extends SceneTree
const Castle = preload("res://scripts/castle_view.gd")
const Dungeon = preload("res://scripts/dungeon.gd")
var checks = 0
var failures = 0
func check(ok: bool, label: String):
 checks += 1
 if not ok:
  failures += 1
  push_error(label)
func _initialize(): call_deferred("run")
func run():
 check(Castle.ATLAS.get_size()==Vector2(256,128),"Environment uses a native 32px tile atlas")
 var game = load("res://main.tscn").instantiate()
 game.save_path = "user://castle-test-run.json"
 game.profile_path = "user://castle-test-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 game.new_run(42365)
 var gameplay_rng = game.rng.state
 var first = game.room_texture.get_image().get_data()
 game.make_floor_texture()
 check(first==game.room_texture.get_image().get_data(),"Re-entering a room cannot reshuffle its flagstones")
 check(game.rng.state==gameplay_rng,"Environment does not consume gameplay randomness")
 game.save_run()
 check(game.load_run() and first==game.room_texture.get_image().get_data(),"A saved room restores exactly the same ground")
 check(first!=Castle.bake_floor(int(game.room.seed)+1,0).get_image().get_data(),"Different rooms have different ground layouts")
 for floor_index in range(4):
  var image = Castle.bake_floor(9876,floor_index).get_image()
  check(image.get_size()==Vector2i(336,132),"Ground texture fits collision-space boundaries on floor %d"%floor_index)
  var peak = 0.0
  var opaque = true
  for y in range(image.get_height()):
   for x in range(image.get_width()):
    var color = image.get_pixel(x,y)
    peak = maxf(peak,color.get_luminance())
    opaque = opaque and color.a==1
  check(peak<0.23 and opaque,"Dark ground does not compete with character highlights, floor %d"%floor_index)
 # Each visible exit must agree with its actual transition and key behavior.
 for direction in range(4):
  game.new_run(100+direction)
  var target = Vector2i(game.DIRECTIONS[direction])
  var room = Dungeon.make_room(target,"treasure",game.rng)
  game.dungeon.rooms[Dungeon.key(target)] = room
  game.room.clear = false
  check(Castle.door_state(game.room.clear,room)=="barred","Combat exit displays a closed portcullis")
  game.room.clear = true
  game.enemies.clear()
  game.place_player(game.door_position(direction)-game.DIRECTIONS[direction]*20,game.DIRECTIONS[direction])
  game.keys = 0
  game.transition_cd = 0
  check(Castle.door_state(game.room.clear,room)=="locked","Unopened treasure exit displays a lock")
  game.check_doors()
  check(game.coords==Vector2i.ZERO and not room.opened,"Visible locked exit rejects missing key")
  game.keys = 2
  game.transition_cd = 0
  game.check_doors()
  check(game.coords==target and room.opened and game.keys==1,"Approaching each drawn exit consumes exactly one key")
  check(Castle.door_state(true,room)=="open","Opened exit displays a passage")
 # Hidden rooms stay masonry through a save until the actual third strike.
 game.new_run(1122)
 var target = Vector2i.RIGHT
 var secret = Dungeon.make_room(target,"secret",game.rng)
 game.dungeon.rooms[Dungeon.key(target)] = secret
 game.room.clear = true
 game.enemies.clear()
 game.place_player(game.door_position(1)-Vector2(24,0),Vector2.RIGHT)
 game.swing_dir = Vector2.RIGHT
 game.perform_attack()
 game.perform_attack()
 check(Castle.door_state(true,secret)=="wall","Two strikes leave a secret looking like masonry")
 game.save_run()
 game.load_run()
 secret = game.dungeon.rooms[Dungeon.key(target)]
 check(secret.cracks==2 and Castle.door_state(true,secret)=="wall","Secret wall damage survives save/load")
 game.perform_attack()
 check(secret.revealed and Castle.door_state(true,secret)=="open","Third outward strike opens the rendered passage")
 game.delete_run()
 if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
 print("CASTLE CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
