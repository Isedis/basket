extends SceneTree
const Rig = preload("res://scripts/rig_view.gd")
const Style = preload("res://scripts/character_style.gd")
const Combat = preload("res://scripts/combat.gd")
const Motion = preload("res://scripts/locomotion.gd")
var checks = 0
var failures = 0
func check(ok: bool, label: String):
	checks += 1
	if not ok:
		failures += 1
		push_error(label)
func feature_count(image: Image, bright: bool) -> int:
	var result = 0
	for y in range(image.get_height()):
		for x in range(image.get_width()):
			var color = image.get_pixel(x,y)
			if color.a>0 and (color.get_luminance()>0.55 if bright else color.get_luminance()<0.13): result += 1
	return result
func has_visor(image: Image) -> bool:
	# A continuous dark strip inside the helmet, rather than its outer outline.
	for y in range(3,image.get_height()-3):
		var run = 0
		for x in range(2,image.get_width()-2):
			var color = image.get_pixel(x,y)
			run = run+1 if color.a>0 and color.get_luminance()<0.25 else 0
			if run>=5: return true
	return false
func _initialize(): call_deferred("run")
func run():
	Rig.load_parts()
	check(Rig.ATLAS.get_size()==Vector2(256,288),"Runtime uses a native-size atlas instead of the large illustration masters")
	for actor in range(3):
		var type: String = Style.TYPES[actor]
		var side = Rig.textures_for(type,1)
		for look in range(4):
			var textures = Rig.textures_for(type,look)
			var valid = true
			var opaque = true
			var palette_ok = true
			var palette: Array = []
			for value in Style.COLORS[actor]: palette.append(Color(value))
			for part in range(8):
				var image = textures[part].get_image()
				valid = valid and image.get_size()==Style.SIZES[actor][part] and image.get_used_rect().has_area()
				for y in range(image.get_height()):
					for x in range(image.get_width()):
						var color = image.get_pixel(x,y)
						opaque = opaque and (color.a==0 or color.a==1)
						if color.a>0: palette_ok = palette_ok and palette.has(color)
			check(valid,"All directional parts retain the character's fixed dimensions: "+type)
			check(opaque and palette_ok,"Hard alpha edges and limited material palette: "+type)
			check(textures[6]==side[6],"Turning cannot change the held weapon's shape or grip")
		var front = Rig.textures_for(type,0)[0].get_image()
		var back = Rig.textures_for(type,2)[0].get_image()
		check(front.get_data()!=back.get_data(),"Front and back have distinct artwork: "+type)
	check(Style.SIZES[1][1].x>Style.SIZES[0][1].x*1.4,"Warden armor is substantially wider than the prisoner's torso")
	check(Style.SIZES[0][0].x>Style.SIZES[0][1].x,"Prisoner keeps the grotesque large-head silhouette")
	check(Style.SIZES[2][0].x<Style.SIZES[0][0].x and Style.SIZES[2][1].x<Style.SIZES[0][1].x,"Assassin has a smaller hood and narrower torso")
	check(feature_count(Rig.textures_for("player",0)[0].get_image(),true)>=8,"Prisoner's light blindfold stays readable at native resolution")
	check(feature_count(Rig.textures_for("assassin",0)[0].get_image(),true)>=3,"Assassin retains a pale face marker against dark cloth")
	check(has_visor(Rig.textures_for("guard",0)[0].get_image()),"Closed helmet retains its dark visor")
	var capsule = Combat.hurt_capsule(Vector2.ZERO,"assassin")
	var drawn_top = -53+6-Style.SIZES[2][0].y
	check(absf((capsule.b.y-capsule.radius)-drawn_top)<2,"Crouched assassin has no invisible tall head hitbox")
	var game = load("res://main.tscn").instantiate()
	game.save_path = "user://test-characters-run.json"
	game.profile_path = "user://test-characters-profile.json"
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game.menu_action("art_probe")
	check(game.enemies.map(func(e): return e.type).has("guard") and game.enemies.map(func(e): return e.type).has("assassin"),"Practice room contains both new enemy silhouettes")
	var enemy = game.enemies.filter(func(e): return e.type=="assassin")[0]
	var p = Vector2(enemy.x,enemy.y)
	enemy.motion = Motion.initialize(p,-1,3)
	game.damage_enemy(enemy,999,game.player,true)
	check(game.corpses.back().type=="assassin" and game.corpses.back().motion.look==3,"Assassin corpse preserves identity and last facing")
	game.save_run()
	game.load_run()
	check(game.corpses.back().type=="assassin", "Assassin's new corpse survives save/load")
	game.leave_art_probe()
	game.delete_run()
	if FileAccess.file_exists(game.profile_path): DirAccess.remove_absolute(game.profile_path)
	print("CHARACTER CHECKS: %d | FAILURES: %d"%[checks,failures])
	quit(1 if failures else 0)
