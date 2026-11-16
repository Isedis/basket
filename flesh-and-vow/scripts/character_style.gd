extends RefCounted
## Native-pixel dimensions and material ramps for the six ordinary characters.
const TYPES = ["player","guard","assassin","skeleton","shadow","mage"]
const CELL = 32
const SIZES = [
	[Vector2i(16,15),Vector2i(13,13),Vector2i(7,12),Vector2i(7,12),Vector2i(6,11),Vector2i(6,11),Vector2i(20,10),Vector2i(5,10)],
	[Vector2i(13,13),Vector2i(19,14),Vector2i(9,12),Vector2i(9,12),Vector2i(8,11),Vector2i(8,11),Vector2i(20,10),Vector2i(9,14)],
	[Vector2i(11,12),Vector2i(11,12),Vector2i(6,11),Vector2i(6,11),Vector2i(5,11),Vector2i(5,11),Vector2i(14,5),Vector2i(9,15)],
	[Vector2i(13,14),Vector2i(12,14),Vector2i(5,12),Vector2i(5,12),Vector2i(4,11),Vector2i(4,11),Vector2i(8,4),Vector2i(5,9)],
	[Vector2i(14,14),Vector2i(12,15),Vector2i(6,12),Vector2i(6,12),Vector2i(5,11),Vector2i(5,11),Vector2i(6,6),Vector2i(7,15)],
	[Vector2i(13,15),Vector2i(13,15),Vector2i(6,12),Vector2i(6,12),Vector2i(5,11),Vector2i(5,11),Vector2i(6,6),Vector2i(6,13)]
]
const COLORS = [
	["10161b","252629","414137","5d5947","80775d","a49b7d","c8bfa2","e7debe","38282f","5c3c43","855953","ad7b65","d0a07e","4b382c","71513b","96714b","303b46","626f7a","a5b4b3","642d3c","963f4c"],
	["0d151c","1b2831","2d3f4d","495c6b","697e8c","9aadb4","c7d1c6","30252b","56303b","7d3f50","a3656b","493d30","796045","aa8b60","b8ae90","202326"],
	["0b1419","17272c","273d43","3b555b","53787b","829e98","b0c1b4","dedbc1","545d57","25252e","3e3543","6d5662","514638","84745b","b7ac8e","b3bfc4"],
	["10191d","252b2b","41423a","5f5b4a","80775e","a49a7b","c6bba0","e1d8bc","33252c","53343d","79505a","4e3e31","7c6044","a58257","343f46","6b7d82"],
	["091318","132229","20343d","304b53","45656b","64878a","8fb2ac","b7d7c5","24272e","39343f","5a4c59","303a35","525b4e","8b9985"],
	["10171d","221f28","392834","573542","784b58","9a6870","3d3930","66543e","8d7350","b49a6d","a19b82","c8c0a2","e6d9b9","1c3937","365e55","5c8b78","9bc1a3"]
]

static func index(type: String) -> int:
	return maxi(0,TYPES.find(type))

static func region(actor: int, view: int, part: int) -> Rect2i:
	var size: Vector2i = SIZES[actor][part]
	var cell = Vector2i(part*CELL,((actor%3)*3+view)*CELL)
	return Rect2i(cell+(Vector2i(CELL,CELL)-size)/2,size)

static func is_rigged(type: String) -> bool:
	return type in TYPES
