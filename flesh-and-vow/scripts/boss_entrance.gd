extends RefCounted
const Combat=preload("res://scripts/combat.gd")
const Motion=preload("res://scripts/locomotion.gd")
const Audio=preload("res://scripts/boss_audio.gd")
const FULL=5.6
const REPEAT=1.2
static func enabled(e: Dictionary) -> bool:return e.get("bell_entrance",false) and e.state=="intro"
static func active(g) -> Dictionary:
 for e in g.enemies:
  if enabled(e) and e.get("bell_intro_started",false):return e
 return {}
static func prepare(g,e: Dictionary):
 e.bell_entrance=true
 e.bell_intro_full=not (g.practice_intro_seen if g.art_probe_active else g.profile.get("bell_intro_seen",false))
 e.bell_intro_duration=FULL if e.bell_intro_full else REPEAT
 e.bell_intro_started=false
 e.bell_intro_arrived=false
 e.bell_intro_events=[]
 e.bell_intro_music=false
 e.motion.look=2
static func arrive(g):
 for e in g.enemies:
  if not enabled(e) or e.get("bell_intro_arrived",false):continue
  e.bell_intro_arrived=true
  for door in g.door_visuals:
   if door.target!="barred":continue
   door.open=1.0
   door.kind="barred"
   door.target="barred"
  g.BossFight.sound(g,"gate",1.0,-16)
static func start(g,e: Dictionary):
 e.bell_intro_started=true
 e.state_time=0.0
 var to=g.player-Vector2(e.x,e.y)
 var dir=to.normalized() if to.length()>0.01 else Vector2.DOWN
 e.dx=dir.x
 e.dy=dir.y
 e.bell_intro_target=Motion.direction_index(dir)
 e.motion.look=(int(e.bell_intro_target)+2)%4 if e.bell_intro_full else int(e.bell_intro_target)
 g.moving=false
 g.windup=0
 g.swing=0
 g.attack_buffer_time=0
 g.attack_contact_pending=false
 g.dash_time=0
 g.player_knockback=Vector2.ZERO
 g.player_stagger=0
 g.bullets.clear()
 g.zones.clear()
 g.message_time=0
static func finish(g,e: Dictionary):
 e.motion.look=int(e.get("bell_intro_target",0))
 e.state="chase"
 e.state_time=0.0
 e.timer=0.65
 e.bell_intro_music=true
 g.invincible=maxf(g.invincible,0.4)
 if g.art_probe_active:g.practice_intro_seen=true
 else:
  g.profile.bell_intro_seen=true
  g.save_profile()
 g.save_run()
static func skip(g) -> bool:
 var e=active(g)
 if e.is_empty():return false
 finish(g,e)
 return true
static func update(g,e: Dictionary):
 if not e.get("bell_intro_started",false):
  e.state_time=0.0
  if g.player.distance_to(Vector2(e.x,e.y))<=230:start(g,e)
  return
 var t=float(e.state_time)
 if e.bell_intro_full:
  var target=int(e.bell_intro_target)
  e.motion.look=(target+2)%4 if t<0.9 else ((target+3)%4 if t<1.35 else target)
  if t>=2.05 and "draw" not in e.bell_intro_events:
   e.bell_intro_events.append("draw")
   g.BossFight.sound(g,"draw",1.0,-17)
  if t>=2.85 and "lift" not in e.bell_intro_events:
   e.bell_intro_events.append("lift")
   g.BossFight.sound(g,"stone",0.65,-23)
   g.shake=maxf(g.shake,1.8)
   g.shake_axis=Vector2.DOWN
   g.hit_stop=maxf(g.hit_stop,0.035)
   for i in range(8):g.emit_particle(Vector2(e.x+(i-3.5)*3,e.y+3),Color("81785f"),Vector2((i-3.5)*10,-12),0.2+(i%3)*0.03,2)
 if t>=(3.15 if e.bell_intro_full else 0.25):e.bell_intro_music=true
 if t>=float(e.bell_intro_duration):finish(g,e)
static func pose(base: Dictionary,e: Dictionary) -> Dictionary:
 var t=float(e.state_time) if e.get("bell_intro_started",false) else 0.0
 var full=bool(e.get("bell_intro_full",true))
 var load=clampf(Combat.curve((t-1.4)/0.65)-Combat.curve((t-2.7)/0.6),0,1) if full else 0.0
 var plant=1-Combat.curve((t-2.75)/0.7) if full else 1-Combat.curve(t/0.55)
 var lift=Combat.curve((t-2.1)/0.65)*12*plant if full else 0.0
 var shift=Vector2(0,load*7)-Vector2(e.dx,e.dy)*load*2
 for key in ["body","hips","head","shoulder","elbow","hand"]:base[key]+=shift
 base.head+=Vector2(0,3*(1-Combat.curve((t-1.1)/0.5) if full else 1-Combat.curve(t/0.5)))
 base.hand=base.hand.lerp(Vector2(e.x,e.y)+Vector2(0,-58-lift),plant)
 var side=Motion.hand_sign(Motion.look_index(e.motion,Vector2(e.dx,e.dy)))
 base.elbow=base.shoulder+Combat.arm_elbow(Vector2.ZERO,(base.hand-base.shoulder)/2,side)*2
 base.angle=lerp_angle(base.angle,PI/2,plant)
 base.intro_spread=3*plant
 return base
static func centre(g,p: Vector2,value: String,size: int,color: Color):
 var width=g.bold.get_string_size(value,HORIZONTAL_ALIGNMENT_LEFT,-1,size).x
 g.draw_string(g.bold,p-Vector2(width/2,0),value,HORIZONTAL_ALIGNMENT_LEFT,-1,size,color)
static func frame_weight(e: Dictionary) -> float:
 if e.is_empty():return 0.0
 var t=float(e.state_time)
 var duration=float(e.bell_intro_duration)
 return minf(Combat.curve(t/0.3),1-Combat.curve((t-duration+0.35)/0.35))
static func overlay(g):
 var e=active(g)
 if e.is_empty():return
 var t=float(e.state_time)
 var duration=float(e.bell_intro_duration)
 var fade=frame_weight(e)
 var ink=Color(0.025,0.026,0.033,fade)
 var shift=round(96*fade/2)*2
 for box in [Rect2(0,0,960,84),Rect2(0,448,960,92),Rect2(736+shift,84,224-shift,364),Rect2(0,84,32+shift,364)]:g.draw_rect(box,ink)
 centre(g,Vector2(384+shift,50),"ЗАЛ ПОСЛЕДНЕГО ПРИГОВОРА",12,Color(0.68,0.6,0.46,fade))
 var reveal=3.15 if e.bell_intro_full else 0.25
 var alpha=fade*Combat.curve((t-reveal)/0.3)*(1-Combat.curve((t-duration+0.65)/0.4)) if e.bell_intro_full else fade*Combat.curve(t/0.18)*(1-Combat.curve((t-duration+0.3)/0.3))
 centre(g,Vector2(384+shift,481),"КОЛОКОЛЬНЫЙ ПАЛАЧ",23,Color(0.83,0.74,0.59,alpha))
 centre(g,Vector2(384+shift,507),"СЛУГА МЁРТВОГО КОРОЛЯ",10,Color(0.61,0.58,0.52,alpha))
 centre(g,Vector2(842,516),"ENTER — ПРОПУСТИТЬ",9,Color(0.5,0.48,0.44,fade*0.8))
