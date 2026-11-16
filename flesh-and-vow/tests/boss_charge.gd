extends SceneTree
const Fight = preload("res://scripts/boss_fight.gd")
const Charge = preload("res://scripts/boss_charge.gd")
const View = preload("res://scripts/boss_view.gd")
var checks=0
var failures=0
var game
func check(ok: bool,label: String):
 checks+=1
 if not ok:
  failures+=1
  push_error(label)
func _initialize():call_deferred("run")
func fresh(look: int=1,phase: int=2) -> Dictionary:
 game.new_run(715)
 game.blocks.clear()
 game.room_props.clear()
 game.hazards.clear()
 game.enemies.clear()
 game.particles.clear()
 game.zones.clear()
 game.melee_contacts.clear()
 game.hit_stop=0
 game.shake=0
 game.spawn_enemy("boss0",Vector2(624,480),true)
 var e=game.enemies[0]
 e.bell_phase=phase
 e.state="chase"
 e.timer=100
 var dir:Vector2=[Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][look]
 game.place_player(Vector2(e.x,e.y)+dir*300,Vector2.UP)
 e.motion=Fight.Motion.initialize(Vector2(e.x,e.y),1,look)
 game.hp=12
 game.invincible=0
 Fight.begin_attack(game,e,"charge")
 return e
func launch(e: Dictionary):
 e.state_time=Fight.windup(e)-0.001
 game.update_enemies(0.002)
func run():
 game=load("res://main.tscn").instantiate()
 game.save_path="user://test-boss-charge-run.json"
 game.profile_path="user://test-boss-charge-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 var e=fresh()
 check(Charge.enabled(e) and e.has("bell_charge_plant"),"Fresh charge opts into dedicated preparation and gait")
 var root_pos=Vector2(e.x,e.y)
 e.state_time=Fight.windup(e)*0.5
 game.update_enemies(0.001)
 check(Vector2(e.x,e.y)==root_pos and e.motion.feet[0].x<e.x-6,"Preparation plants a rear foot without sliding the root")
 e.state_time=Fight.windup(e)
 var a=Fight.pose(e,game.elapsed)
 launch(e)
 var b=Fight.pose(e,game.elapsed)
 check(e.state=="strike" and a.body.distance_to(b.body)<0.05 and a.hand.distance_to(b.hand)<0.05,"Push-off connects continuously to release")
 var dir=Vector2(e.dx,e.dy)
 var d=Charge.distance(e,0,0.06)
 var m=Charge.distance(e,0.3,0.36)
 var end=Charge.distance(e,0.66,0.72)
 check(d<m and end<m and d>0 and end>0,"Travel accelerates, cruises, then brakes instead of snapping to full speed")
 for phase in [1,2]:
  var distances: Array=[]
  for fps in [60,120]:
   e=fresh(1,phase)
   launch(e)
   var start=e.x
   var brake_steps=0
   for _i in range(fps):
    var previous_steps=int(e.bell_charge_steps)
    game.update_enemies(1.0/fps)
    if e.state=="strike" and e.state_time>Charge.DURATION-Charge.BRAKE:brake_steps+=int(e.bell_charge_steps)-previous_steps
    if e.state=="recover":break
   distances.append(e.x-start)
   check(e.state=="recover" and not e.bell_charge_wall,"Open charge reaches a normal braking recovery")
   check(absf(e.x-start-(340 if phase==2 else 295)*0.72)<0.01,"New speed curve preserves the warned charge distance")
   check(e.bell_charge_steps>=3 and e.bell_charge_steps<=11,"Dust and sound follow a finite number of actual foot plants")
   check(brake_steps>=2,"Open charge ends with two actual braking footfalls")
   check(e.bell_charge_braked,"Braking cue is consumed exactly once")
   a=Fight.pose(e,game.elapsed)
   var probe=e.duplicate(true)
   probe.state="strike"
   probe.state_time=Charge.DURATION
   b=Fight.pose(probe,game.elapsed)
   check(a.body.distance_to(b.body)<0.05,"Braking connects continuously to recovery")
   e.state_time=0.4
   game.update_enemies(0.001)
   check(Charge.visual_feet(e).all(func(v):return v.length()<0.01),"Recovery settles both feet before the following axe windup")
  check(absf(distances[0]-distances[1])<0.01,"Total travel is stable at 60 and 120 Hz")
 # Each facing stops at thin cover, recoils once and leaves a punish window.
 for look in range(4):
  e=fresh(look)
  dir=Vector2(e.dx,e.dy)
  var center=Vector2(e.x,e.y)
  var wall_point=center+dir*105
  var wall=Rect2(wall_point-Vector2(1,65),Vector2(2,130)) if look in [1,3] else Rect2(wall_point-Vector2(65,1),Vector2(130,2))
  game.blocks=[wall]
  game.place_player(wall_point+dir*12,Vector2.UP)
  game.invincible=0
  launch(e)
  for _i in range(60):
   game.update_enemies(1.0/60)
   if e.state=="recover":break
  check(e.state=="recover" and e.bell_charge_wall,"Charge stops at the first stone contact in each direction")
  check(not game.blocked(Vector2(e.x,e.y)+dir*Charge.FRONT,28) and center.distance_to(Vector2(e.x,e.y))<80,"Refined stop leaves the entire collider outside thin cover")
  check(game.hp==12,"Charge cannot hit a player through thin stone")
  check(game.hit_stop>0 and game.melee_contacts.size()==1 and game.melee_contacts[0].material=="stone","Wall contact creates one synchronized stone response")
  a=Fight.pose(e,game.elapsed)
  var contact_pose=e.duplicate(true)
  contact_pose.state="strike"
  contact_pose.state_time=e.bell_charge_contact_time
  b=Fight.pose(contact_pose,game.elapsed)
  check(a.body.distance_to(b.body)<0.01 and a.hand.distance_to(b.hand)<0.01,"Wall recoil starts at the exact impact posture without a pose jump")
  check(Fight.recovery(e)>=1.3 and e.bell_followup_pending,"Wall stun delays the combo without discarding its pending warning")
  var held=e.state_time
  game.advance_frame(0.03)
  check(e.state_time==held,"Wall hit-stop freezes recoil and feet together")
  game.save_run()
  game.load_run()
  e=game.enemies[0]
  game.hit_stop=0
  game.melee_contacts.clear()
  game.particles.clear()
  game.update_enemies(0.01)
  check(e.bell_charge_wall and e.has("bell_charge_stop_feet") and game.melee_contacts.is_empty(),"Reloaded wall recoil preserves foot plants without replaying impact")
  e.state_time=Fight.recovery(e)+0.01
  game.update_enemies(0.001)
  check(e.state=="windup" and e.bell_attack=="cleave" and not Charge.enabled(e) and Fight.windup(e)>=0.7,"Wall recovery ends in a separate fully warned axe swing")
 # Pending acceleration, step phase and brake cue persist in an active charge.
 e=fresh()
 launch(e)
 for _i in range(17):game.update_enemies(1.0/120)
 var x=e.x
 var t=e.state_time
 var foot=e.motion.feet[0].duplicate(true)
 var steps=e.bell_charge_steps
 game.save_run()
 game.load_run()
 e=game.enemies[0]
 check(is_equal_approx(e.x,x) and is_equal_approx(e.state_time,t) and e.bell_charge_steps==steps and is_equal_approx(e.motion.feet[0].x,foot.x) and is_equal_approx(e.motion.feet[0].y,foot.y) and is_equal_approx(e.motion.feet[0].lift,foot.lift) and e.motion.feet[0].stance==foot.stance,"Saved active charge retains velocity progress, gait and consumed steps")
 game.update_enemies(1.0/120)
 check(absf(e.x-x-Charge.distance(e,t,t+1.0/120))<0.001,"Resumed charge advances by the next exact speed-profile interval")
 # Old pending charges are deliberately not retrofitted in mid-flight.
 e=fresh()
 e.erase("bell_charge_rig")
 e.state="strike"
 e.state_time=0.224
 var old_x=e.x
 game.update_enemies(0.01)
 check(not Charge.enabled(e) and absf(e.x-old_x-3.4)<0.001,"Legacy saved charge retains constant velocity and original pending attack")
 # The same complete mesh keeps its grip and foot bounds throughout the new action.
 for look in range(4):
  e=fresh(look)
  for state in ["windup","strike","recover"]:
   e.state=state
   for u in [0.0,0.25,0.5,0.75,1.0]:
    e.state_time=u*(Fight.windup(e) if state=="windup" else (Charge.DURATION if state=="strike" else Fight.recovery(e)))
    var pose=Fight.pose(e,game.elapsed)
    var offset=View.BodySkin.parameters(e,pose,look).feet
    check(pose.get("charge_rig",false) and offset.all(func(v):return absf(v.x)<=16 and v.y>=-14 and v.y<=9),"New charge skin uses bounded shared foot deformation")
 game.delete_run()
 if FileAccess.file_exists(game.profile_path):DirAccess.remove_absolute(game.profile_path)
 print("BOSS CHARGE CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
