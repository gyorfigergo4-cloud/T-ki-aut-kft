const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('node:net');
const { test } = require('node:test');
const Partners = require('../app/partners');
const { createService } = require('../app/garage-service');
const Network = require('../app/garage-network');

test('legacy import skips exact matches and leaves ambiguous contacts for review', () => {
  const existing = Partners.merge([], [{ name: 'Kovács Péter', phone: '+36 30 123 4567' }]);
  const notes = [
    { title: '  KO VÁCS ', phone: '' },
    { title: ' KOVÁCS  PÉTER ', phone: '06 (30) 123-4567' },
    { title: 'Kovács Péter', phone: '+36 70 123 4567' },
    { title: 'Nagy Juli', phone: '0036 20 987 6543', body: 'Helyi jegyzet' },
    { title: 'nagy juli', phone: '+36 20 987 6543' },
    { title: 'Nagy Júlia', phone: '+36 20 987 6543' }
  ];
  const original = structuredClone(notes);
  const preview = Partners.candidates(notes, existing);
  assert.equal(preview.skipped, 0);
  assert.equal(preview.duplicates, 2);
  assert.deepEqual(preview.rows.map(row => row.possibleDuplicate), [true, true, true, false]);
  assert.ok(preview.rows.every(row => !('body' in row)));
  const next = Partners.merge(existing, preview.rows.slice(1, 2));
  assert.equal(next.length, 2);
  assert.deepEqual(Partners.merge(next, preview.rows.slice(1, 2)), next);
  assert.deepEqual(notes, original);
});

test('one host and three clients share partners with conflict protection and independent vehicle data', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'toki-partners-'));
  const services = ['host', 'client1', 'client2', 'client3'].map(name => createService(path.join(root, name)));
  t.after(async () => { await Promise.all(services.map(service => service.close())); await fs.rm(root, { recursive: true, force: true }); });
  await Promise.all(services.map(service => service.start()));
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise(resolve => probe.close(resolve));
  const [host, ...clients] = services;
  const { pairingCode: token } = await host.configure({ mode: 'host', port });
  const config = { mode: 'client', host: '127.0.0.1', port, token };
  await Promise.all(clients.map(service => service.configure(config)));
  const garageBefore = await host.load();
  const snapshots = await Promise.all(services.map(service => service.loadPartners()));
  const people = Partners.merge(snapshots[0].people, [{ name: 'Kiss Anna', phone: '' }]);
  const saved = await clients[0].savePartners({ people, revision: snapshots[1].revision });
  await assert.rejects(clients[1].savePartners({ people: [], revision: snapshots[2].revision }), { code: 'conflict' });
  assert.deepEqual(await clients[2].loadPartners(), saved);
  assert.deepEqual(await host.loadPartners(), saved);
  assert.deepEqual(await host.load(), garageBefore);
  await assert.rejects(Network.request({ ...config, token: '0'.repeat(32) }, 'GET', undefined, '/partners'), { code: 'unauthorized' });
  await host.close();
  await assert.rejects(clients[0].loadPartners());
  await host.start();
  assert.deepEqual(await clients[2].loadPartners(), saved);
});

test('old note text yields reviewable phones and counts the reasons for skipped notes', () => {
  const result = Partners.candidates([
    { title: 'Júlia', body: 'Cikkszám: 123456789\nTelefon: +36 30 123 4567\n06 20 989 1234' },
    { title: 'Júlia', phone: '06 (30) 123-4567' },
    { title: 'Éva', body: '123456789' },
    { title: 'Péter', phone: 'hibás' },
    { title: '', phone: '+36 20 123 4567' }
  ], []);
  assert.equal(result.duplicates, 1);
  assert.equal(result.missingPhone, 1);
  assert.equal(result.invalidPhone, 1);
  assert.equal(result.missingName, 1);
  assert.deepEqual(result.rows.map(row => [row.phone, row.fromText, row.possibleDuplicate]), [
    ['+36 30 123 4567', false, true],
    ['06 20 989 1234', true, true],
    ['', false, false],
    ['', false, false]
  ]);
});

test('partner rates are optional, including zero, and duplicate names require a phone match', () => {
  const people = [
    { id: '1', name: 'Kiss Anna', phone: '+36 30 111 1111', discountPercent: '35.5' },
    { id: '2', name: 'Kiss Anna', phone: '+36 20 111 1111', discountPercent: '0' },
    { id: '3', name: 'Nagy Gabi', phone: '+36 30 111 1111' }
  ];
  assert.equal(Partners.validate(people), people);
  assert.deepEqual(Partners.match(people, ' KISS   ANNA ', ''), { ambiguous: true });
  assert.equal(Partners.match(people, 'Kiss Anna', '06301111111').discountPercent, '35.5');
  assert.equal(Partners.match(people, 'Kiss Anna', '0036201111111').discountPercent, '0');
  assert.equal(Partners.match(people, 'Nagy Gabi', '').discountPercent, undefined);
  assert.throws(() => Partners.validate([{ ...people[0], discountPercent: '101' }]));
});

test('name-only import handles thousands of old notes and supplements a reviewed phone without losing the rate', () => {
  const notes = Array.from({ length: 5822 }, (_, index) => ({
    title: 'Partner ' + (index % 1000),
    body: 'Jegyzetszöveg'
  }));
  notes.push({ title: ' Partner 0 ', phone: '06 30 123 4567' });
  const preview = Partners.candidates(notes, []);
  assert.equal(preview.rows.length, 1000);
  assert.equal(preview.rows.filter(person => !person.phone).length, 999);
  const shared = Partners.merge([], preview.rows);
  Partners.validate(shared);
  assert.equal(Partners.candidates(notes, shared).rows.length, 0);
  const person = shared.find(person => person.name === 'Partner 1');
  person.discountPercent = '35';
  const later = [{ title: 'PARTNER 1', phone: '+36 20 987 6543' }];
  const reviewed = Partners.candidates(later, shared);
  assert.equal(reviewed.rows.length, 1);
  assert.equal(reviewed.rows[0].possibleDuplicate, true);
  const updated = Partners.merge(shared, reviewed.rows);
  assert.equal(updated.length, shared.length);
  assert.deepEqual(updated.find(p => p.id === person.id), { ...person, phone: '+36 20 987 6543' });
  assert.equal(Partners.candidates(later, updated).rows.length, 0);
  assert.deepEqual(Partners.merge(updated, reviewed.rows), updated);
});
