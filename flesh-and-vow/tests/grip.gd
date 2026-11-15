extends SceneTree
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
var checks = 0
var failures = 0
func check(ok: bool, label: String):
	checks += 1
	if not ok:
		failures += 1
		push_error(label)
func _initialize():
	var p = Vector2(384,320)
	var dirs = [Vector2.DOWN,Vector2.RIGHT,Vector2.UP,Vector2.LEFT]
	for view in range(4):
		var motion = Motion.initialize(p,1,view)
		var idle = Combat.weapon_pose(p,motion,dirs[view],0,0)
		check(idle.hand.y>idle.shoulder.y+16,"Relaxed hand rests below shoulder")
		for action in [2,3]:
			var bones_hold = true
			var continuous = true
			var clears_shoulder = true
			var previous = Combat.weapon_pose(p,motion,dirs[view],action,0)
			for sample in range(101):
				var pose = Combat.weapon_pose(p,motion,dirs[view],action,sample/100.0)
				bones_hold = bones_hold and absf(pose.shoulder.distance_to(pose.elbow)-13)<0.001 and absf(pose.elbow.distance_to(pose.hand)-13)<0.001
				continuous = continuous and pose.elbow.distance_to(previous.elbow)<5 and pose.hand.distance_to(previous.hand)<5
				clears_shoulder = clears_shoulder and pose.hand.distance_to(pose.shoulder)>17
				previous = pose
			check(bones_hold,"Upper arm and forearm retain length throughout animation")
			check(continuous,"No snapping elbow or wrist during swing")
			check(clears_shoulder,"Raising hand follows an arc outside the shoulder")
		var raised = Combat.weapon_pose(p,motion,dirs[view],2,1)
		var start = Combat.weapon_pose(p,motion,dirs[view],3,0)
		check(raised.hand.distance_to(start.hand)<0.001 and raised.elbow.distance_to(start.elbow)<0.001,"Windup joins strike without a pose jump")
		var finished = Combat.weapon_pose(p,motion,dirs[view],3,1)
		check(finished.hand.distance_to(idle.hand)<0.001,"Recovery returns to the relaxed grip")
		var contact = Combat.weapon_pose(p,motion,dirs[view],3,Combat.CONTACT_RATIO)
		var long_contact = Combat.weapon_pose(p,motion,dirs[view],3,Combat.CONTACT_RATIO,Combat.BASE_REACH+40)
		check(contact.hand==long_contact.hand and contact.elbow==long_contact.elbow,"Length items do not enlarge the grip or stretch the arm")
		var normal_blade = Combat.blade_polygon(contact)
		var long_blade = Combat.blade_polygon(long_contact)
		check(normal_blade[0].distance_to(long_blade[0])<0.001 and absf(normal_blade[1].distance_to(long_blade[1])-40)<0.001,"Only blade length changes, preserving the neck and full added reach")
	print("GRIP CHECKS: %d | FAILURES: %d"%[checks,failures])
	quit(1 if failures else 0)
