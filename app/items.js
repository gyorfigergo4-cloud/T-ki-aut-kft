(function (root) {
  const PERCENT_SCALE = 1000000n, HUNDRED_PERCENT = 100n * PERCENT_SCALE;
  function scaled(value, places, pattern, message) {
    if (typeof value !== 'string' || !pattern.test(value)) throw new Error(message);
    const [whole, fraction = ''] = value.replace(',', '.').split('.');
    return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0') || '0');
  }
  function decimal(value, places) {
    const negative = value < 0n; if (negative) value = -value;
    const scale = 10n ** BigInt(places), fraction = (value % scale).toString().padStart(places, '0').replace(/0+$/, '');
    return (negative ? '-' : '') + (value / scale).toString() + (fraction ? '.' + fraction : '');
  }
  const cents = value => scaled(value, 2, /^\d{1,12}(?:[.,]\d{1,2})?$/, 'Az ár legfeljebb két tizedesjegyű, nem negatív szám legyen.');
  function percent(value) {
    const result = scaled(value || '0', 6, /^\d{1,3}(?:[.,]\d{1,6})?$/, 'A kedvezmény 0 és 100 közötti százalék legyen.');
    if (result > HUNDRED_PERCENT) throw new Error('A kedvezmény 0 és 100 közötti százalék legyen.');
    return result;
  }
  function quantity(value) {
    if (typeof value !== 'string' || !/^[1-9]\d{0,5}$/.test(value)) throw new Error('A darabszám legalább 1, egész szám legyen.');
    return BigInt(value);
  }
  function discounted(fullPrice, discountPercent) {
    if (fullPrice === '') return '';
    const numerator = cents(fullPrice) * (HUNDRED_PERCENT - percent(discountPercent));
    return decimal((numerator + HUNDRED_PERCENT / 2n) / HUNDRED_PERCENT, 2);
  }
  function discountFromPrices(fullPrice, discountedPrice) {
    const full = cents(fullPrice), reduced = cents(discountedPrice);
    if (!full || reduced > full) return '';
    return decimal(((full - reduced) * HUNDRED_PERCENT + full / 2n) / full, 6);
  }
  function blank(id) {
    return { id, partNumber: '', fullPrice: '', discountPercent: '0', discountedPrice: '', quantity: '1', supplier: '', priceMode: 'auto' };
  }
  const amount = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,2})?';
  const pairPattern = new RegExp('(?<![\\w.,])(' + amount + ')\\s*(?:Ft(?:\\s*/\\s*db)?)?\\s*[-–]\\s*(' + amount + ')\\s*Ft(?:\\s*/\\s*db)?(?!\\w)', 'gi');
  const pricePattern = new RegExp('(?<![\\w.,])(' + amount + ')\\s*Ft(?!\\w)', 'gi');
  const suppliers = /(?:^|\s)(AP|IC|UNIX|Láng|Szakál|Bárdi|Autonet|Unitrack|Ivanics|Polc|Gyári)(?=\s|$)/i;
  const legacyAmount = value => value.replaceAll('.', '').replace(',', '.');
  function parseLegacyLine(line, index) {
    const item = { ...blank('legacy-' + (index + 1)), legacyLine: line, priceMode: 'legacy' };
    const pairs = [...line.matchAll(pairPattern)], prices = [...line.matchAll(pricePattern)];
    let prefix = line;
    const supplier = suppliers.exec(line);
    if (supplier) item.supplier = supplier[1];
    try {
    if (pairs.length === 1 && prices.length <= 2) {
      item.fullPrice = legacyAmount(pairs[0][1]); item.discountedPrice = legacyAmount(pairs[0][2]);
      item.discountPercent = discountFromPrices(item.fullPrice, item.discountedPrice);
      prefix = line.slice(0, pairs[0].index);
    } else if (!pairs.length && prices.length === 1) {
      item.fullPrice = legacyAmount(prices[0][1]); item.discountedPrice = item.fullPrice;
      item.discountPercent = '0'; prefix = line.slice(0, prices[0].index);
      if (/Ft(?:\s*\/\s*db)?\s*[-–]\s*\d/i.test(line)) { item.discountedPrice = ''; item.discountPercent = ''; }
    } else if (pairs.length > 1 || prices.length > 2) {
      // Leave ambiguous prices in the original line, never invent a total.
      item.supplier = '';
    }
    if (item.fullPrice) cents(item.fullPrice);
    if (item.discountedPrice) cents(item.discountedPrice);
    } catch { item.fullPrice = ''; item.discountedPrice = ''; item.discountPercent = ''; prefix = line; item.supplier = ''; }
    if (item.supplier) prefix = prefix.replace(suppliers, ' ');
    const count = /(?:^|\s)[x×]\s*([1-9]\d{0,5})(?=\s|$)/i.exec(line);
    if (count) item.quantity = count[1];
    item.partNumber = prefix.trim().replace(/\s+/g, ' ');
    return item;
  }
  function normalizeNote(note) {
    if (note.items !== undefined) { validate(note.items); return { ...note, items: note.items.map(item => ({ ...item })) }; }
    const part = note.part ?? '';
    const items = part.split(/\r?\n/).filter(line => line.trim()).map(parseLegacyLine);
    const result = { ...note, items };
    if (part) result.legacyParts = note.legacyParts ?? part;
    if (note.fullPrice || note.discountPrice) result.legacyTotals = note.legacyTotals ?? { fullPrice: note.fullPrice || '', discountedPrice: note.discountPrice || '' };
    return result;
  }
  function validate(items) {
    if (!Array.isArray(items) || items.length > 10000) throw new Error('Érvénytelen cikkszámtáblázat');
    const ids = new Set();
    for (const item of items) {
      if (!item || ['id', 'partNumber', 'fullPrice', 'discountPercent', 'discountedPrice', 'quantity', 'supplier', 'priceMode'].some(key => typeof item[key] !== 'string') || !item.id || ids.has(item.id) || !['auto', 'legacy'].includes(item.priceMode)) throw new Error('Érvénytelen cikkszámsor');
      ids.add(item.id);
      if (item.description !== undefined && typeof item.description !== 'string') throw new Error('Érvénytelen tételmegnevezés');
      if (item.legacyLine !== undefined && typeof item.legacyLine !== 'string') throw new Error('Érvénytelen korábbi cikkszámsor');
      quantity(item.quantity); percent(item.discountPercent);
      if (item.fullPrice !== '') cents(item.fullPrice);
      if (item.discountedPrice !== '') cents(item.discountedPrice);
      if (item.priceMode === 'auto' && item.discountedPrice !== discounted(item.fullPrice, item.discountPercent)) throw new Error('Eltérő számított kedvezményes ár');
    }
    return items;
  }
  function totals(items) {
    let full = 0n, reduced = 0n, missing = 0, active = 0;
    for (const item of items) {
      if (!item.partNumber && !item.description && !item.supplier && item.fullPrice === '' && item.discountedPrice === '') continue;
      active++;
      if (item.fullPrice === '' || item.discountedPrice === '') { missing++; continue; }
      const count = quantity(item.quantity);
      full += cents(item.fullPrice) * count; reduced += cents(item.discountedPrice) * count;
    }
    return { fullPrice: decimal(full, 2), discountedPrice: decimal(reduced, 2), savings: decimal(full - reduced, 2), missing, active, priced: active - missing };
  }
  function formatMoney(value) {
    if (value === '') return '—';
    const negative = value.startsWith('-'), amount = scaled(negative ? value.slice(1) : value, 2, /^\d+(?:[.,]\d{1,2})?$/, 'Érvénytelen összeg');
    const whole = new Intl.NumberFormat('hu-HU').format(amount / 100n), fraction = amount % 100n;
    return (negative ? '−' : '') + whole + (fraction ? ',' + fraction.toString().padStart(2, '0') : '') + ' Ft';
  }
  function syncLegacy(note) {
    note.part = note.items.filter(item => item.partNumber || item.fullPrice || item.supplier).map(item => [item.partNumber, item.supplier, item.fullPrice ? item.fullPrice + 'Ft' + (item.discountedPrice ? '-' + item.discountedPrice + 'Ft' : '') : '', item.quantity !== '1' ? 'x' + item.quantity : ''].filter(Boolean).join(' ')).join('\n');
    const result = totals(note.items);
    note.fullPrice = result.priced && !result.missing ? result.fullPrice : '';
    note.discountPrice = result.priced && !result.missing ? result.discountedPrice : '';
  }
  const api = { blank, cents, percent, quantity, discounted, discountFromPrices, parseLegacyLine, normalizeNote, validate, totals, formatMoney, syncLegacy };
  if (typeof module !== 'undefined') module.exports = api;
  else root.LineItems = api;
})(globalThis);
