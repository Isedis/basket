"""Exercise real Godot PCK overlays, removals, skipped releases and immutable versions."""
import argparse, json, subprocess, sys, tempfile, zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--godot',default='godot')
parser.add_argument('--project',type=Path,required=True)
args = parser.parse_args()
project = args.project.resolve()
sys.path.insert(0,str(project/'tools'))
from build_content import build, read_export

def write_export(path,files):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for name,data in files.items(): z.writestr(name,data)

with tempfile.TemporaryDirectory(prefix='flesh content Ж ') as temp:
    root = Path(temp)
    files = {'build.json':b'{"version":"0.4.0"}', 'project.binary':b'stable-settings',
        'scripts/patch_boot.gdc':b'stable-bootstrap', 'fixture/stable.bin':b'UNCHANGED'*131072,
        'fixture/change.txt':b'before','fixture/deleted.txt':b'old',
        'fixture/behavior.gd':b'extends RefCounted\nstatic func answer(): return 1\n'}
    base_zip = root/'base.zip'
    write_export(base_zip,files)
    base, index = build(base_zip,'0.4.0',root/'v0',project,args.godot)
    base['version'] = '0.4.0'
    files.update({'build.json':b'{"version":"0.4.1"}','fixture/change.txt':b'after',
        'fixture/new.txt':b'added','fixture/behavior.gd':b'extends RefCounted\nstatic func answer(): return 2\n'})
    del files['fixture/deleted.txt']
    next_zip = root/'next.zip'
    write_export(next_zip,files)
    next_feed, next_index = build(next_zip,'0.4.1',root/'v1',project,args.godot,index,base)
    assert len(next_feed['patches'])==1
    assert next_feed['patches'][0]['size']<base['snapshot']['size']/100
    assert 'fixture/deleted.txt' in next_index['removed']
    reader = root/'reader.gd'
    reader.write_text('''extends SceneTree
func fail(label):
 push_error(label)
 quit(1)
func _initialize():
 var args = OS.get_cmdline_user_args()
 if not ProjectSettings.load_resource_pack(args[0],true):
  fail("Base pack could not be mounted")
  return
 if not ProjectSettings.load_resource_pack(args[1],true):
  fail("Overlay could not be mounted")
  return
 if FileAccess.get_file_as_string("res://fixture/change.txt")!="after":
  fail("Changed resource was not replaced")
  return
 if load("res://fixture/behavior.gd").answer()!=2:
  fail("New script code was not loaded")
  return
 if args[2]=="first":
  if FileAccess.file_exists("res://fixture/deleted.txt") or not FileAccess.file_exists("res://fixture/stable.bin"):
   fail("Removal or unchanged resource failed")
   return
 else:
  if FileAccess.get_file_as_string("res://fixture/deleted.txt")!="returned" or FileAccess.file_exists("res://fixture/stable.bin"):
   fail("Skipped-version snapshot did not preserve deletions and re-additions")
   return
 print("PCK OVERLAY PASS: "+args[2])
 quit()
''')
    def verify(path,mode):
        result = subprocess.run([args.godot,'--headless','--path',str(project),'--script',str(reader),
            '--',str(root/'v0/content.pck'),str(path),mode],text=True,capture_output=True,timeout=30)
        if result.returncode or 'ERROR' in result.stderr: raise AssertionError(result.stdout+result.stderr)
        print(result.stdout.strip())
    verify(root/'v1/patch-0.4.0-0.4.1.pck','first')
    verify(root/'v1/content.pck','first')
    next_feed['version'] = '0.4.1'
    files['build.json'] = b'{"version":"0.4.2"}'
    files['fixture/deleted.txt'] = b'returned'
    del files['fixture/stable.bin']
    third_zip = root/'third.zip'
    write_export(third_zip,files)
    third_feed, third_index = build(third_zip,'0.4.2',root/'v2',project,args.godot,next_index,next_feed)
    assert len(third_feed['patches'])==2
    assert 'fixture/deleted.txt' not in third_index['removed']
    verify(root/'v2/content.pck','skipped')
    changed = dict(files,**{'fixture/change.txt':b'version-reused'})
    duplicate = root/'duplicate.zip'
    write_export(duplicate,changed)
    third_feed['version'] = '0.4.2'
    try: build(duplicate,'0.4.2',root/'duplicate',project,args.godot,third_index,third_feed)
    except ValueError: pass
    else: raise AssertionError('Published version was reused with different content')
    unsafe = root/'unsafe.zip'
    write_export(unsafe,{'../escape':b'bad','build.json':b'{}'})
    try: read_export(unsafe)
    except ValueError: pass
    else: raise AssertionError('Unsafe exported path was accepted')
    print('CONTENT PACK CHECKS PASSED: script replacement, additions, removals, unchanged data, skipped versions, re-additions, immutable versions, path validation')
