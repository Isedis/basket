extends RefCounted
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
const TYPES = ["skeleton","shadow","mage"]

static func pose(type: String, p: Vector2, motion: Dictionary, direction: Vector2, action: int, progress: float, clock: float) -> Dictionary:
 var result = Combat.weapon_pose(p,motion,direction,4 if action==4 else 0,progress,Combat.BASE_REACH,clock)
 var side = Motion.hand_sign(Motion.look_index(motion,direction))
 var aim = direction.normalized() if direction.length_squared()>0.00001 else Vector2.DOWN
 var sway = sin(float(motion.get("phase",0)))*1.1*float(motion.get("walk_weight",0))
 var rest = Vector2(side*4+sway,21)
 var back = Vector2(side*9,-13) if type=="skeleton" else Vector2(side*5,-11)
 if type=="mage": back = Vector2(side*2,10)
 var forward = aim*20.5
 var offset = rest
 var coil = 0.0
 var drive = 0.0
 if action==2:
  var prepare = Combat.curve(progress/0.65)
  var release = Combat.curve((progress-0.65)/0.35)
  coil = prepare*(1-release)
  drive = release
  offset = Combat.arm_arc(rest,back,prepare) if progress<=0.65 else Combat.arm_arc(back,forward,release)
 elif action==3:
  var settle = Combat.curve(progress)
  drive = 1-settle
  offset = Combat.arm_arc(forward,rest,settle)
 var lean = (-aim*coil+aim*2.4*drive)
 var twist = side*(-0.08*coil+0.08*drive)
 if action in [2,3]:
  result.body += lean
  result.hips += lean*0.45
  result.head += lean-aim*drive*0.8
 result.twist = twist
 result.coil = coil
 result.drive = drive
 var chest = Vector2(0,-31)
 result.shoulder = result.body+chest+(Vector2(side*12,-36)-chest).rotated(twist)
 result.hand = result.shoulder+offset
 result.elbow = Combat.arm_elbow(result.shoulder,result.hand,side)
 result.angle = lerp_angle(0.3 if side>0 else PI-0.3,aim.angle()-side*0.9,coil)
 if action in [2,3]: result.angle = lerp_angle(result.angle,aim.angle(),drive)
 if type=="shadow": result.angle = (result.hand-result.elbow).angle()
 if type=="mage": result.angle = 0.0
 result.cast_charge = clampf(progress,0,1) if action==2 else (maxf(0,1-progress/0.5) if action==3 else 0.0)
 return result

static func free_hand(type: String, shoulder: Vector2, pose: Dictionary, direction: Vector2, rest: Vector2) -> Vector2:
 if type=="mage":
  return shoulder+rest.lerp((pose.hand-shoulder).limit_length(21),maxf(pose.coil,pose.drive)*0.8).limit_length(21.5)
 if type=="shadow":
  var reach = direction.normalized()*19
  return shoulder+rest.lerp(reach,maxf(pose.coil*0.5,pose.drive)).limit_length(21.5)
 return shoulder+rest.limit_length(21.5)
