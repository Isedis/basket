"""Run from repo root after exporting dist/FleshAndVow-Windows/FleshAndVow.exe."""
import hashlib,json,re,subprocess
from pathlib import Path
repo='Isedis/basket'
version=re.search(r'const VERSION = "([0-9.]+)"',Path('flesh-and-vow/scripts/updater.gd').read_text()).group(1)
tag='flesh-v'+version
exe=Path('dist/FleshAndVow-Windows/FleshAndVow.exe')
manifest={'version':version,'url':f'https://github.com/{repo}/releases/download/{tag}/FleshAndVow.exe','sha256':hashlib.sha256(exe.read_bytes()).hexdigest(),'size':exe.stat().st_size,'notes':Path('flesh-and-vow/RELEASE_NOTES.txt').read_text(encoding='utf-8').strip() if Path('flesh-and-vow/RELEASE_NOTES.txt').exists() else 'Обновление Плоть и Обет '+version}
Path('dist/update.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
def gh(*args): return subprocess.run(['gh',*args],check=True)
def ensure_release(release,title,prerelease=False):
    if subprocess.run(['gh','release','view',release,'--repo',repo],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
        gh('release','create',release,'--repo',repo,'--title',title,'--notes','Игра Плоть и Обет. Распакуйте Windows-архив и запустите FleshAndVow.exe.','--latest=false',*(['--prerelease'] if prerelease else []))
ensure_release(tag,'Плоть и Обет '+version)
gh('release','upload',tag,str(exe),'dist/FleshAndVow-Windows.zip','dist/update.json','--repo',repo,'--clobber')
ensure_release('flesh-latest','Плоть и Обет — канал обновлений',True)
gh('release','upload','flesh-latest','dist/update.json','--repo',repo,'--clobber')
