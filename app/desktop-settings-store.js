const fs = require('node:fs');
const path = require('node:path');
const defaults = () => ({ version: 1, openAtLogin: false, closeToTray: true, loginPath: '' });
function validate(value) {
  if (!value || value.version !== 1 || typeof value.openAtLogin !== 'boolean' || typeof value.closeToTray !== 'boolean' || typeof value.loginPath !== 'string' || value.loginPath.length > 32768 || value.loginPath.includes('\0')) throw new Error('Az indítási beállítások nem olvashatók.');
  return { version: 1, openAtLogin: value.openAtLogin, closeToTray: value.closeToTray, loginPath: value.loginPath };
}
function read(file) {
  if (!fs.existsSync(file)) return defaults();
  if (fs.statSync(file).size > 65536) throw new Error('Az indítási beállítások nem olvashatók.');
  return validate(JSON.parse(fs.readFileSync(file, 'utf8')));
}
function write(file, value) {
  const bytes = JSON.stringify(validate(value), null, 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', bytes, 'utf8');
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
  fs.renameSync(file + '.tmp', file);
}
module.exports = { defaults, read, write };
