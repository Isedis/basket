extends RefCounted
## Cosmetic ballistic debris: spawned only after accepted damage, independent of loot RNG.
static var random = RandomNumberGenerator.new()
static func emit(g,e: Dictionary,point: Vector2,direction: Vector2,impact: float):
 var axis=direction.normalized() if direction.length_squared()>0.001 else Vector2.UP
 var heavy=clampf(impact,0,2.5)
 var direct=impact>0
 var count=14+int(heavy*3) if direct else 3
 for i in range(count):
  var chunk=direct and i<3
  var velocity=axis.rotated(random.randf_range(-0.8,0.8))*random.randf_range(95,210)*(1+heavy*0.12)
  var height=clampf(float(e.y)-point.y,18,95)
  var life=1.4 if chunk else 0.95
  g.particles.append({"wound":true,"chunk":chunk,"x":point.x,"y":point.y+height,"z":height,"vz":random.randf_range(55,140),"vx":velocity.x,"vy":velocity.y*0.55,"life":life,"max":life,"size":random.randf_range(5,8) if chunk else random.randf_range(2,4),"angle":random.randf()*TAU,"spin":random.randf_range(-10,10),"bounced":false})
 if direct:
  g.particles.append({"wound":true,"flare":true,"x":point.x,"y":point.y,"life":0.10,"max":0.10,"angle":axis.angle(),"size":18+heavy*3})
 if g.particles.size()>400:g.particles=g.particles.slice(g.particles.size()-400)
static func update(g,p: Dictionary,dt: float):
 p.life-=dt
 if p.get("flare",false):return
 p.x+=p.vx*dt
 p.y+=p.vy*dt
 p.z+=p.vz*dt-260*dt*dt
 p.vz-=520*dt
 p.vx*=exp(-1.8*dt)
 p.vy*=exp(-1.8*dt)
 p.angle+=p.spin*dt
 if p.z<=0:
  p.z=0.0
  if p.chunk and not p.bounced:
   p.bounced=true
   p.vz=absf(p.vz)*0.23
   p.vx*=0.4
   p.vy*=0.4
  else:
   var bounds: Rect2=g.room_floor_rect.grow(-8)
   var at=Vector2(p.x,p.y).clamp(bounds.position,bounds.end)
   g.blood.append({"x":at.x,"y":at.y,"size":p.size*1.7,"bone":false,"kind":"flesh" if p.chunk else "blood"})
   if g.blood.size()>160:g.blood=g.blood.slice(g.blood.size()-160)
   p.life=0.0
static func draw(g,p: Dictionary):
 var alpha=clampf(p.life/0.15,0,1)
 var at=Vector2(p.x,p.y).snapped(Vector2(2,2))
 if p.get("flare",false):
  var axis=Vector2.from_angle(p.angle)
  g.draw_line(at-axis*p.size,at+axis*p.size,Color(0.93,0.66,0.48,alpha),4)
  g.draw_line(at-axis.orthogonal()*8,at+axis.orthogonal()*8,Color(0.95,0.82,0.65,alpha),2)
  return
 var z=float(p.z)
 if p.chunk:g.draw_rect(Rect2(at-Vector2(4,2),Vector2(8,4)),Color(0.06,0.02,0.025,alpha*0.55))
 at.y-=roundf(z/2)*2
 if p.chunk:
  var points=PackedVector2Array()
  for v in [Vector2(-1,-0.4),Vector2(0.3,-0.8),Vector2(1,0.2),Vector2(0.2,0.7),Vector2(-0.7,0.5)]:points.append((at+(v*p.size).rotated(p.angle)).snapped(Vector2(2,2)))
  g.draw_colored_polygon(points,Color(0.53,0.075,0.12,alpha))
  g.draw_line(points[0],points[1],Color(0.86,0.36,0.35,alpha),2)
 else:
  var tail=Vector2(p.vx,p.vy-p.vz).normalized()*clampf(Vector2(p.vx,p.vy-p.vz).length()*0.035,3,10)
  g.draw_line(at-tail,at,Color(0.58,0.04,0.08,alpha),p.size)
  g.draw_rect(Rect2(at,Vector2(2,2)),Color(0.91,0.20,0.24,alpha))
