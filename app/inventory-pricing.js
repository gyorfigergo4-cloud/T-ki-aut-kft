(function (root) {
  'use strict';
  const Items = typeof module !== 'undefined' ? require('./items') : root.LineItems;
  const DEFAULTS = Object.freeze({ general: '40', engineOil: '20', transmissionOil: '20' });
  function decimal(value, places = 2) {
    const scale = 10n ** BigInt(places), fraction = (value % scale).toString().padStart(places, '0').replace(/0+$/, '');
    return (value / scale).toString() + (fraction ? '.' + fraction : '');
  }
  function percent(value) {
    if (typeof value !== 'string' || value === '') throw Error('A kedvezményt 0 és 100 közötti százalékban add meg.');
    return decimal(Items.percent(value), 6);
  }
  function price(value) { return value === undefined || value === '' ? '' : decimal(Items.cents(value)); }
  function override(value) { return value === undefined || value === '' ? '' : percent(value); }
  function settings(value) {
    if (value === undefined) return { ...DEFAULTS };
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !Object.hasOwn(DEFAULTS, key))) throw Error('Érvénytelen alapkedvezmények.');
    return Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, percent(value[key])]));
  }
  function defaultPercent(category, value) {
    const s = settings(value); return category === 'engine-oil' ? s.engineOil : category === 'transmission-oil' ? s.transmissionOil : s.general;
  }
  function quote(fullPrice, discountPercent) {
    const full = price(fullPrice), discount = percent(discountPercent);
    return { fullPrice: full, discountPercent: discount, discountedPrice: Items.discounted(full, discount) };
  }
  function product(product, value) { return quote(product.price, override(product.discountPercent) || defaultPercent(product.category, value)); }
  function version(product, value) { return JSON.stringify([price(product.price), override(product.discountPercent), product.category || '', settings(value)]); }
  function line(fullPrice, discountPercent, quantity) {
    if (quantity === null) return null;
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1000000000) throw Error('Hibás készletdarabszám.');
    if (quantity === 0) return { fullValue: '0', discountedValue: '0', savings: '0' };
    if (fullPrice === '' || discountPercent === '') return null;
    const q = quote(fullPrice, discountPercent), full = Items.cents(q.fullPrice) * BigInt(quantity), discounted = Items.cents(q.discountedPrice) * BigInt(quantity);
    return { fullValue: decimal(full), discountedValue: decimal(discounted), savings: decimal(full - discounted) };
  }
  function amount(value) {
    if (typeof value !== 'string' || !/^\d{1,40}(?:\.\d{1,2})?$/.test(value)) throw Error('Sérült készletérték.');
    const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  }
  function total(rows) {
    let full = 0n, reduced = 0n, missingPrices = 0, uncounted = 0, counted = 0;
    for (const row of rows) {
      if (row.quantity === null) { uncounted++; continue; }
      counted++; const value = line(row.fullPrice, row.discountPercent, row.quantity);
      if (!value) { missingPrices++; continue; }
      full += amount(value.fullValue); reduced += amount(value.discountedValue);
    }
    return { fullValue: decimal(full), discountedValue: decimal(reduced), savings: decimal(full - reduced), missingPrices, uncounted, counted };
  }
  function warehouse(products, value) { return total(products.map(p => ({ ...product(p, value), quantity: p.quantity }))); }
  function validateTotal(value) {
    if (!value || typeof value !== 'object') throw Error('Sérült készletérték.');
    for (const field of ['fullValue', 'discountedValue', 'savings']) amount(value[field]);
    for (const field of ['missingPrices', 'uncounted', 'counted']) if (!Number.isSafeInteger(value[field]) || value[field] < 0) throw Error('Sérült készletérték.');
    if (amount(value.fullValue) - amount(value.discountedValue) !== amount(value.savings)) throw Error('Sérült készletérték.');
  }
  const api = { DEFAULTS, price, percent, override, settings, defaultPercent, quote, product, version, line, total, warehouse, validateTotal, formatMoney: Items.formatMoney };
  if (typeof module !== 'undefined') module.exports = api; else root.InventoryPricing = api;
})(globalThis);
