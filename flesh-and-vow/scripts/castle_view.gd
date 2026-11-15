extends RefCounted
## Architecture shares the actors' native 2x world pixel grid.
const ATLAS = preload("res://assets/castle_tiles.png")
const CELL = 32
const FLOOR_RECT = Rect2(48,168,672,264)
const FLOOR_SIZE = Vector2i(336,132)
const TINTS = [Color.WHITE,Color("a5c2c7"),Color("adc098"),Color("cabda3")]
const PROP_SIZES = [Vector2i(32,24),Vector2i(18,12),Vector2i(18,16),Vector2i(16,16),Vector2i(16,20),Vector2i(10,14),Vector2i(16,24),Vector2i(20,20)]
static var stone_textures: Dictionary = {}

static func source(column: int, row: int) -> Rect2:
	var size = Vector2(CELL,CELL)
	if row==2 and column in [4,5]: size = Vector2(24,32)
	if row==3: size = PROP_SIZES[column]
	return Rect2(Vector2(column*CELL,row*CELL),size)

static func floor_choices(seed_value: int) -> PackedInt32Array:
	var local = RandomNumberGenerator.new()
	local.seed = seed_value
	var result = PackedInt32Array()
	for _i in range(11*5):
		var roll = local.randi_range(0,19)
		result.append(roll%3 if roll<18 else 3+(roll-18)*3)
	return result

static func bake_floor(seed_value: int, floor_index: int) -> Texture2D:
	var image = Image.create(FLOOR_SIZE.x,FLOOR_SIZE.y,false,Image.FORMAT_RGBA8)
	var choices = floor_choices(seed_value)
	var atlas = ATLAS.get_image()
	for y in range(5):
		for x in range(11):
			var extent = Vector2i(mini(CELL,FLOOR_SIZE.x-x*CELL),mini(CELL,FLOOR_SIZE.y-y*CELL))
			if extent.x<=0 or extent.y<=0: continue
			image.blit_rect(atlas,Rect2i(choices[y*11+x]*CELL,0,extent.x,extent.y),Vector2i(x*CELL,y*CELL))
	# Lighting and floor hue are part of the cached ground, never a veil on actors.
	var tint: Color = TINTS[clampi(floor_index,0,3)]
	for y in range(FLOOR_SIZE.y):
		for x in range(FLOOR_SIZE.x):
			var c = image.get_pixel(x,y)*tint
			var edge = minf(minf(x,FLOOR_SIZE.x-1-x),minf(y,FLOOR_SIZE.y-1-y))
			var shade = lerpf(0.35,0.72,clampf(edge/20.0,0,1))
			image.set_pixel(x,y,Color(c.r*shade,c.g*shade,c.b*shade,1))
	return ImageTexture.create_from_image(image)

static func tile(g, column: int, row: int, box: Rect2, tint: Color = Color.WHITE):
	g.draw_texture_rect_region(ATLAS,box,source(column,row),tint)

static func wall_column(seed_value: int, column: int) -> int:
	if column in [0,5,10]: return 6
	if column==3: return 4 if seed_value%2 else 1
	if column==8: return 1 if seed_value%2 else 4
	return [0,1,0,3,4,5][posmod(seed_value/11+column*7,6)]

static func background(g):
	var tint: Color = TINTS[g.floor_index]
	g.draw_rect(Rect2(32,84,704,364),Color("080e10"))
	if g.room_texture: g.draw_texture_rect(g.room_texture,FLOOR_RECT,false)
	# A tall north wall, narrow side walls and a low south parapet define depth.
	for col in range(11):
		var x = 32+col*64
		tile(g,wall_column(int(g.room.seed),col),1,Rect2(x,104,64,64),tint)
		g.draw_texture_rect_region(ATLAS,Rect2(x,84,64,20),Rect2(0,32,32,10),tint*Color("8b969b"))
	for y in range(168,432,64):
		var height = mini(64,432-y)
		g.draw_texture_rect_region(ATLAS,Rect2(32,y,16,height),Rect2(0,32,8,height/2.0),tint*Color("8b969b"))
		g.draw_texture_rect_region(ATLAS,Rect2(720,y,16,height),Rect2(24,32,8,height/2.0),tint*Color("8b969b"))
	for col in range(11):
		g.draw_texture_rect_region(ATLAS,Rect2(32+col*64,432,64,16),Rect2(0,32,32,8),tint)
	# Flat floor dressing cannot hide actors or imply extra solid obstacles.
	var variant = posmod(int(g.room.seed),3)
	if variant==0: tile(g,3,3,Rect2(112,342,32,32),Color("637574"))
	if variant==1: tile(g,7,3,Rect2(616,354,40,40),Color("637574"))
	for col in [1,9]:
		var column = 2 if col==1 else 1
		tile(g,column,3,Rect2(Vector2(40+col*64,152),Vector2(PROP_SIZES[column])*2),Color("9a9b89"))
	# Contact shadows at the foot of the wall, built on the same hard pixel grid.
	for band in range(4):
		g.draw_rect(Rect2(48,168+band*2,672,2),Color(0,0,0,0.22-band*0.045))

static func door_state(room_clear: bool, destination: Dictionary) -> String:
	if destination.is_empty() or not destination.get("revealed",true): return "wall"
	if not room_clear: return "barred"
	return "locked" if not destination.get("opened",true) else "open"

static func doorway(g, index: int, state: String):
	var tint: Color = TINTS[g.floor_index]
	var column = {"open":0,"barred":1,"locked":2,"wall":3}[state]
	if index==0:
		tile(g,column,2,Rect2(352,112,64,64),tint)
		if state!="wall":
			g.draw_rect(Rect2(362,176,44,8),Color("1b272a"))
			g.draw_line(Vector2(362,184),Vector2(406,184),Color("454f4e"),2)
	elif index==2:
		if state=="wall":
			g.draw_texture_rect_region(ATLAS,Rect2(352,424,64,24),Rect2(0,32,32,12),tint)
		else:
			# Low jambs leave the player readable while approaching the south exit.
			g.draw_rect(Rect2(360,424,48,24),Color("080e10"))
			g.draw_texture_rect_region(ATLAS,Rect2(352,420,64,28),Rect2((7 if state=="barred" else 6)*32,82,32,14),tint)
			if state=="locked": lock(g,Vector2(384,431))
	else:
		var x = 32 if index==3 else 688
		if state=="wall":
			g.draw_texture_rect_region(ATLAS,Rect2(x if index==3 else 720,236,16,64),Rect2(0,32,8,32),tint)
		else:
			tile(g,4 if index==3 else 5,2,Rect2(x,236,48,64),tint)
			if state=="barred":
				var bar_x = 50 if index==3 else 716
				for y in range(246,294,10):
					g.draw_rect(Rect2(bar_x-6,y,12,4),Color("59605a"))
				g.draw_rect(Rect2(bar_x-2,242,4,54),Color("344044"))
			elif state=="locked": lock(g,Vector2(54 if index==3 else 714,268))

static func lock(g, p: Vector2):
	g.draw_rect(Rect2(p-Vector2(4,6),Vector2(8,6)),Color("727361"))
	g.draw_rect(Rect2(p-Vector2(2,4),Vector2(4,4)),Color("080e10"))
	g.draw_rect(Rect2(p-Vector2(6,0),Vector2(12,10)),Color("ad8c55"))
	g.draw_rect(Rect2(p+Vector2(-1,2),Vector2(2,4)),Color("38252a"))

static func secret_crack(g, index: int, visible: bool):
	var p: Vector2 = g.door_position(index)
	var line = PackedVector2Array([Vector2(-6,-12),Vector2(2,-4),Vector2(-2,2),Vector2(5,10)])
	if index==0: p = Vector2(384,148)
	if index==2: p = Vector2(384,434)
	for i in range(line.size()-1):
		var a = line[i]
		var b = line[i+1]
		if index%2==1:
			a = Vector2(a.y,a.x)
			b = Vector2(b.y,b.x)
		g.draw_line(p+a,p+b,Color("b0a88c") if visible else Color("59605a"),2)

static func stone(g, box: Rect2):
	g.draw_rect(Rect2(box.position+Vector2(-2,4),box.size+Vector2(4,4)),Color(0,0,0,0.5))
	# Preserve edge pixels on obstacles of different sizes; no fractional scaling.
	var size = Vector2i((box.size/2).round())
	if not stone_textures.has(size):
		var image = Image.create(size.x,size.y,false,Image.FORMAT_RGBA8)
		var atlas = ATLAS.get_image()
		for y in range(size.y):
			for x in range(size.x):
				var sx = x if x<4 else (32-(size.x-x) if x>=size.x-4 else 4+(x-4)%24)
				var sy = y if y<4 else (24-(size.y-y) if y>=size.y-4 else 4+(y-4)%16)
				image.set_pixel(x,y,atlas.get_pixel(sx,96+sy))
		stone_textures[size] = ImageTexture.create_from_image(image)
	g.draw_texture_rect(stone_textures[size],Rect2(box.position.snapped(Vector2(2,2)),Vector2(size)*2),false)

static func lights(g):
	for p in [Vector2(272,148),Vector2(496,148)]:
		var phase = int(g.anim*8+p.x)%4
		for ring in range(3):
			var radius = 24+ring*16
			var a = 0.024+(2-ring)*0.008+(0.004 if phase==1 else 0)
			var points = PackedVector2Array()
			for v in [Vector2(-1,-0.5),Vector2(-0.5,-1),Vector2(0.5,-1),Vector2(1,-0.5),Vector2(1,0.5),Vector2(0.5,1),Vector2(-0.5,1),Vector2(-1,0.5)]:
				points.append((p+v*radius).snapped(Vector2(2,2)))
			g.draw_colored_polygon(points,Color(0.9,0.39,0.1,a))
		tile(g,5,3,Rect2(p-Vector2(10,10),Vector2(20,28)))
		var tip = p+Vector2([-2,0,2,0][phase],[-16,-20,-18,-14][phase])
		var shape = PackedVector2Array()
		for v in [Vector2(0,0),Vector2(4,6),Vector2(4,10),Vector2(6,12),Vector2(4,18),Vector2(-4,18),Vector2(-6,12),Vector2(-2,6)]: shape.append(tip+v)
		g.draw_colored_polygon(shape,Color("b7632f"))
		g.draw_rect(Rect2(tip+Vector2(-2,6),Vector2(4,10)),Color("e8b45f"))
		g.draw_rect(Rect2(tip+Vector2(0,10),Vector2(2,6)),Color("f7db9f"))
