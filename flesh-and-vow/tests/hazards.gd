extends SceneTree
const Hazard = preload("res://scripts/hazard_view.gd")
var checks = 0
var failures = 0
func check(ok: bool, label: String):
 checks += 1
 if not ok:
  failures += 1
  push_error(label)
func _initialize(): call_deferred("run")
func run():
 Hazard.load_parts()
 check(Hazard.ATLAS.get_size()==Vector2(128,128),"Hazards use a compact native-pixel atlas")
 for i in range(16):
  var image = Hazard.textures[i].get_image()
  var hard_alpha = true
  for y in range(image.get_height()):
   for x in range(image.get_width()): hard_alpha = hard_alpha and image.get_pixel(x,y).a in [0.0,1.0]
  check(hard_alpha and image.get_used_rect().has_area(),"Native component has a nonempty silhouette and hard pixel edges")
 var pit_image = Hazard.textures[0].get_image()
 check(pit_image.get_pixel(16,11).a==1 and pit_image.get_pixel(16,11).get_luminance()<0.15,"Pit interior is an opaque dark cavity rather than a hole showing the floor")
 var trap = {"type":"spikes","rect":Rect2(300,300,52,32),"phase":0.0}
 for offset in [0.0,0.7,3.0,6.0]:
  trap.phase = offset
  for sample in range(250):
   var time = sample/100.0
   var state = Hazard.state(trap,time)
   var expected = fposmod(time+offset,2.5)<1.2
   check((state.height>0)==expected and (state.damage>0)==expected,"Visible needles and harmful state agree throughout a full cycle")
 trap.phase = 0.0
 check(Hazard.state(trap,2.25).name=="warning" and Hazard.damage(trap,2.25)==0,"Warning glints precede the next dangerous rise without dealing damage")
 var sockets: Array = []
 for row in range(3):
  for col in range(4): sockets.append(Hazard.socket(trap,col,row))
 check(sockets.size()==12 and sockets.all(func(p): return trap.rect.has_point(p)),"All twelve fixed needle sockets stay inside the physical trap footprint")
 check(Hazard.layers(trap,0.6).size()==3 and Hazard.layers(trap,1.7).is_empty(),"Raised rows participate separately in world depth order")
 var game = load("res://main.tscn").instantiate()
 game.save_path = "user://test-hazards-run.json"
 game.profile_path = "user://test-hazards-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 game.new_run(0)
 game.enemies.clear()
 game.blocks.clear()
 var center = game.CENTRE
 var box = Rect2(center-Vector2(26,16),Vector2(52,32))
 game.hazards = [{"type":"spikes","rect":box,"phase":0.0}]
 game.place_player(center)
 game.hp = 12
 game.invincible = 0
 game.elapsed = 2.25
 game.anim = 10000
 game.check_hazards()
 check(game.hp==12,"Actual game applies no spike damage during the visual warning, independent of ambient time")
 game.elapsed = 0.6
 game.check_hazards()
 check(game.hp==10.5,"Actual game applies spike damage while the needles are visibly raised")
 game.invincible = 0
 game.elapsed = 1.7
 game.check_hazards()
 check(game.hp==10.5,"Retracted mechanism is safe")
 var before = Hazard.state(game.hazards[0],game.elapsed)
 game.mode = "paused"
 game._process(4.0)
 check(Hazard.state(game.hazards[0],game.elapsed)==before,"Pause freezes both trap animation and its gameplay phase")
 game.mode = "playing"
 game.hit_stop = 0.2
 game.advance_frame(0.1)
 check(Hazard.state(game.hazards[0],game.elapsed)==before,"Impact freeze cannot advance a trap behind the stopped combat")
 game.hit_stop = 0
 game.hazards = [{"type":"fire","rect":box,"phase":0.0}]
 game.invincible = 0
 game.check_hazards()
 check(game.hp==9.5,"Furnace flame retains its original continuous damage")
 var travel: Array = []
 for wet in [false,true]:
  game.hazards = [{"type":"water","rect":box,"phase":0.0}] if wet else []
  game.place_player(center,Vector2.RIGHT)
  Input.action_press("right")
  game.update_game(0.1)
  Input.action_release("right")
  travel.append(game.player.x-center.x)
 check(absf(travel[1]/travel[0]-0.64)<0.001,"Walking through water retains the existing physical slowdown")
 game.hazards = [{"type":"pit","rect":box,"phase":0.0}]
 var start = center-Vector2(60,0)
 var end = game.move_body(start,Vector2(120,0),9)
 check(end.x<box.position.x and not game.blocked(end,9),"Actual body movement stops at the visible pit boundary")
 # A generated trap uses the saved simulation clock and deterministic room phase.
 var room = game.dungeon.rooms.values().filter(func(r): return r.type=="combat")[0]
 room.layout = 0
 room.span_x = 1
 room.span_y = 1
 game.Dungeon.rebuild_cells(game.dungeon)
 game.enter_room(Vector2i(room.x,room.y),Vector2.INF)
 var spike = game.hazards.filter(func(h): return h.type=="spikes")[0]
 game.elapsed = 12.5+2.25-spike.phase
 var saved_state = Hazard.state(spike,game.elapsed)
 game.save_run()
 game.load_run()
 var restored = game.hazards.filter(func(h): return h.type=="spikes")[0]
 check(Hazard.state(restored,game.elapsed)==saved_state,"Checkpoint restores the exact warning/animation phase")
 game.delete_run()
 if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
 print("HAZARD CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
