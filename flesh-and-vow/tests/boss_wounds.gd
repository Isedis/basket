extends SceneTree
var g
var checks=0
var failures=0
func check(ok,label):
 checks+=1
 if not ok:
  failures+=1
  push_error(label)
func _initialize():call_deferred("run")
func run():
 g=load("res://main.tscn").instantiate()
 g.save_path="user://test-wounds-run.json"
 g.profile_path="user://test-wounds-profile.json"
 root.add_child(g)
 await process_frame
 g.set_process(false)
 g.new_run(914)
 g.enemies.clear()
 g.particles.clear()
 g.spawn_enemy("boss0",g.CENTRE,true)
 var e=g.enemies[0]
 var p=Vector2(e.x,e.y)-Vector2(0,48)
 for state in ["intro","fracture"]:
  e.state=state
  g.damage_enemy(e,5,g.player,true,1,Vector2.RIGHT,p)
  check(e.hp==165 and g.particles.is_empty(),"Invulnerable state produces no wound")
 e.state="chase"
 g.damage_enemy(e,0,g.player,true,1,Vector2.RIGHT,p)
 check(g.particles.is_empty() and e.hp==165,"Zero damage creates no debris")
 g.damage_enemy(e,5,g.player,true,1.4,Vector2.RIGHT,p)
 var wounds=g.particles.filter(func(x):return x.get("wound",false))
 check(e.hp==160,"Real damage applied once")
 check(wounds.filter(func(x):return x.get("chunk",false)).size()==3,"Direct hit emits three flesh fragments")
 check(wounds.filter(func(x):return x.get("flare",false)).size()==1,"One contact flash")
 for part in wounds:
  if part.get("flare",false):continue
  check(Vector2(part.x,part.y-part.z).distance_to(p)<0.01,"Debris originates at actual contact")
  check(part.vx>0,"Debris follows the attack direction")
 var before=wounds[0].duplicate(true)
 g.mode="paused"
 g._process(0.1)
 check(wounds[0]==before,"Pause freezes ballistic effects")
 g.mode="playing"
 for _i in range(200):g.update_particles(1.0/120)
 check(g.particles.is_empty(),"Flying debris expires")
 check(g.blood.any(func(x):return x.get("kind","")=="flesh"),"Landed fragments leave floor traces")
 g.save_run()
 var marks=g.blood.duplicate(true)
 g.blood.clear()
 check(g.load_run() and JSON.stringify(g.blood)==JSON.stringify(marks),"Floor traces persist through save/load")
 e=g.enemies[0]
 g.particles.clear()
 g.damage_enemy(e,1,g.player,false)
 wounds=g.particles.filter(func(x):return x.get("wound",false))
 check(wounds.size()==3 and not wounds.any(func(x):return x.get("chunk",false)),"Damage over time emits only small drops")
 var state=g.rng.state
 for _i in range(80):g.BossWounds.emit(g,e,p,Vector2.LEFT,2)
 check(g.rng.state==state,"New cosmetic randomness does not affect loot")
 check(g.particles.size()<=400,"Rapid hits cap active debris")
 for _i in range(200):g.update_particles(1.0/120)
 check(g.blood.size()<=160,"Landed blood cap")
 g.BossFight.stop_sounds(g)
 g.delete_run()
 if FileAccess.file_exists(g.profile_path):DirAccess.remove_absolute(g.profile_path)
 await create_timer(0.25).timeout
 print("BOSS WOUNDS CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
