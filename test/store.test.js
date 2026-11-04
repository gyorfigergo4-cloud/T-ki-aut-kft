const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const store = require('../app/store');
test('jegyzetek mentése, újraolvasása és előző változat megőrzése', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-'));
  try {
    const file = path.join(dir, 'notes.json');
    assert.deepEqual(store.read(file), []);
    const notes = [{ id: '1', title: 'Árvíztűrő', body: 'Első sor\nMásodik sor', updated: new Date().toISOString() }];
    store.write(file, notes); assert.deepEqual(store.read(file), notes);
    store.write(file, []); assert.deepEqual(store.read(file), []); assert.deepEqual(store.read(file + '.bak'), notes);
    assert.throws(() => store.write(file, [{}])); assert.deepEqual(store.read(file), []);
    fs.writeFileSync(file, 'hibás'); assert.throws(() => store.read(file)); assert.equal(fs.readFileSync(file, 'utf8'), 'hibás');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('autóbolti mezők és árak megőrzése, hibás adatok elutasítása', () => {
 const n = {id:'1',title:'Ügyfél',body:'',updated:'2026-11-04T12:00:00Z',created:'2025-02-01T12:00:00Z',vin:'WVW123',part:'ABC-123\nDEF-456',oil:'5W-30, 4 liter',fullPrice:'12000.50',discountPrice:'10000'};
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),'autobolt-'));
 try {
  const file=path.join(dir,'notes.json'); store.write(file,[n]); assert.deepEqual(store.read(file),[n]);
  assert.throws(()=>store.write(file,[{...n,fullPrice:'-1'}]));
  assert.throws(()=>store.write(file,[{...n,vin:123}]));
  assert.deepEqual(store.read(file),[n]);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
