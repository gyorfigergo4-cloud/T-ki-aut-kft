// Format the Töki Autó artwork for Windows without redesigning the logo.
// Run with Electron: electron scripts/build-notification-icons.cjs app/assets/toki-icon.png
const { app, nativeImage } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
app.setPath('userData', path.join(os.tmpdir(), 'toki-notification-icon-builder'));
app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const source = process.argv.slice(2).find(value => !value.startsWith('--') && /\.png$/i.test(value));
  if (!source) throw Error('Provide the generated source PNG path.');
  const artwork = nativeImage.createFromPath(path.resolve(source));
  if (artwork.isEmpty()) throw Error('The generated image cannot be read.');
  const output = path.resolve(__dirname, '../app/assets');
  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const png = size => artwork.resize({ width: size, height: size, quality: 'best' }).toPNG();
  fs.writeFileSync(path.join(output, 'toki-notification.png'), png(256));
  const frames = sizes.map(size => ({ size, bytes: png(size) }));
  const header = Buffer.alloc(6 + 16 * frames.length); header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, bytes }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size; header[entry + 1] = header[entry];
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8); header.writeUInt32LE(offset, entry + 12); offset += bytes.length;
  });
  fs.writeFileSync(path.join(output, 'toki-tray.ico'), Buffer.concat([header, ...frames.map(frame => frame.bytes)]));
  console.log(JSON.stringify({ notificationPng: '256×256', trayIcoFrames: sizes }));
  app.exit(0);
}).catch(error => { console.error(error.message); app.exit(1); });
