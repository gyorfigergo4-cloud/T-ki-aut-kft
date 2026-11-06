(function (root) {
 const Items = typeof module !== 'undefined' ? require('./items') : root.LineItems;
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
 function validateAssignments(note) {
  const ids = new Set(get(note).map(row => row.id));
  const valid = id => typeof id === 'string' && id.length <= 200 && (id === '' || ids.has(id));
  if (note.activeVehicleId !== undefined && !valid(note.activeVehicleId)) throw new Error('Érvénytelen kiválasztott autó');
  for (const item of note.items || []) if (item.vehicleId !== undefined && !valid(item.vehicleId)) throw new Error('A cikkszámhoz rendelt autó nem található.');
 }
 function normalize(note) {
  const vehicles = get(note), result = { ...note, vehicles };
  if (Array.isArray(note.items)) {
   // Only an unambiguous single-car legacy note can be assigned automatically.
   result.items = note.items.map(item => ({ ...item, vehicleId: item.vehicleId === undefined ? (vehicles.length === 1 ? vehicles[0].id : '') : item.vehicleId }));
   result.activeVehicleId = note.activeVehicleId ?? (result.items.some(item => item.vehicleId === '') ? '' : vehicles[0]?.id || '');
  }
  if (vehicles.length && result.activeVehicleId === '' && !(result.items || []).some(item => item.vehicleId === '' && Items.isActive(item))) result.activeVehicleId = vehicles[0].id;
  validateAssignments(result); return result;
 }
 function itemsFor(note, id = note.activeVehicleId) { return note.items.filter(item => (item.vehicleId || '') === (id || '')); }
 function label(vehicle, index = 0) { return [vehicle.brand.trim(), vehicle.vin.trim()].filter(Boolean).join(' · ') || (index + 1) + '. autó – alvázszám megadása'; }
 function remove(note, id) {
  const index = note.vehicles.findIndex(vehicle => vehicle.id === id);
  const moved = note.items.filter(item => item.vehicleId === id && Items.isActive(item)).length;
  note.items = note.items.filter(item => item.vehicleId !== id || Items.isActive(item)).map(item => item.vehicleId === id ? { ...item, vehicleId: '' } : item);
  note.vehicles = note.vehicles.filter(vehicle => vehicle.id !== id);
  if (note.activeVehicleId === id) note.activeVehicleId = note.vehicles[Math.max(0, index - 1)]?.id || '';
  sync(note); validateAssignments(note); return moved;
 }
 function selectedNote(note) {
  const vehicles = note.vehicles.filter(vehicle => vehicle.id === note.activeVehicleId);
  return { ...note, vehicles, items: itemsFor(note).map(item => ({ ...item })), ...quoteInfo({ vehicles }) };
 }
 function findSelection(note, query) {
  const fold = value => value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const text = fold(query.trim()); if (!text) return undefined;
  const vehicle = note.vehicles.find(row => fold(row.vin).includes(text) || fold(row.brand).includes(text));
  if (vehicle) return vehicle.id;
  const item = note.items.find(row => fold([row.partNumber, row.description || '', row.supplier, row.fullPrice, row.discountPercent, row.discountedPrice, row.quantity, row.ordered ? 'megrendelve rendelve' : '', row.orderedAt || ''].join(' ')).includes(text));
  return item?.vehicleId;
 }
 function sync(note) { validate(note.vehicles); note.vin = note.vehicles.map(row => row.vin.trim()).filter(Boolean).join(' / '); }
 function searchText(note) { return get(note).map(row => row.vin + ' ' + row.brand).join(' '); }
 function quoteInfo(note) {
  const rows = get(note).filter(row => row.vin.trim() || row.brand.trim());
  return { vin: rows.map(row => row.vin.trim()).filter(Boolean).join(' / '), vehicle: [...new Set(rows.map(row => row.brand.trim()).filter(Boolean))].join(' / ') };
 }
 const api = { brands, blank, validate, get, normalize, sync, searchText, normalizeBrand, quoteInfo, validateAssignments, itemsFor, label, remove, selectedNote, findSelection };
 if (typeof module !== 'undefined') module.exports = api; else root.NoteVehicles = api;
})(globalThis);
