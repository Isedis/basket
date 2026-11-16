extends RefCounted
const TINTS = [Color.WHITE,Color("a5c2c7"),Color("adc098"),Color("cabda3")]
static func sample(material: Color, world: Vector2, floor_index: int, wall: bool, torches: Array) -> Color:
 var result = material*Color(0.48,0.56,0.6)*TINTS[clampi(floor_index,0,3)]
 for torch in torches:
  var strength = pow(maxf(0,1-world.distance_to(torch)/220.0),2)
  result += material*Color(1.1,0.64,0.25)*strength*(0.9 if wall else 0.65)
  result += Color(0.018,0.008,0.001)*strength
 return Color(clampf(result.r,0,1),clampf(result.g,0,1),clampf(result.b,0,1),material.a)
