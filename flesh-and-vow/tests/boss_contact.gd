extends SceneTree
const Fight = preload("res://scripts/boss_fight.gd")
const Combat = preload("res://scripts/combat.gd")
var checks=0
var failures=0
var game
func check(ok: bool,label: String):
 checks+=1
 if not ok:
  failures+=1
  push_error(label)
func _initialize():call_deferred("run")
func reset(look: int = 0) -> Dictionary:
 game.new_run(715)
 game.blocks.clear()
 game.room_props.clear()
 game.hazards.clear()
 game.enemies.clear()
 game.blood.clear()
 game.melee_contacts.clear()
 game.particles.clear()
 game.hit_stop=0
 game.shake=0
 game.hp=12
 game.invincible=0
 game.spawn_enemy("boss0",Vector2(624,480),true)
 var e=game.enemies[0]
 e.state="strike"
 e.bell_attack="cleave"
 e.state_time=0.0
 e.strike_hit=false
 var dir:Vector2=[Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][look]
 e.dx=dir.x
 e.dy=dir.y
 e.motion=Fight.Motion.initialize(Vector2(e.x,e.y),1,look)
 e.timer=100
 game.place_player(Vector2(1000,700),Vector2.LEFT)
 return e
func center_at(e: Dictionary,u: float) -> Vector2:
 var probe=e.duplicate(true)
 probe.state_time=u*Fight.STRIKE.cleave
 var center=Vector2.ZERO
 for point in Fight.blade(probe,game.elapsed):center+=point/4
 return center
func advance_to_contact(e: Dictionary,fps: int = 120):
 for _i in range(fps):
  game.update_enemies(1.0/fps)
  if e.strike_hit or e.state!="strike":return
func run():
 game=load("res://main.tscn").instantiate()
 game.save_path="user://test-boss-contact-run.json"
 game.profile_path="user://test-boss-contact-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 var e=reset()
 for _i in range(40):game.update_enemies(1.0/60)
 check(game.hp==12 and game.hit_stop==0 and game.shake==0 and game.melee_contacts.is_empty(),"A missed cleave produces no phantom impact, shake or damage")
 for look in range(4):
  e=reset(look)
  game.place_player(center_at(e,0.35)+Vector2(0,30),Vector2.UP)
  advance_to_contact(e)
  check(game.hp==9 and e.get("bell_hit_kind","")=="flesh","Actual blade contact triggers flesh response in every direction")
  check(game.hit_stop>=0.05 and game.player_knockback.length()>170 and game.player_stagger>=0.13,"Heavy contact aligns hit-stop, impulse and stagger")
  check(e.strike_hit and game.melee_contacts.size()==1 and game.melee_contacts[0].material=="flesh","Flesh response is consumed once")
  check(Combat.polygon_capsule(Fight.blade(e,game.elapsed),Combat.hurt_capsule(game.player,"player")).hit,"Frozen axe pose matches actual player contact")
  var clock=game.elapsed
  var progress=e.state_time
  var age=e.bell_hit_age
  game.advance_frame(0.02)
  check(game.elapsed==clock and e.state_time==progress and e.bell_hit_age==age,"Hit-stop freezes contact pose and simulation timers together")
  game.invincible=0
  game.update_enemies(0.01)
  check(game.hp==9 and game.melee_contacts.size()==1,"One cleave cannot damage twice after invulnerability resets")
  game.save_run()
  game.load_run()
  var loaded=game.enemies[0]
  check(loaded.strike_hit and loaded.bell_hit_kind=="flesh" and is_equal_approx(loaded.bell_hit_u,e.bell_hit_u),"Saved flesh contact preserves consumed hit and recoil metadata")
 # Invulnerability does not trigger a fake damaging impact.
 e=reset()
 game.place_player(center_at(e,0.35)+Vector2(0,30),Vector2.UP)
 game.invincible=10
 advance_to_contact(e)
 check(game.hp==12 and game.hit_stop==0 and game.melee_contacts.is_empty(),"Invulnerable player is not given a false flesh impact")
 # A real blocking polygon, reached by the blade head, stops the sweep.
 for look in range(4):
  e=reset(look)
  var point=center_at(e,0.34)
  game.blocks=[Rect2(point-Vector2(10,12),Vector2(20,24))]
  advance_to_contact(e)
  check(e.state=="recover" and e.get("bell_hit_kind","")=="stone" and game.hp==12,"Axe stops on stone at real blade contact")
  check(game.hit_stop>=0.065 and Fight.recovery(e)>Fight.RECOVERY.cleave,"Stone has distinct stop and a punishable recovery")
  var contact_pose=e.duplicate(true)
  contact_pose.state="strike"
  contact_pose.state_time=e.bell_hit_u*Fight.STRIKE.cleave
  contact_pose.bell_hit_kind=""
  var frozen=Fight.pose(e,game.elapsed)
  var exact=Fight.pose(contact_pose,game.elapsed)
  check(frozen.hand.distance_to(exact.hand)<0.01 and absf(angle_difference(frozen.angle,exact.angle))<0.001,"Stone recoil begins at exact impact pose without jumping")
  check(game.melee_contacts.size()==1 and game.melee_contacts[0].material=="stone" and game.blood.all(func(b):return b.kind=="stone"),"Stone emits sparks/chips instead of blood")
  var hit_point=Vector2(e.bell_hit_x,e.bell_hit_y)
  check(game.blocks[0].grow(0.01).has_point(hit_point),"Clang origin lies on the collided stone")
  game.save_run()
  game.load_run()
  e=game.enemies[0]
  check(e.bell_hit_kind=="stone" and e.state=="recover" and e.strike_hit,"Save/load preserves a blocked cleave and cannot replay its damage")
  var u=e.bell_hit_u
  for _i in range(160):
   e.timer=100
   game.update_enemies(1.0/120)
  check(e.state=="chase" and e.bell_hit_u==u and game.hp==12,"Blocked axe completes recovery without a second hit")
 # Tall existing prop profiles use the same dimensions as their visible stone artwork.
 e=reset()
 game.blocks=[Rect2(700,480,44,22)]
 game.room_props=[{"x":722.0,"y":491.0,"kind":0,"solid":true}]
 var surfaces=Fight.Contact.surfaces(game)
 check(surfaces[0].position.y<410 and surfaces[0].end.y>490,"Column collision covers the visible shaft above its ground footprint")
 # Contact time does not depend on display/simulation frequency.
 var times: Array=[]
 for fps in [60,120]:
  e=reset()
  game.place_player(center_at(e,0.35)+Vector2(0,30),Vector2.UP)
  advance_to_contact(e,fps)
  times.append(e.bell_hit_u)
 check(absf(times[0]-times[1])<0.001,"Refined contact timing is stable at 60 and 120 Hz")
 game.delete_run()
 if FileAccess.file_exists(game.profile_path):DirAccess.remove_absolute(game.profile_path)
 print("BOSS CONTACT CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
