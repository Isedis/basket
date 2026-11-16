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
        if failures:raise AssertionError(json.dumps(failures[:12],indent=2))
        print(f'RENDERED WHOLE-BODY SILHOUETTES: {len(cases)} | DETACHED BODY CHUNKS: 0')
if __name__=='__main__':main()
