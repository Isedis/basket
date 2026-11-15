"""Build immutable content packs from Godot's exported ZIP, without bundling the engine."""
from __future__ import annotations
import argparse, hashlib, json, os, re, subprocess, tempfile, zipfile
from pathlib import Path, PurePosixPath

RUNTIME = 'godot-4.6.3-patch-1'
ASSETS = 'https://github.com/Isedis/basket/releases/download/'

def digest(data): return hashlib.sha256(data).hexdigest()

def read_export(path):
    result = {}
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if name.endswith('/'): continue
            p = PurePosixPath(name)
            if p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name:
                raise ValueError('Invalid exported path: '+name)
            if name in result: raise ValueError('Duplicate exported path: '+name)
            result[name] = z.read(name)
    if 'build.json' not in result: raise ValueError('Export must include build.json')
    return result

def pack_files(files, removals, destination, project, godot):
    with tempfile.TemporaryDirectory(prefix='flesh-pack-') as temp:
        folder = Path(temp)
        entries = []
        for i, (name, data) in enumerate(sorted(files.items())):
            source = folder / str(i)
            source.write_bytes(data)
            entries.append({'path':name, 'source':str(source)})
        plan = folder / 'plan.json'
        plan.write_text(json.dumps({'files':entries,'removals':sorted(removals)}))
        subprocess.run([godot,'--headless','--path',str(project),'--script',
            'res://tools/pack_patch.gd','--',str(plan),str(destination.resolve())],check=True)
    if destination.read_bytes()[:4] != b'GDPC': raise ValueError('Missing PCK output')

def asset(path, version):
    data = path.read_bytes()
    return {'url':ASSETS+'flesh-v'+version+'/'+path.name,'sha256':digest(data),'size':len(data)}

def build(export, version, output, project, godot, previous_index=None, previous_feed=None):
    if not re.fullmatch(r'\d+\.\d+\.\d+',version): raise ValueError('Invalid version')
    output.mkdir(parents=True,exist_ok=True)
    files = read_export(export)
    if json.loads(files['build.json'])['version']!=version: raise ValueError('Build version mismatch')
    hashes = {name:digest(data) for name,data in sorted(files.items())}
    bootstrap = hashes['project.binary']+':'+hashes['scripts/patch_boot.gdc']
    prior = previous_index or {}
    feed = previous_feed or {}
    if prior.get('version')==version and prior.get('files')!=hashes:
        raise ValueError('Version is already published with different content; increment the version')
    compatible = prior.get('runtime')==RUNTIME and feed.get('runtime')==RUNTIME and prior.get('version')==feed.get('version') and prior.get('bootstrap')==bootstrap
    prior_files = prior.get('files',{}) if compatible else {}
    removed = (set(prior.get('removed',[])) | (set(prior_files)-set(files))) - set(files) if compatible else set()
    history = list(feed.get('patches',[])) if compatible else []
    changed = {n:data for n,data in files.items() if prior_files.get(n)!=hashes[n]}
    if compatible and prior['version']!=version:
        if tuple(map(int,version.split('.'))) <= tuple(map(int,prior['version'].split('.'))):
            raise ValueError('Version downgrade refused')
        path = output / ('patch-'+prior['version']+'-'+version+'.pck')
        pack_files(changed,set(prior_files)-set(files),path,project,godot)
        edge = asset(path,version)
        edge.update({'from':prior['version'],'to':version})
        history.append(edge)
    # Old clients can always skip a long/missing chain using this content-only snapshot.
    snapshot = output / 'content.pck'
    pack_files(files,removed,snapshot,project,godot)
    index = {'runtime':RUNTIME,'bootstrap':bootstrap,'version':version,'files':hashes,'removed':sorted(removed)}
    (output / 'content-index.json').write_text(json.dumps(index,sort_keys=True,indent=2))
    result = {'format':2,'runtime':RUNTIME,'bootstrap':bootstrap,'snapshot':asset(snapshot,version),'patches':history[-128:]}
    (output / 'content-manifest.json').write_text(json.dumps(result,indent=2))
    print(json.dumps({'export_files':len(files),'changed_files':len(changed),
        'removed_files':len(set(prior_files)-set(files)), 'snapshot_bytes':snapshot.stat().st_size,
        'patch_bytes':history[-1]['size'] if compatible and prior['version']!=version else None}))
    return result, index

if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--export',type=Path,required=True)
    parser.add_argument('--version',required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--project',type=Path,required=True)
    parser.add_argument('--godot',default=os.environ.get('GODOT','godot'))
    parser.add_argument('--previous-index',type=Path)
    parser.add_argument('--previous-feed',type=Path)
    args = parser.parse_args()
    load = lambda p: json.loads(p.read_text()) if p and p.exists() else None
    build(args.export,args.version,args.output,args.project,args.godot,
        load(args.previous_index),load(args.previous_feed))
