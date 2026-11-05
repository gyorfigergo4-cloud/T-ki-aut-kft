const fs = require('node:fs');
const path = require('node:path');
const { validDay } = require('./archive');
const lineItems = require('./items');
const noteStatuses = require('./note-status');
const vehicles = require('./vehicles');
function validate(notes) {
  if (!Array.isArray(notes) || notes.some(n => !n || typeof n.id !== 'string' || typeof n.title !== 'string' || typeof n.body !== 'string' || typeof n.updated !== 'string')) throw new Error('Sérült jegyzetadatok');
  for (const note of notes) {
    noteStatuses.validate(note.workflowStatus);
    vehicles.validate(note.vehicles);
    if (note.paid !== undefined && typeof note.paid !== 'boolean') throw new Error('Érvénytelen fizetésjelölés');
    if (note.items !== undefined) lineItems.validate(note.items);
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
  const migrationBackup = file + '.before-items-v1.json';
  if (fs.existsSync(file) && !fs.existsSync(migrationBackup) && notes.some(note => Array.isArray(note.items)) && read(file).some(note => note.items === undefined)) {
    fs.copyFileSync(file, migrationBackup, fs.constants.COPYFILE_EXCL);
  }
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(notes), 'utf8');
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
  fs.renameSync(temp, file);
}
module.exports = { read, write, validate };
