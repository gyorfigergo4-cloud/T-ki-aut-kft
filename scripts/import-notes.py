#!/usr/bin/env python3
"""Convert an existing TXT archive without executing or extracting its contents.

All source text is retained. The bundle is private customer data, not source code.
"""
import argparse
import codecs
import datetime as dt
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
from zoneinfo import ZoneInfo

MONTHS = {name: i + 1 for i, name in enumerate(['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'])}
DATE_NAME = re.compile(r'^(\d{1,2})[.,](\d{1,2})\.*(?: \(\d+\))?\.txt$', re.I)
VIN = re.compile(r'(?<![A-Z0-9])[A-HJ-NPR-Z0-9]{17}(?![A-Z0-9])', re.I)
OIL = re.compile(r'\b\d{1,2}\s*w\s*[- ]?\s*\d{2}\b|\bsae\s*\d+|\b(?:dexos|eneos|castrol|motul)\b|\bmobil\s*(?:1|super|[0-9])', re.I)
AMOUNT = r'(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?'
PAIR = re.compile(r'(?<![\w.,])(' + AMOUNT + r')\s*(?:Ft)?\s*[-–]\s*(' + AMOUNT + r')\s*Ft(?!\w)', re.I)
PRICE = re.compile(r'(?<![\w.,])(' + AMOUNT + r')\s*Ft(?!\w)', re.I)
DATA_WORDS = re.compile(r'^(?:olaj\b|olajsz[űü]r|leveg[őö]sz[űü]r|légsz[űü]r|pollensz[űü]r|sz[űü]r[őö]|gyári\b|rendel|összesen|telibe|teli ár|kedvezmény|saját\b|hajtókar|dugat|csapágy|vezér|tömítés|henger|főtengely|szívósor|vákuum|kipuf|szimering|fagyálló|nincsen\b|nincs\b)', re.I)
SUPPLIER = re.compile(r'\b(?:Ft|AP|IC|UNIX|LÁNG|SZAKÁL|BÁRDI|AUTONET|UNITRACK|IVANICS)\b', re.I)
TIMEZONE = ZoneInfo('Europe/Budapest')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def decode(raw):
    if raw.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return raw.decode('utf-16'), 'utf-16'
    try:
        return raw.decode('utf-8'), 'utf-8'
    except UnicodeDecodeError:
        return raw.decode('cp1250'), 'cp1250'


def parse_day(name, modified, use_modified=False, overrides=None):
    parts = PurePosixPath(name).parts
    year = next((int(p) for p in parts if re.fullmatch(r'20\d{2}', p)), None)
    month = next((MONTHS[p.casefold()] for p in parts if p.casefold() in MONTHS), None)
    if not year or not month:
        raise ValueError('Missing year/month folder: ' + name)
    if name in (overrides or {}):
        return dt.date.fromisoformat(overrides[name]).isoformat(), 'user-confirmed'
    match = DATE_NAME.fullmatch(parts[-1])
    if match:
        if int(match[1]) != month:
            raise ValueError('Filename month and folder disagree: ' + name)
        return dt.date(year, month, int(match[2])).isoformat(), 'filename'
    if not use_modified:
        return None, 'missing-date'
    if tuple(modified[:2]) != (year, month):
        raise ValueError('Modified date outside its folder: ' + name)
    return dt.date(*modified[:3]).isoformat(), 'file-modified'


def vins(text):
    return list(dict.fromkeys(match[0].upper() for match in VIN.finditer(text) if re.search('[A-Za-z]', match[0]) and re.search('[0-9]', match[0])))


def line_type(line):
    value = line.strip().lstrip('\ufeff')
    if not value:
        return 'blank'
    if PRICE.search(value) or DATA_WORDS.search(value) or OIL.search(value):
        return 'continuation'
    if re.search(r'\bkész\b', value, re.I) and len(value) <= 90 and re.match(r'[^\W\d_]', value, re.UNICODE):
        return 'name'
    if vins(value) or re.match(r'^[\d\W]', value) or re.search(r'[A-Za-z]\d|\d[A-Za-z]', value) or SUPPLIER.search(value):
        return 'continuation'
    # A plain short heading is used as the customer's original label, not corrected.
    if len(value) <= 65 and re.fullmatch(r'[^\W\d_][\w\s.\-/()ÁÉÍÓÖŐÚÜŰáéíóöőúüű]*', value, re.UNICODE) and not re.search(r'\d', value):
        return 'name'
    return 'uncertain'


def split_notes(text, named_file=False):
    lines = text.splitlines(keepends=True)
    if named_file or not lines:
        return [(0, len(lines), text, 'named-file')]
    starts = [0]
    classifications = ['name' if line_type(next((line for line in lines if line.strip().lstrip('\ufeff')), '')) == 'name' else 'uncertain']
    for index, line in enumerate(lines):
        if not line.strip().lstrip('\ufeff'):
            continue
        previous_blank = index > 0 and not lines[index - 1].strip().lstrip('\ufeff')
        kind = line_type(line)
        strong_header = kind == 'name' and bool(re.search(r'\bkész\b', line, re.I))
        if index > 0 and (previous_blank and kind in ('name', 'uncertain') or strong_header):
            # The initial blank/BOM prefix remains attached to the first entry.
            if not ''.join(lines[starts[-1]:index]).strip().lstrip('\ufeff'):
                classifications[-1] = kind
                continue
            starts.append(index)
            classifications.append(kind)
    result = []
    for offset, start in enumerate(starts):
        end = starts[offset + 1] if offset + 1 < len(starts) else len(lines)
        result.append((start, end, ''.join(lines[start:end]), classifications[offset]))
    assert ''.join(block[2] for block in result) == text
    return result


def amount(value):
    return value.replace('.', '').replace(',', '.')


def extract_fields(text):
    clean = text.replace('\r\n', '\n').replace('\r', '\n').lstrip('\ufeff').strip()
    lines = [line.strip() for line in clean.splitlines() if line.strip()]
    oil_lines = [line for line in lines[1:] if OIL.search(line)]
    part_lines = []
    for line in lines[1:]:
        if line in oil_lines or (VIN.fullmatch(line) and vins(line)):
            continue
        if re.search(r'\d', line) and not re.match(r'^(?:telibe|teli ár|kedvezmény|összesen)\b', line, re.I):
            part_lines.append(line)
    all_prices = [line for line in lines[1:] if PRICE.search(line)]
    full_price = discount_price = ''
    # Never add together multi-item prices, quantities or multiple vehicle totals.
    if len(all_prices) == 1 and len(part_lines) + len(oil_lines) == 1 and len(list(PAIR.finditer(all_prices[0]))) == 1 and not re.search(r'/\s*db\b|\bx\s*\d|\b\d+\s*db\b', all_prices[0], re.I):
        match = PAIR.search(all_prices[0])
        if match and len(PRICE.findall(all_prices[0])) <= 2:
            full, discount = amount(match[1]), amount(match[2])
            if float(discount) <= float(full):
                full_price, discount_price = full, discount
    return {'vin': ' / '.join(vins(clean)), 'part': '\n'.join(part_lines), 'oil': '; '.join(oil_lines), 'fullPrice': full_price, 'discountPrice': discount_price, 'body': clean}


def build(zip_path, use_modified=False, overrides=None):
    original_zip = Path(zip_path).read_bytes()
    bundle_id = 'txt-zip-' + sha(original_zip)
    notes, sources, skipped, warnings = [], [], [], []
    date_stats = Counter()
    with ZipFile(zip_path) as archive:
        entries = archive.infolist()
        if len(entries) > 20000 or sum(i.file_size for i in entries) > 100_000_000:
            raise ValueError('Archive exceeds the import size limit')
        seen_names = set()
        for entry in entries:
            if entry.is_dir():
                continue
            name = unicodedata.normalize('NFC', entry.filename.replace('\\', '/'))
            parts = PurePosixPath(name).parts
            if name.startswith('/') or '..' in parts or re.match(r'^[A-Za-z]:', name) or name in seen_names:
                raise ValueError('Unsafe or duplicate archive path')
            seen_names.add(name)
            if not name.lower().endswith('.txt'):
                skipped.append({'path': name, 'reason': 'not-a-text-note'})
                continue
            raw = archive.read(entry)
            text, encoding = decode(raw)
            file_hash = sha(raw)
            day, date_basis = parse_day(name, entry.date_time, use_modified, overrides)
            source = {'path': name, 'sha256': file_hash, 'encoding': encoding, 'sizeBytes': len(raw), 'originalText': text, 'day': day, 'dateBasis': date_basis}
            sources.append(source)
            if not day:
                warnings.append({'path': name, 'reason': 'missing-date'})
                continue
            date_stats[date_basis] += 1
            named_file = DATE_NAME.fullmatch(PurePosixPath(name).name) is None
            blocks = split_notes(text, named_file)
            source['noteIds'] = []
            covered = ''
            for index, (start, end, block, classification) in enumerate(blocks):
                covered += block
                first_line = next((line.strip().lstrip('\ufeff') for line in block.splitlines() if line.strip().lstrip('\ufeff')), '')
                title = PurePosixPath(name).stem if named_file else first_line if classification == 'name' or len(first_line) <= 80 else 'Egyéb jegyzet · ' + str(index + 1)
                note_id = 'txt-' + sha((name + '\0' + file_hash + '\0' + str(start)).encode('utf-8'))[:32]
                created = dt.datetime.combine(dt.date.fromisoformat(day), dt.time(12), TIMEZONE) + dt.timedelta(seconds=index)
                modified = dt.datetime(*entry.date_time, tzinfo=TIMEZONE)
                note = {'id': note_id, 'title': title, 'day': day, 'created': created.isoformat(), 'updated': modified.isoformat(), **extract_fields(block), 'source': {'bundleId': bundle_id, 'path': name, 'fileHash': file_hash, 'startLine': start + 1, 'endLine': end, 'originalText': block, 'dateBasis': date_basis, 'classification': classification}}
                notes.append(note)
                source['noteIds'].append(note_id)
                if classification == 'uncertain':
                    warnings.append({'path': name, 'noteId': note_id, 'reason': 'unclassified-heading', 'heading': first_line[:120]})
            assert covered == text, name
    days = sorted({source['day'] for source in sources if source['day']})
    years = sorted({2024, 2025, 2026, *(int(day[:4]) for day in days)})
    notes.sort(key=lambda note: (note['day'], note['created']))
    report = {
        'sourceZipSha256': sha(original_zip), 'textFiles': len(sources), 'importedTextFiles': sum(bool(source['day']) for source in sources),
        'days': len(days), 'notes': len(notes), 'byYear': dict(sorted(Counter(note['day'][:4] for note in notes).items())),
        'filesByYear': dict(sorted(Counter(source['day'][:4] for source in sources if source['day']).items())),
        'dateSources': dict(date_stats), 'skippedFiles': skipped, 'warnings': warnings,
        'originalTextCoverage': 'All dated text files reconstructed exactly from note source spans.',
        'pricePolicy': 'No automatic totals. Only a single unambiguous price pair without per-piece quantities is copied to total fields. All original price lines are preserved.'
    }
    return {'format': 'autobolt-initial-import', 'version': 1, 'bundleId': bundle_id, 'archive': {'years': years, 'days': days}, 'notes': notes, 'sources': sources, 'report': report}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('zip')
    parser.add_argument('--output', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--use-modified-for-undated', action='store_true')
    parser.add_argument('--date-overrides', help='JSON mapping of archive paths to YYYY-MM-DD')
    args = parser.parse_args()
    overrides = json.loads(Path(args.date_overrides).read_text('utf-8')) if args.date_overrides else None
    bundle = build(args.zip, args.use_modified_for_undated, overrides)
    for target, value in [(args.output, bundle), (args.report, bundle['report'])]:
        path = Path(target)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: bundle['report'][key] for key in ['textFiles', 'importedTextFiles', 'days', 'notes', 'filesByYear', 'dateSources']}, ensure_ascii=False))
    print('Unclassified headings:', sum(w['reason'] == 'unclassified-heading' for w in bundle['report']['warnings']))
    print('Missing dates:', sum(w['reason'] == 'missing-date' for w in bundle['report']['warnings']))

if __name__ == '__main__':
    main()
