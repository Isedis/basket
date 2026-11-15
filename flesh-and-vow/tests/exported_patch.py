"""Prove compiled game scripts load from a small overlay before the main scene starts."""
import argparse, hashlib, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--godot',default='godot')
parser.add_argument('--project',type=Path,required=True)
args=parser.parse_args()
source=args.project.resolve()
sys.path.insert(0,str(source/'tools'))
from build_content import build
def run(cmd,log,env=None):
    with log.open('w') as f: result=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,env=env,timeout=120)
    text=log.read_text()
    if result.returncode or 'ERROR' in text: raise RuntimeError(text[-4000:])
    return text
with tempfile.TemporaryDirectory(prefix='flesh-export-patch-') as temp:
    root=Path(temp)
    version=json.loads((source/'build.json').read_text())['version']
    parts=list(map(int,version.split('.')));parts[2]+=1
    next_version='.'.join(map(str,parts))
    run([args.godot,'--headless','--path',str(source),'--export-pack','Windows Desktop',str(root/'base.zip')],root/'base-export.log')
    base_feed,base_index=build(root/'base.zip',version,root/'base-assets',source,args.godot)
    base_feed['version']=version
    candidate=root/'candidate'
    shutil.copytree(source,candidate,ignore=shutil.ignore_patterns('.godot','.git','build','__pycache__'))
    (candidate/'build.json').write_text(json.dumps({'version':next_version}))
    path=candidate/'scripts/updater.gd'
    path.write_text(path.read_text().replace('const VERSION = "'+version+'"','const VERSION = "'+next_version+'"'))
    path=candidate/'scripts/game.gd'
    text=path.read_text()
    assert 'func _ready():\n' in text
    path.write_text(text.replace('func _ready():\n','func _ready():\n\tset_meta("export_patch_probe",true)\n',1))
    run([args.godot,'--headless','--path',str(candidate),'--editor','--import','--quit'],root/'candidate-import.log')
    run([args.godot,'--headless','--path',str(candidate),'--export-pack','Windows Desktop',str(root/'candidate.zip')],root/'candidate-export.log')
    feed,index=build(root/'candidate.zip',next_version,root/'candidate-assets',source,args.godot,base_index,base_feed)
    assert len(feed['patches'])==1, 'Unexpected bootstrap incompatibility'
    patch=root/'candidate-assets'/('patch-'+version+'-'+next_version+'.pck')
    assert patch.stat().st_size<base_feed['snapshot']['size']/10
    folder=root/'updates';folder.mkdir()
    data=patch.read_bytes();sha=hashlib.sha256(data).hexdigest();name=sha+'.pck'
    (folder/name).write_bytes(data)
    catalog={'runtime':feed['runtime'],'base_version':version,'version':next_version,'packs':[{'file':name,'sha256':sha,'size':len(data),'from':version,'to':next_version}]}
    (folder/'active.json').write_text(json.dumps(catalog))
    reader=root/'verify.gd'
    script='''extends SceneTree
func _initialize(): call_deferred("run")
func run():
 var boot = load("res://scripts/patch_boot.gd").new()
 boot.storage_root = FOLDER
 root.add_child(boot)
 await create_timer(0.3).timeout
 var state = ProjectSettings.get_meta("flesh_patch_state",{})
 if state.get("version")!=NEXT or load("res://scripts/updater.gd").VERSION!=NEXT or current_scene==null:
  push_error("Patched startup/version failed")
  quit(1)
  return
 var game = current_scene
 game.new_run(342)
 if not game.get_meta("export_patch_probe",false):
  push_error("Old game script remained cached")
  quit(1)
  return
 if "recovery" in OS.get_cmdline_user_args() and str(ProjectSettings.get_meta("flesh_patch_warning","")).is_empty():
  push_error("Damaged overlay recovery was not reported")
  quit(1)
  return
 game.delete_run()
 print("EXPORTED PATCH BOOT PASS: "+state.version)
 quit()
'''.replace('FOLDER',json.dumps(str(folder))).replace('NEXT',json.dumps(next_version))
    reader.write_text(script)
    env=dict(os.environ,XDG_DATA_HOME=str(root/'userdata'))
    cmd=[args.godot,'--headless','--main-pack',str(root/'base.zip'),'--script',str(reader)]
    print(run(cmd,root/'boot.log',env))
    # Corrupt current catalog and truncated pack both fall back before mounting anything.
    (folder/'active.previous.json').write_text(json.dumps(catalog))
    (folder/'active.json').write_text('broken json')
    print(run(cmd+['--','recovery'],root/'recovery-json.log',env))
    bad=folder/('f'*64+'.pck');bad.write_bytes(b'GDPCtruncated')
    damaged=json.loads(json.dumps(catalog));damaged['packs'][0].update({'file':bad.name,'sha256':'f'*64})
    (folder/'active.json').write_text(json.dumps(damaged))
    print(run(cmd+['--','recovery'],root/'recovery-pack.log',env))
    print('REAL COMPILED PATCH: bytes=%d, content_snapshot=%d; startup, ordinary run, corrupt JSON and truncated pack recovery passed'%(len(data),base_feed['snapshot']['size']))
