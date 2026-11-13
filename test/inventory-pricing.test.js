const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const Pricing = require('../app/inventory-pricing');
const { createDatabase } = require('../app/inventory-db');
const Stocktake = require('../app/stocktake');
const { workbook } = require('../app/excel-export');

function fixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toki-pricing-'));
  try {
    const file = path.join(dir, 'inventory.json'), db = createDatabase(file);
    const cmd = c => db.command({ id: randomUUID(), operator: 'Minta raktáros', ...c });
    const add = (sku, category = '', price = '1000', discountPercent = '') => {
      cmd({ type: 'product', product: { name: sku, sku, category, price, discountPercent, barcodes: [] } });
      return db.read().products.at(-1);
    };
    const start = () => { const sessionId = randomUUID(); cmd({ type: 'stocktake', action: 'start', sessionId, title: 'Minta leltár' }); return sessionId; };
    run({ file, db, cmd, add, start });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('category defaults are 40 / 20 / 20; explicit zero and inherited discounts differ', () => {
  for (const category of ['', 'oil-filter', 'brake-fluid', 'air-filter']) assert.equal(Pricing.product({ price: '1000', category }).discountedPrice, '600');
  for (const category of ['engine-oil', 'transmission-oil']) assert.equal(Pricing.product({ price: '1000', category }).discountedPrice, '800');
  assert.equal(Pricing.product({ price: '1000', category: 'engine-oil', discountPercent: '0' }).discountedPrice, '1000');
  assert.equal(Pricing.product({ price: '1000', discountPercent: '100' }).discountedPrice, '0');
  assert.equal(Pricing.product({ price: '1000', discountPercent: '12,345678' }).discountPercent, '12.345678');
  for (const invalid of ['-1', '100.000001', 'NaN', '1.2345678', 20, null]) assert.throws(() => Pricing.override(invalid));
  for (const invalid of [{ general: '40' }, { ...Pricing.DEFAULTS, extra: '1' }, []]) assert.throws(() => Pricing.settings(invalid));
  for (const invalid of ['-1', '0.001', '1000000000000', 100]) assert.throws(() => Pricing.price(invalid));
});

test('stock values round unit prices first and keep exact cents beyond safe integers', () => {
  assert.deepEqual(Pricing.line('0.01', '50', 3), { fullValue: '0.03', discountedValue: '0.03', savings: '0' });
  assert.deepEqual(Pricing.line('999999999999.99', '40', 1000000000), {
    fullValue: '999999999999990000000', discountedValue: '599999999999990000000', savings: '400000000000000000000'
  });
  const total = Pricing.total([
    { fullPrice: '1000', discountPercent: '40', quantity: 3 },
    { fullPrice: '', discountPercent: '40', quantity: 2 },
    { fullPrice: '', discountPercent: '', quantity: 0 },
    { fullPrice: '1000', discountPercent: '20', quantity: null }
  ]);
  assert.deepEqual(total, { fullValue: '3000', discountedValue: '1800', savings: '1200', missingPrices: 1, uncounted: 1, counted: 3 });
  Pricing.validateTotal(total);
  assert.throws(() => Pricing.validateTotal({ ...total, savings: '1' }));
  assert.match(Pricing.formatMoney('999999999999990000000'), /999.*999.*999.*999.*990.*000.*000 Ft/);
});

test('shared prices change valuations without stock movements; counting does not conflict with price edits', () => fixture(({ db, cmd, add, start }) => {
  const a = add('Minta szűrő', 'oil-filter'), b = add('Minta motorolaj', 'engine-oil');
  for (const p of [a, b]) cmd({ type: 'receive', productId: p.id, quantity: 5 });
  const sessionId = start(), before = db.read(), version = db.stocktake().rows[0].pricingVersion;
  cmd({ type: 'stocktake', action: 'add', sessionId, productId: a.id, quantity: 2 });
  const price = { id: randomUUID(), type: 'stocktake', action: 'pricing', sessionId, productId: a.id, expectedPricing: version, fullPrice: '2000', discountPercent: '25' };
  cmd(price); const after = db.read(); cmd(price);
  assert.deepEqual(db.read(), after, 'retry is idempotent');
  assert.deepEqual(after.movements, before.movements);
  assert.deepEqual(after.products.map(p => [p.quantity, p.stockChangeId]), before.products.map(p => [p.quantity, p.stockChangeId]));
  assert.equal(db.stocktake().rows[0].stockChanged, false);
  assert.equal(db.stocktake().countedValuation.discountedValue, '3000');
  assert.equal(db.stocktake().warehouseValuation.discountedValue, '11500');
  assert.throws(() => cmd({ ...price, id: randomUUID(), fullPrice: '3000' }), e => e.code === 'conflict');
  const oldSettings = JSON.stringify(db.read().pricingSettings);
  cmd({ type: 'pricing-settings', expectedSettings: oldSettings, settings: { general: '50', engineOil: '30', transmissionOil: '10' } });
  assert.equal(db.stocktake().rows[0].discountPercent, '25');
  assert.equal(db.stocktake().rows[1].discountPercent, '30');
  assert.throws(() => cmd({ type: 'pricing-settings', expectedSettings: oldSettings, settings: Pricing.DEFAULTS }), e => e.code === 'conflict');
  assert.equal(db.stocktake().warehouseValuation.discountedValue, '11000');
}));

test('product edits from old clients preserve overrides; removing a category restores the general default', () => fixture(({ db, cmd, add, start }) => {
  const p = add('Minta olaj', 'engine-oil', '1000', '0'); start();
  cmd({ type: 'product', revision: db.read().revision, product: { id: p.id, name: p.name, sku: p.sku, barcodes: [] } });
  assert.equal(db.stocktake().rows[0].discountPercent, '0');
  cmd({ type: 'product', revision: db.read().revision, product: { id: p.id, name: p.name, sku: p.sku, barcodes: [], category: '', discountPercent: '' } });
  assert.equal(db.stocktake().rows[0].category, '');
  assert.equal(db.stocktake().rows[0].defaultDiscount, '40');
  assert.equal(db.stocktake().rows[0].discountPercent, '40');
}));

test('closed money snapshots survive later price, default, category and stock changes, including deletion', () => fixture(({ db, cmd, add, start }) => {
  const a = add('Minta motorolaj', 'engine-oil'), b = add('Minta üres készlet', '', '500');
  cmd({ type: 'receive', productId: a.id, quantity: 5 });
  const sessionId = start();
  cmd({ type: 'stocktake', action: 'add', sessionId, productId: a.id, quantity: 3 });
  cmd({ type: 'stocktake', action: 'set', sessionId, productId: b.id, quantity: 0, expectedQuantity: null });
  cmd({ type: 'stocktake', action: 'close', sessionId });
  const closed = db.stocktake(sessionId);
  cmd({ type: 'product', revision: db.read().revision, product: { id: a.id, sku: a.sku, name: a.name, barcodes: [], price: '10000', category: '', discountPercent: '90' } });
  cmd({ type: 'pricing-settings', expectedSettings: JSON.stringify(db.read().pricingSettings), settings: { general: '1', engineOil: '2', transmissionOil: '3' } });
  cmd({ type: 'receive', productId: a.id, quantity: 1 });
  cmd({ type: 'delete', productId: b.id }); add('Később felvett termék');
  const after = db.stocktake(sessionId);
  for (const key of ['warehouseValuation', 'countedValuation', 'rows', 'pricingSettings']) assert.deepEqual(after[key], closed[key]);
  assert.equal(after.warehouseValuation.discountedValue, '4000');
  assert.equal(after.countedValuation.discountedValue, '2400');
  assert.throws(() => cmd({ type: 'stocktake', action: 'pricing', sessionId, productId: a.id, fullPrice: '5', discountPercent: '10' }));
}));

test('legacy open reports use current prices; legacy closed reports never invent historical values', () => {
  const product = { id: randomUUID(), sku: 'A', name: 'Minta', quantity: 4, price: '1000', category: 'engine-oil', barcodes: [] };
  const session = { id: randomUUID(), title: 'Régi', createdAt: new Date().toISOString(), createdBy: 'Minta', rows: [{ productId: product.id, sku: 'A', name: 'Minta', barcodes: [], quantity: 2, expected: 4, stockChangeId: 'legacy' }] };
  const data = { revision: 'a', products: [product], stocktakes: [session] };
  Stocktake.validate(data.stocktakes);
  assert.equal(Stocktake.report(data).countedValuation.discountedValue, '1600');
  session.closedAt = new Date().toISOString(); session.rows[0].closingQuantity = 4;
  const report = Stocktake.report(data);
  assert.equal(report.legacyPricing, true); assert.equal(report.warehouseValuation, null);
  assert.equal(report.rows[0].fullPrice, ''); assert.equal(report.countedValuation.missingPrices, 1);
});

test('Excel preserves original stocktake columns and exports exact totals, missing prices and large amounts', async () => {
  const data = { session: { title: 'Minta', createdAt: '', createdBy: '' }, rows: [{ sku: '001', name: 'Minta', expected: 5, quantity: 2, difference: -3, currentQuantity: 5, fullPrice: '1000', discountPercent: '40', discountedPrice: '600', discountedValue: '1200', category: 'oil-filter' }], countedValuation: { fullValue: '2000', savings: '800', discountedValue: '1200', missingPrices: 0, uncounted: 0, counted: 1 }, warehouseValuation: { fullValue: '999999999999990000000', discountedValue: '599999999999990000000', savings: '400000000000000000000', missingPrices: 1, uncounted: 0, counted: 2 } };
  const book = workbook('stocktake', data), bytes = await book.xlsx.writeBuffer();
  const loaded = new (require('exceljs').Workbook)(); await loaded.xlsx.load(bytes);
  const rows = loaded.getWorksheet('Leltár eltérések'), totals = loaded.getWorksheet('Készletérték összesítés');
  assert.equal(rows.getCell('E2').value, -3); assert.equal(rows.getCell('K2').value, 1000);
  assert.equal(rows.getCell('M2').value, 600); assert.equal(rows.getCell('N2').value, 1200);
  assert.equal(totals.getCell('D2').value, '599999999999990000000'); assert.equal(totals.getCell('E2').value, 1);
  assert.equal(totals.getCell('D3').value, 1200);
});
