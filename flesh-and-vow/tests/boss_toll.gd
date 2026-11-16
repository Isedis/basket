extends SceneTree
const Fight = preload("res://scripts/boss_fight.gd")
const Toll = preload("res://scripts/boss_toll.gd")
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
func fresh(phase: int=2,look: int=0) -> Dictionary:
 game.new_run(715)
 game.blocks.clear()
 game.room_props.clear()
 game.hazards.clear()
 game.enemies.clear()
 game.particles.clear()
 game.zones.clear()
 game.hit_stop=0
 game.shake=0
 game.spawn_enemy("boss0",Vector2(624,480),true)
 var e=game.enemies[0]
 e.bell_phase=phase
 e.state="chase"
 e.timer=100
 var dir:Vector2=[Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][look]
 e.motion=Fight.Motion.initialize(Vector2(e.x,e.y),1,look)
 game.place_player(Vector2(e.x,e.y)+dir*200,Vector2.UP)
 game.invincible=0
 game.hp=12
 Fight.begin_attack(game,e,"toll")
 return e
func release(e: Dictionary):
 e.state_time=Fight.windup(e)-0.001
 game.update_enemies(0.002)
func run():
 game=load("res://main.tscn").instantiate()
 game.save_path="user://test-boss-toll-run.json"
 game.profile_path="user://test-boss-toll-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 for phase in [1,2]:
  var e=fresh(phase)
  var initial=Vector2(e.x,e.y)
  var gap=e.bell_gap
  e.state_time=Fight.windup(e)*0.85
  game.update_enemies(0.001)
  check(Vector2(e.x,e.y)==initial and game.hp==12 and game.zones.is_empty(),"Toll preparation plants without moving or dealing hidden damage")
  check(e.motion.feet[0].stance and e.motion.feet[1].stance and e.motion.feet[1].x-e.motion.feet[0].x>=27,"Preparation sets both feet in a wide stable stance")
  check(Fight.pose(e,game.elapsed).body.y>e.y+4,"Whole body compresses before the bell release")
  e.state_time=Fight.windup(e)
  var before=Fight.pose(e,game.elapsed)
  release(e)
  var after=Fight.pose(e,game.elapsed)
  check(before.body.distance_to(after.body)<0.01 and before.hand.distance_to(after.hand)<0.01,"Loaded posture connects continuously to wave release")
  check(game.zones.size()==phase and e.bell_toll_pulses==0 and game.hit_stop==0,"Wave creation waits for the shared simulation release event")
  game.update_zones(0.01)
  check(e.bell_toll_pulses==1 and game.zones[0].pulse_spent and game.hit_stop>0,"First visible wave triggers one body, sound and camera pulse")
  check(absf(e.bell_toll_clock-game.zones[0].age)<0.0001,"Visual clock follows the age of the actual wave")
  var held=e.bell_toll_clock
  var held_wave=game.zones[0].age
  var held_time=e.state_time
  game.advance_frame(0.02)
  check(e.bell_toll_clock==held and game.zones[0].age==held_wave and e.state_time==held_time,"Hit-stop freezes posture and waves together")
  var particles=game.particles.size()
  game.update_zones(0.01)
  check(e.bell_toll_pulses==1 and game.particles.size()==particles,"First pulse cannot repeat on following frames")
  if phase==2:
   check(not game.zones[1].pulse_spent and game.zones[1].age<0,"Second wave retains a separate pending pulse")
   game.save_run()
   game.load_run()
   e=game.enemies[0]
   check(e.bell_toll_pulses==1 and not game.zones[1].pulse_spent and game.zones[0].pulse_spent,"Save/load preserves consumed first pulse and pending second pulse")
   game.particles.clear()
   game.hit_stop=0
   game.update_zones(0.01)
   check(e.bell_toll_pulses==1 and game.particles.is_empty(),"Reload cannot replay the first sound or recoil")
   # Move the caster: the pending wave is linked by saved token, not its origin.
   e.x+=16
   Fight.Motion.shift(e.motion,Vector2(16,0))
   while game.zones[1].age < -0.02:game.update_zones(0.01)
   check(e.bell_toll_pulses==1,"Second body pulse never precedes its visible wave")
   game.update_zones(0.025)
   check(e.bell_toll_pulses==2 and game.zones[1].pulse_spent and game.hit_stop>0,"Pending wave emits a second independent synchronized pulse")
   check(absf(e.bell_toll_clock-(game.zones[1].age+Toll.SECOND))<0.0001,"Second reaction remains synchronized after caster movement")
   game.save_run()
   game.load_run()
   e=game.enemies[0]
   game.particles.clear()
   game.update_zones(0.01)
   check(e.bell_toll_pulses==2 and game.particles.is_empty(),"Reload after both pulses cannot replay either impulse")
  check(is_equal_approx(e.bell_gap,gap) and game.zones.all(func(z):return is_equal_approx(z.gap,gap)),"Both safe wedges remain committed to the original warning")
  e.bell_toll_clock=Toll.last_pulse(e)+0.14
  e.bell_toll_pulses=phase
  var moving=Fight.pose(e,game.elapsed)
  check(absf(moving.toll_rock)>0.001 and absf(moving.toll_chain)>0.1,"Released bell and chains have a damped vibration on the same skin")
  e.bell_toll_clock=Toll.last_pulse(e)+0.9
  e.state="recover"
  e.state_time=0.9
  game.update_enemies(0.001)
  var settled=Fight.pose(e,game.elapsed)
  check(absf(settled.body.y-e.y)<0.01 and absf(settled.toll_rock)<0.001,"Body returns to rest after resonance")
  check(e.motion.feet[1].x-e.motion.feet[0].x<12.01,"Feet settle before the next attack")
 # Legacy delayed waves never acquire new pulse metadata on update.
 var e=fresh()
 e.erase("bell_toll_rig")
 release(e)
 check(not game.zones[0].has("toll_token"),"Legacy pending toll retains its original release behavior")
 game.hit_stop=0
 game.particles.clear()
 game.update_zones(0.7)
 check(game.hit_stop==0 and game.particles.is_empty(),"Legacy pending second wave cannot invent a new replayed event")
 # Destruction cancels a pending pulse along with its harmful wave.
 e=fresh()
 release(e)
 game.update_zones(0.01)
 e.state="recover"
 game.damage_enemy(e,999,game.player,false)
 check(game.enemies.is_empty() and game.zones.is_empty(),"Death cancels pending bell events with their waves")
 # Frame-rate and real input-clock simulation keep exactly two events.
 for fps in [60,120]:
  e=fresh()
  release(e)
  for _i in range(fps*2):game.advance_frame(1.0/fps)
  check(e.bell_toll_pulses==2,"Real game clock emits exactly two pulses at both frame rates")
 # Saved attack identity isolates old waves from the next windup.
 e=fresh()
 release(e)
 var pending=game.zones[1]
 var old_token=e.bell_toll_token
 Fight.begin_attack(game,e,"toll")
 pending.age=0.01
 Toll.sync(game,pending)
 check(e.bell_toll_token!=old_token and e.bell_toll_pulses==0,"Previous wave cannot trigger a new attack's recoil")
 for look in range(4):
  e=fresh(2,look)
  for t in [0.0,0.06,0.14,0.36,0.58,0.6,0.66,0.74,1.2]:
   e.state="recover"
   e.state_time=maxf(0,t-0.35)
   e.bell_toll_clock=t
   e.bell_toll_pulses=1 if t<Toll.SECOND else 2
   var pose=Fight.pose(e,game.elapsed)
   var side=Fight.Motion.hand_sign(look)
   var wrist=60.0 if look in [1,3] else 72.0
   check(View.BodySkin.point(Vector2(side*wrist,-86),e,pose,look).distance_to(pose.hand)<0.01,"Shared mesh keeps the fist on the axe throughout both toll impulses")
 game.delete_run()
 if FileAccess.file_exists(game.profile_path):DirAccess.remove_absolute(game.profile_path)
 print("BOSS TOLL CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
