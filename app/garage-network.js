const http = require('node:http');
const net = require('node:net');
const { timingSafeEqual } = require('node:crypto');
const { GarageError } = require('./garage-database');
const MAX_BYTES = 16 * 1024 * 1024;
const DEFAULT_PORT = 47831;
function privateAddress(address) {
  address = (address || '').replace(/^::ffff:/, '');
  if (address === '::1') return true;
  if (net.isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}
function settings(input) {
  if (!input || !['local', 'host', 'client'].includes(input.mode)) throw new GarageError('Válassz működési módot.');
  const port = input.port === undefined ? DEFAULT_PORT : Number(input.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new GarageError('A port 1024 és 65535 közötti szám legyen.');
  if (input.mode === 'local') return { mode: 'local', port };
  const token = String(input.token || '').replace(/[\s-]/g, '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(token)) throw new GarageError('A kapcsolódási kód 32 betűből/számból áll. Másold át a központi gépről.');
  const config = { mode: input.mode, port, token };
  if (input.mode === 'client') {
    if (net.isIP(input.host) !== 4 || !privateAddress(input.host)) throw new GarageError('A központi gép helyi IPv4-címét add meg, például 192.168.1.20.');
    config.host = input.host;
  }
  return config;
}
function startServer({ database, token, port = DEFAULT_PORT, host = '0.0.0.0' }) {
  const server = http.createServer(async (req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
    if (!privateAddress(req.socket.remoteAddress) || req.headers.origin) { send(403, { error: 'Hozzáférés megtagadva.' }); return; }
    const provided = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from('Bearer ' + token);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) { send(401, { error: 'Hibás kapcsolódási kód.', code: 'unauthorized' }); return; }
    if (req.url !== '/garage') { send(404, { error: 'Nincs ilyen végpont.' }); return; }
    if (!['GET', 'PUT'].includes(req.method)) { send(405, { error: 'Nem engedélyezett művelet.' }); return; }
    try {
      if (req.method === 'GET') { send(200, database.read()); return; }
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > MAX_BYTES) { send(413, { error: 'Túl nagy autólista.' }); return; } chunks.push(chunk); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { send(400, { error: 'Hibás adatok.' }); return; }
      if (!body || Object.keys(body).some(k => !['people', 'revision'].includes(k))) { send(400, { error: 'Csak autónyilvántartó adatok küldhetők.' }); return; }
      try { send(200, database.write(body.people, body.revision)); }
      catch (error) { send(error.code === 'conflict' ? 409 : 400, { error: error.message, code: error.code || 'invalid' }); }
    } catch { if (!res.headersSent) send(503, { error: 'A közös autónyilvántartó nem olvasható vagy nem menthető.', code: 'unavailable' }); }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  return new Promise((resolve, reject) => {
    const fail = error => reject(new GarageError(error.code === 'EADDRINUSE' ? 'A portot már más program használja. Válassz másik portot.' : 'A központi szolgáltatás nem indítható.'));
    server.once('error', fail);
    server.listen(port, host, () => { server.off('error', fail); server.on('error', () => {}); resolve(server); });
  });
}
function request(config, method = 'GET', payload) {
  return new Promise((resolve, reject) => {
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    if (body && Buffer.byteLength(body) > MAX_BYTES) { reject(new GarageError('Túl nagy autólista.')); return; }
    const req = http.request({ host: config.host, port: config.port, path: '/garage', method, headers: { Authorization: 'Bearer ' + config.token, ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) } }, res => {
      let size = 0; const chunks = [];
      res.on('data', chunk => { size += chunk.length; if (size > MAX_BYTES) { res.destroy(); reject(new GarageError('Túl nagy szerverválasz.')); } else chunks.push(chunk); });
      res.on('error', () => reject(new GarageError('Megszakadt a kapcsolat a központi géppel.')));
      res.on('end', () => {
        try { const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (res.statusCode !== 200) { reject(new GarageError(data.error || 'A központi gép nem fogadta el a műveletet.', data.code)); return; }
          const { validate } = require('./garage-model'); validate(data.people);
          if (typeof data.revision !== 'string' || !data.revision) throw Error('revision');
          resolve(data);
        } catch { reject(new GarageError('Érvénytelen válasz a központi géptől.')); }
      });
    });
    req.setTimeout(5000, () => req.destroy());
    req.on('error', () => reject(new GarageError('A központi gép nem érhető el. Ellenőrizd, hogy be van-e kapcsolva, fut-e a program, és a helyi hálózati tűzfal engedi-e a kapcsolatot. A jegyzetek továbbra is külön használhatók.')));
    if (body) req.write(body); req.end();
  });
}
module.exports = { settings, privateAddress, startServer, request, DEFAULT_PORT };
