extends Node2D
## Paint world coordinates into a half-resolution viewport; UI stays native-sized.
const View = preload("res://scripts/view.gd")
var state

func _get(property: StringName):
	if state==null: return null
	if property=="CENTRE": return state.CENTRE
	if property=="DIRECTIONS": return state.DIRECTIONS
	return state.get(property)

func attack_range() -> float: return state.attack_range()
func has_item(id: String) -> bool: return state.has_item(id)
func door_position(index: int) -> Vector2: return state.door_position(index)

func _process(_dt): queue_redraw()

func _draw():
	if state==null or state.room.is_empty() or state.mode in ["title","confirm_new"]: return
	View.world(self)
