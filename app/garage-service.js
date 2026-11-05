// Network access is confined to garage records; private notes are never inputs.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes, createHash } = require('node:crypto');
const Store = require('./garage-store');
const { createDatabase, GarageError } = require('./garage-database');
const Network = require('./garage-network');
function createService(userData) {
  const localFile = path.join(userData, 'garage.json');
  const configFile = path.join(userData, 'garage-network.json');
  const sharedFile = path.join(userData, 'shared-garage', 'people.json');
  let config = { mode: 'local', port: Network.DEFAULT_PORT }, server, database, startupError;
  function localRead() {
    const people = Store.read(localFile);
    return { people, revision: createHash('sha256').update(JSON.stringify(people)).digest('hex') };
  }
  function persistConfig(next) {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(configFile + '.tmp', JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(configFile + '.tmp', configFile);
  }
  async function start() {
    try {
      if (fs.existsSync(configFile)) config = Network.settings(JSON.parse(fs.readFileSync(configFile, 'utf8')));
      if (config.mode === 'host') {
        database = createDatabase(sharedFile, fs.existsSync(sharedFile) ? [] : Store.read(localFile));
        server = await Network.startServer({ database, token: config.token, port: config.port });
      }
    } catch (error) { startupError = error; }
  }
  async function load() {
    if (startupError) throw new GarageError('Az autónyilvántartó hálózati beállítása hibás vagy a központ nem indítható. Ellenőrizd a Kapcsolat beállítását.');
    if (config.mode === 'client') return Network.request(config);
    if (config.mode === 'host') return database.read();
    return localRead();
  }
  async function save(payload) {
    if (!payload || !Array.isArray(payload.people)) throw new GarageError('Hibás autónyilvántartó mentés.');
    if (startupError) throw new GarageError('A közös autónyilvántartó nem elérhető.');
    if (config.mode === 'client') return Network.request(config, 'PUT', payload);
    if (config.mode === 'host') return database.write(payload.people, payload.revision);
    if (localRead().revision !== payload.revision) throw new GarageError('A helyi autólista közben változott. Nyisd meg újra a szerkesztőt.', 'conflict');
    Store.write(localFile, payload.people); return localRead();
  }
  async function configure(input) {
    const next = Network.settings(input.mode === 'host' ? { ...input, token: config.mode === 'host' ? config.token : randomBytes(16).toString('hex') } : input);
    let candidate, nextDatabase;
    if (next.mode === 'client') await Network.request(next); // Fail safely without replacing working settings.
    if (next.mode === 'host') {
      nextDatabase = database || createDatabase(sharedFile, fs.existsSync(sharedFile) ? [] : Store.read(localFile));
      if (!server || next.port !== config.port) candidate = await Network.startServer({ database: nextDatabase, token: next.token, port: next.port });
    }
    try { persistConfig(next); }
    catch { if (candidate) candidate.close(); throw new GarageError('A kapcsolat beállítása nem menthető.'); }
    const old = server;
    server = next.mode === 'host' ? candidate || server : undefined;
    if (old && old !== server) { old.close(); old.closeAllConnections(); }
    database = nextDatabase || database;
    config = next; startupError = undefined; return status();
  }
  function status() {
    const addresses = Object.values(os.networkInterfaces()).flat().filter(entry => entry.family === 'IPv4' && !entry.internal && Network.privateAddress(entry.address)).map(entry => entry.address);
    return { mode: config.mode, port: config.port, host: config.host || '', addresses, ...(config.mode === 'host' ? { pairingCode: config.token } : {}), error: startupError ? 'A központ indítása vagy a beállítások betöltése nem sikerült.' : null };
  }
  async function close() { if (server) { const old = server; server = undefined; old.closeAllConnections(); await new Promise(resolve => old.close(resolve)); } }
  return { start, load, save, configure, status, close };
}
module.exports = { createService };
