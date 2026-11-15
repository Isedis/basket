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
	return {"rooms": rooms, "floor":floor_index}

static func make_room(p: Vector2i, type: String, rng: RandomNumberGenerator) -> Dictionary:
	return {"x":p.x, "y":p.y, "type":type, "seed":rng.randi(), "visited":false,
		"clear":false, "opened":type != "treasure", "used":false, "revealed":type != "secret",
		"cracks":0, "enemies":[], "drops":[], "blood":[], "layout":rng.randi_range(0,5), "spawned":false}
