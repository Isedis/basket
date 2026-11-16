extends SceneTree
const Fight = preload("res://scripts/boss_fight.gd")
const View = preload("res://scripts/boss_view.gd")
const Combat = preload("res://scripts/combat.gd")
var checks = 0
var failures = 0
var game
func check(ok: bool, label: String):
 checks += 1
 if not ok:
  failures += 1
  push_error(label)
func _initialize(): call_deferred("run")
func ready_boss() -> Dictionary:
 game.enemies.clear()
 game.zones.clear()
 game.blocks.clear()
 game.hazards.clear()
 game.spawn_enemy("boss0",Vector2(624,440),true)
 var e = game.enemies.back()
 e.state = "chase"
 e.timer = 0.0
 return e
func run():
 game = load("res://main.tscn").instantiate()
 game.save_path = "user://test-boss-run.json"
 game.profile_path = "user://test-boss-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 game.new_run(711)
 game.coins = 23
 game.inventory = ["echo"]
 game.save_run()
 var normal = FileAccess.get_file_as_string(game.save_path)
 game.menu_action("boss_probe")
 check(game.art_probe_active and game.boss_practice and game.room.type=="boss" and game.enemies.size()==1,"Boss trial starts in actual isolated castle arena")
 check(game.enemies[0].type=="boss0" and game.enemies[0].state=="intro","New boss begins with its introduction")
 check(FileAccess.get_file_as_string(game.original_save_path)==normal,"Practice cannot replace regular run")
 var e = game.enemies[0]
 var camera = game.desired_camera()
 check(e.y-164-camera.y>=84 and game.player.y+12-camera.y<=448,"Encounter camera keeps helmet and player inside the arena viewport")
 var far = game.player
 game.place_player(Vector2(e.x,e.y)+Vector2(0,280),Vector2.UP)
 game.update_enemies(0.5)
 check(e.state=="intro" and e.state_time==0,"Boss introduction waits until the entering player can see it")
 game.place_player(far,Vector2.UP)
 var initial = e.hp
 game.damage_enemy(e,10,game.player,true)
 check(e.hp==initial,"Introduction cannot be skipped with damage")
 for look in range(4):
  var view = View.BodySkin.view_index(look)
  var image = View.BodySkin.ATLAS.get_image().get_region(Rect2i(view*128,0,128,96))
  var valid = image.get_size()==Vector2i(128,96) and image.get_used_rect().has_area()
  for y in range(image.get_height()):
   for x in range(image.get_width()):valid = valid and image.get_pixel(x,y).a in [0.0,1.0]
  check(valid,"Native complete body skin and hard alpha in each facing")
  check(View.textures(look)[6]==View.textures(1)[6],"One unchanged axe across all facings")
 game.place_player(Vector2(624,590),Vector2.UP)
 e = ready_boss()
 for attack in ["cleave","toll","charge","cleave"]:
  e.timer = 0.0
  game.update_enemies(0.01)
  check(e.state=="windup" and e.bell_attack==attack,"Attack cycle remains deterministic and readable")
  var locked = Vector2(e.dx,e.dy)
  var gap = e.bell_gap
  game.place_player(game.player+Vector2(40,0),Vector2.UP)
  game.update_enemies(0.01)
  check(Vector2(e.dx,e.dy)==locked and e.bell_gap==gap,"Committed attacks never track the player after warning")
  var delay = Fight.windup(e)
  e.state_time = delay-0.02
  game.update_enemies(0.01)
  check(e.state=="windup","Warning stays harmless until exact release")
  e.state_time = delay-0.005
  game.update_enemies(0.01)
  check(e.state=="strike","Windup releases once at shared timing")
  e.state = "recover"
  e.state_time = Fight.RECOVERY[attack]+0.01
  game.update_enemies(0.01)
  check(e.state=="chase","Each attack leaves a punishable recovery")
 # One phase change; invulnerability protects its finite transformation only.
 e.hp = e.max*0.49
 game.update_enemies(0.01)
 check(e.bell_phase==2 and e.state=="fracture","Half-health fracture starts exactly once")
 var phase_hp = e.hp
 game.damage_enemy(e,10,game.player,true)
 check(e.hp==phase_hp,"Transformation preserves its readable duration")
 e.state_time = Fight.FRACTURE+0.01
 game.update_enemies(0.01)
 check(e.state=="chase","Second phase returns control to combat")
 e.timer = 100.0
 game.update_enemies(0.01)
 check(e.state=="chase","Fracture cannot repeatedly retrigger")
 # Two delayed waves; safe wedge and moving annulus share geometry with rendering.
 game.zones.clear()
 e.bell_attack = "toll"
 e.state = "windup"
 e.state_time = Fight.windup(e)
 game.update_enemies(0.01)
 check(game.zones.size()==2 and game.zones[1].age==-0.6,"Phase two toll emits exactly two separated waves")
 var z = game.zones[0]
 z.age = 0.5
 var radius = Fight.ring_radius(z)
 check(not Fight.ring_hits(z,Vector2(z.x,z.y)+Vector2.from_angle(z.gap)*radius,radius-3),"Visible gap is safe")
 check(Fight.ring_hits(z,Vector2(z.x,z.y)+Vector2.from_angle(z.gap+PI)*radius,radius-3),"Visible wave band can hit")
 check(not Fight.ring_hits(z,Vector2(z.x,z.y)+Vector2.from_angle(z.gap+PI)*(radius+50),radius-3),"Wave cannot damage ahead of its visible band")
 game.place_player(Vector2(z.x,z.y)+Vector2.from_angle(z.gap+PI)*(radius+2),Vector2.UP)
 game.invincible = 0
 var hp = game.hp
 game.update_zones(0.01)
 check(game.hp==hp-2,"Actual moving wave deals its specified damage")
 game.invincible = 0
 game.update_zones(0.01)
 check(game.hp==hp-2,"Each wave can damage only once")
 # Shared native blade collision, including a miss and cover.
 e = ready_boss()
 e.bell_attack = "cleave"
 e.state = "strike"
 e.dx = 0.0
 e.dy = 1.0
 e.motion.look = 0
 e.state_time = Fight.STRIKE.cleave*0.35
 var polygon = Fight.blade(e,game.elapsed)
 var center = Vector2.ZERO
 for point in polygon: center += point/4
 game.place_player(center+Vector2(0,30),Vector2.UP)
 game.invincible = 0
 hp = game.hp
 game.update_enemies(0.005)
 check(game.hp<hp,"Drawn axe blade actually contacts player capsule")
 game.invincible = 0
 hp = game.hp
 game.update_enemies(0.005)
 check(game.hp==hp,"Cleave cannot hit twice")
 e = ready_boss()
 e.bell_attack = "charge"
 e.state = "strike"
 e.dx = 1.0
 e.dy = 0.0
 e.timer = 100
 game.blocks = [Rect2(680,350,30,180)]
 game.place_player(Vector2(745,440),Vector2.LEFT)
 hp = game.hp
 game.invincible = 0
 for _i in range(60): game.update_enemies(1.0/60)
 check(e.x<680 and game.hp==hp,"Charge stops at stone without damaging through cover")
 # Persistence preserves pending timing, safe gap, consumed hits, and phase.
 e.bell_phase = 2
 e.bell_attack = "toll"
 e.state = "windup"
 e.state_time = 0.37
 e.bell_gap = 1.2
 var pending_wave = {"kind":"boss_ring","x":e.x,"y":e.y,"age":-0.3,"timer":2.4,"radius":12.0,"damage":2.0,"gap":1.2,"spent":true}
 game.zones = [pending_wave]
 game.save_run()
 game.load_run()
 check(game.zones.size()==1 and is_equal_approx(game.zones[0].age,-0.3) and game.zones[0].spent and is_equal_approx(game.zones[0].gap,1.2),"Saved wave retains its delay, safe wedge and consumed hit")
 e = game.enemies[0]
 check(e.bell_phase==2 and e.bell_attack=="toll" and is_equal_approx(e.state_time,0.37) and is_equal_approx(e.bell_gap,1.2),"Save/load preserves committed phase, attack and safe wedge")
 e.state = "recover"
 game.damage_enemy(e,999,game.player,true)
 check(game.enemies.is_empty() and game.zones.filter(func(v):return v.kind=="boss_ring").is_empty(),"Death cancels outstanding boss waves")
 check(game.corpses.back().bell_snapshot.bell_phase==2,"Corpse retains exact boss phase and anatomy")
 game.clear_room()
 check(game.room.clear and "boss1" in game.profile.unlocks and game.drops.any(func(d):return d.type=="item"),"Boss victory still opens exit and grants unlock/reward")
 game.start_boss_round(true)
 check(game.enemies.size()==1 and game.enemies[0].state=="intro" and game.has_item("heavy"),"Retry reconstructs boss encounter and chosen weapon")
 game.leave_art_probe()
 check(FileAccess.get_file_as_string(game.save_path)==normal,"Boss trial and rewards leave real progression untouched")
 game.delete_run()
 if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
 var old = {"state":"strike","state_time":0.2,"timer":0.0,"hp":32,"max":65}
 Fight.ensure(old)
 check(old.hp==32 and old.max==65 and old.state=="chase","Old saved boss retains health and safely re-prepares")
 print("BOSS CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
