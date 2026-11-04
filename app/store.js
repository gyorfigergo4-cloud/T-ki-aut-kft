const fs = require('node:fs');
const path = require('node:path');
const { validDay } = require('./archive');
function validate(notes) {
  if (!Array.isArray(notes) || notes.some(n => !n || typeof n.id !== 'string' || typeof n.title !== 'string' || typeof n.body !== 'string' || typeof n.updated !== 'string')) throw new Error('Sérült jegyzetadatok');
  for (const note of notes) {
    if (note.day !== undefined && !validDay(note.day)) throw new Error('Érvénytelen bejegyzésdátum');
    for (const field of ['vin', 'part', 'oil', 'fullPrice', 'discountPrice', 'created']) {
      if (note[field] !== undefined && typeof note[field] !== 'string') throw new Error('Sérült mező: ' + field);
    }
    if (!Number.isFinite(Date.parse(note.updated)) || (note.created !== undefined && !Number.isFinite(Date.parse(note.created)))) throw new Error('Sérült dátum');
    for (const field of ['fullPrice', 'discountPrice']) {
      const value = note[field];
      if (value !== undefined && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error('Érvénytelen ár');
    }
  }
  return notes;
}
function read(file) {
  if (!fs.existsSync(file)) return [];
  return validate(JSON.parse(fs.readFileSync(file, 'utf8')));
}
function write(file, notes) {
  validate(notes);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(notes), 'utf8');
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
  fs.renameSync(temp, file);
}
module.exports = { read, write, validate };
