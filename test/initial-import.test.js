const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const importer = require('../app/initial-import');
const store = require('../app/store');
const archiveStore = require('../app/archive-store');
const bundleId = 'txt-zip-' + 'a'.repeat(64);
const makeNote = (id, title) => ({ id, title, day: '2024-06-27', body: 'Árvíztűrő\r\nEredeti jegyzet', vin: '', part: 'A123', oil: '', fullPrice: '', discountPrice: '', created: '2024-06-27T12:00:00Z', updated: '2024-06-27T12:00:00Z' });
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'initial-import-'));
  const bundleFile = path.join(root, 'bundle.json'), dataDirectory = path.join(root, 'data');
  const bundle = { format: 'autobolt-initial-import', version: 1, bundleId, archive: { years: [2024, 2025, 2026], days: ['2024-06-27'] }, notes: [makeNote('imported', 'Régi ügyfél')] };
  fs.writeFileSync(bundleFile, JSON.stringify(bundle));
  return { root, bundleFile, dataDirectory, bundle };
}
test('első import, meglévő adat megőrzése, külön biztonsági másolat és ismételt indítás', () => {
  const s = setup();
  try {
    const file = path.join(s.dataDirectory, 'notes.json');
    const original = [makeNote('manual', 'Már meglévő ügyfél')];
    store.write(file, original); archiveStore.write(path.join(s.dataDirectory, 'archive.json'), { years: [2027], days: ['2027-01-05'] });
    assert.equal(importer.apply(s.dataDirectory, s.bundleFile).imported, 1);
    assert.equal(store.read(file).length, 2); assert.equal(store.read(file)[0].title, 'Már meglévő ügyfél');
    assert.deepEqual(store.read(path.join(s.dataDirectory, 'import-backups', bundleId, 'notes.json')), original);
    assert.ok(archiveStore.read(path.join(s.dataDirectory, 'archive.json')).years.includes(2027));
    assert.ok(archiveStore.read(path.join(s.dataDirectory, 'archive.json')).days.includes('2027-01-05'));
    assert.equal(importer.apply(s.dataDirectory, s.bundleFile).alreadyImported, true);
    store.write(file, [makeNote('manual', 'Már meglévő ügyfél')]);
    importer.apply(s.dataDirectory, s.bundleFile);
    assert.equal(store.read(file).length, 1, 'A törölt importált adatlap nem jelenhet meg újra indításkor');
  } finally { fs.rmSync(s.root, { recursive: true, force: true }); }
});
test('félbeszakadt import újrafuttatása nem írja felül a meglévő rekordot és nem dupláz', () => {
  const s = setup();
  try {
    store.write(path.join(s.dataDirectory, 'notes.json'), [makeNote('imported', 'Felhasználó által már módosítva')]);
    assert.equal(importer.apply(s.dataDirectory, s.bundleFile).imported, 0);
    assert.equal(store.read(path.join(s.dataDirectory, 'notes.json'))[0].title, 'Felhasználó által már módosítva');
    assert.equal(store.read(path.join(s.dataDirectory, 'notes.json')).length, 1);
  } finally { fs.rmSync(s.root, { recursive: true, force: true }); }
});
test('hibás import esetén az eredeti adatfájl nem változik', () => {
  const s = setup();
  try {
    const file = path.join(s.dataDirectory, 'notes.json'); store.write(file, [makeNote('manual', 'Eredeti')]);
    const original = fs.readFileSync(file, 'utf8');
    s.bundle.notes[0].day = '2026-02-30'; fs.writeFileSync(s.bundleFile, JSON.stringify(s.bundle));
    assert.throws(() => importer.apply(s.dataDirectory, s.bundleFile)); assert.equal(fs.readFileSync(file, 'utf8'), original);
  } finally { fs.rmSync(s.root, { recursive: true, force: true }); }
});
