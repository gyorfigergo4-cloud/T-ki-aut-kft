#!/usr/bin/env python3
"""Independent full-corpus verification against the original ZIP (no extraction)."""
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile

zip_path, bundle_path, report_path = map(Path, sys.argv[1:4])
bundle = json.loads(bundle_path.read_text('utf-8'))
assert bundle['report']['sourceZipSha256'] == hashlib.sha256(zip_path.read_bytes()).hexdigest()
sources = {source['path']: source for source in bundle['sources']}
notes_by_source = defaultdict(list)
ids = set()
for note in bundle['notes']:
    assert note['id'] not in ids
    ids.add(note['id'])
    notes_by_source[note['source']['path']].append(note)
verified_files = 0
verified_bytes = 0
with ZipFile(zip_path) as archive:
    text_entries = [entry for entry in archive.infolist() if not entry.is_dir() and entry.filename.lower().endswith('.txt')]
    assert len(sources) == len(text_entries)
    for entry in text_entries:
        source = sources[entry.filename]
        raw = archive.read(entry)
        assert hashlib.sha256(raw).hexdigest() == source['sha256']
        text = source['originalText']
        assert text.encode(source['encoding']) == raw, entry.filename
        imported = sorted(notes_by_source[entry.filename], key=lambda note: note['source']['startLine'])
        assert imported, entry.filename
        assert ''.join(note['source']['originalText'] for note in imported) == text, entry.filename
        lines = text.splitlines(keepends=True)
        cursor = 0
        for note in imported:
            info = note['source']
            assert info['startLine'] == cursor + 1
            assert info['originalText'] == ''.join(lines[cursor:info['endLine']])
            cursor = info['endLine']
            assert note['day'] == source['day']
            assert info['fileHash'] == source['sha256']
            assert info['bundleId'] == bundle['bundleId']
        assert cursor == len(lines)
        verified_files += 1
        verified_bytes += len(raw)
assert set(bundle['archive']['days']) == {source['day'] for source in sources.values()}
assert verified_files == bundle['report']['textFiles'] == bundle['report']['importedTextFiles']
report = {
    'verifiedTextFiles': verified_files, 'verifiedOriginalBytes': verified_bytes,
    'notes': len(ids), 'days': len(bundle['archive']['days']),
    'sourceTextExactRoundTrip': True, 'noMissingOrOverlappingSourceLines': True,
    'sourceZipSha256': bundle['report']['sourceZipSha256'],
    'filesByYear': dict(sorted(Counter(source['day'][:4] for source in sources.values()).items()))
}
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
