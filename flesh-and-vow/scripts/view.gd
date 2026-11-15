extends RefCounted

const Art = preload("res://scripts/art_view.gd")
const Catalog = preload("res://scripts/catalog.gd")
const Dungeon = preload("res://scripts/dungeon.gd")
const INK = Color("0d0e15")
const PANEL = Color("14141e")
const BORDER = Color("39313f")
const GOLD = Color("c5a373")
const WHITE = Color("e0d6c3")
const MUTED = Color("88828e")
const RED = Color("c64d65")
const ROOM_NAMES = {"start":"ПРОБУЖДЕНИЕ", "combat":"ЗАЛ ЗАБЫТЫХ", "boss":"ХРАНИТЕЛЬ ОБЕТА", "treasure":"ЗАПЕЧАТАННЫЙ ДАР", "shop":"ТОРГОВЕЦ ОСТАТКАМИ", "torture":"КОМНАТА ПЫТОК", "oracle":"ДВА ОТВЕТА", "reliquary":"ЗЕРКАЛО ВОЗМОЖНОГО", "secret":"МЕЖДУ СТЕН"}
const MARKS = {"start":"·","combat":"·","boss":"†","treasure":"◆","shop":"$","torture":"×","oracle":"±","reliquary":"◇","secret":"?"}

static func rect(g, box: Rect2, color: Color, outline: Color = Color.TRANSPARENT):
	g.draw_rect(box,color)
	if outline.a>0: g.draw_rect(box,outline,false,1)

static func text(g, p: Vector2, value: String, size: int = 14, color: Color = WHITE, heavy: bool = false):
	g.draw_string(g.bold if heavy else g.font,p,value,HORIZONTAL_ALIGNMENT_LEFT,-1,size,color)

static func centre(g, p: Vector2, value: String, size: int = 14, color: Color = WHITE, heavy: bool = false):
	var font = g.bold if heavy else g.font
	var width = font.get_string_size(value,HORIZONTAL_ALIGNMENT_LEFT,-1,size).x
	text(g,p-Vector2(width/2,0),value,size,color,heavy)

static func panel(g, box: Rect2):
	rect(g,box,PANEL,BORDER)
	g.draw_line(box.position+Vector2(8,0),box.position+Vector2(45,0),GOLD,2)

static func item_icon(g, id: String, p: Vector2, scale_value: float = 1):
	var index = 0
	for i in range(Catalog.ITEMS.size()):
		if Catalog.ITEMS[i].id == id:
			index = i
			break
	g.draw_texture_rect_region(g.icons,Rect2(p,Vector2(24,24)*scale_value),Rect2(index*24,0,24,24))

static func actor(g, type: String, p: Vector2, frame: int = 0, scale_value: float = 1, flash: bool = false, tint: Color = Color.WHITE):
	Art.actor(g,type,p,frame,scale_value,flash,tint)

static func render(g):
	rect(g,Rect2(0,0,960,540),INK)
	if g.mode in ["title","confirm_new"]:
		title_screen(g)
	else:
		world(g)
		hud(g)
		if g.mode == "paused" and not g.help_open and not g.journal_open:
			veil(g)
			panel(g,Rect2(300,152,360,270))
			centre(g,Vector2(480,204),"ТЕЛО МОЖЕТ ПОДОЖДАТЬ",17,GOLD,true)
			centre(g,Vector2(480,228),"Забег сохранён",12,MUTED)
		if g.mode=="victory" or (g.mode=="dead" and g.death_elapsed>=0.85):
			ending(g)
	if g.help_open: help_screen(g)
	if g.journal_open: journal(g)
	if g.mode == "confirm_new":
		veil(g)
		panel(g,Rect2(220,185,520,190))
		centre(g,Vector2(480,231),"РАЗОРВАТЬ ЭТОТ ОБЕТ?",22,GOLD,true)
		centre(g,Vector2(480,269),"Текущий забег будет потерян. Открытия сохранятся.",13,WHITE)
	buttons(g)

static func veil(g):
	rect(g,Rect2(0,0,960,540),Color(0.025,0.025,0.04,0.9))

static func title_screen(g):
	if g.castle_art: g.draw_texture_rect(g.castle_art,Rect2(-48,-6,1056,546),false,Color("8e9c84"))
	g.draw_rect(Rect2(0,0,480,540),Color(0.015,0.022,0.018,0.88))
	g.draw_rect(Rect2(480,0,480,540),Color(0.015,0.022,0.018,0.2))
	g.draw_set_transform(Vector2.ZERO,0,Vector2(3,3))
	Art.pose(g,"player",Vector2(239,140),Vector2.RIGHT,0,int(g.anim*4)%8)
	g.draw_set_transform(Vector2.ZERO)
	Art.pixel_text(g,Vector2(72,80),"ОСКВЕРНЁННЫЙ ЗАМОК",GOLD)
	g.draw_string(g.pixel_font,Vector2(67,161),"ПЛОТЬ",HORIZONTAL_ALIGNMENT_LEFT,-1,40,WHITE)
	g.draw_string(g.pixel_font,Vector2(72,218),"И ОБЕТ",HORIZONTAL_ALIGNMENT_LEFT,-1,32,RED)
	g.draw_line(Vector2(73,244),Vector2(391,244),BORDER,1)
	text(g,Vector2(73,269),"Тебе дали тело. Волю придётся забрать.",13,MUTED)
	text(g,Vector2(72,526),"АРТ-ПРОБА 0.3 · ПЕРВЫЙ ЭТАП ПЕРЕРАБОТКИ",10,MUTED)
	text(g,Vector2(706,510),"F11 · ПОЛНЫЙ ЭКРАН",10,MUTED)
	if g.message_time>0: centre(g,Vector2(480,539),g.message,10,RED)

static func buttons(g):
	var arr = g.menu_buttons()
	for i in range(arr.size()):
		var b = arr[i]
		var hovered = i == g.menu_hover
		rect(g,b.rect,Color("302333") if hovered else Color("191823"),GOLD if hovered else BORDER)
		if hovered: rect(g,Rect2(b.rect.position,Vector2(3,b.rect.size.y)),GOLD)
		centre(g,b.rect.position+Vector2(b.rect.size.x/2,b.rect.size.y/2+5),b.text,12,GOLD if hovered else WHITE,true)

static func world(g):
	var off = Vector2(round(sin(g.anim*77)*g.shake),round(cos(g.anim*91)*g.shake*0.65))
	g.draw_set_transform(off)
	if g.castle_art:
		var tints = [Color.WHITE,Color("aac8c2"),Color("b6bf98"),Color("d6c4a3")]
		g.draw_texture_rect(g.castle_art,Rect2(32,84,704,364),false,tints[g.floor_index])
	Art.light(g)
	doors(g)
	for hazard in g.hazards: draw_hazard(g,hazard)
	for b in g.blood:
		var color = Color("63232b") if not b.bone else Color("96846a")
		var position = Vector2(b.x,b.y).snapped(Vector2(2,2))
		var width = maxi(2,int(b.size/2)*2)
		rect(g,Rect2(position-Vector2(width/2,2),Vector2(width,4)),color)
		if not b.bone:
			rect(g,Rect2(position-Vector2(width/3,4),Vector2(maxi(2,width-4),8)),Color("4d2026"))
	for b in g.blocks: Art.stone(g,b)
	Art.corpses(g)
	room_prop(g)
	for z in g.zones:
		var c = Color("c290df") if z.kind=="echo" else Color("db865e")
		g.draw_circle(Vector2(z.x,z.y),z.radius,Color(c,0.07))
		g.draw_arc(Vector2(z.x,z.y),z.radius,0,TAU,40,Color(c,0.6+0.3*sin(g.anim*15)),2)
	for d in g.drops: draw_drop(g,d)
	# Draw entities in foot-position order for correct top-down overlap.
	var entities = g.enemies.duplicate()
	entities.append({"type":"player","x":g.player.x,"y":g.player.y,"boss":false})
	entities.sort_custom(func(a,b): return a.y<b.y)
	for e in entities:
		var p = Vector2(e.x,e.y)
		var is_player = e.type=="player"
		var size = 2.0 if e.boss else 1.0
		g.draw_circle(p+Vector2(0,3),11*size,Color(0,0,0,0.25))
		if not is_player:
			if e.state=="windup":
				var dir = Vector2(e.dx,e.dy)
				g.draw_circle(p,23*size,Color(0.9,0.3,0.3,0.07))
				g.draw_arc(p,23*size,0,TAU,32,Color("d78c66"),1)
				g.draw_line(p,p+dir*(110 if e.boss else 65),Color(0.8,0.4,0.35,0.7),3)
				text(g,p+Vector2(-3,-72*size),"!",16,Color("f6c78e"),true)
			var tint = Color("b5d8e2") if e.slow>0 else Color.WHITE
			actor(g,e.type,p,int(g.anim*6)%3 if e.state=="chase" else 0,size,e.flash>0,tint)
			if e.hp<e.max and not e.boss:
				rect(g,Rect2(p.x-15,p.y-71,30,3),Color("27202c"))
				rect(g,Rect2(p.x-15,p.y-71,30*maxf(0,e.hp/e.max),3),RED)
			if e.burn>0:
				for i in range(3):
					rect(g,Rect2(p.x-9+i*8,p.y-14-sin(g.anim*14+i)*5,3,6),Color("e79759"))
			if e.poison>0: g.draw_circle(p+Vector2(0,-28),3,Color("9cbb6e"))
		else:
			if g.windup>0:
				g.draw_arc(p,g.attack_range(),g.swing_dir.angle()-0.8,g.swing_dir.angle()+0.8,20,Color(0.9,0.8,0.65,0.27),1)
			var blink = g.mode!="dead" and g.invincible>0 and int(g.anim*17)%2==0
			actor(g,"player",p,int(g.anim*9)%3 if g.moving else 0,1,false,Color(1,1,1,0.4) if blink else Color.WHITE)
			if g.swing>0: slash(g,p)
	for b in g.bullets:
		var c = Color("d95d71") if b.type=="ally" else (Color("a8b774") if b.type=="rot" else Color("e9b777"))
		var pos = Vector2(b.x,b.y)
		g.draw_line(pos,pos-Vector2(b.vx,b.vy).normalized()*8,Color(c,0.4),3)
		rect(g,Rect2(pos-Vector2(3,3),Vector2(6,6)),c)
		rect(g,Rect2(pos-Vector2(1,1),Vector2(2,2)),WHITE)
	if g.has_item("orbit"):
		var orb = g.player+Vector2.from_angle(g.anim*3.2)*42
		g.draw_arc(g.player,42,0,TAU,40,Color(0.8,0.7,0.5,0.09),1)
		rect(g,Rect2(orb-Vector2(4,4),Vector2(8,8)),GOLD,WHITE)
	for p in g.particles:
		var c = Color(p.color,p.life/p.max)
		rect(g,Rect2(p.x,p.y,p.size,p.size),c)
	g.draw_set_transform(Vector2.ZERO)
	if g.hurt_flash>0:
		rect(g,Rect2(32,84,704,364),Color(0.7,0.1,0.2,g.hurt_flash*0.35))

static func slash(g, p: Vector2):
	var dir = g.swing_dir.angle()
	var progress = 1.0-g.swing/0.22
	var reach = g.attack_range()
	var points = PackedVector2Array()
	for i in range(13):
		var a = dir-1.1+float(i)/12*2.2
		points.append(p+Vector2.from_angle(a)*reach)
	for i in range(12,-1,-1):
		var a = dir-1.1+float(i)/12*2.2
		points.append(p+Vector2.from_angle(a)*reach*(0.64+progress*0.2))
	var c = Color("eee1bd")
	if g.has_item("ember"): c = Color("eeb276")
	if g.has_item("frost"): c = Color("99ceda")
	g.draw_colored_polygon(points,Color(c,(1.0-progress)*0.23))
	g.draw_arc(p,reach,dir-1.0+progress,dir+1.0,24,Color(c,(1.0-progress)*0.55),2)

static func doors(g):
	for i in range(4):
		var next = g.coords+Vector2i(g.DIRECTIONS[i])
		var key = Dungeon.key(next)
		if not g.dungeon.rooms.has(key):
			var absent = g.door_position(i)
			Art.stone(g,Rect2(absent-Vector2(23,10),Vector2(46,20)) if i%2==0 else Rect2(absent-Vector2(9,25),Vector2(18,50)))
			continue
		var dest = g.dungeon.rooms[key]
		var p = g.door_position(i)
		if not dest.revealed:
			var c = Color("aa8c71") if g.has_item("sight") else Color("62515c")
			g.draw_line(p-Vector2(6,8),p+Vector2(3,2),c,1)
			g.draw_line(p+Vector2(3,2),p-Vector2(1,9),c,1)
			if g.has_item("sight"): text(g,p+Vector2(-4,-16),"?",14,GOLD,true)
			continue
		var box = Rect2(p-Vector2(25,9),Vector2(50,18)) if i%2==0 else Rect2(p-Vector2(9,25),Vector2(18,50))
		rect(g,box.grow(2),Color("333126"),Color("645b42"))
		rect(g,box,Color("11131c"))
		if not g.room.clear:
			for v in range(-15,20,10):
				if i%2==0: g.draw_line(p+Vector2(v,-9),p+Vector2(v,9),Color("7d7660"),2)
				else: g.draw_line(p+Vector2(-9,v),p+Vector2(9,v),Color("7d7660"),2)
		elif not dest.opened:
			rect(g,Rect2(p-Vector2(5,4),Vector2(10,9)),GOLD)
			g.draw_arc(p-Vector2(0,5),4,PI,TAU,8,GOLD,2)
		else:
			centre(g,p+Vector2(0,4),MARKS[dest.type],11,GOLD)

static func draw_hazard(g, h):
	var b = h.rect
	match h.type:
		"pit":
			rect(g,b.grow(3),Color("40303d"))
			rect(g,b,Color("070a10"))
			g.draw_line(b.position,b.position+Vector2(b.size.x,0),Color("66505c"),2)
		"water":
			g.draw_colored_polygon(PackedVector2Array([b.position+Vector2(8,0),b.position+Vector2(b.size.x-8,0),b.position+Vector2(b.size.x,8),b.end-Vector2(0,8),b.end-Vector2(8,0),b.position+Vector2(8,b.size.y),b.position+Vector2(0,b.size.y-8),b.position+Vector2(0,8)]),Color("22372f"))
			for i in range(3):
				g.draw_line(b.position+Vector2(6,7+i*9),b.position+Vector2(b.size.x-7+sin(g.anim*2+i)*3,7+i*9),Color("4b6250"),1)
		"spikes":
			rect(g,b,Color("29242e"),Color("675058"))
			var raised = fmod(g.anim+h.phase,2.5)<1.2
			for x in range(int(b.position.x)+5,int(b.end.x)-2,10):
				for y in range(int(b.position.y)+10,int(b.end.y),12):
					g.draw_colored_polygon(PackedVector2Array([Vector2(x,y),Vector2(x+3,y-(10 if raised else 3)),Vector2(x+6,y)]),Color("bc9a97") if raised else Color("64515d"))
		"fire":
			rect(g,b,Color("44272a"))
			for i in range(7):
				var x = b.position.x+3+i*b.size.x/7
				var y = b.position.y+b.size.y/2+sin(i*4)*8
				var high = 7+sin(g.anim*10+i*2)*5
				rect(g,Rect2(x,y-high,5,high+5),Color("b8563c"))
				rect(g,Rect2(x+1,y-high/2,2,high/2),Color("ecc47d"))

static func room_prop(g):
	var p = g.CENTRE
	var type = g.room.type
	if type in ["combat","secret","shop","start"]:
		if type=="start":
			g.draw_arc(p,42,0,TAU,32,Color("453641"),1)
			g.draw_line(p-Vector2(20,0),p+Vector2(20,0),Color("453641"),1)
			g.draw_line(p-Vector2(0,20),p+Vector2(0,20),Color("453641"),1)
		if type=="shop":
			actor(g,"mage",Vector2(384,184),0,1.2,false,Color("bcb09b"))
			text(g,Vector2(289,144),"«Я продаю лишь то, что пережило хозяев».",10,MUTED)
		return
	if type=="boss":
		if g.room.clear:
			g.draw_circle(p,27,Color("272332"))
			g.draw_arc(p,28,0,TAU,40,GOLD,2)
			g.draw_arc(p,19,g.anim,TAU+g.anim,24,Color("8e566c"),1)
			centre(g,p+Vector2(0,6),"†",25,GOLD)
		return
	if type=="torture":
		rect(g,Rect2(p-Vector2(22,12),Vector2(44,34)),Color("211c28"),Color("604451"))
		rect(g,Rect2(p-Vector2(19,16),Vector2(38,20)),Color("6a3e4b"),Color("ae6971"))
		for dx in [-26,26]:
			g.draw_line(p+Vector2(dx,-28),p+Vector2(dx,12),Color("a18772"),2)
			g.draw_circle(p+Vector2(dx,-29),4,Color("a18772"))
		if not g.room.used:
			g.draw_line(p+Vector2(0,-42),p+Vector2(0,-18),Color("d8ba9a"),2)
			g.draw_colored_polygon(PackedVector2Array([p+Vector2(-9,-41),p+Vector2(9,-41),p+Vector2(0,-27)]),Color("bcb6aa"))
	elif type=="oracle":
		for side in [-1,1]:
			var at = p+Vector2(side*35,0)
			rect(g,Rect2(at-Vector2(12,20),Vector2(24,31)),Color("403240"),Color("75605d"))
			centre(g,at-Vector2(0,24),"−" if side<0 else "+",24,RED if side<0 else GOLD,true)
	elif type=="reliquary":
		g.draw_arc(p-Vector2(0,24),24,0,TAU,32,GOLD,3)
		g.draw_circle(p-Vector2(0,24),20,Color("343044"))
		g.draw_line(p-Vector2(0,4),p+Vector2(0,16),Color("7d6c65"),5)
		g.draw_line(p-Vector2(16,-17),p+Vector2(16,17),Color("7d6c65"),3)
	elif type=="treasure":
		g.draw_arc(p,33,0,TAU,32,Color("665239"),1)

static func draw_drop(g, d):
	var p = Vector2(d.x,d.y)
	var bob = sin(g.anim*3+d.x)*2
	if d.type=="item":
		g.draw_circle(p+Vector2(0,5),16,Color("24212d"))
		rect(g,Rect2(p-Vector2(13,0),Vector2(26,11)),Color("3e3540"),Color("69555a"))
		item_icon(g,d.id,p-Vector2(12,25+bob))
		if g.player.distance_to(p)<47:
			g.draw_arc(p,19,0,TAU,28,GOLD,1)
	elif d.type=="coin":
		rect(g,Rect2(p.x-4,p.y-7-bob,8,10),Color("bf9658"),Color("f0cb82"))
		rect(g,Rect2(p.x-1,p.y-5-bob,2,5),Color("76513d"))
	elif d.type=="key":
		g.draw_arc(p-Vector2(0,7+bob),4,0,TAU,10,GOLD,2)
		g.draw_line(p-Vector2(0,3+bob),p+Vector2(0,6-bob),GOLD,2)
		g.draw_line(p+Vector2(0,4-bob),p+Vector2(4,4-bob),GOLD,2)
	elif d.type=="heal":
		g.draw_colored_polygon(PackedVector2Array([p+Vector2(0,-13-bob),p+Vector2(6,-5-bob),p+Vector2(5,1-bob),p+Vector2(-4,2-bob),p+Vector2(-6,-5-bob)]),RED)
	if d.price>0: centre(g,p+Vector2(0,24),"%d ¤"%d.price,11,GOLD)

static func hud(g):
	Art.rune_border(g,Rect2(32,16,704,56))
	Art.pixel_text(g,Vector2(46,34),"ПЛОТЬ",Color("a98d68"))
	for i in range(int(ceil(g.max_hp))):
		var p = Vector2(46+i*13,43)
		rect(g,Rect2(p,Vector2(10,14)),Color("301e20"),Color("614136"))
		var amount = clampf(g.hp-i,0,1)
		if amount>0:
			rect(g,Rect2(p+Vector2(2,2+10*(1-amount)),Vector2(6,10*amount)),Color("a63b3e"))
			rect(g,Rect2(p+Vector2(2,2),Vector2(2,2)),Color("e18a6b"))
	Art.pixel_text(g,Vector2(230,34),"БОЛЬ")
	rect(g,Rect2(230,46,94,6),Color("2c2325"))
	rect(g,Rect2(230,46,94*g.pain/100,6),Color("9f5c51"))
	Art.pixel_text(g,Vector2(351,34),"МОНЕТЫ")
	text(g,Vector2(351,57),"%02d"%g.coins,18,GOLD,true)
	Art.pixel_text(g,Vector2(440,34),"КЛЮЧИ")
	text(g,Vector2(440,57),"%02d"%g.keys,18,WHITE,true)
	Art.pixel_text(g,Vector2(526,34),"ВЕРА")
	text(g,Vector2(526,57),("+" if g.faith>0 else "")+str(g.faith),18,GOLD if g.faith>=0 else RED,true)
	text(g,Vector2(650,49),time_string(g.elapsed),17,WHITE,true)
	# An austere margin leaves the room as the dominant element.
	Art.pixel_text(g,Vector2(762,39),"ОБЕТ %d"%(g.floor_index+1),GOLD)
	g.draw_line(Vector2(758,60),Vector2(928,60),Color("544832"),1)
	minimap(g)
	text(g,Vector2(765,280),"◆ дар  † босс  $ торг",9,MUTED)
	g.draw_line(Vector2(758,299),Vector2(928,299),Color("544832"),1)
	item_icon(g,g.active,Vector2(764,320),2)
	Art.pixel_text(g,Vector2(762,388),"ПРОБЕЛ",GOLD)
	for i in range(3): rect(g,Rect2(762+i*46,400,36,4),GOLD if i<g.charge else BORDER)
	text(g,Vector2(762,433),"Убито: %d"%g.kills,11,MUTED)
	text(g,Vector2(762,453),"Дары: %d"%g.inventory.size(),11,MUTED)
	text(g,Vector2(762,473),"Shift · рывок" if g.has_item("blink") else "Рывок не обретён",10,MUTED)
	Art.rune_border(g,Rect2(32,460,704,42))
	Art.pixel_text(g,Vector2(46,478),Catalog.FLOORS[g.floor_index].short.to_upper(),GOLD)
	text(g,Vector2(46,494),ROOM_NAMES[g.room.type],9,MUTED)
	var count = mini(11,g.inventory.size())
	for i in range(count):
		item_icon(g,g.inventory[g.inventory.size()-count+i],Vector2(315+i*35,467))
	text(g,Vector2(32,523),"WASD · шаг     СТРЕЛКИ · удар     E · взять     TAB · дары",10,MUTED)
	text(g,Vector2(762,523),"ESC · F1 · F11",10,MUTED)
	var hint = g.interaction_text()
	if hint!="":
		var width = g.font.get_string_size(hint,HORIZONTAL_ALIGNMENT_LEFT,-1,11).x
		rect(g,Rect2(384-width/2-10,422,width+20,22),Color(0.02,0.025,0.025,0.9))
		centre(g,Vector2(384,437),hint,11,GOLD)
	if g.message_time>0:
		centre(g,Vector2(384,109),g.message,11,WHITE)
	if g.popup_time>0 and g.item_popup!="":
		var entry = Catalog.item(g.item_popup)
		Art.rune_border(g,Rect2(170,114,428,62))
		item_icon(g,g.item_popup,Vector2(188,132),1.25)
		text(g,Vector2(233,139),entry.name,14,GOLD,true)
		text(g,Vector2(233,160),entry.hint,10,WHITE)
	for e in g.enemies:
		if e.boss:
			rect(g,Rect2(173,390,422,5),Color("302027"))
			rect(g,Rect2(173,390,422*maxf(0,e.hp/e.max),5),RED)
			centre(g,Vector2(384,411),Catalog.FLOORS[g.floor_index].boss,10,WHITE)
			break

static func minimap(g):
	var visible: Array = []
	for key in g.dungeon.rooms:
		var r = g.dungeon.rooms[key]
		if not r.revealed and not g.has_item("sight"): continue
		var p = Vector2i(int(r.x),int(r.y))
		var show = r.visited or g.has_item("sight")
		for d in Dungeon.DIRS:
			var adjacent = Dungeon.key(p+d)
			if g.dungeon.rooms.has(adjacent) and g.dungeon.rooms[adjacent].visited: show = true
		if show: visible.append(r)
	if visible.is_empty(): return
	var lo = Vector2(100,100)
	var hi = Vector2(-100,-100)
	for r in visible:
		lo = lo.min(Vector2(r.x,r.y))
		hi = hi.max(Vector2(r.x,r.y))
	var spacing = minf(23,142.0/maxf(hi.x-lo.x+1,hi.y-lo.y+1))
	var mid = (lo+hi)/2
	for r in visible:
		var p = Vector2(846,184)+(Vector2(r.x,r.y)-mid)*spacing
		for d in [Vector2i.RIGHT,Vector2i.DOWN]:
			var key = Dungeon.key(Vector2i(int(r.x),int(r.y))+d)
			if g.dungeon.rooms.has(key) and g.dungeon.rooms[key] in visible:
				g.draw_line(p,p+Vector2(d)*spacing,BORDER,2)
		var current = int(r.x)==g.coords.x and int(r.y)==g.coords.y
		var color = Color("5b3d50") if current else (Color("33303c") if r.visited else Color("1c1d28"))
		rect(g,Rect2(p-Vector2(8,6),Vector2(16,12)),color,GOLD if current else BORDER)
		centre(g,p+Vector2(0,4),MARKS[r.type] if r.visited or g.has_item("sight") else "·",10,GOLD if current else MUTED)

static func help_screen(g):
	veil(g)
	panel(g,Rect2(160,45,640,450))
	centre(g,Vector2(480,85),"ПРЕЖДЕ ЧЕМ ДАТЬ ОБЕТ",23,GOLD,true)
	var lines = [
		["WASD / СТРЕЛКИ", "Движение / удар в выбранном направлении. Можно удерживать."],
		["E / ПРОБЕЛ", "Взять дар, купить, использовать алтарь / активный предмет."],
		["ESC / TAB / F11", "Пауза и сохранение / собранные дары / полный экран."],
		["ПЛОТЬ И БОЛЬ", "Раны усиливают удары. Но при нуле плоти забег окончен."],
		["ЧИТАЙ ДВИЖЕНИЯ", "Знак «!» — замах врага. Отступи и ударь во время передышки."],
		["ЦЕНА ДАРА", "Пытки отнимают 2 максимальной плоти до конца забега."],
		["СЛУШАЙ КАМЕНЬ", "В безопасной комнате ударь треснувшую стену три раза."],
		["ДАЛЬШЕ — ГЛУБЖЕ", "Победи босса. Забери дар. Нажми E у печати в центре."]
	]
	for i in range(lines.size()):
		text(g,Vector2(190,120+i*38),lines[i][0],10,GOLD,true)
		text(g,Vector2(190,138+i*38),lines[i][1],11,WHITE)
	text(g,Vector2(190,427),"Рывок открывается предметом. Зачистка трёх комнат заряжает активный дар.",10,MUTED)

static func journal(g):
	veil(g)
	panel(g,Rect2(130,38,700,474))
	centre(g,Vector2(480,77),"ТО, ЧТО ТЫ НОСИШЬ В СЕБЕ",22,GOLD,true)
	if g.inventory.is_empty():
		centre(g,Vector2(480,250),"Пока только чужая плоть и собственная воля.",14,MUTED)
	var unique: Array = []
	for id in g.inventory:
		if id not in unique: unique.append(id)
	for i in range(mini(unique.size(),20)):
		var column = i/10
		var row = i%10
		var p = Vector2(155+int(column)*337,102+row*34)
		var entry = Catalog.item(unique[i])
		item_icon(g,entry.id,p)
		text(g,p+Vector2(33,10),entry.name+(" ×%d"%g.count_item(entry.id) if g.count_item(entry.id)>1 else ""),11,GOLD,true)
		text(g,p+Vector2(33,25),entry.hint,8,MUTED)

static func ending(g):
	veil(g)
	var victory = g.mode=="victory"
	centre(g,Vector2(480,148),"ОБЕТ РАЗОРВАН" if victory else "ПЛОТЬ НЕ ВЫДЕРЖАЛА",30,GOLD if victory else RED,true)
	centre(g,Vector2(480,192),g.end_quote,14,WHITE)
	g.draw_line(Vector2(290,220),Vector2(670,220),BORDER,1)
	centre(g,Vector2(480,257),"ЭТАЖ %d / 4     ·     %s     ·     УБИЙСТВ %d"%[g.floor_index+1,time_string(g.elapsed),g.kills],12,WHITE)
	centre(g,Vector2(480,286),"Реликвий: %d   ·   Комнат: %d"%[g.inventory.size(),g.rooms_cleared],12,MUTED)
	centre(g,Vector2(480,332),"Тело исчезло. Открытые возможности остались.",12,GOLD)

static func number(value: float) -> String:
	return str(int(value)) if value==int(value) else "%.1f"%value

static func time_string(value: float) -> String:
	return "%02d:%02d"%[int(value)/60,int(value)%60]
