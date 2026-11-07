#!/usr/bin/env python3
"""Package the already-built Windows app and refresh the existing checked launcher."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
APP = DIST / 'TokiAuto-win32-x64'
EXE = APP / 'TokiAuto.exe'
if not EXE.is_file() or EXE.read_bytes()[:2] != b'MZ':
    raise SystemExit('First run: npm run package:win')
INNER = DIST / f'TokiAuto-program-{VERSION}.zip'
with zipfile.ZipFile(INNER, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted(APP.rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(DIST))
with zipfile.ZipFile(INNER) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Invalid program archive')
parts = []
checksum = hashlib.sha256()
with INNER.open('rb') as source:
    index = 1
    while chunk := source.read(40 * 1024 * 1024):
        name = f'TokiAuto.part{index:02d}'
        (ROOT / 'downloads' / name).write_bytes(chunk)
        checksum.update(chunk)
        parts.append({'file': name, 'size': len(chunk), 'sha256': hashlib.sha256(chunk).hexdigest()})
        index += 1
for file in (ROOT / 'downloads').glob('TokiAuto.part*'):
    if file.name not in {part['file'] for part in parts}:
        file.unlink()
manifest = {'product': 'TokiAuto', 'version': VERSION, 'sha256': checksum.hexdigest(),
            'exeSha256': hashlib.sha256(EXE.read_bytes()).hexdigest(), 'parts': parts}
(ROOT / 'downloads/package.json').write_text(json.dumps(manifest, indent=2) + '\n')
# The outer ZIP uses the original installer and its per-part/full-archive checks.
OUTPUT = DIST / f'TokiAuto-Kozos-Autonyilvantarto-{VERSION}.zip'
with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_STORED) as archive:
    for name in ['TokiAuto-Inditas.cmd', 'HALOZAT-BEALLITAS.txt', 'KEZDES-ITT.txt', 'RAKTAR-UTMUTATO.txt', 'downloads/package.json']:
        archive.write(ROOT / name, name)
    for part in parts:
        name = 'downloads/' + part['file']
        archive.write(ROOT / name, name)
with zipfile.ZipFile(OUTPUT) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Invalid download archive')
print(f'WINDOWS_DOWNLOAD_READY {OUTPUT} ({OUTPUT.stat().st_size} bytes)')
