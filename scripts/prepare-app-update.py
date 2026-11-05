"""Create an application-only update and a one-time small migration ZIP."""
from pathlib import Path
import json,hashlib,zipfile,subprocess,sys
root=Path(__file__).resolve().parent.parent
pkg=json.loads((root/'package.json').read_text());version=pkg['version'];runtime=pkg['devDependencies']['electron']
app=root/'release/Opora-win32-x64'
files=[]
for file in sorted(app.rglob('*')):
 if file.is_file():
  name=file.relative_to(app).as_posix()
  if name not in ['Opora.exe','resources/app.asar','GUIDE.md','START-HERE.txt']:
   files.append(dict(name=name,sha256=hashlib.sha256(file.read_bytes()).hexdigest()))
meta=dict(version=version,runtimeVersion=runtime,files=files,appSha256=hashlib.sha256((app/'resources/app.asar').read_bytes()).hexdigest())
target=root/'distribution/app';target.mkdir(parents=True,exist_ok=True)
archive=target/'Opora-Windows.zip.part01'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 z.write(app/'resources/app.asar','Opora-win32-x64/resources/app.asar')
 z.writestr('Opora-win32-x64/runtime.json',json.dumps(meta))
patch=dict(runtimeVersion=runtime,size=archive.stat().st_size,sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),parts=[dict(name=archive.name,size=archive.stat().st_size,sha256=hashlib.sha256(archive.read_bytes()).hexdigest())])
(target/'manifest.json').write_text(json.dumps(patch,indent=2)+'\n')
subprocess.run([sys.executable,str(root/'scripts/prepare-launcher.py')],check=True)
cmd='''@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "OPORA_PACKAGE_ROOT=%~dp0"
cd /d "%TEMP%"
powershell.exe -NoLogo -NoProfile -Command "& ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $env:OPORA_PACKAGE_ROOT 'light-update.ps1'))))"
if errorlevel 1 pause
'''
with zipfile.ZipFile(root/'distribution/Opora-small-update.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.write(app/'resources/app.asar','new-app.asar')
 z.writestr('runtime.json',json.dumps(meta))
 z.write(root/'desktop/windows-install.ps1','update-helper.ps1')
 z.write(root/'scripts/light-bootstrap.ps1','light-update.ps1')
 z.write(root/'START-OPORA.cmd','NEW-START-OPORA.cmd')
 z.writestr('UPDATE-OPORA.cmd',cmd.replace('\n','\r\n'))
print(f'App update: {patch["size"]} bytes; migration ZIP: {(root/"distribution/Opora-small-update.zip").stat().st_size} bytes')
