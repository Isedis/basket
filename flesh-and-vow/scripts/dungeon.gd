extends RefCounted

const DIRS = [Vector2i.UP, Vector2i.RIGHT, Vector2i.DOWN, Vector2i.LEFT]

static func key(p: Vector2i) -> String:
	return "%d,%d" % [p.x, p.y]

static func generate(rng: RandomNumberGenerator, floor_index: int) -> Dictionary:
	var rooms: Dictionary = {}
	var pos := Vector2i.ZERO
	rooms[key(pos)] = make_room(pos, "start", rng)
	# A connected backbone with a guaranteed boss at its far end.
	var spine: Array[Vector2i] = [pos]
	for i in range(7):
		var candidates: Array[Vector2i] = []
		for d in DIRS:
			if not rooms.has(key(pos + d)):
				candidates.append(pos + d)
		if candidates.is_empty():
			break
		pos = candidates[rng.randi_range(0, candidates.size()-1)]
		spine.append(pos)
		rooms[key(pos)] = make_room(pos, "combat", rng)
	rooms[key(pos)].type = "boss"
	var types := ["treasure", "shop", "torture", "oracle", "reliquary", "secret"]
	for type in types:
		var added := false
		for attempt in range(100):
			var base: Vector2i = spine[rng.randi_range(0, maxi(0, spine.size()-2))]
			var spot: Vector2i = base + DIRS[rng.randi_range(0,3)]
			if not rooms.has(key(spot)):
				rooms[key(spot)] = make_room(spot, type, rng)
				added = true
				break
		if not added:
			# Search all boundary cells, so every floor always has every special room.
			for existing in rooms.keys():
				var p := Vector2i(int(rooms[existing].x), int(rooms[existing].y))
				for d in DIRS:
					if not rooms.has(key(p+d)):
						rooms[key(p+d)] = make_room(p+d, type, rng)
						added = true
						break
				if added:
					break
	if floor_index==0: merge_combat_pairs(rooms,rng)
	var result = {"rooms":rooms,"floor":floor_index}
	rebuild_cells(result)
	return result

static func make_room(p: Vector2i, type: String, rng: RandomNumberGenerator) -> Dictionary:
	return {"x":p.x, "y":p.y, "type":type, "seed":rng.randi(), "visited":false,
		"span_x":1,"span_y":1,"clear":false, "opened":type != "treasure", "used":false, "revealed":type != "secret",
		"cracks":0, "enemies":[], "drops":[], "blood":[], "layout":rng.randi_range(0,5), "spawned":false}

static func span(room: Dictionary) -> Vector2i:
	var size = Vector2i(int(room.get("span_x",1)),int(room.get("span_y",1)))
	return size if size in [Vector2i.ONE,Vector2i(2,1),Vector2i(1,2)] else Vector2i.ONE

static func rebuild_cells(dungeon: Dictionary):
	var cells: Dictionary = {}
	for anchor in dungeon.rooms:
		var room: Dictionary = dungeon.rooms[anchor]
		var size = span(room)
		for y in range(size.y):
			for x in range(size.x): cells[key(Vector2i(int(room.x)+x,int(room.y)+y))] = anchor
	dungeon.cells = cells

static func owner(dungeon: Dictionary, cell: Vector2i) -> String:
	var address = key(cell)
	if dungeon.rooms.has(address): return address
	return dungeon.get("cells",{}).get(address,"")

static func ports(dungeon: Dictionary, room: Dictionary) -> Array:
	var origin = Vector2i(int(room.x),int(room.y))
	var size = span(room)
	var edges: Array = []
	# Preserve cardinal slots 0..3 for standard rooms; additional slots are exterior only.
	var slots = [[0,Vector2i.ZERO],[1,Vector2i(size.x-1,0)],[2,Vector2i(0,size.y-1)],[3,Vector2i.ZERO]]
	if size.x==2: slots.append_array([[0,Vector2i(1,0)],[2,Vector2i(1,0)]])
	if size.y==2: slots.append_array([[1,Vector2i(0,1)],[3,Vector2i(0,1)]])
	for slot in slots:
		var from: Vector2i = origin+slot[1]
		var to = from+DIRS[slot[0]]
		edges.append({"dir":slot[0],"from":from,"to":to,"target":owner(dungeon,to)})
	return edges

static func merge_combat_pairs(rooms: Dictionary, rng: RandomNumberGenerator):
	var used_orientations: Array = []
	for _attempt in range(2):
		var pairs: Array = []
		for address in rooms:
			var a: Dictionary = rooms[address]
			if a.type!="combat" or span(a)!=Vector2i.ONE: continue
			var p = Vector2i(int(a.x),int(a.y))
			for d in [Vector2i.RIGHT,Vector2i.DOWN]:
				var other = key(p+d)
				if rooms.has(other) and rooms[other].type=="combat" and span(rooms[other])==Vector2i.ONE:
					pairs.append([address,other,d])
		if pairs.is_empty(): break
		var preferred = pairs.filter(func(pair): return pair[2] not in used_orientations)
		if not preferred.is_empty(): pairs = preferred
		var pair: Array = pairs[rng.randi_range(0,pairs.size()-1)]
		rooms[pair[0]].span_x = 2 if pair[2]==Vector2i.RIGHT else 1
		rooms[pair[0]].span_y = 2 if pair[2]==Vector2i.DOWN else 1
		rooms.erase(pair[1])
		used_orientations.append(pair[2])
