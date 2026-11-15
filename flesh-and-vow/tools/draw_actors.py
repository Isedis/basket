"""Original articulated pixel sprites. Every frame is drawn separately on a 64px grid.
Columns: four directions x eight frames. Rows: ten actors x six actions.
Actions: idle, run, anticipation, strike, hurt, death. Pivot: (32,55).
No existing bitmap artwork is read or modified by this generator.
"""
from PIL import Image,ImageDraw
from pathlib import Path
import math,random
OUT=Path(__file__).resolve().parents[1]/'assets'/'actors_v3.png'
actors=['player','guard','shadow','skeleton','assassin','mage','boss0','boss1','boss2','boss3']
actions=['idle','run','anticipation','strike','hurt','death']
atlas=Image.new('RGBA',(64*32,64*len(actors)*6))
palettes=[('#625951','#a99b7d','#b62f3d','#201e20'),('#555b53','#9d9a7e','#773c37','#202723'),('#352d42','#89718b','#70658a','#1d2028'),('#93896e','#cdc0a0','#70534b','#332d29'),('#373d39','#a4987e','#8e3c42','#171f20'),('#5e4a55','#b7aa8d','#b56e3b','#29232a'),('#5a5b52','#c5ac85','#a34b33','#252925'),('#9a6a63','#c9a68d','#b62f43','#46262c'),('#526047','#a7b279','#ae7950','#283a2a'),('#827557','#e0cca1','#c6a868','#3a3529')]
for ai,kind in enumerate(actors):
 body,skin,red,dark=palettes[ai]
 for si,action in enumerate(actions):
  for direction in range(4):
   for frame in range(8):
    im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im)
    t=frame/7; phase=frame*math.tau/8
    run=action=='run'; swing=action=='strike'; dead=action=='death'
    bob=round(math.cos(phase*2)) if run else (1 if frame>3 else 0)
    lean=round((math.sin(t*math.pi)*3 if swing else -t*2 if action=='anticipation' else 0))
    cx=32+lean; cy=33+bob
    # Ground shadows are rendered by the engine, never baked into the bitmap.
    def rect(box,c):d.rectangle(tuple(round(v) for v in box),fill=c)
    def poly(points,c):d.polygon([(round(x),round(y)) for x,y in points],fill=c)
    def line(points,c,w=1):d.line([(round(x),round(y)) for x,y in points],fill=c,width=w)
    def oval(box,c):d.ellipse(tuple(round(v) for v in box),fill=c)
    def limb(a,b,c,width=3):
     line([a,b],dark,width+2);line([a,b],c,width);line([(a[0]-1,a[1]),(b[0]-1,b[1]-1)],skin,1)
    if dead:
     collapse=min(1,t*1.6); y=42+int(collapse*10)
     poly([(cx-10,y-7),(cx+8,y-6),(cx+13,y+3),(cx+4,y+7),(cx-13,y+3)],dark)
     poly([(cx-9,y-5),(cx+7,y-5),(cx+10,y+2),(cx-10,y+2)],body)
     poly([(cx-5,y-3),(cx+5,y-5),(cx+7,y+3),(cx-6,y+5)],red)
     limb((cx-7,y),(cx-17-int(t*3),y+4),skin,3)
     limb((cx+6,y),(cx+14,y+5),body,3)
     hx=cx+int(t*17);hy=y-11-int(math.sin(t*math.pi)*9)
     oval((hx-6,hy-6,hx+6,hy+4),dark);oval((hx-5,hy-5,hx+4,hy+3),skin)
     rect((hx-3,hy-2,hx-1,hy),dark);rect((hx+2,hy-2,hx+3,hy),dark)
     for j in range(5):rect((cx-5+j*3,y+2+(j%2),cx-4+j*3,y+3+(j%2)),'#b45656')
     if frame>2:
      line([(cx-8,y+5),(cx-13,y+8),(cx-8,y+10),(cx-2,y+8)],'#7b2833',2)
      for j in range(4):rect((hx-j*7,y+7+j%3,hx-j*7+2,y+8+j%3),'#942c3a')
    else:
     side=direction in (1,3); back=direction==2; sign= -1 if direction==3 else 1
     steps=round(math.sin(phase)*4) if run else 0
     # Each boot and knee follows a different gait phase.
     for j in [-1,1]:
      xx=cx+j*(3 if side else 4); yy=cy+15+j*steps
      limb((xx,cy+8),(xx+(j*steps//2 if side else 0),yy),dark,4)
      rect((xx-2,yy-1,xx+3,yy+2),'#393a30');rect((xx-1,yy-1,xx+2,yy),'#706958')
     cloak=-steps//2
     poly([(cx-8,cy-6),(cx+8,cy-6),(cx+10+cloak,cy+13),(cx+3,cy+12),(cx,cy+15),(cx-9+cloak,cy+12)],dark)
     poly([(cx-6,cy-5),(cx+6,cy-5),(cx+7+cloak,cy+10),(cx-6+cloak,cy+11)],body)
     line([(cx-5,cy-3),(cx-3+cloak,cy+8)],'#85816b',1)
     if kind in ['player','boss1'] and not back:
      for j in range(4):
       line([(cx-4,cy+j*2),(cx+2,cy+j*2+1)],skin,1)
      line([(cx,cy-1),(cx+2,cy+9)],red,2)
     elif kind in ['guard','boss0','boss3']:
      poly([(cx-6,cy-4),(cx+6,cy-4),(cx+5,cy+5),(cx,cy+8),(cx-5,cy+5)],'#6e7264')
      line([(cx-5,cy-3),(cx+4,cy-3)],'#9fa58b');line([(cx,cy-3),(cx,cy+6)],'#434d43')
     elif kind=='skeleton':
      rect((cx-6,cy-4,cx+6,cy+7),dark)
      for j in range(4):line([(cx-5,cy-3+j*3),(cx+5,cy-3+j*3)],skin)
      line([(cx,cy-3),(cx,cy+8)],skin,2)
     rect((cx-7,cy+8,cx+7,cy+10),'#51392d');rect((cx,cy+8,cx+2,cy+10),'#b39162')
     # Scarf/clothing tails bend through gait and attack poses.
     tail=math.sin(phase)*3 if run else math.sin(t*math.pi)*2
     poly([(cx-6,cy-7),(cx+5,cy-7),(cx+7,cy-3),(cx-3,cy-3),(cx-7-int(tail),cy+6),(cx-11-int(tail),cy+3)],red)
     line([(cx-8,cy-5),(cx+5,cy-5)],'#cc6954')
     # Grotesque large head with stitched blindfold or corroded guard helm.
     hx=cx+(sign*2 if side else 0);hy=cy-15
     oval((hx-9,hy-8,hx+9,hy+8),dark)
     poly([(hx-6,hy-7),(hx+5,hy-7),(hx+8,hy-2),(hx+6,hy+6),(hx-3,hy+8),(hx-8,hy+3),(hx-8,hy-3)],skin)
     rect((hx-5,hy-7,hx+3,hy-5),'#d0c3a2')
     line([(hx-7,hy+1),(hx-4,hy+6),(hx+3,hy+7)],'#7f725e')
     if kind in ['guard','boss0','assassin']:
      poly([(hx-8,hy-5),(hx-5,hy-9),(hx+4,hy-9),(hx+8,hy-5),(hx+8,hy+2),(hx-8,hy+2)],body)
      rect((hx-6,hy-1,hx+6,hy+2),dark)
      line([(hx-5,hy-6),(hx+4,hy-6)],'#a7a48b')
      if not back:
       rect((hx+1 if side else hx-5,hy,hx+5,hy),'#ef965b')
     elif not back:
      if kind=='player':
       line([(hx-7,hy-1),(hx+7,hy+1)],'#4a3937',3)
       line([(hx-5,hy-2),(hx-4,hy+2),(hx-1,hy-1),(hx,hy+3),(hx+3,hy),(hx+4,hy+3)],'#b0a17b')
      else:
       rect((hx-5,hy-1,hx-2,hy+1),dark);rect((hx+2,hy-1,hx+5,hy+1),dark)
      rect((hx-2,hy+5,hx+3,hy+6),'#452c2d')
     if back:line([(hx-4,hy-5),(hx+3,hy+4)],'#6d604f',2)
     # Left arm counters the weapon arm. Anticipation and strike are distinct poses.
     shoulder=(cx-7,cy-2)
     limb(shoulder,(cx-10-round(math.sin(phase)*2) if run else cx-10,cy+7),skin,3)
     if action=='anticipation':
      hand=(cx+10,cy-11-round(t*5)); tip=(cx+8-round(t*12),cy-30)
     elif swing:
      angle=-2.2+t*3.8
      hand=(cx+round(math.cos(angle)*11),cy+round(math.sin(angle)*8))
      tip=(hand[0]+round(math.cos(angle)*19),hand[1]+round(math.sin(angle)*19))
     else:
      hand=(cx+10,cy+7-(steps//2));tip=(cx+17,cy-8-(steps//2))
     if direction==3:
      hand=(2*cx-hand[0],hand[1]);tip=(2*cx-tip[0],tip[1])
     limb((cx+7 if direction!=3 else cx-7,cy-2),hand,skin,3)
     line([hand,tip],'#292c28',4);line([hand,tip],'#8a7757',2)
     dx,dy=tip[0]-hand[0],tip[1]-hand[1];length=max(1,math.hypot(dx,dy));nx,ny=-dy/length,dx/length
     base=(hand[0]+dx*.42,hand[1]+dy*.42)
     blade=[(base[0]-nx*2,base[1]-ny*2),(tip[0]-nx*2,tip[1]-ny*2),(tip[0]+nx*7,tip[1]+ny*7),(base[0]+nx*7,base[1]+ny*7)]
     poly(blade,'#323e3a');poly([(base[0],base[1]),tip,(tip[0]+nx*6,tip[1]+ny*6),(base[0]+nx*6,base[1]+ny*6)],'#a6ada0')
     line([(tip[0]+nx*6,tip[1]+ny*6),(base[0]+nx*6,base[1]+ny*6)],'#e1d7b6',1)
     if ai==0 or ai>5:line([(tip[0]+nx*2,tip[1]+ny*2),(base[0]+nx*4,base[1]+ny*4)],'#8b3239',2)
     if action=='hurt':
      # Readable stagger: torn scarf, raised shoulder, blood at the impact side.
      rect((cx-12,cy-3,cx-10,cy-2),'#d34d4e');rect((cx-15,cy+1,cx-14,cy+2),'#a9353c')
    atlas.alpha_composite(im,((direction*8+frame)*64,(ai*6+si)*64))
atlas.save(OUT)
print(OUT,atlas.size)
