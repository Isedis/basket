extends SceneTree
const Fight = preload("res://scripts/boss_fight.gd")
const View = preload("res://scripts/boss_view.gd")
var checks=0
var failures=0
var game
class Canvas extends RefCounted:
 var lines: Array=[]
 func draw_line(a,b,color,width):lines.append([a,b,color,width])
func check(ok: bool,label: String):
 checks+=1
 if not ok:
  failures+=1
  push_error(label)
func _initialize():call_deferred("run")
func fresh() -> Dictionary:
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
 e.state="chase"
 e.timer=100.0
 game.place_player(Vector2(800,500),Vector2.LEFT)
 game.hp=12
 game.invincible=0
 return e
func run():
 game=load("res://main.tscn").instantiate()
 game.save_path="user://test-boss-phase-run.json"
 game.profile_path="user://test-boss-phase-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 var e=fresh()
 Fight.begin_attack(game,e,"charge")
 check(not e.bell_followup_pending and Fight.recovery(e)==Fight.RECOVERY.charge,"Phase-one charge keeps its single attack and original recovery")
 e=fresh()
 e.hp=65.0
 e.state="strike"
 e.bell_attack="cleave"
 e.strike_hit=true
 e.state_time=0.3
 game.update_enemies(0.01)
 check(e.bell_phase==1 and e.state=="strike","Threshold never interrupts an already committed blade")
 e.state="recover"
 game.update_enemies(0.01)
 check(e.bell_phase==2 and e.state=="fracture" and not e.bell_fracture_hit,"Fracture enters once and arms one pulse")
 check(game.shake==0 and game.hit_stop==0 and game.particles.is_empty(),"Fracture prepares before the visible and audible pulse")
 e.state_time=Fight.FRACTURE_PULSE-0.02
 game.update_enemies(0.01)
 check(not e.bell_fracture_hit,"Pulse cannot release early")
 game.save_run()
 game.load_run()
 e=game.enemies[0]
 check(not e.bell_fracture_hit and e.state=="fracture","Save before pulse keeps it pending")
 game.update_enemies(0.02)
 check(e.bell_fracture_hit and game.hit_stop>0 and game.shake>0 and game.particles.size()==18,"One fracture pulse synchronizes stop, shake and fragments")
 var held=e.state_time
 game.advance_frame(0.02)
 check(is_equal_approx(e.state_time,held),"Pulse freezes the entire transformation through the game clock")
 var hp=e.hp
 game.damage_enemy(e,9,game.player,true)
 check(e.hp==hp,"Finite fracture protects the prepared transformation")
 game.save_run()
 game.load_run()
 e=game.enemies[0]
 game.particles.clear()
 game.hit_stop=0
 game.shake=0
 game.update_enemies(0.01)
 check(e.bell_fracture_hit and game.particles.is_empty() and game.hit_stop==0,"Reload after pulse never replays it")
 e.state_time=Fight.FRACTURE+0.01
 game.update_enemies(0.01)
 check(e.state=="chase" and e.bell_turn==1,"New phase opens with the double-toll pattern")
 e.timer=0
 game.update_enemies(0.01)
 check(e.bell_attack=="toll" and e.state=="windup","New phase gives the double toll its full warning")
 var gap=e.bell_gap
 game.place_player(Vector2(410,610),Vector2.RIGHT)
 game.update_enemies(0.1)
 check(e.bell_gap==gap,"Toll safe wedge cannot track the player during windup")
 e.state_time=Fight.windup(e)
 game.update_enemies(0.01)
 check(game.zones.size()==2 and game.zones[1].age==-0.6,"Two waves retain their visible separation")
 var canvas=Canvas.new()
 View.ring(canvas,game.zones[1])
 check(not canvas.lines.is_empty(),"Pending second wave is warned before it becomes dangerous")
 game.place_player(Vector2(e.x+30,e.y),Vector2.LEFT)
 game.invincible=0
 hp=game.hp
 var pending=game.zones[1]
 game.zones=[pending]
 game.update_zones(0.1)
 check(game.hp==hp and pending.age<0,"Warning for pending wave does not deal damage")
 # Charge commits once, then explicitly prepares one newly aimed axe swing.
 e=fresh()
 e.bell_phase=2
 Fight.begin_attack(game,e,"charge")
 check(e.bell_followup_pending and Fight.recovery(e)==Fight.CHARGE_LINK,"New phase charge arms one finite follow-up")
 var charge_aim=Vector2(e.dx,e.dy)
 game.place_player(Vector2(430,600),Vector2.RIGHT)
 game.update_enemies(0.1)
 check(Vector2(e.dx,e.dy)==charge_aim,"Charge aim stays locked during preparation")
 e.state="recover"
 e.state_time=0.2
 game.save_run()
 game.load_run()
 e=game.enemies[0]
 check(e.bell_followup_pending and is_equal_approx(e.state_time,0.2),"Save/load preserves a charge with its pending follow-up")
 e.state_time=Fight.CHARGE_LINK-0.03
 game.update_enemies(0.01)
 check(e.state=="recover","Charge brakes before preparing its next attack")
 var expected=(game.player-Vector2(e.x,e.y)).normalized()
 game.update_enemies(0.03)
 check(e.state=="windup" and e.bell_attack=="cleave" and e.bell_combo_step==1 and not e.bell_followup_pending,"Exactly one prepared cleave follows the charge")
 check(Vector2(e.dx,e.dy).distance_to(expected)<0.001,"Follow-up acquires its own aim only when preparation starts")
 check(Fight.windup(e)>=0.7,"Follow-up has a readable standalone warning")
 var aim=Vector2(e.dx,e.dy)
 game.place_player(Vector2(820,660),Vector2.UP)
 game.update_enemies(0.1)
 check(Vector2(e.dx,e.dy)==aim,"Follow-up cannot track a dodging player")
 game.save_run()
 game.load_run()
 e=game.enemies[0]
 check(e.bell_combo_step==1 and Vector2(e.dx,e.dy).distance_to(aim)<0.001 and e.state=="windup","Reload retains follow-up warning and locked aim")
 e.state_time=Fight.FOLLOWUP_WINDUP-0.03
 game.update_enemies(0.01)
 check(e.state=="windup","Follow-up cannot strike before its full warning")
 game.update_enemies(0.03)
 check(e.state=="strike" and not e.strike_hit,"Follow-up releases one unconsumed blade")
 e.state_time=0.35*Fight.STRIKE.cleave
 var center=Vector2.ZERO
 for point in Fight.blade(e,game.elapsed):center+=point/4
 game.place_player(center+Vector2(0,30),Vector2.UP)
 game.invincible=0
 hp=game.hp
 game.update_enemies(0.005)
 check(game.hp==hp-3 and e.strike_hit,"Follow-up uses the actual blade and material hit response")
 game.invincible=0
 game.update_enemies(0.005)
 check(game.hp==hp-3,"Follow-up cannot hit twice")
 game.save_run()
 game.load_run()
 e=game.enemies[0]
 game.invincible=0
 game.update_enemies(0.005)
 check(game.hp==hp-3 and e.strike_hit,"Saved consumed follow-up cannot replay its damage")
 e.state="recover"
 e.state_time=Fight.RECOVERY.cleave+0.02
 game.update_enemies(0.01)
 check(e.state=="recover" and Fight.recovery(e)>Fight.RECOVERY.cleave,"Full combo ends with an extended punishable recovery")
 e.state_time=Fight.recovery(e)+0.01
 game.update_enemies(0.01)
 check(e.state=="chase" and e.timer>0,"Combo ends without an unbounded attack chain")
 e.bell_attack="cleave"
 e.bell_combo_step=1
 e.bell_hit_kind="stone"
 check(Fight.recovery(e)>1.4,"Blocked follow-up keeps the longer stone recoil window")
 # Published saves with no new fields finish their original charge normally.
 e=fresh()
 e.bell_phase=2
 e.bell_attack="charge"
 e.state="recover"
 e.state_time=Fight.RECOVERY.charge+0.01
 e.erase("bell_followup_pending")
 e.erase("bell_combo_step")
 game.update_enemies(0.01)
 check(e.state=="chase","Legacy phase-two charge does not invent a pending follow-up")
 e.state="fracture"
 e.state_time=0.8
 e.erase("bell_fracture_hit")
 game.particles.clear()
 game.update_enemies(0.01)
 check(game.particles.is_empty(),"Legacy transformation cannot replay an unknown pulse")
 # Attached seams use the same full skin mapping in every view.
 for look in range(4):
  e.motion=Fight.Motion.initialize(Vector2(e.x,e.y),1,look)
  e.dx=[0.0,1.0,0.0,-1.0][look]
  e.dy=[1.0,0.0,-1.0,0.0][look]
  for state in ["fracture","windup","strike","recover"]:
   e.state=state
   e.state_time=0.5
   var pose=Fight.pose(e,game.elapsed)
   var paths=View.fracture_paths(e,pose,look)
   var first=View.BodySkin.point(Vector2(0,-146),e,pose,look).snapped(Vector2(2,2))
   check(paths.size()==2 and paths[0][0].distance_to(first)<0.01,"Glowing seam follows the same helmet vertices through every pose")
 for view in range(3):
  var image=View.BodySkin.ATLAS.get_image()
  var opaque=true
  for seam in [[Vector2(64,17),Vector2(67,21),Vector2(65,25),Vector2(69,30),Vector2(66,33)],[Vector2(65,25),Vector2(62,29)]]:
   for i in range(seam.size()-1):
    for sample in range(17):
     var pixel=seam[i].lerp(seam[i+1],sample/16.0).round()
     opaque=opaque and image.get_pixel(view*128+int(pixel.x),int(pixel.y)).a==1.0
  check(opaque,"Glowing seams stay on opaque helmet artwork in every native view")
 e.bell_phase=1
 check(View.fracture_glow(e,0)==0,"Phase-one helmet does not glow")
 e.bell_phase=2
 e.state="fracture"
 e.state_time=0
 check(View.fracture_glow(e,0)==0,"Glowing seam is revealed by transformation timing")
 e.state_time=Fight.FRACTURE_PULSE
 check(View.fracture_glow(e,0)>0.5,"Seam is visible at the exact fracture pulse")
 game.delete_run()
 if FileAccess.file_exists(game.profile_path):DirAccess.remove_absolute(game.profile_path)
 print("BOSS PHASE CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
