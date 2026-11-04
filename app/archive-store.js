const fs = require('node:fs');
const path = require('node:path');
const { defaultYears, validate } = require('./archive');
function read(file) {
  if (!fs.existsSync(file)) return { years: [...defaultYears], days: [] };
  return validate(JSON.parse(fs.readFileSync(file, 'utf8')));
}
function write(file, archive) {
  validate(archive);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(archive), 'utf8');
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
  fs.renameSync(file + '.tmp', file);
}
module.exports = { read, write };
