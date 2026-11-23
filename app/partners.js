const { percent } = require('./items');
const { randomUUID } = require('node:crypto');

const clean = value => value.normalize('NFC').trim().replace(/\s+/g, ' ');
const nameKey = name => clean(name).toLocaleLowerCase('hu');
function phoneKey(phone) {
  if (!/^[+\d(). /-]+$/.test(phone)) return '';
  const digits = phone.replace(/\D/g, '');
  const key = digits.replace(/^00/, '').replace(/^06(?=\d{8,9}$)/, '36');
  return key.length >= 6 && key.length <= 15 ? key : '';
}
const keyOf = ({ name, phone }) => JSON.stringify([nameKey(name), phoneKey(phone)]);

function contact(name, phone) {
  if (typeof name !== 'string' || typeof phone !== 'string') throw Error('Add meg a nevet és a telefonszámot.');
  name = clean(name);
  phone = clean(phone);
  if (!name || name.length > 200) throw Error('Adj meg egy legfeljebb 200 karakteres nevet.');
  if (phone && (phone.length > 100 || !phoneKey(phone))) throw Error('Adj meg érvényes telefonszámot, vagy hagyd üresen a mezőt.');
  return { name, phone };
}

function validate(people) {
  if (!Array.isArray(people)) throw Error('Érvénytelen partnerlista.');
  const ids = new Set(), keys = new Set();
  for (const person of people) {
    if (!person || typeof person.id !== 'string' || !person.id || ids.has(person.id) ||
        Object.keys(person).some(field => !['id', 'name', 'phone', 'discountPercent'].includes(field))) throw Error('Érvénytelen partner.');
    contact(person.name, person.phone);
    if (person.discountPercent !== undefined) {
      if (typeof person.discountPercent !== 'string' || !person.discountPercent) throw Error('Érvénytelen alapkedvezmény.');
      percent(person.discountPercent);
    }
    const key = keyOf(person);
    if (keys.has(key)) throw Error('Ez a név és telefonszám már szerepel a partnerlistában.');
    ids.add(person.id);
    keys.add(key);
  }
  return people;
}

function match(people, name, phone) {
  const key = nameKey(name);
  const matches = people.filter(person => nameKey(person.name) === key);
  if (matches.length <= 1) return { discountPercent: matches[0]?.discountPercent };
  const number = phoneKey(phone);
  const exact = number && matches.find(person => phoneKey(person.phone) === number);
  return exact ? { discountPercent: exact.discountPercent } : { ambiguous: true };
}

function phonesFromBody(body) {
  const found = new Map();
  for (const line of (body || '').split(/\r?\n/)) {
    const labeled = line.match(/^\s*(?:telefon(?:szám)?|tel\.?|mobil(?:szám)?|phone)\s*(?::|=|[-–]|\s)\s*(.+)$/iu);
    const phone = clean(labeled?.[1] || line);
    const key = phoneKey(phone);
    const hungarian = /^(?:\+36|0036|06)[\s()./-]*\d/.test(phone) && /^36\d{8,9}$/.test(key);
    if (phone.length <= 100 && key && (labeled || hungarian)) found.set(key, phone);
  }
  return [...found.values()];
}

function candidates(notes, people) {
  const names = new Set(people.map(person => nameKey(person.name)));
  const phones = new Set(people.map(person => phoneKey(person.phone)).filter(Boolean));
  const seen = new Set(people.map(keyOf));
  const rows = [];
  let missingName = 0, missingPhone = 0, invalidPhone = 0, duplicates = 0;
  const added = new Map();
  const namesWithoutPhone = new Map();
  for (const note of notes) {
    const name = clean(note.title || '');
    if (!name || name.length > 200) { missingName++; continue; }
    const field = clean(note.phone || '');
    const fieldValid = field.length <= 100 && phoneKey(field);
    const numbers = fieldValid ? [field] : phonesFromBody(note.body);
    if (!numbers.length) {
      if (field) invalidPhone++;
      else missingPhone++;
      const key = nameKey(name);
      if (namesWithoutPhone.has(key)) duplicates++;
      else namesWithoutPhone.set(key, name);
      continue;
    }
    for (const phone of numbers) {
      const key = keyOf({ name, phone });
      if (seen.has(key)) {
        duplicates++;
        if (fieldValid && added.has(key)) added.get(key).fromText = false;
        continue;
      }
      seen.add(key);
      const row = { name, phone, fromText: !fieldValid };
      added.set(key, row);
      rows.push(row);
    }
  }
  for (const row of rows) {
    const name = nameKey(row.name), phone = phoneKey(row.phone);
    row.possibleDuplicate = names.has(name) || phones.has(phone);
    names.add(name);
    phones.add(phone);
  }
  // Names with a phone elsewhere are already represented in the preview or directory.
  for (const [key, name] of namesWithoutPhone) {
    if (names.has(key)) duplicates++;
    else rows.push({ name, phone: '', fromText: false, possibleDuplicate: false });
  }

  names.clear();
  phones.clear();
  for (const row of rows.slice().reverse()) {
    const name = nameKey(row.name), phone = phoneKey(row.phone);
    row.possibleDuplicate ||= names.has(name) || (!!phone && phones.has(phone));
    names.add(name);
    if (phone) phones.add(phone);
  }
  return { rows, skipped: missingName, missingName, missingPhone, invalidPhone, duplicates };
}

function merge(people, rows) {
  const seen = new Set(people.map(keyOf));
  const next = people.slice();
  const indexes = new Map();
  const incoming = new Map();
  const withPhone = new Map();
  for (const [index, person] of people.entries()) {
    const name = nameKey(person.name);
    const entries = indexes.get(name) || [];
    entries.push(index);
    indexes.set(name, entries);
  }
  for (const row of rows) {
    const person = contact(row.name, row.phone);
    const name = nameKey(person.name);
    if (person.phone) withPhone.set(keyOf(person), person);
    else incoming.set(name, person);
  }
  const numberCounts = new Map();
  for (const person of withPhone.values()) {
    const name = nameKey(person.name);
    numberCounts.set(name, (numberCounts.get(name) || 0) + 1);
  }
  for (const [key, person] of withPhone) {
    if (seen.has(key)) continue;
    const name = nameKey(person.name);
    const matches = indexes.get(name);
    if (matches?.length === 1 && !next[matches[0]].phone && numberCounts.get(name) === 1) {
      // A reviewed number from another machine can fill the existing contact.
      const index = matches[0];
      next[index] = { ...next[index], phone: person.phone };
    } else {
      next.push({ id: randomUUID(), ...person });
    }
  }
  for (const [name, person] of incoming) {
    if (!indexes.has(name) && !numberCounts.has(name)) next.push({ id: randomUUID(), ...person });
  }
  return next;
}

module.exports = { validate, candidates, merge, match };
