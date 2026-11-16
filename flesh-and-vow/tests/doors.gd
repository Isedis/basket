extends SceneTree
const Motion = preload("res://scripts/door_motion.gd")
const Doors = preload("res://scripts/door_view.gd")
var checks = 0
var failures = 0
func check(ok: bool, label: String):
 checks += 1
 if not ok:
  failures += 1
  push_error(label)
func _initialize(): call_deferred("run")
func run():
 var hall = load("res://scenes/castle_hall.tscn").instantiate()
 hall.save_path = "user://test-doors-run.json"
 hall.profile_path = "user://test-doors-profile.json"
 root.add_child(hall)
 hall.set_process(false)
 hall.enemies.clear()
 check(Doors.ATLAS.get_size()==Vector2(256,192),"All orientations share a native door atlas")
 for direction in range(4):
  for part in range(3):
   var tex = Doors.texture(hall,direction,part)
   check(tex.get_size()==Vector2(Doors.SIZES[part][direction]),"Frame and moving inserts retain their fixed native dimensions")
 hall.room.clear = false
 Motion.reset(hall)
 hall.room.clear = true
 Motion.advance(hall,0.13)
 check(is_equal_approx(hall.door_visuals[0].open,0.25) and not Motion.ready(hall,0),"Portcullis opens over time and prevents an early transition")
 Motion.advance(hall,0.4)
 check(Motion.ready(hall,0),"Passage becomes available when the gate has risen")
 hall.room.clear = false
 Motion.advance(hall,0.13)
 check(is_equal_approx(hall.door_visuals[0].open,0.75),"A reversing portcullis does not jump between poses")
 var samples: Array = []
 for fps in [30,120]:
  hall.room.clear = false
  Motion.reset(hall)
  hall.room.clear = true
  for _i in range(fps/2): Motion.advance(hall,1.0/fps)
  samples.append(hall.door_visuals[0].open)
 check(absf(samples[0]-samples[1])<0.00001,"Gate opening is independent of the frame rate")
 var before = hall.door_visuals[0].open
 hall.mode = "paused"
 hall._process(0.2)
 check(hall.door_visuals[0].open==before,"Pausing freezes door motion")
 hall.mode = "playing"
 for direction in range(4):
  hall.enter_room(Vector2i.ZERO,hall.CENTRE)
  hall.enemies.clear()
  hall.room.clear = true
  var target = Vector2i(hall.DIRECTIONS[direction])
  var dest: Dictionary = hall.dungeon.rooms[hall.Dungeon.key(target)]
  dest.opened = false
  Motion.reset(hall)
  hall.place_player(hall.door_position(direction)-hall.DIRECTIONS[direction]*20)
  hall.transition_cd = 0
  hall.keys = 0
  hall.check_doors()
  check(hall.coords==Vector2i.ZERO and not dest.opened,"Locked door rejects a player without a key")
  hall.keys = 2
  hall.transition_cd = 0
  hall.check_doors()
  check(hall.coords==Vector2i.ZERO and dest.opened and hall.keys==1,"Unlocking consumes one key and begins the wooden leaf animation")
  hall.check_doors()
  check(hall.coords==Vector2i.ZERO and hall.keys==1,"Repeated approach cannot consume a second key or skip opening")
  Motion.advance(hall,Motion.WOOD_TIME/2)
  hall.check_doors()
  check(hall.coords==Vector2i.ZERO,"Player waits for half-open wooden leaves")
  Motion.advance(hall,Motion.WOOD_TIME)
  hall.check_doors()
  check(hall.coords==target and not hall.blocked(hall.player,9),"Fully opened door transitions to a safe opposite entrance")
 hall.enter_room(Vector2i.ZERO,hall.CENTRE)
 hall.enemies.clear()
 hall.room.clear = true
 var hidden: Dictionary = hall.dungeon.rooms["1,0"]
 hidden.revealed = false
 hall.place_player(hall.door_position(1)-Vector2(20,0))
 hall.transition_cd = 0
 Motion.reset(hall)
 hall.check_doors()
 check(hall.coords==Vector2i.ZERO and Motion.desired(hall,1)=="wall","Unrevealed secret remains masonry and rejects transitions")
 hidden.revealed = true
 hidden.opened = true
 hall.save_run()
 hall.load_run()
 check(Motion.ready(hall,1),"Reloading an opened passage does not repeat its unlock animation")
 hall.delete_run()
 if FileAccess.file_exists(hall.profile_path): DirAccess.remove_absolute(hall.profile_path)
 print("DOOR CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
