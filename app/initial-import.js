const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');
const archiveStore = require('./archive-store');
const { validate: validateArchive, normalize } = require('./archive');

function writeJson(file, value) {
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(file + '.tmp', file);
}
function validateBundle(bundle) {
  if (!bundle || bundle.format !== 'autobolt-initial-import' || bundle.version !== 1 || !/^txt-zip-[a-f0-9]{64}$/.test(bundle.bundleId)) throw new Error('Érvénytelen kezdeti import');
  store.validate(bundle.notes); validateArchive(bundle.archive);
  if (new Set(bundle.notes.map(note => note.id)).size !== bundle.notes.length) throw new Error('Ismétlődő importazonosító');
  return bundle;
}
function apply(dataDirectory, bundleFile) {
  if (!fs.existsSync(bundleFile)) return { imported: 0, available: false };
  const bundle = validateBundle(JSON.parse(fs.readFileSync(bundleFile, 'utf8')));
  const ledgerFile = path.join(dataDirectory, 'imports.json');
  let ledger = { completed: [] };
  if (fs.existsSync(ledgerFile)) {
    ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
    if (!ledger || !Array.isArray(ledger.completed) || ledger.completed.some(entry => !entry || typeof entry.bundleId !== 'string')) throw new Error('Sérült importnapló');
  }
  if (ledger.completed.some(entry => entry.bundleId === bundle.bundleId)) return { imported: 0, alreadyImported: true };
  const notesFile = path.join(dataDirectory, 'notes.json'), archiveFile = path.join(dataDirectory, 'archive.json');
  const existingNotes = store.read(notesFile), existingArchive = archiveStore.read(archiveFile);
  const knownIds = new Set(existingNotes.map(note => note.id));
  const additions = bundle.notes.filter(note => !knownIds.has(note.id));
  const merged = normalize([...existingNotes, ...additions], {
    years: [...existingArchive.years, ...bundle.archive.years], days: [...existingArchive.days, ...bundle.archive.days]
  });
  // A durable, import-specific backup precedes the first write. Retrying a partial
  // import cannot overwrite this backup or duplicate/replace existing records.
  const backupDirectory = path.join(dataDirectory, 'import-backups', bundle.bundleId);
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  const manifest = path.join(backupDirectory, 'manifest.json');
  if (!fs.existsSync(manifest)) {
    const files = [];
    for (const name of ['notes.json', 'archive.json', 'imports.json']) {
      const source = path.join(dataDirectory, name), target = path.join(backupDirectory, name);
      if (fs.existsSync(source)) {
        if (!fs.existsSync(target)) fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
        files.push(name);
      }
    }
    writeJson(manifest, { bundleId: bundle.bundleId, files, createdAt: new Date().toISOString() });
  }
  archiveStore.write(archiveFile, { years: merged.years, days: merged.days });
  store.write(notesFile, merged.notes);
  ledger.completed.push({ bundleId: bundle.bundleId, imported: additions.length, completedAt: new Date().toISOString() });
  writeJson(ledgerFile, ledger);
  return { imported: additions.length, total: merged.notes.length, days: merged.days.length };
}
module.exports = { apply, validateBundle };
