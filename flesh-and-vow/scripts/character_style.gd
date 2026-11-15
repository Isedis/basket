extends RefCounted
## Native-pixel dimensions and material ramps for the three castle characters.
const TYPES = ["player","guard","assassin"]
const CELL = 32
const SIZES = [
	[Vector2i(16,15),Vector2i(13,13),Vector2i(7,12),Vector2i(7,12),Vector2i(6,11),Vector2i(6,11),Vector2i(20,10),Vector2i(5,10)],
	[Vector2i(13,13),Vector2i(19,14),Vector2i(9,12),Vector2i(9,12),Vector2i(8,11),Vector2i(8,11),Vector2i(20,10),Vector2i(9,14)],
	[Vector2i(11,12),Vector2i(11,12),Vector2i(6,11),Vector2i(6,11),Vector2i(5,11),Vector2i(5,11),Vector2i(14,5),Vector2i(9,15)]
]
const COLORS = [
	["10161b","252629","414137","5d5947","80775d","a49b7d","c8bfa2","e7debe","38282f","5c3c43","855953","ad7b65","d0a07e","4b382c","71513b","96714b","303b46","626f7a","a5b4b3","642d3c","963f4c"],
	["0d151c","1b2831","2d3f4d","495c6b","697e8c","9aadb4","c7d1c6","30252b","56303b","7d3f50","a3656b","493d30","796045","aa8b60","b8ae90","202326"],
	["0b1419","17272c","273d43","3b555b","53787b","829e98","b0c1b4","dedbc1","545d57","25252e","3e3543","6d5662","514638","84745b","b7ac8e","b3bfc4"]
]

static func index(type: String) -> int:
	return maxi(0,TYPES.find(type))

static func region(actor: int, view: int, part: int) -> Rect2i:
	var size: Vector2i = SIZES[actor][part]
	var cell = Vector2i(part*CELL,(actor*3+view)*CELL)
	return Rect2i(cell+(Vector2i(CELL,CELL)-size)/2,size)
