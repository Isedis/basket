extends SceneTree
const Fight=preload("res://scripts/boss_fight.gd")
const Rhythm=preload("res://scripts/boss_rhythm.gd")
var g
var checks=0
var failures=0
func check(ok,label):
 checks+=1
 if not ok:
  failures+=1
  push_error(label)
func _initialize():call_deferred("run")
func fresh(distance: float=80) -> Dictionary:
 g.new_run(917)
 g.enemies.clear()
 g.hazards.clear()
 g.blocks.clear()
 g.spawn_enemy("boss0",g.CENTRE,true)
 var e=g.enemies[0]
 e.state="chase"
 e.state_time=0.0
 e.timer=0.0
 e.dx=1.0
 e.dy=0.0
 e.bell_intro_music=true
 e.motion=Fight.Motion.initialize(g.CENTRE,1,1)
 g.place_player(g.CENTRE+Vector2(distance,0),Vector2.LEFT)
 g.invincible=100
 Rhythm.prepare(e)
 return e
func run():
 g=load("res://main.tscn").instantiate()
 g.save_path="user://test-rhythm-run.json"
 g.profile_path="user://test-rhythm-profile.json"
 root.add_child(g)
 await process_frame
 g.set_process(false)
 var e=fresh()
 check(Rhythm.select(e,80)=="cleave","Close range chooses axe")
 check(Rhythm.select(e,140)=="toll","Medium range chooses toll")
 check(Rhythm.select(e,240)=="charge","Long range chooses charge")
 check(Rhythm.select(e,420)=="","Outside attack range approaches first")
 e.bell_last_primary="cleave"
 check(Rhythm.select(e,80)=="toll","Close attacks alternate instead of repeating axe")
 e.bell_last_primary="toll"
 check(Rhythm.select(e,140)=="","After toll close the distance for axe")
 for fps in [60,120]:
  e=fresh()
  e.timer=0.6
  g.place_player(g.CENTRE+Vector2(-160,0),Vector2.RIGHT)
  var start=Vector2(e.x,e.y)
  var angle=0.0
  for _i in range(int(fps*0.5)):
   g.update_enemies(1.0/fps)
   var next=Vector2(e.dx,e.dy).angle()
   check(absf(angle_difference(angle,next))<=Rhythm.TURN/fps+0.0001,"Turn speed bounded without snapping")
   angle=next
  check(Vector2(e.x,e.y)==start and e.state=="chase","Recovery pause plants feet while turning")
 e=fresh(400)
 g.update_enemies(0.02)
 check(e.x>g.CENTRE.x and e.x-g.CENTRE.x<0.1,"Approach accelerates from rest")
 e=fresh()
 for _i in range(12):g.update_enemies(1.0/60)
 check(e.state=="chase" and e.bell_poise>0,"Readable poised pause precedes warning")
 g.save_run()
 var saved=e.bell_poise
 check(g.load_run(),"Poise save loads")
 e=g.enemies[0]
 check(is_equal_approx(e.bell_poise,saved),"Save keeps preparation elapsed time")
 for _i in range(8):g.update_enemies(1.0/60)
 check(e.state=="windup" and e.bell_attack=="cleave","Full warning follows poised pause")
 var aim=Vector2(e.dx,e.dy)
 g.place_player(g.CENTRE+Vector2(0,-80),Vector2.DOWN)
 for _i in range(10):g.update_enemies(1.0/60)
 check(Vector2(e.dx,e.dy)==aim,"Warning direction stays committed when hero dodges")
 e.state="recover"
 e.state_time=0.7
 e.bell_hit_kind=""
 check(Fight.recovery(e)>=1.2,"Missed axe gives a longer counterattack window")
 var settled=Fight.pose(e,1)
 var rest=e.duplicate(true)
 rest.state="chase"
 var resting=Fight.pose(rest,1)
 check(settled.hand.distance_to(resting.hand)<0.01,"Axe returns continuously to idle before recovery ends")
 e.erase("bell_rhythm_attack")
 check(is_equal_approx(Fight.recovery(e),0.95),"Saved legacy attack retains its original recovery")
 e=fresh()
 for frame in range(160):
  if e.state!="chase":break
  var a=frame/60.0*4
  g.place_player(g.CENTRE+Vector2.from_angle(a)*80,Vector2.LEFT)
  g.update_enemies(1.0/60)
 check(e.state=="windup" or e.state=="strike","Circling cannot stall aiming forever")
 e=fresh()
 e.bell_phase=2
 e.bell_turn=1
 check(Rhythm.select(e,80)=="toll","Second phase still opens with the double toll")
 var pose=e.duplicate(true)
 g.mode="paused"
 g._process(0.2)
 check(e==pose,"Pause freezes decision and turn")
 g.delete_run()
 g.BossFight.stop_sounds(g)
 if FileAccess.file_exists(g.profile_path):DirAccess.remove_absolute(g.profile_path)
 await create_timer(0.25).timeout
 print("BOSS RHYTHM CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
