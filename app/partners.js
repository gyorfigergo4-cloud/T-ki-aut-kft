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
  if (!name || name.length > 200 || phone.length > 100 || !phoneKey(phone)) {
    throw Error('Adj meg egy nevet és egy érvényes telefonszámot.');
  }
  return { name, phone };
}

function validate(people) {
  if (!Array.isArray(people)) throw Error('Érvénytelen partnerlista.');
  const ids = new Set(), keys = new Set();
  for (const person of people) {
    if (!person || typeof person.id !== 'string' || !person.id || ids.has(person.id) ||
        Object.keys(person).some(field => !['id', 'name', 'phone'].includes(field))) throw Error('Érvénytelen partner.');
    contact(person.name, person.phone);
    const key = keyOf(person);
    if (keys.has(key)) throw Error('Ez a név és telefonszám már szerepel a partnerlistában.');
    ids.add(person.id);
    keys.add(key);
  }
  return people;
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
  const phones = new Set(people.map(person => phoneKey(person.phone)));
  const seen = new Set(people.map(keyOf));
  const rows = [];
  let missingName = 0, missingPhone = 0, invalidPhone = 0, duplicates = 0;
  const added = new Map();
  for (const note of notes) {
    const name = clean(note.title || '');
    if (!name || name.length > 200) { missingName++; continue; }
    const field = clean(note.phone || '');
    const fieldValid = field.length <= 100 && phoneKey(field);
    const numbers = fieldValid ? [field] : phonesFromBody(note.body);
    if (!numbers.length) {
      if (field) invalidPhone++;
      else missingPhone++;
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
    row.possibleDuplicate = names.has(nameKey(row.name)) || phones.has(phoneKey(row.phone));
    names.add(nameKey(row.name));
    phones.add(phoneKey(row.phone));
  }
  // Flag both entries of an ambiguous pair so neither is preselected.
  names.clear();
  phones.clear();
  for (const row of rows.slice().reverse()) {
    const name = nameKey(row.name), phone = phoneKey(row.phone);
    row.possibleDuplicate ||= names.has(name) || phones.has(phone);
    names.add(name);
    phones.add(phone);
  }
  return { rows, skipped: missingName + missingPhone + invalidPhone, missingName, missingPhone, invalidPhone, duplicates };
}

function merge(people, rows) {
  const seen = new Set(people.map(keyOf));
  const next = people.slice();
  for (const row of rows) {
    const person = contact(row.name, row.phone);
    const key = keyOf(person);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({ id: randomUUID(), ...person });
  }
  return next;
}

module.exports = { validate, candidates, merge };
