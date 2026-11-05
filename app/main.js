const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const store = require('./store');
const archiveStore = require('./archive-store');
const initialImport = require('./initial-import');
const folderImport = require('./folder-import');
const excelImport = require('./excel-import');
const workordersStore = require('./workorders-store');
const workorderPrint = require('./workorder-print');
const crypto = require('node:crypto');
const syncFs = require('node:fs');
const { validate: validateArchive } = require('./archive');
let win;
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
app.on('second-instance', () => {
  const active = win && !win.isDestroyed() ? win : BrowserWindow.getAllWindows()[0];
  if (active) { if (active.isMinimized()) active.restore(); active.show(); active.focus(); }
});
app.whenReady().then(() => {
  const file = path.join(app.getPath('userData'), 'notes.json');
  const workordersFile = path.join(app.getPath('userData'), 'workorders.json');
  const excelSessions = new Map();
  const folderSessions = new Map();
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
  ipcMain.on('confirm-note-exit', (event, request) => {
    const title = typeof request?.title === 'string' ? request.title.slice(0, 200) : 'Új név';
    const allPending = Array.isArray(request?.pending) ? request.pending.filter(text => typeof text === 'string') : [];
    const pending = allPending.slice(0, 8).map(text => '• ' + text.slice(0, 180));
    if (allPending.length > 8) pending.push('… és még ' + (allPending.length - 8) + ' nyitott teendő.');
    const detail = title + (pending.length ? '\n\nNyitott emlékeztetők:\n' + pending.join('\n') : '\nEllenőrizd a cikkszámokat, árakat és a darabszámokat.');
    event.returnValue = dialog.showMessageBoxSync(win, {
      type: 'question', title: 'Töki Autó – jegyzet ellenőrzése',
      message: 'Biztosan minden tételt felírtál?', detail,
      buttons: ['Igen, minden felírva', 'Vissza a jegyzethez'], defaultId: 1, cancelId: 1, noLink: true
    }) === 0;
  });
  ipcMain.handle('save', (_, notes) => store.write(file, notes));
  ipcMain.handle('import-folder', async () => {
    try {
      const result = await dialog.showOpenDialog(win, { title: 'Válaszd ki a TXT-jegyzetek teljes mappáját (év- és hónapmappákkal)', properties: ['openDirectory'] });
      if (result.canceled || !result.filePaths[0]) return { canceled: true };
      const prepared = folderImport.prepare(result.filePaths[0]);
      const token = crypto.randomUUID(); folderSessions.clear(); folderSessions.set(token, prepared.records);
      return { ok: true, token, files: prepared.files, issues: prepared.issues };
    }
    catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle('commit-folder-import', (_, request) => {
    try {
      const records = folderSessions.get(request.token);
      if (!records) throw new Error('Válaszd ki újra a jegyzetmappát.');
      const bundle = folderImport.buildFromScan(records, request.dates);
      const result = initialImport.applyBundle(app.getPath('userData'), bundle);
      const knownIds = new Set(store.read(file).map(note => note.id));
      const noteId = bundle.notes.filter(note => knownIds.has(note.id)).sort((a, b) => b.day.localeCompare(a.day))[0]?.id;
      folderSessions.delete(request.token);
      return { ok: true, ...result, files: bundle.fileCount, notes: bundle.notes.length, days: bundle.archive.days.length, noteId };
    } catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle('close-folder-import', (_, token) => { folderSessions.delete(token); });
  ipcMain.handle('load-workorders', () => workordersStore.read(workordersFile));
  ipcMain.handle('save-workorders', (_, docs) => workordersStore.write(workordersFile, docs));
  function excelSession(token) { const s = excelSessions.get(token); if (!s) throw new Error('Nyisd meg újra az Excel-fájlt.'); return s; }
  ipcMain.handle('open-excel', async () => {
    const selected = await dialog.showOpenDialog(win, { title: 'Excel .xlsx beolvasása (a .xls fájlt előbb mentsd .xlsx-ként)', properties: ['openFile'], filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true };
    try { const { session, view } = await excelImport.open(selected.filePaths[0]); const token = crypto.randomUUID(); excelSessions.clear(); excelSessions.set(token, session); return { ok: true, token, fileName: session.fileName, ...view }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle('excel-describe', (_, request) => { try { return { ok: true, ...excelImport.describe(excelSession(request.token), request.sheet, Number(request.headerRow)) }; } catch (error) { return { ok: false, error: error.message }; } });
  ipcMain.handle('excel-preview', (_, request) => { try { return { ok: true, ...excelImport.build(excelSession(request.token), request.config).preview }; } catch (error) { return { ok: false, error: error.message }; } });
  ipcMain.handle('close-excel', (_, token) => { excelSessions.delete(token); });
  ipcMain.handle('excel-commit', (_, request) => {
    try {
      const built = excelImport.build(excelSession(request.token), request.config);
      if (built.errors.length) throw new Error(built.errors[0]);
      if (!built.items.length) throw new Error('Nincs beolvasható tétel.');
      if (request.target === 'notes') {
        const result = initialImport.applyBundle(app.getPath('userData'), built.bundle);
        return { ok: true, ...result, target: 'notes', rows: built.items.length, noteId: built.bundle.notes[0]?.id };
      }
      if (request.target !== 'workorder') throw new Error('Válaszd ki a beolvasás helyét.');
      const result = excelImport.appendWorkorder(workordersStore.read(workordersFile), request.workorderId, built);
      workordersStore.write(workordersFile, result.docs);
      return { ok: true, target: 'workorder', workorderId: result.workorderId, rows: result.added, alreadyImported: result.added === 0 };
    } catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle('excel-template', async () => {
    const selected = await dialog.showSaveDialog(win, { defaultPath: 'TokiAuto-Excel-minta.xlsx', filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (selected.canceled) return { canceled: true };
    try { await excelImport.template(selected.filePath); return { ok: true }; } catch (error) { return { ok: false, error: error.message }; }
  });
  async function printWindow(doc, visible) {
    const logo = 'data:image/png;base64,' + syncFs.readFileSync(path.join(__dirname, 'assets', 'toki-logo.png')).toString('base64');
    const html = workorderPrint.html(doc, logo);
    const preview = new BrowserWindow({ width: 1000, height: 900, show: false, title: 'Töki Autó Kft. – nyomtatási előnézet', webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
    preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    preview.webContents.on('will-navigate', event => event.preventDefault());
    await preview.loadURL('data:text/html;charset=UTF-8;base64,' + Buffer.from(html).toString('base64'));
    await preview.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    if (visible) {
      preview.setMenu(Menu.buildFromTemplate([{ label: 'Dokumentum', submenu: [{ label: 'Nyomtatás', accelerator: 'CmdOrCtrl+P', click: () => printNative(preview).then(result => { if (!result.ok && !result.canceled) dialog.showMessageBox(preview, { type: 'error', message: 'A nyomtatás nem sikerült.', detail: result.error || '' }); }) }, { label: 'Mentés PDF-ként', click: () => savePdf(preview, doc).catch(error => dialog.showMessageBox(preview, { type: 'error', message: 'A PDF mentése nem sikerült.', detail: error.message })) }, { type: 'separator' }, { role: 'close', label: 'Bezárás' }] }]));
      preview.show();
    }
    return preview;
  }
  function printNative(preview) { return new Promise(resolve => preview.webContents.print({ silent: false, printBackground: true, pageSize: 'A4' }, (success, reason) => resolve({ ok: success, canceled: /cancel/i.test(reason || ''), error: success ? '' : reason }))); }
  async function savePdf(preview, doc) {
    const fileName = (doc.kind === 'quote' ? 'Arajanlat-' : 'Munkalap-') + doc.number.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-') + '.pdf';
    const selected = await dialog.showSaveDialog(preview.isVisible() ? preview : win, { defaultPath: fileName, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (selected.canceled) return { canceled: true };
    const bytes = await preview.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true, displayHeaderFooter: false });
    await fs.writeFile(selected.filePath, bytes); return { ok: true };
  }
  ipcMain.handle('workorder-output', async (_, request) => {
    let preview;
    try {
      if (!['preview', 'print', 'pdf'].includes(request.action)) throw new Error('Érvénytelen nyomtatási művelet.');
      preview = await printWindow(request.doc, request.action === 'preview');
      if (request.action === 'preview') return { ok: true };
      return request.action === 'pdf' ? await savePdf(preview, request.doc) : await printNative(preview);
    } catch (error) { return { ok: false, error: error.message }; }
    finally { if (preview && !preview.isDestroyed() && request.action !== 'preview') preview.destroy(); }
  });
  ipcMain.handle('export', async (_, notes, archive) => {
    store.validate(notes);
    validateArchive(archive);
    const result = await dialog.showSaveDialog(win, { defaultPath: 'jegyzetek.json', filters: [{ name: 'Jegyzetmentés', extensions: ['json'] }] });
    if (result.canceled) return false;
    await fs.writeFile(result.filePath, JSON.stringify({ format: 'autobolt-backup', version: 2, archive, notes, workorders: workordersStore.read(workordersFile) }, null, 2), 'utf8');
    return true;
  });
  win = new BrowserWindow({ width: 1240, height: 850, minWidth: 900, minHeight: 600, title: 'Töki Autó Kft. · Belső jegyzetek', backgroundColor: '#F5F7F2', icon: path.join(__dirname, 'assets', 'toki-icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.setMenuBarVisibility(false);
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && !input.isAutoRepeat && (input.control || input.meta) && input.key.toLowerCase() === 'p') { event.preventDefault(); win.webContents.send('request-workorder-print'); }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
}
