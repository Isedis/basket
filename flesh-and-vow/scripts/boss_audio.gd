extends RefCounted
## Original hall ambience and a restrained musical foundation, owned by the scene.
static func approach(g) -> bool:
 if g.floor_index!=0 or g.room.is_empty():return false
 for i in range(g.room_ports.size()):
  var dest=g.door_destination(i)
  if dest.get("type","")=="boss" and not dest.get("clear",false) and g.player.distance_to(g.door_position(i))<200:return true
 return false
static func loop(g,kind: String,wanted: bool,target: float,dt: float):
 var player
 for child in g.get_children():
  if child is AudioStreamPlayer and child.get_meta("bell_loop","")==kind:player=child;break
 if player==null:
  if not wanted:return
  player=AudioStreamPlayer.new()
  player.set_meta("castle_boss_sfx",true)
  player.set_meta("bell_loop",kind)
  var stream=load("res://assets/boss_"+kind+".wav").duplicate()
  stream.loop_mode=AudioStreamWAV.LOOP_FORWARD
  stream.loop_begin=0
  stream.loop_end=int(stream.mix_rate*stream.get_length())
  player.stream=stream
  player.volume_db=-60
  g.add_child(player)
  player.play()
 player.volume_db=move_toward(player.volume_db,target if wanted else -60,dt*35)
 if not wanted and player.volume_db<=-59.9:
  player.stop()
  player.stream=null
  player.queue_free()
static func update(g,dt: float):
 if DisplayServer.get_name()=="headless":return
 var paused=g.mode=="paused" or g.help_open
 for child in g.get_children():
  if child is AudioStreamPlayer and child.has_meta("castle_boss_sfx"):child.stream_paused=paused
 if g.mode not in ["playing","paused"]:
  for child in g.get_children():
   if child is AudioStreamPlayer and child.has_meta("castle_boss_sfx"):
    child.stop()
    child.stream=null
    child.queue_free()
  return
 if paused:return
 var boss: Dictionary={}
 for e in g.enemies:
  if e.type=="boss0" and e.hp>0:boss=e;break
 var nearby=approach(g)
 var hall=not boss.is_empty() or nearby
 var battle=not boss.is_empty() and (boss.state!="intro" or boss.get("bell_intro_music",false))
 loop(g,"hall",hall,-31 if battle else (-26 if not boss.is_empty() else -33),dt)
 loop(g,"theme",battle,-23,dt)
 var scrape=float(g.get_meta("bell_approach_draw",-1))
 if nearby and boss.is_empty() and scrape>=0:
  scrape-=dt
  if scrape<=0:
   g.BossFight.sound(g,"draw",0.75,-34)
   scrape=-1
 elif not nearby or not boss.is_empty():scrape=-1
 var cooldown=maxf(0,float(g.get_meta("bell_approach_cd",0))-dt)
 if nearby and boss.is_empty() and cooldown<=0:
  g.BossFight.sound(g,"bell",0.68,-28)
  cooldown=8
  scrape=0.7
 g.set_meta("bell_approach_draw",scrape)
 g.set_meta("bell_approach_cd",cooldown)
