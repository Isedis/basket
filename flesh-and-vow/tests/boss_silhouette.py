"""Check complete rendered body alpha, excluding the separately held axe."""
import argparse,json,subprocess,tempfile
from pathlib import Path
from collections import deque
from PIL import Image

def chunks(path):
    image=Image.open(path).getchannel('A')
    bounds=image.getbbox()
    if not bounds:return []
    image=image.crop(bounds)
    width,height=image.size
    pixels=image.tobytes()
    seen=bytearray(width*height)
    counts=[]
    for start,alpha in enumerate(pixels):
        if alpha<128 or seen[start]:continue
        seen[start]=1
        queue=deque([start]);count=0
        while queue:
            current=queue.popleft();count+=1
            x,y=current%width,current//width
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    nx,ny=x+dx,y+dy
                    if nx<0 or ny<0 or nx>=width or ny>=height:continue
                    index=ny*width+nx
                    if not seen[index] and pixels[index]>=128:
                        seen[index]=1;queue.append(index)
        if count>=8:counts.append(count)
    return sorted(counts,reverse=True)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--godot',default='godot')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--existing-display',action='store_true')
    p.add_argument('--pack',type=Path,action='append',default=[])
    args=p.parse_args()
    with tempfile.TemporaryDirectory(prefix='boss-silhouette-') as temp:
        command=[args.godot,'--path',str(args.project.resolve()),'--audio-driver','Dummy','--script','res://tests/boss_silhouette.gd','--',temp]
        command.extend(str(pack.resolve()) for pack in args.pack)
        if not args.existing_display:command=['xvfb-run','-a','--server-args=-screen 0 960x540x24',*command]
        run=subprocess.run(command,capture_output=True,text=True,timeout=240)
        if run.returncode or 'SCRIPT ERROR:' in run.stdout+run.stderr or '\nERROR:' in run.stdout+run.stderr:
            raise RuntimeError(run.stdout+run.stderr)
        folder=Path(temp);cases=json.loads((folder/'cases.json').read_text())
        failures=[]
        for i,case in enumerate(cases):
            counts=chunks(folder/f'{i:04d}.png')
            if len(counts)!=1:failures.append({'case':case,'chunks':counts})
            if 'wrist' in case:
                image=Image.open(folder/f'{i:04d}.png').getchannel('A')
                x,y=map(round,case['wrist'])
                patch=image.crop((x-3,y-3,x+4,y+4))
                if sum(value>=128 for value in patch.tobytes())<2:
                    failures.append({'case':case,'error':'Held axe wrist has no connected opaque hand'})
        layer_cases=json.loads((folder/'layers.json').read_text())
        checks=0
        old_wrong=0
        covered={look:0 for look in range(4)}
        forward_contact=0
        for i,case in enumerate(layer_cases):
            pictures={key:Image.open(folder/f'layer-{i:02d}-{key}.png').convert('RGBA').tobytes() for key in ['all','arm','core','original']}
            matches=0
            for offset in range(0,len(pictures['all']),4):
                arm=pictures['arm'][offset:offset+4]
                core=pictures['core'][offset:offset+4]
                if arm[3]<250 or core[3]<250 or arm[:3]==core[:3]:continue
                expected=arm if case['front'] else core
                actual=pictures['all'][offset:offset+4]
                old=pictures['original'][offset:offset+4]
                matches+=1;checks+=1
                if actual!=expected:failures.append({'layer':case,'pixel':offset//4,'expected':list(expected),'actual':list(actual)})
                if old!=expected:old_wrong+=1
            covered[case['look']]+=matches
            if case['look']==0 and case['ratio']>0:forward_contact+=matches
        if failures:raise AssertionError(json.dumps(failures[:12],indent=2))
        if not all(covered.values()) or forward_contact<20:raise AssertionError(f'Insufficient observed arm/torso overlap: {covered}; forward strike {forward_contact}')
        if old_wrong==0:raise AssertionError('Layer regression did not reproduce original incorrect overlap')
        print(f'ARM/TORSO DEPTH: {checks} overlapping pixels | WRONG DEPTH: 0 | ORIGINAL WRONG: {old_wrong}')
        print(f'RENDERED WHOLE-BODY SILHOUETTES: {len(cases)} | DETACHED BODY CHUNKS: 0')
if __name__=='__main__':main()
