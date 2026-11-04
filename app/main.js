const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const store = require('./store');
const archiveStore = require('./archive-store');
const initialImport = require('./initial-import');
const { validate: validateArchive } = require('./archive');
let win;
app.whenReady().then(() => {
  const file = path.join(app.getPath('userData'), 'notes.json');
  const archiveFile = path.join(app.getPath('userData'), 'archive.json');
  let prepared = false;
  function prepareInitialData() {
    if (!prepared) {
      initialImport.apply(app.getPath('userData'), path.join(__dirname, 'private-data', 'initial-import.json'));
      prepared = true;
    }
  }
  ipcMain.handle('load-archive', () => { prepareInitialData(); return archiveStore.read(archiveFile); });
  ipcMain.handle('save-archive', (_, archive) => archiveStore.write(archiveFile, archive));
  ipcMain.handle('load', () => { prepareInitialData(); return store.read(file); });
  ipcMain.handle('save', (_, notes) => store.write(file, notes));
  ipcMain.handle('export', async (_, notes, archive) => {
    store.validate(notes);
    validateArchive(archive);
    const result = await dialog.showSaveDialog(win, { defaultPath: 'jegyzetek.json', filters: [{ name: 'Jegyzetmentés', extensions: ['json'] }] });
    if (result.canceled) return false;
    await fs.writeFile(result.filePath, JSON.stringify({ format: 'autobolt-backup', version: 1, archive, notes }, null, 2), 'utf8');
    return true;
  });
  win = new BrowserWindow({ width: 1240, height: 850, minWidth: 900, minHeight: 600, title: 'Töki Autó Kft. · Belső jegyzetek', backgroundColor: '#F5F7F2', icon: path.join(__dirname, 'assets', 'toki-logo.png'), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
