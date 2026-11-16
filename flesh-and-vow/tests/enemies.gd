extends SceneTree
const Pose = preload("res://scripts/enemy_pose.gd")
const Rig = preload("res://scripts/rig_view.gd")
const Style = preload("res://scripts/character_style.gd")
const Motion = preload("res://scripts/locomotion.gd")
var checks = 0
var failures = 0
func check(ok: bool, label: String):
 checks += 1
 if not ok:
  failures += 1
  push_error(label)
func _initialize(): call_deferred("run")
func run():
 check(Rig.ENEMY_ATLAS.get_size()==Vector2(256,320),"New atlas retains native resolution")
 for type in Pose.TYPES:
  var actor = Style.index(type)
  for look in range(4):
   var textures = Rig.textures_for(type,look)
   var valid = true
   var palette_ok = true
   var palette: Array = []
   for value in Style.COLORS[actor]: palette.append(Color(value))
   for part in range(8):
    var image = textures[part].get_image()
    valid = valid and image.get_size()==Style.SIZES[actor][part] and image.get_used_rect().has_area()
    for y in range(image.get_height()):
     for x in range(image.get_width()):
      var pixel = image.get_pixel(x,y)
      palette_ok = palette_ok and (pixel.a==0 or (pixel.a==1 and palette.has(pixel)))
   check(valid and palette_ok,"Fixed native parts, hard alpha and palette: "+type)
   check(textures[6]==Rig.textures_for(type,1)[6],"Held object cannot morph when turning")
   var dir: Vector2 = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT][look]
   var motion = Motion.initialize(Vector2.ZERO,1,look)
   var end = Pose.pose(type,Vector2.ZERO,motion,dir,2,1,1)
   var start = Pose.pose(type,Vector2.ZERO,motion,dir,3,0,1)
   check(end.hand.distance_to(start.hand)<0.001 and end.head.distance_to(start.head)<0.001,"Release begins at exact windup pose")
   var settled = Pose.pose(type,Vector2.ZERO,motion,dir,3,1,1)
   var idle = Pose.pose(type,Vector2.ZERO,motion,dir,0,0,1)
   check(settled.hand.distance_to(idle.hand)<0.001,"Recovery rejoins idle without a snap")
   for action in [2,3]:
    for frame in range(61):
     var pose = Pose.pose(type,Vector2.ZERO,motion,dir,action,frame/60.0,1)
     check(pose.hand.distance_to(pose.shoulder)<=22.001,"Arm reach stays anatomical")
     check(pose.elbow.distance_to(pose.shoulder)<=10.01 and pose.elbow.distance_to(pose.hand)<=12.01,"Joint segment lengths stay fixed")
  var capsule = Pose.Combat.hurt_capsule(Vector2.ZERO,type)
  check(absf(capsule.b.y-capsule.radius+66)<2,"Head collider matches native enemy height")
 var game = load("res://main.tscn").instantiate()
 game.save_path = "user://test-enemies-run.json"
 game.profile_path = "user://test-enemies-profile.json"
 root.add_child(game)
 await process_frame
 game.set_process(false)
 game.menu_action("art_probe")
 var roster = game.enemies.map(func(e): return e.type)
 check(roster.size()==5 and Pose.TYPES.all(func(type): return roster.has(type)),"Practice exposes all five enemies")
 game.blocks.clear()
 game.hazards.clear()
 game.enemies.clear()
 for type in Pose.TYPES:
  game.bullets.clear()
  game.zones.clear()
  game.blood.clear()
  var p = Vector2(500,400)
  game.place_player(Vector2(750,400),Vector2.LEFT)
  game.spawn_enemy(type,p,false)
  var enemy = game.enemies.back()
  enemy.motion = Motion.initialize(p,1,1)
  enemy.state = "windup"
  enemy.state_time = 0.52
  enemy.dx = 1.0
  enemy.dy = 0.0
  game.update_enemies(0.01)
  check(enemy.state=="strike","Original release timing retained")
  if type=="shadow":
   check(game.bullets.is_empty() and game.zones.size()==1 and game.zones[0].radius==44,"Shadow retains its close area attack")
  else:
   check(game.bullets.size()==(1 if type=="skeleton" else 3),"Original volley size retained")
   for bullet in game.bullets:
    check(bullet.visual==("bone" if type=="skeleton" else "curse") and is_equal_approx(Vector2(bullet.vx,bullet.vy).length(),145) and bullet.damage==1.5 and bullet.life==4,"Native projectile retains original physics")
    var launch = Pose.pose(type,p,enemy.motion,Vector2.RIGHT,3,0,game.elapsed).hand-p
    check(launch.distance_to(Vector2(bullet.lx,bullet.ly))<0.001,"Projectile visual starts at casting hand")
  enemy.state = "windup"
  enemy.state_time = 0.26
  game.damage_enemy(enemy,999,game.player,true)
  var corpse = game.corpses.back()
  check(corpse.type==type and corpse.motion.death_action==2 and is_equal_approx(corpse.motion.death_progress,0.5),"Lethal hit preserves original cast pose before stagger")
  if type=="skeleton": check(game.blood.all(func(b): return b.bone),"Skeleton emits bone fragments instead of red blood")
  if type=="shadow": check(game.blood.all(func(b): return b.kind=="ash" and not b.bone),"Shadow leaves cold ash instead of red blood")
 game.save_run()
 var before = JSON.parse_string(JSON.stringify(game.corpses))
 var projectiles = JSON.parse_string(JSON.stringify(game.bullets))
 game.load_run()
 check(game.corpses==before and game.bullets==projectiles,"New corpse snapshots and projectile metadata survive save/load")
 game.fire_bullet(Vector2(500,400),Vector2.RIGHT*145,1.5,"enemy",4)
 var legacy = game.bullets.back()
 for key in ["age","visual","lx","ly"]: legacy.erase(key)
 game.update_bullets(0.01)
 check(game.bullets.has(legacy) and legacy.age>0,"Old saves without projectile artwork metadata remain compatible")
 game.leave_art_probe()
 game.delete_run()
 if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
 print("ENEMY CHECKS: %d | FAILURES: %d"%[checks,failures])
 quit(1 if failures else 0)
