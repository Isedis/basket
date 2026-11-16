extends SceneTree
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
 hall.save_path = "user://test-castle_hall-run.json"
 hall.profile_path = "user://test-castle_hall-profile.json"
 root.add_child(hall)
 hall.set_process(false)
 check(hall.room_floor_rect.size==Vector2(18,10)*64,"Standard room contains exactly 18x10 full floor cells")
 check(hall.room_texture.get_size()==Vector2(576,320),"Actual room area increases while keeping 2x native sprite scale")
 check(hall.world_viewport.size==Vector2i(352,182),"Normal gameplay camera clips the world before drawing the HUD")
 var ordinary_save = "user://run_v1.json"
 check(hall.save_path!=ordinary_save,"Room review does not write the ordinary run")
 check(hall.blocks.size()==10 and hall.room_props.size()==18,"Architecture has collidable bases and nonblocking floor dressing")
 for p in [hall.CENTRE,Vector2(624,320),Vector2(624,744),Vector2(88,488),Vector2(1152,488)]:
  check(not hall.blocked(p,9),"Central route and all four door approaches remain clear")
 check(hall.blocked(Vector2(304,360),9),"Column base blocks movement")
 var moved = hall.move_body(Vector2(304,320),Vector2(0,100),9)
 check(moved.y<340,"Movement cannot pass through a drawn column base")
 var floor_bytes = hall.room_texture.get_image().get_data()
 hall.save_run()
 check(hall.load_run(),"Hall checkpoint loads")
 check(hall.room_texture.get_image().get_data()==floor_bytes,"Saved hall restores identical material layout and illumination")
 hall.enemies.clear()
 hall.room.clear = true
 for direction in range(4):
  hall.enter_room(Vector2i.ZERO,hall.CENTRE)
  hall.enemies.clear()
  hall.room.clear = true
  hall.DoorMotion.reset(hall)
  hall.place_player(hall.door_position(direction)-hall.DIRECTIONS[direction]*20)
  hall.transition_cd = 0
  hall.check_doors()
  check(hall.coords==Vector2i(hall.DIRECTIONS[direction]) and not hall.blocked(hall.player,9),"Each architectural exit transitions to a valid opposing entrance")
 var safe = hall.room_floor_rect.position+Vector2(2,8)
 check(hall.blocked(safe,9),"Unwalkable wall margin agrees with the room boundary")
 hall.place_player(Vector2(1100,700))
 var camera = hall.desired_camera()
 check(camera.x>=0 and camera.x<=480 and camera.y>=0 and camera.y<=376,"Following camera stays within the room")
 hall.delete_run()
 if FileAccess.file_exists(hall.profile_path): DirAccess.remove_absolute(hall.profile_path)
 print("HALL CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
