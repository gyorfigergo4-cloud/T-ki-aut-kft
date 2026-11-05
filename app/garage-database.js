// Only the shared vehicle directory lives here. No note/archive/workorder paths.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { validate } = require('./garage-model');
class GarageError extends Error {
  constructor(message, code = 'unavailable') { super(message); this.code = code; }
}
function createDatabase(file, seed = []) {
  function read() {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.version !== 1 || typeof data.revision !== 'string' || !data.revision) throw new GarageError('Sérült közös autónyilvántartó. Az adatokat nem írjuk felül.');
    validate(data.people);
    return { people: data.people, revision: data.revision };
  }
  function atomic(data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    const fd = fs.openSync(tmp, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(data, null, 2), 'utf8'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
    fs.renameSync(tmp, file);
  }
  if (!fs.existsSync(file)) { validate(seed); atomic({ version: 1, revision: randomUUID(), people: seed }); }
  read(); // Corrupt existing data must never be replaced by an empty list.
  return {
    read,
    write(people, revision) {
      validate(people);
      const before = read();
      if (typeof revision !== 'string' || revision !== before.revision) throw new GarageError('Valaki közben módosította a közös listát. A módosításod nem írta felül az övét. Zárd be ezt az ablakot a Mégse gombbal, várd meg a frissítést, majd nyisd meg újra.', 'conflict');
      const next = { version: 1, revision: randomUUID(), people };
      atomic(next); return { people, revision: next.revision };
    }
  };
}
module.exports = { createDatabase, GarageError };
