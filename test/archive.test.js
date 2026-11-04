const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const archiveStore = require('../app/archive-store');
const { normalize, validDay } = require('../app/archive');
test('üres év és nap megőrzése, biztonsági másolat és sérült dátum elutasítása', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-'));
  try {
    const file = path.join(dir, 'archive.json');
    assert.deepEqual(archiveStore.read(file), { years: [2024, 2025, 2026], days: [] });
    const data = { years: [2024, 2025, 2026, 2027], days: ['2027-01-05'] };
    archiveStore.write(file, data); assert.deepEqual(archiveStore.read(file), data);
    archiveStore.write(file, { ...data, years: [...data.years, 2028] }); assert.deepEqual(archiveStore.read(file + '.bak'), data);
    assert.throws(() => archiveStore.write(file, { years: [2024], days: ['2025-02-29'] }));
    assert.throws(() => archiveStore.write(file, { years: ['2027'], days: [] }));
    assert.equal(validDay('2024-02-29'), true); assert.equal(validDay('2026-02-30'), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('korábbi adatlapok mappába sorolása mezők és névenkénti adatok összevonása nélkül', () => {
  const data = [
    { id: 'a', title: 'Péter', body: 'Korábbi szöveg', vin: 'VIN123', part: 'A\nB', oil: '5W-30', fullPrice: '100', discountPrice: '80', created: '2025-01-01T12:00:00Z', updated: '2026-01-01T12:00:00Z' },
    { id: 'b', title: 'János', body: 'Másik ügyfél', updated: '2025-01-01T13:00:00Z' }
  ];
  const result = normalize(data, { years: [2027], days: ['2027-01-05'] });
  assert.deepEqual(result.years, [2024, 2025, 2026, 2027]);
  assert.deepEqual(result.days, ['2025-01-01', '2027-01-05']); assert.equal(result.notes.length, 2);
  assert.equal(result.notes[0].day, '2025-01-01');
  for (const key of Object.keys(data[0])) assert.equal(result.notes[0][key], data[0][key]);
  assert.equal(result.notes[1].title, 'János');
  assert.deepEqual(normalize(result.notes, { years: result.years, days: result.days }), result);
});
