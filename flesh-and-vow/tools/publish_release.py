"""Publish full installers for migration and content-only updates for existing clients."""
import hashlib, json, os, re, subprocess, tempfile
from pathlib import Path
from build_content import build

repo = 'Isedis/basket'
project = Path('flesh-and-vow').resolve()
version = re.search(r'const VERSION = "([0-9.]+)"',(project/'scripts/updater.gd').read_text()).group(1)
tag = 'flesh-v'+version
dist = Path('dist').resolve()
exe = dist/'FleshAndVow-Windows/FleshAndVow.exe'
godot = os.environ.get('GODOT','Godot_v4.6.3-stable_linux.x86_64')

def gh(*args): return subprocess.run(['gh',*args],check=True)
def ensure_release(release,title,prerelease=False):
    result = subprocess.run(['gh','release','view',release,'--repo',repo],capture_output=True,text=True)
    if result.returncode:
        if 'not found' not in result.stderr.lower() and '404' not in result.stderr:
            raise RuntimeError(result.stderr)
        gh('release','create',release,'--repo',repo,'--title',title,'--notes',
           'Плоть и Обет. Распакуйте Windows-архив и запустите FleshAndVow.exe. Обновления 0.4.x передают изменённые файлы без движка.',
           '--latest=false',*(['--prerelease'] if prerelease else []))

ensure_release('flesh-latest','Плоть и Обет — канал обновлений',True)
with tempfile.TemporaryDirectory(prefix='flesh-previous-') as temp:
    folder = Path(temp)
    metadata = json.loads(subprocess.check_output(['gh','release','view','flesh-latest','--repo',repo,'--json','assets']))
    names = {a['name'] for a in metadata['assets']}
    for name in ['update.json','content-index.json']:
        if name in names: gh('release','download','flesh-latest','--repo',repo,'--pattern',name,'--dir',str(folder))
    load = lambda name: json.loads((folder/name).read_text()) if (folder/name).exists() else None
    content, index = build(dist/'content.zip',version,dist,project,godot,load('content-index.json'),load('update.json'))
subprocess.run([godot,'--headless','--path',str(project),'--script','res://tools/check_export.gd',
    '--',str(exe),str(dist/'content-index.json')],check=True)
manifest = {'version':version,'url':f'https://github.com/{repo}/releases/download/{tag}/FleshAndVow.exe',
    'sha256':hashlib.sha256(exe.read_bytes()).hexdigest(),'size':exe.stat().st_size,
    'notes':(project/'RELEASE_NOTES.txt').read_text().strip(),**content}
(dist/'update.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
ensure_release(tag,'Плоть и Обет '+version)
files = [exe,dist/'FleshAndVow-Windows.zip',dist/'update.json',dist/'content.pck',dist/'content-index.json',*sorted(dist.glob('patch-*.pck'))]
gh('release','upload',tag,*map(str,files),'--repo',repo,'--clobber')
# Release assets exist and have hashes before the discovery feed points to them.
gh('release','upload','flesh-latest',str(dist/'content-index.json'),'--repo',repo,'--clobber')
gh('release','upload','flesh-latest',str(dist/'update.json'),'--repo',repo,'--clobber')
