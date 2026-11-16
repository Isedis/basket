extends RefCounted
const Dungeon = preload("res://scripts/dungeon.gd")
const Motion = preload("res://scripts/locomotion.gd")
const UNIT = Vector2(1152,640)
const ORIGIN = Vector2(48,168)

static func configure(g):
 var size = Dungeon.span(g.room)
 g.room_floor_rect = Rect2(ORIGIN,UNIT*Vector2(size))
 g.CENTRE = g.room_floor_rect.get_center()
 g.room_ports = Dungeon.ports(g.dungeon,g.room)
 g.authored_room = true
 g.room_torches.clear()
 for x in range(size.x):
  for offset in [176,384,768,976]: g.room_torches.append(Vector2(ORIGIN.x+x*UNIT.x+offset,142))
 for y in range(size.y):
  g.room_torches.append(Vector2(56,388+y*UNIT.y))
  g.room_torches.append(Vector2(g.room_floor_rect.end.x-8,388+y*UNIT.y))

static func reserved(g, box: Rect2) -> bool:
 var size = Dungeon.span(g.room)
 for x in range(size.x):
  var center = ORIGIN.x+(x+0.5)*UNIT.x
  if box.grow(14).intersects(Rect2(center-68,176,136,g.room_floor_rect.size.y)): return true
 for y in range(size.y):
  var center = ORIGIN.y+(y+0.5)*UNIT.y
  if box.grow(14).intersects(Rect2(ORIGIN.x,center-56,g.room_floor_rect.size.x,112)): return true
 return false

static func prop(g, kind: int, p: Vector2, footprint: Vector2 = Vector2.ZERO):
 var box = Rect2(p-footprint/2,footprint)
 if footprint!=Vector2.ZERO and reserved(g,box): return
 g.room_props.append({"type":"scenery","kind":kind,"x":p.x,"y":p.y,"solid":footprint!=Vector2.ZERO,"boss":false})
 if footprint!=Vector2.ZERO: g.blocks.append(box)

static func setup(g):
 g.blocks.clear()
 g.hazards.clear()
 g.room_props.clear()
 var size = Dungeon.span(g.room)
 # Peripheral relics frame the entire hall, including uninterrupted double halls.
 var end: Vector2 = g.room_floor_rect.end
 for p in [Vector2(112,248),Vector2(end.x-64,248)]: prop(g,2,p,Vector2(46,20))
 prop(g,4,Vector2(116,end.y-184),Vector2(58,20))
 prop(g,3,Vector2(end.x-104,end.y-192),Vector2(70,24))
 prop(g,7,Vector2(128,end.y-56),Vector2(48,22))
 prop(g,1,Vector2(end.x-96,end.y-60),Vector2(46,20))
 for p in [Vector2(172,286),Vector2(end.x-128,294),Vector2(88,end.y-114),Vector2(end.x-48,end.y-136),Vector2(256,end.y-28),Vector2(end.x-184,end.y-24)]: prop(g,5,p)
 prop(g,6,Vector2(176,end.y-216))
 prop(g,6,Vector2(end.x-160,end.y-46))
 for y in range(size.y):
  for x in range(size.x):
   var offset = Vector2(x,y)*UNIT
   var variant = (int(g.room.layout)+x*3+y*5)%6
   var columns = [Vector2(304,360),Vector2(944,360),Vector2(304,664),Vector2(944,664)]
   if variant==1: columns = [Vector2(264,336),Vector2(984,336),Vector2(264,704),Vector2(984,704)]
   if variant==2: columns = [Vector2(336,320),Vector2(912,320),Vector2(336,704),Vector2(912,704)]
   if variant==3: columns = [Vector2(256,360),Vector2(992,664)]
   if variant==4: columns = [Vector2(352,336),Vector2(896,688)]
   if variant==5: columns = [Vector2(288,320),Vector2(960,704)]
   if g.room.type!="boss":
    for i in range(columns.size()):
     var kind = 1 if variant in [2,5] and i%2==0 else 0
     prop(g,kind,columns[i]+offset,Vector2(44,22))
    if variant in [3,4,5]:
     prop(g,7 if variant==3 else 3,Vector2(392,664)+offset,Vector2(56,24))
     prop(g,1,Vector2(856,352)+offset,Vector2(46,20))
   if g.room.type in ["combat","boss"]:
    var box = Rect2(Vector2(408,320)+offset,Vector2(52,32))
    if not reserved(g,box): g.hazards.append({"rect":box,"type":["spikes","fire","water","pit"][(variant+g.floor_index)%4],"phase":float(int(g.room.seed)%7)})

static func fixture(g, kind: int, p: Vector2, width: float):
 g.room_props.append({"type":"scenery","kind":kind,"x":p.x,"y":p.y,"solid":true,"boss":false,"sheet":"special"})
 g.blocks.append(Rect2(p-Vector2(width/2,7),Vector2(width,14)))

static func special(g):
 match g.room.type:
  "shop": fixture(g,0,g.CENTRE-Vector2(0,100),68)
  "torture": fixture(g,1,g.CENTRE,48)
  "oracle":
   fixture(g,2,g.CENTRE-Vector2(40,0),54)
   fixture(g,3,g.CENTRE+Vector2(40,0),54)
  "reliquary": fixture(g,4,g.CENTRE,36)

static func legacy_point(p: Vector2) -> Vector2:
 return Vector2(50+(p.x-50)*1148.0/668.0,176+(p.y-176)*625.0/249.0)

static func move_record(record: Dictionary):
 if not record.has("x") or not record.has("y"): return
 var before = Vector2(record.x,record.y)
 var after = legacy_point(before)
 record.x = after.x
 record.y = after.y
 if record.get("motion") is Dictionary: Motion.shift(record.motion,after-before)

static func upgrade_save(data: Dictionary):
 if int(data.get("room_geometry",1))>=2: return
 var before = Vector2(data.player[0],data.player[1])
 var after = legacy_point(before)
 data.player = [after.x,after.y]
 if data.get("player_motion") is Dictionary: Motion.shift(data.player_motion,after-before)
 for room in data.dungeon.rooms.values():
  for field in ["enemies","drops","blood","corpses"]:
   for entry in room.get(field,[]): move_record(entry)
 for field in ["bullets","zones"]:
  for entry in data.get(field,[]): move_record(entry)
 data.room_geometry = 2
 Dungeon.rebuild_cells(data.dungeon)
