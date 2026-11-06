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
  function manualPercent(fullPrice, reducedPrice) {
    if (fullPrice === '' || reducedPrice === '') return '';
    const full = cents(fullPrice), reduced = cents(reducedPrice);
    if (reduced > full) throw new Error('A kedvezményes ár nem lehet magasabb a teli árnál.');
    return full === 0n ? '0' : discountFromPrices(fullPrice, reducedPrice);
  }
  function normalizeSupplier(value) { return /^unitra(?:c)?k$/i.test(value.trim()) ? 'Unitrak' : value; }
  function blank(id) {
    return { id, partNumber: '', fullPrice: '', discountPercent: '0', discountedPrice: '', quantity: '1', supplier: '', priceMode: 'auto', ordered: false, orderedAt: '', paid: false, arrived: false };
  }
  function legacyOrdered(line) {
    return typeof line === 'string' && /\b(?:megrendelve|rendelve)\s*[.!]?\s*$/iu.test(line) && !/\b(?:nem|nincs|nincsen)\b.*\b(?:megrendelve|rendelve)\b/iu.test(line);
  }
  function order(item) {
    return { ordered: item.ordered === undefined ? legacyOrdered(item.legacyLine) : item.ordered, orderedAt: item.orderedAt || '' };
  }
  function normalizeItem(item) { return { ...item, ...order(item), supplier: normalizeSupplier(item.supplier), paid: item.paid ?? false }; }
  function isActive(item) { return !!(item.partNumber || item.description || item.supplier || item.fullPrice !== '' || item.discountedPrice !== ''); }
  function paymentState(items, fallback = false) {
    if (typeof fallback !== 'boolean') throw new Error('Érvénytelen fizetésjelölés');
    const active = items.filter(isActive), paidCount = active.filter(item => item.paid === true).length;
    return { paid: active.length ? paidCount === active.length : fallback, partial: paidCount > 0 && paidCount < active.length, paidCount, total: active.length };
  }
  function withPaid(item, paid) {
    if (typeof paid !== 'boolean' || (paid && !isActive(item))) throw new Error('Fizetés jelölése előtt add meg a tétel adatait.');
    const next = { ...item, paid }; validate([next]); return next;
  }
  function withArrival(item, arrived) { if(typeof arrived!=='boolean'||(arrived&&!isActive(item)))throw new Error('Megérkezés jelölése előtt add meg a tétel adatait.');const next={...item,arrived};validate([next]);return next;}
  function setAllPaid(items, paid) {
    if (typeof paid !== 'boolean') throw new Error('Érvénytelen fizetésjelölés');
    const next = items.map(item => isActive(item) ? { ...item, paid } : { ...item }); validate(next); return next;
  }
  function withOrder(item, ordered, at = new Date().toISOString()) {
    if (typeof ordered !== 'boolean') throw new Error('Érvénytelen rendelésjelölés');
    if (ordered && !item.partNumber.trim() && !item.description?.trim()) throw new Error('Rendelés jelölése előtt add meg a cikkszámot vagy a megnevezést.');
    if (ordered && !at) throw new Error('Érvénytelen rendelési időpont');
    const next = { ...item, ordered, orderedAt: ordered ? at : '' }; validate([next]); return next;
  }
  const identity = value => (value || '').replace(/\s+/g, '').toLocaleUpperCase('hu');
  function edit(item, patch) {
    const next = { ...item, ...patch };
    if (Object.hasOwn(patch, 'supplier')) next.supplier = normalizeSupplier(next.supplier);
    if (Object.hasOwn(patch, 'discountedPrice')) {
      next.priceMode = 'manual'; next.discountPercent = manualPercent(next.fullPrice, next.discountedPrice);
    } else if (Object.hasOwn(patch, 'discountPercent')) {
      next.priceMode = 'auto'; next.discountedPrice = discounted(next.fullPrice, next.discountPercent);
    } else if (Object.hasOwn(patch, 'fullPrice')) {
      if (item.priceMode === 'manual' || (item.priceMode === 'legacy' && item.discountedPrice !== '')) {
        next.priceMode = 'manual'; next.discountPercent = manualPercent(next.fullPrice, next.discountedPrice);
      } else { next.priceMode = 'auto'; next.discountedPrice = discounted(next.fullPrice, next.discountPercent); }
    }
    if (identity(next.partNumber) !== identity(item.partNumber) || (!identity(next.partNumber) && identity(next.description) !== identity(item.description))) {
      next.ordered = false; next.orderedAt = ''; next.paid = false; next.arrived = false;
    }
    return next;
  }
  function orderCounts(items) {
    const active = items.filter(isActive);
    return { ordered: active.filter(i => order(i).ordered).length, total: active.length };
  }
  const amount = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,2})?';
  const pairPattern = new RegExp('(?<![\\w.,])(' + amount + ')\\s*(?:Ft(?:\\s*/\\s*db)?)?\\s*[-–]\\s*(' + amount + ')\\s*Ft(?:\\s*/\\s*db)?(?!\\w)', 'gi');
  const pricePattern = new RegExp('(?<![\\w.,])(' + amount + ')\\s*Ft(?!\\w)', 'gi');
  const suppliers = /(?:^|\s)(AP|IC|UNIX|Láng|Szakál|Bárdi|Autonet|Unitrack|Unitrak|Ivanics|Polc|Gyári)(?=\s|$)/i;
  const legacyAmount = value => value.replaceAll('.', '').replace(',', '.');
  function parseLegacyLine(line, index) {
    const item = { ...blank('legacy-' + (index + 1)), legacyLine: line, priceMode: 'legacy' };
    item.ordered = legacyOrdered(line);
    const pairs = [...line.matchAll(pairPattern)], prices = [...line.matchAll(pricePattern)];
    let prefix = line;
    const supplier = suppliers.exec(line);
    if (supplier) item.supplier = normalizeSupplier(supplier[1]);
    try {
    if (pairs.length === 1 && prices.length <= 2) {
      item.fullPrice = legacyAmount(pairs[0][1]); item.discountedPrice = legacyAmount(pairs[0][2]);
      item.discountPercent = discountFromPrices(item.fullPrice, item.discountedPrice);
      prefix = line.slice(0, pairs[0].index);
    } else if (!pairs.length && prices.length === 1) {
      prefix = line.slice(0, prices[0].index);
      if (/kedvezményes\s+ár\s*:\s*$/iu.test(prefix)) {
        item.fullPrice = ''; item.discountedPrice = legacyAmount(prices[0][1]); item.discountPercent = ''; item.priceMode = 'manual';
        prefix = prefix.replace(/kedvezményes\s+ár\s*:\s*$/iu, '');
      } else {
        item.fullPrice = legacyAmount(prices[0][1]); item.discountedPrice = item.fullPrice; item.discountPercent = '0';
      }
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
    if (note.items !== undefined) { validate(note.items); const items = note.items.map(normalizeItem); return { ...note, items, paid: paymentState(items, note.paid).paid }; }
    const part = note.part ?? '';
    const items = part.split(/\r?\n/).filter(line => line.trim()).map(parseLegacyLine);
    const result = { ...note, items, paid: paymentState(items, note.paid).paid };
    if (part) result.legacyParts = note.legacyParts ?? part;
    if (note.fullPrice || note.discountPrice) result.legacyTotals = note.legacyTotals ?? { fullPrice: note.fullPrice || '', discountedPrice: note.discountPrice || '' };
    return result;
  }
  function validate(items) {
    if (!Array.isArray(items) || items.length > 10000) throw new Error('Érvénytelen cikkszámtáblázat');
    const ids = new Set();
    for (const item of items) {
      if (!item || ['id', 'partNumber', 'fullPrice', 'discountPercent', 'discountedPrice', 'quantity', 'supplier', 'priceMode'].some(key => typeof item[key] !== 'string') || !item.id || ids.has(item.id) || !['auto', 'legacy', 'manual'].includes(item.priceMode)) throw new Error('Érvénytelen cikkszámsor');
      ids.add(item.id);
      if (item.description !== undefined && typeof item.description !== 'string') throw new Error('Érvénytelen tételmegnevezés');
      if (item.legacyLine !== undefined && typeof item.legacyLine !== 'string') throw new Error('Érvénytelen korábbi cikkszámsor');
      if (item.ordered !== undefined && typeof item.ordered !== 'boolean') throw new Error('Érvénytelen rendelésjelölés');
      if (item.arrived !== undefined && typeof item.arrived !== 'boolean') throw new Error('Érvénytelen megérkezési jelölés');
      if (item.paid !== undefined && typeof item.paid !== 'boolean') throw new Error('Érvénytelen fizetésjelölés');
      if (item.vehicleId !== undefined && (typeof item.vehicleId !== 'string' || item.vehicleId.length > 200)) throw new Error('Érvénytelen autó-hozzárendelés');
      if (item.orderedAt !== undefined && (typeof item.orderedAt !== 'string' || (item.orderedAt !== '' && (!Number.isFinite(Date.parse(item.orderedAt)) || new Date(item.orderedAt).toISOString() !== item.orderedAt || item.ordered !== true)))) throw new Error('Érvénytelen rendelési időpont');
      quantity(item.quantity); percent(item.discountPercent);
      if (item.fullPrice !== '') cents(item.fullPrice);
      if (item.discountedPrice !== '') cents(item.discountedPrice);
      if (item.priceMode === 'auto' && item.discountedPrice !== discounted(item.fullPrice, item.discountPercent)) throw new Error('Eltérő számított kedvezményes ár');
      if (item.priceMode === 'manual') {
        const expected = manualPercent(item.fullPrice, item.discountedPrice);
        if (expected === '' ? item.discountPercent !== '' : percent(item.discountPercent) !== percent(expected)) throw new Error('Eltérő számított kedvezményszázalék');
      }
    }
    return items;
  }
  function totals(items) {
    let full = 0n, reduced = 0n, savings = 0n, active = 0, fullPriced = 0, discountedPriced = 0, priced = 0;
    for (const item of items) {
      if (!isActive(item)) continue;
      active++;
      const count = quantity(item.quantity);
      const hasFull = item.fullPrice !== '', hasDiscounted = item.discountedPrice !== '';
      if (hasFull) { full += cents(item.fullPrice) * count; fullPriced++; }
      if (hasDiscounted) { reduced += cents(item.discountedPrice) * count; discountedPriced++; }
      if (hasFull && hasDiscounted) { savings += (cents(item.fullPrice) - cents(item.discountedPrice)) * count; priced++; }
    }
    return { fullPrice: decimal(full, 2), discountedPrice: decimal(reduced, 2), savings: decimal(savings, 2), missing: active - priced, active, priced, fullPriced, discountedPriced, missingFull: active - fullPriced, missingDiscounted: active - discountedPriced };
  }
  function totalsHint(result) {
    if (!result.missing) return 'Az összesítés a darabszámokat is figyelembe veszi.';
    const messages = [];
    if (result.missingFull) messages.push(result.missingFull + ' tételnél hiányzik a teli ár.');
    if (result.missingDiscounted) messages.push(result.missingDiscounted + ' tételnél hiányzik a kedvezményes ár.');
    messages.push(result.discountedPriced && !result.missingDiscounted ? 'A kedvezményes végösszeg az összes tételt tartalmazza.' : 'A részösszegek csak a megadott árakat tartalmazzák.');
    return messages.join(' ');
  }
  function formatMoney(value) {
    if (value === '') return '—';
    const negative = value.startsWith('-'), amount = scaled(negative ? value.slice(1) : value, 2, /^\d+(?:[.,]\d{1,2})?$/, 'Érvénytelen összeg');
    const whole = new Intl.NumberFormat('hu-HU').format(amount / 100n), fraction = amount % 100n;
    return (negative ? '−' : '') + whole + (fraction ? ',' + fraction.toString().padStart(2, '0') : '') + ' Ft';
  }
  function syncLegacy(note) {
    note.part = note.items.filter(isActive).map(item => [item.partNumber || item.description, item.supplier, item.fullPrice !== '' ? item.fullPrice + 'Ft' + (item.discountedPrice !== '' ? '-' + item.discountedPrice + 'Ft' : '') : item.discountedPrice !== '' ? 'Kedvezményes ár: ' + item.discountedPrice + 'Ft' : '', item.quantity !== '1' ? 'x' + item.quantity : '', order(item).ordered ? 'Rendelve' : ''].filter(Boolean).join(' ')).join('\n');
    const result = totals(note.items);
    note.fullPrice = result.fullPriced && !result.missingFull ? result.fullPrice : '';
    note.discountPrice = result.discountedPriced && !result.missingDiscounted ? result.discountedPrice : '';
    note.paid = paymentState(note.items, note.paid).paid;
  }
  const api = { blank, cents, percent, quantity, discounted, discountFromPrices, parseLegacyLine, normalizeNote, normalizeItem, normalizeSupplier, validate, totals, totalsHint, formatMoney, syncLegacy, order, withOrder, edit, orderCounts, isActive, paymentState, withPaid, withArrival, setAllPaid };
  if (typeof module !== 'undefined') module.exports = api;
  else root.LineItems = api;
})(globalThis);
