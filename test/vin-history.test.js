const { test } = require('node:test');
const assert = require('node:assert/strict');
const History = require('../app/vin-history');
const Items = require('../app/items');
const vin = 'WVWZZZ1KZ6W123456';
const make = (id, day, changes = {}) => ({ id, day, title: 'Minta Péter', phone: '+36 30 000 0000', body: '', vehicles: [{ id: 'car-' + id, vin, brand: 'Volkswagen', oil: '' }], items: [], ...changes });

test('VIN-előzmény: teljes alvázszám és legalább hat karakteres részlet, kisbetű és formázási szóköz', () => {
  const notes = [make('old', '2024-05-12')];
  assert.equal(History.find(notes, '').length, 0);
  assert.equal(History.find(notes, '12345').length, 0);
  assert.equal(History.find(notes, '123456')[0].exact, false);
  assert.equal(History.find(notes, '  wvw zzz1k-z6w123456  ')[0].exact, true);
  assert.equal(History.find(notes, 'VW123456').length, 0);
});
test('csak a jármű alvázszáma egyezhet, a jelenlegi jegyzet nem saját előzmény', () => {
  const notes = [make('current', '2026-11-11'), make('unrelated', '2026-11-10', { body: vin, title: vin, vehicles: [{ id: 'different', vin: 'WAUZZZ8K09A111111', brand: 'Audi' }] })];
  assert.equal(History.find(notes, vin, 'current').length, 0);
  assert.equal(History.find(notes, '111111', 'current')[0].entries[0].noteId, 'unrelated');
});
test('azonos VIN egy csoport, újabb nap előbb, teljes egyezés a részletegyezés előtt', () => {
  const notes = [make('old', '2024-01-05'), make('recent', '2026-11-10'), make('partial', '2026-11-11', { vehicles: [{ id: 'p', vin: 'PREFIX-' + vin, brand: '' }] })];
  const result = History.find(notes, vin);
  assert.equal(result.length, 2);
  assert.equal(result[0].exact, true);
  assert.deepEqual(result[0].entries.map(entry => entry.noteId), ['recent', 'old']);
  assert.deepEqual(result[0].brands, ['Volkswagen']);
  assert.equal(result[0].multipleOwners, false);
});
test('több autó közül a megfelelő autóhoz tartozó előzmény és tétel, adatváltoztatás nélkül', () => {
  const note = make('two', '2025-03-06');
  note.vehicles.push({ id: 'other', vin: 'WBAHT71010G123456', brand: 'BMW' });
  note.items = [{ ...Items.blank('a'), vehicleId: 'car-two', partNumber: 'VW-ONLY', description: 'Első fékbetét' }, { ...Items.blank('b'), vehicleId: 'other', partNumber: 'BMW-ONLY', description: 'Másik autó tétele' }];
  const before = JSON.stringify(note), entry = History.find([note], vin)[0].entries[0];
  assert.equal(entry.vehicleId, 'car-two');
  assert.match(entry.summary, /Első fékbetét/);
  assert.doesNotMatch(entry.summary, /BMW-ONLY|Másik autó/);
  assert.equal(JSON.stringify(note), before);
});
test('több ügyfél vagy eltérő telefon esetén külön ügyfélválasztás szükséges', () => {
  const first = make('a', '2026-11-01'), second = make('b', '2026-11-02', { title: 'Másik ügyfél' });
  assert.equal(History.find([first, second], vin)[0].multipleOwners, true);
  second.title = first.title; second.phone = '+36 30 999 9999';
  assert.equal(History.find([first, second], vin)[0].multipleOwners, true);
  second.phone = '+36 (30) 000-0000';
  assert.equal(History.find([first, second], vin)[0].multipleOwners, false);
});
test('régi, csak vin mezős jegyzet és több alvázszámos import is megtalálható', () => {
  const note = { id: 'legacy', title: 'Régi minta', day: '2024-06-27', vin: vin + ' / WBAHT71010G123456', body: 'Eredeti szöveg', items: [] };
  const result = History.find([note], vin);
  assert.equal(result.length, 1); assert.equal(result[0].entries[0].vehicleId, 'legacy-vin-1'); assert.equal(result[0].entries[0].summary, 'Eredeti szöveg');
});
