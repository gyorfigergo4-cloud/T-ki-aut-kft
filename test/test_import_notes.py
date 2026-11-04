import datetime
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('import_notes', Path(__file__).resolve().parents[1] / 'scripts' / 'import-notes.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ImportNotesTest(unittest.TestCase):
    def test_split_preserves_original_and_customer_boundaries(self):
        text = '\ufeffAnna Kész\r\nWVWZZZ1KZ6W123456\r\nA123 10.000Ft-6000Ft\r\n\r\nBéla Kész\r\nB456 7000Ft-4000Ft\r\n\r\n99-ABC 5000Ft\r\n'
        blocks = module.split_notes(text)
        self.assertEqual(len(blocks), 2)
        self.assertEqual(''.join(block[2] for block in blocks), text)
        self.assertIn('99-ABC', blocks[1][2])
        fields = module.extract_fields(blocks[0][2])
        self.assertEqual(fields['vin'], 'WVWZZZ1KZ6W123456')
        self.assertEqual(fields['fullPrice'], '10000')
        self.assertEqual(fields['discountPrice'], '6000')
        self.assertIn('A123 10.000Ft-6000Ft', fields['part'])

    def test_prices_are_not_guessed_or_added(self):
        fields = module.extract_fields('Anna\nA123 10.000Ft/db-6000Ft/db x2\nB456 5000Ft-3000Ft')
        self.assertEqual(fields['fullPrice'], '')
        self.assertEqual(fields['discountPrice'], '')
        self.assertIn('x2', fields['body'])
        fields = module.extract_fields('Anna\nA123 30.000Ft-18.00Ft')
        self.assertEqual(fields['discountPrice'], '')
        fields = module.extract_fields('Anna\nA123 30.000Ft-18.000Ft\nB456')
        self.assertEqual(fields['fullPrice'], '')

    def test_dates_are_taken_from_names_and_overrides_not_later_modification(self):
        for name in ['05.30.txt', '05,30.txt', '05.30..txt', '05.30 (2).txt']:
            self.assertEqual(module.parse_day('Jegyzetek/2024/Május/' + name, (2025, 1, 1, 0, 0, 0)), ('2024-05-30', 'filename'))
        name = 'Jegyzetek/2024/Június/Ügyfél.txt'
        self.assertEqual(module.parse_day(name, (2024, 6, 27, 16, 0, 0)), (None, 'missing-date'))
        self.assertEqual(module.parse_day(name, (2024, 6, 27, 16, 0, 0), overrides={name: '2024-06-27'}), ('2024-06-27', 'user-confirmed'))
        with self.assertRaises(ValueError):
            module.parse_day('Jegyzetek/2024/Június/05.30.txt', (2024, 6, 27, 16, 0, 0))

    def test_whole_archive_roundtrip_and_metadata_files(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'notes.zip'
            first = 'Anna Kész\r\nA123 10000Ft-6000Ft\r\n\r\nBéla Kész\r\nOlaj 5w30 4l\r\n'
            second = 'Második külön fájl\nMinden sor megmarad.'
            with zipfile.ZipFile(archive, 'w') as z:
                z.writestr('Jegyzetek/2024/Május/05.30.txt', first.encode('utf-8'))
                z.writestr('Jegyzetek/2024/Május/05.30 (2).txt', second.encode('utf-8'))
                z.writestr('Jegyzetek/desktop.ini', '[settings]')
            bundle = module.build(archive)
            self.assertEqual(bundle['report']['textFiles'], 2)
            self.assertEqual(bundle['archive']['days'], ['2024-05-30'])
            self.assertEqual(len(bundle['report']['skippedFiles']), 1)
            for source in bundle['sources']:
                records = sorted((n for n in bundle['notes'] if n['source']['path'] == source['path']), key=lambda n: n['source']['startLine'])
                self.assertEqual(''.join(n['source']['originalText'] for n in records), source['originalText'])
            self.assertEqual(len({n['id'] for n in bundle['notes']}), len(bundle['notes']))

    def test_unsafe_archive_path_is_rejected_without_extraction(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'notes.zip'
            with zipfile.ZipFile(archive, 'w') as z:
                z.writestr('../unsafe.txt', 'No execution, no extraction')
            with self.assertRaises(ValueError):
                module.build(archive)

if __name__ == '__main__':
    unittest.main()
