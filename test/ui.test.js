const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
const copy = value => JSON.parse(JSON.stringify(value));
async function openUI(saved) {
  const dom = new JSDOM(fs.readFileSync('app/index.html', 'utf8'), { runScripts: 'outside-only', url: 'https://notes.local' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.notesAPI = {
    load: async () => copy(saved.notes), loadArchive: async () => copy(saved.archive),
    save: async notes => { saved.notes = copy(notes); }, saveArchive: async archive => { saved.archive = copy(archive); },
    export: async () => true
  };
  for (const script of ['archive.js', 'renderer.js']) window.eval(fs.readFileSync('app/' + script, 'utf8'));
  await tick();
  const $ = id => window.document.getElementById(id);
  const input = (id, value) => { $(id).value = value; $(id).dispatchEvent(new window.Event('input')); };
  const submit = id => $(id).dispatchEvent(new window.Event('submit', { cancelable: true }));
  const newDay = day => { $('add-day').click(); $('day-value').value = day; submit('day-form'); };
  const cards = () => [...$('list').querySelectorAll('.note')];
  return { dom, $, input, submit, newDay, cards };
}
test('év/hónap/nap mappák, napi több név, visszakeresés és újranyitás', async () => {
  const saved = { notes: [{ id: 'old', title: 'Régi ügyfél', body: 'Korábbi egyeztetés', updated: '2024-01-15T12:00:00Z' }], archive: { years: [2024, 2025, 2026], days: [] } };
  let ui = await openUI(saved);
  const { $, input, submit, newDay, cards } = ui;
  assert.deepEqual([...$('folders').querySelectorAll('[data-year]')].map(el => el.dataset.year), ['2024', '2025', '2026']);
  assert.equal($('title').value, 'Régi ügyfél');
  assert.equal($('folders').querySelector('[data-day="2024-01-15"]').getAttribute('aria-current'), 'true');
  newDay('2026-11-04'); await tick();
  assert.equal(cards().length, 0); assert.equal($('editor').hidden, true);
  $('new').click();
  for (const [id, value] of Object.entries({ title: 'Kovács Péter', vin: 'WVWZZZ1KZ6W123456', part: '0986479123\nMANN HU 719/7 x', oil: 'Castrol EDGE 5W-30, 4,5 liter', fullPrice: '25000', discountPrice: '20000', body: 'Olajcsere' })) input(id, value);
  await tick();
  const firstId = saved.notes.find(note => note.title === 'Kovács Péter').id;
  assert.equal(saved.notes.find(note => note.id === firstId).day, '2026-11-04');
  assert.match($('price-summary').textContent, /20%/);
  $('new').click(); input('title', 'Nagy László'); input('part', 'BOSCH ABC-456'); await tick();
  assert.equal(cards().length, 2); assert.equal(saved.notes.length, 3);
  $('list').querySelector('[data-note="' + firstId + '"]').click();
  assert.equal($('title').value, 'Kovács Péter'); assert.equal($('part').value, '0986479123\nMANN HU 719/7 x');
  assert.equal($('oil').value, 'Castrol EDGE 5W-30, 4,5 liter');
  newDay('2026-11-05'); $('new').click(); input('title', 'Másnapi ügyfél'); await tick();
  assert.equal(cards().length, 1); assert.equal(saved.notes.length, 4);
  $('folders').querySelector('[data-day="2026-11-04"]').click(); assert.equal(cards().length, 2);
  newDay('2026-11-04'); await tick(); assert.equal(saved.notes.length, 4); assert.equal(cards().length, 2);
  for (const term of ['kovacs', '123456', 'MANN', 'Castrol', '5W-30', '25000', '20000']) {
    input('search', term); assert.equal(cards().length, 1, term); assert.equal($('title').value, 'Kovács Péter');
  }
  input('search', 'regi'); assert.equal(cards().length, 1); assert.equal($('title').value, 'Régi ügyfél');
  input('search', 'nincsilyen'); assert.equal(cards().length, 0); assert.equal($('editor').hidden, true);
  $('clear').click(); assert.equal(cards().length, 1);
  $('add-year').click(); $('year-value').value = '2027'; submit('year-form'); await tick();
  assert.ok(saved.archive.years.includes(2027));
  assert.equal($('folders').querySelector('[data-year="2027"]').nextElementSibling.querySelectorAll('[data-month]').length, 12);
  $('add-year').click(); $('year-value').value = '2027'; submit('year-form'); assert.match($('year-error').textContent, /már szerepel/); $('year-cancel').click();
  newDay('2027-01-05'); await tick(); assert.ok(saved.archive.days.includes('2027-01-05'));
  assert.equal($('editor').hidden, true); assert.equal(saved.notes.length, 4);
  await tick(); ui.dom.window.close();
  ui = await openUI(saved);
  assert.ok(ui.$('folders').querySelector('[data-year="2027"]'));
  ui.$('folders').querySelector('[data-year="2027"]').click();
  ui.$('folders').querySelector('[data-month="2027-01"]').click();
  assert.ok(ui.$('folders').querySelector('[data-day="2027-01-05"]'));
  ui.$('folders').querySelector('[data-day="2027-01-05"]').click();
  assert.equal(ui.cards().length, 0);
  ui.newDay('2026-11-04'); assert.equal(ui.cards().length, 2);
  ui.input('title', 'Kovács Péter frissítve'); await tick();
  assert.equal(saved.notes.find(note => note.id === firstId).day, '2026-11-04');
  assert.equal(saved.notes.find(note => note.id === 'old').body, 'Korábbi egyeztetés');
  ui.dom.window.close();
});
test('egy név törlése megőrzi a napot és a többi adatlapot', async () => {
  const saved = { notes: [{ id: 'a', title: 'Anna', body: '', day: '2026-01-01', updated: '2026-01-01T12:00:00Z' }, { id: 'b', title: 'Béla', body: '', day: '2026-01-01', updated: '2026-01-01T12:00:00Z' }], archive: { years: [2024, 2025, 2026], days: [] } };
  let ui = await openUI(saved);
  ui.$('delete').click(); ui.$('remove').click(); await tick();
  assert.equal(saved.notes.length, 1); assert.equal(saved.notes[0].title, 'Béla');
  ui.$('delete').click(); ui.$('remove').click(); await tick();
  assert.equal(saved.notes.length, 0); assert.ok(saved.archive.days.includes('2026-01-01'));
  ui.dom.window.close();
  ui = await openUI(saved); assert.ok(ui.$('folders').querySelector('[data-day="2026-01-01"]')); ui.dom.window.close();
});
test('importált eredeti szöveg biztonságos megjelenítése és megőrzése szerkesztéskor', async () => {
  const original = 'Ügyfél\r\nA123 10.000Ft-6000Ft\r\n<script>window.injected=true</script>';
  const saved = { notes: [{ id: 'source', title: 'Importált ügyfél', body: original, vin: Array(5).fill('WVWZZZ1KZ6W123456').join(' / '), day: '2024-06-27', updated: '2024-06-27T12:00:00Z', source: { path: '2024/Június/jegyzet.txt', originalText: original } }], archive: { years: [2024, 2025, 2026], days: ['2024-06-27'] } };
  const ui = await openUI(saved);
  assert.equal(ui.$('import-source').hidden, false);
  assert.equal(ui.$('import-original').textContent, original);
  assert.equal(ui.$('import-original').querySelector('script'), null);
  assert.equal(ui.dom.window.injected, undefined);
  assert.ok(ui.$('vin').maxLength >= saved.notes[0].vin.length);
  assert.equal(ui.$('fullPrice').placeholder, 'Nincs összesítve');
  ui.input('body', 'Később módosított megjegyzés'); await tick();
  assert.equal(saved.notes[0].source.originalText, original);
  ui.dom.window.close();
});
