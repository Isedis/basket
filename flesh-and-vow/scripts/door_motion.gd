extends RefCounted
const Dungeon = preload("res://scripts/dungeon.gd")
const RISE_TIME = 0.52
const WOOD_TIME = 0.42

static func desired(g, index: int) -> String:
 var dest: Dictionary = g.door_destination(index)
 if dest.is_empty() or not dest.get("revealed",true): return "wall"
 if not g.room.clear: return "barred"
 return "open" if dest.get("opened",true) else "locked"

static func reset(g):
 g.door_visuals.clear()
 for i in range(g.room_ports.size()):
  var state = desired(g,i)
  g.door_visuals.append({"target":state,"kind":state,"open":1.0 if state in ["open","wall"] else 0.0})

static func advance(g, dt: float):
 if g.door_visuals.size()!=g.room_ports.size(): reset(g)
 for i in range(g.room_ports.size()):
  var visual: Dictionary = g.door_visuals[i]
  var target = desired(g,i)
  if target!=visual.target:
   if target in ["locked","barred"]: visual.kind = target
   visual.target = target
  var duration = WOOD_TIME if visual.kind=="locked" else RISE_TIME
  visual.open = move_toward(float(visual.open),1.0 if target in ["open","wall"] else 0.0,maxf(0,dt)/duration)

static func unlock(g, index: int):
 if g.door_visuals.size()!=g.room_ports.size(): reset(g)
 g.door_visuals[index] = {"target":"open","kind":"locked","open":0.0}

static func visual(g, index: int, state: String) -> Dictionary:
 if g.door_visuals.size()!=g.room_ports.size() or g.door_visuals[index].target!=state:
  return {"kind":state,"open":1.0 if state in ["open","wall"] else 0.0}
 return g.door_visuals[index]

static func ready(g, index: int) -> bool:
 var state = desired(g,index)
 if state!="open": return false
 if g.door_visuals.size()!=g.room_ports.size() or g.door_visuals[index].target!=state: return true
 return float(g.door_visuals[index].open)>=0.98
