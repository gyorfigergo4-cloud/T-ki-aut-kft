(function (root) {
 const brands = typeof module !== 'undefined' ? require('./car-brands') : root.CarBrands;
 const key = value => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu').replace(/[^a-z0-9]/g, '');
 const known = new Map(brands.map(brand => [key(brand), brand]).filter(([code]) => code));
 for (const [alias, name] of [['vw','Volkswagen'],['mercedes','Mercedes-Benz'],['mercédesz','Mercedes-Benz'],['bmv','BMW'],['skoda','Škoda'],['citroen','Citroën'],['ds','DS Automobiles']]) known.set(key(alias), name);
 function normalizeBrand(value) { return known.get(key(value)) || value; }
 function validate(rows) {
  if (rows === undefined) return;
  if (!Array.isArray(rows) || rows.length > 1000) throw new Error('Érvénytelen járműlista');
  const ids = new Set();
  for (const row of rows) {
   if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 200 || ids.has(row.id) || typeof row.vin !== 'string' || row.vin.length > 20000 || typeof row.brand !== 'string' || row.brand.length > 200) throw new Error('Érvénytelen alvázszám- vagy márkaadat');
   ids.add(row.id);
  }
 }
 const blank = id => ({ id, vin: '', brand: '' });
 function get(note) {
  if (note.vehicles !== undefined) { validate(note.vehicles); return note.vehicles.map(row => ({ ...row, brand: normalizeBrand(row.brand) })); }
  const text = note.vin || '', pieces = text.split(/\s*\/\s*|\r?\n/).filter(Boolean);
  const values = pieces.length > 1 && pieces.every(value => /^[A-HJ-NPR-Z0-9]{17}$/i.test(value)) ? pieces : [text];
  return values.map((vin, index) => ({ id: 'legacy-vin-' + (index + 1), vin, brand: '' }));
 }
 function normalize(note) { return { ...note, vehicles: get(note) }; }
 function sync(note) { validate(note.vehicles); note.vin = note.vehicles.map(row => row.vin.trim()).filter(Boolean).join(' / '); }
 function searchText(note) { return get(note).map(row => row.vin + ' ' + row.brand).join(' '); }
 function quoteInfo(note) {
  const rows = get(note).filter(row => row.vin.trim() || row.brand.trim());
  return { vin: rows.map(row => row.vin.trim()).filter(Boolean).join(' / '), vehicle: [...new Set(rows.map(row => row.brand.trim()).filter(Boolean))].join(' / ') };
 }
 const api = { brands, blank, validate, get, normalize, sync, searchText, normalizeBrand, quoteInfo };
 if (typeof module !== 'undefined') module.exports = api; else root.NoteVehicles = api;
})(globalThis);
