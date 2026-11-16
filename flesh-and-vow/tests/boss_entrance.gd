extends SceneTree
const Fight=preload("res://scripts/boss_fight.gd")
const Scene=preload("res://scripts/boss_entrance.gd")
var checks=0
var failures=0
var game
func check(ok: bool,label: String):
 checks+=1
 if not ok:
  failures+=1
  push_error(label)
func _initialize():call_deferred("run")
func fresh(seen: bool=false) -> Dictionary:
 game.new_run(711)
 game.profile.bell_intro_seen=seen
 game.save_profile()
 for r in game.dungeon.rooms.values():
  if r.type=="boss":game.enter_room(Vector2i(int(r.x),int(r.y)),Vector2.INF);break
 game.hazards.clear()
 var e=game.enemies[0]
 # Spawn occurred with the preceding profile; prepare this controlled encounter.
 Scene.prepare(game,e)
 game.place_player(Vector2(e.x,e.y+120),Vector2.UP)
 return e
func run():
 game=load("res://main.tscn").instantiate()
 game.save_path="user://test-boss-entrance-run.json"
 game.profile_path="user://test-boss-entrance-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 var e=fresh()
 check(game.door_visuals.all(func(v):return v.target=="barred" or v.kind==v.target),"Entrance gate animation leaves unconnected walls intact")
 check(e.state=="intro" and e.bell_intro_full and e.bell_intro_duration==Scene.FULL,"First ordinary encounter chooses the full scene")
 game.place_player(Vector2(e.x,e.y+280),Vector2.UP)
 game.advance_frame(0.02)
 check(not e.bell_intro_started and e.state_time==0,"Entrance waits until the boss is visible")
 game.place_player(Vector2(e.x,e.y+120),Vector2.UP)
 var player=game.player
 game.advance_frame(0.02)
 check(e.bell_intro_started and not Scene.active(game).is_empty(),"Proximity starts the staged entrance once")
 var hp=e.hp
 game.damage_enemy(e,10,game.player,true)
 check(e.hp==hp,"Cutscene cannot be damaged or interrupted by a buffered swing")
 Input.action_press("right")
 Input.action_press("hit_up")
 for _i in range(12):game.advance_frame(1.0/60)
 Input.action_release("right")
 Input.action_release("hit_up")
 check(game.player==player and not game.player_motion.moving and game.windup==0 and game.swing==0,"Held movement and attack cannot act during the entrance")
 var event=InputEventKey.new()
 event.pressed=true
 event.physical_keycode=KEY_SPACE
 event.keycode=KEY_SPACE
 var charge=game.charge
 game._unhandled_input(event)
 check(game.charge==charge,"Active item input is blocked without consuming its charge")
 var direction=int(e.motion.look)
 e.state_time=1.0
 game.update_enemies(0.001)
 check(e.motion.look!=direction,"Palač turns through a quarter view before facing the player")
 e.state_time=1.4
 game.update_enemies(0.001)
 check(e.motion.look==e.bell_intro_target,"Turn finishes toward the entrance direction")
 e.state_time=2.2
 game.update_enemies(0.001)
 check("draw" in e.bell_intro_events,"Draw sound has one persisted release marker")
 game.save_run()
 game.load_run()
 e=game.enemies[0]
 check(is_equal_approx(e.state_time,2.201) and e.bell_intro_started and "draw" in e.bell_intro_events,"Reload resumes the same entrance pose and consumed cue")
 game.particles.clear()
 game.update_enemies(0.001)
 check(game.particles.is_empty() and e.bell_intro_events.count("draw")==1,"Reload cannot repeat the extraction cue")
 e.state_time=2.9
 game.update_enemies(0.001)
 check("lift" in e.bell_intro_events and not game.particles.is_empty(),"Axe extraction creates one stone release")
 var count=game.particles.size()
 game.update_enemies(0.001)
 check(game.particles.size()==count,"Stone release does not repeat on subsequent frames")
 e.state_time=3.3
 game.update_enemies(0.001)
 check(e.bell_intro_music,"Music starts with the name reveal")
 game.mode="paused"
 var time=e.state_time
 game._process(0.2)
 check(e.state_time==time,"Pause holds the entire entrance timeline")
 game.mode="playing"
 e.state_time=Scene.FULL-0.001
 var end_pose=Fight.pose(e,game.elapsed)
 game.update_enemies(0.002)
 var rest=Fight.pose(e,game.elapsed)
 check(e.state=="chase" and game.profile.bell_intro_seen,"Full scene ends and records first viewing in the ordinary profile")
 check(end_pose.hand.distance_to(rest.hand)<0.1 and end_pose.body.distance_to(rest.body)<0.1,"Entrance ends continuously in the combat stance")
 check(game.invincible>0 and e.timer>0,"Combat resumes with a fair response window")
 e=fresh(true)
 check(not e.bell_intro_full and e.bell_intro_duration==Scene.REPEAT,"Later ordinary encounters use the short entrance")
 game.advance_frame(0.02)
 check(Scene.skip(game) and e.state=="chase","Enter skip completes the entrance immediately")
 check(not Scene.skip(game),"Skip cannot affect an active combat attack")
 # Ordinary progress and profile are protected during a full trial and retry.
 game.profile.bell_intro_seen=false
 game.save_profile()
 game.save_run()
 var original_run=FileAccess.get_file_as_string(game.save_path)
 var original_profile=FileAccess.get_file_as_string(game.profile_path)
 game.menu_action("boss_probe")
 e=game.enemies[0]
 check(e.bell_intro_full,"First boss trial shows the full entrance independently of ordinary progression")
 game.advance_frame(0.02)
 Scene.skip(game)
 check(game.practice_intro_seen,"Trial completion records viewing only in the trial session")
 game.start_boss_round()
 check(not game.enemies[0].bell_intro_full,"Trial retry has the short entrance")
 check(FileAccess.get_file_as_string(game.original_save_path)==original_run and FileAccess.get_file_as_string(game.original_profile_path)==original_profile,"Trial scenes cannot alter the ordinary run or profile")
 game.leave_art_probe()
 check(not game.practice_intro_seen,"Leaving trial resets only its local viewing history")
 # A saved old intro keeps its original duration and behavior.
 e=fresh()
 e.erase("bell_entrance")
 e.state_time=Fight.INTRO+0.01
 game.update_enemies(0.001)
 check(e.state=="chase","Legacy intro finishes under its original timing")
 # The warning belongs to a real adjacent boss door, not a generic hallway.
 var neighbor=false
 for r in game.dungeon.rooms.values():
  if r.type=="boss":continue
  game.enter_room(Vector2i(int(r.x),int(r.y)),Vector2.INF,false)
  for i in range(game.room_ports.size()):
   if game.door_destination(i).get("type","")!="boss":continue
   game.place_player(game.door_position(i)-game.DIRECTIONS[game.door_direction(i)]*82)
   check(Scene.Audio.approach(game),"Distant hall sound is available beside the actual boss door")
   game.place_player(game.CENTRE)
   check(not Scene.Audio.approach(game),"Distant sound does not fill the whole neighboring room")
   neighbor=true
   break
  if neighbor:break
 check(neighbor,"Fixed dungeon provides a connected approach room")
 # Native mesh grip remains connected during turn, extraction and settle.
 for look in range(4):
  for t in [0.0,0.8,1.0,1.35,1.8,2.2,2.7,2.85,3.15,3.45,4.8,5.6]:
   var model={"x":624.0,"y":480.0,"dx":0.0,"dy":1.0,"motion":Fight.Motion.initialize(Vector2(624,480),1,look),"state":"intro","state_time":t,"bell_entrance":true,"bell_intro_started":true,"bell_intro_full":true,"bell_intro_duration":Scene.FULL}
   var pose=Fight.pose(model,1.0)
   var wrist=60.0 if look in [1,3] else 72.0
   var side=Fight.Motion.hand_sign(look)
   var skin=load("res://scripts/boss_skin.gd")
   check(skin.point(Vector2(side*wrist,-86),model,pose,look).distance_to(pose.hand)<0.01,"Planted axe and extraction maintain the fist-to-handle binding")
 game.delete_run()
 if FileAccess.file_exists(game.profile_path):DirAccess.remove_absolute(game.profile_path)
 print("BOSS ENTRANCE CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
