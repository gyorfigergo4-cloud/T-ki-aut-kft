const path = require('node:path');
const settingsStore = require('./desktop-settings-store');
const LOGIN_NAME = 'TokiAuto';
const STARTUP_ARGS = ['--toki-background'];
function create({ app, win, Tray, Menu, ipcMain, iconPath, platform = process.platform, executablePath = process.execPath, argv = process.argv, storage = settingsStore }) {
  const file = path.join(app.getPath('userData'), 'desktop-settings.json');
  const startupSupported = platform === 'win32' && app.isPackaged;
  let preferences, notice = '', tray = null, hiddenHint = false, alarmActive = false;
  try { preferences = storage.read(file); }
  catch { preferences = settingsStore.defaults(); notice = 'A korábbi indítási beállítások nem olvashatók. A Mentés gombbal újra beállíthatod őket.'; }
  function readLogin(loginPath = executablePath) {
    const target = loginPath || executablePath, actual = app.getLoginItemSettings({ path: target, args: [...STARTUP_ARGS] });
    if (!Array.isArray(actual.launchItems)) return actual;
    // Electron's Windows launchItems.args comes from CommandLine::GetArgs(),
    // which omits switches such as --toki-background. openAtLogin checks the
    // full registered command (including switches) under our AppUserModelId.
    const own = actual.launchItems.find(entry => entry.name.toLowerCase() === LOGIN_NAME.toLowerCase() && entry.scope === 'user' && path.win32.normalize(entry.path).toLowerCase() === path.win32.normalize(target).toLowerCase());
    return { openAtLogin: actual.openAtLogin === true && !!own, executableWillLaunchAtLogin: !!own?.enabled };
  }
  const writeLogin = (openAtLogin, enabled = openAtLogin, loginPath = executablePath) => app.setLoginItemSettings({ name: LOGIN_NAME, path: loginPath, args: [...STARTUP_ARGS], openAtLogin, enabled });
  function balloon(options) { try { tray?.displayBalloon(options); } catch {} }
  function show() {
    if (win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show(); win.focus();
  }
  function openSettings() {
    show();
    const send = () => { if (!win.isDestroyed()) win.webContents.send('open-desktop-settings'); };
    if (win.webContents.isLoadingMainFrame()) win.webContents.once('did-finish-load', send); else send();
  }
  if (platform === 'win32') {
    try {
      tray = new Tray(iconPath);
      tray.setToolTip('Töki Autó Kft. · fut a háttérben');
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Töki Autó megnyitása', click: show },
        { label: 'Indítás és tálca…', click: openSettings },
        { type: 'separator' },
        { label: 'Kilépés', click: () => app.quit() }
      ]));
      tray.on('click', show); tray.on('double-click', show); tray.on('balloon-click', show);
    } catch { tray?.destroy(); tray = null; notice = 'Az óra melletti ikon nem hozható létre. Az X most teljesen bezárja a programot.'; }
  }
  // Refresh only our existing login entry after a version update. Preserve a
  // disabled Task Manager entry, and never opt a user into startup implicitly.
  if (startupSupported && preferences.openAtLogin && preferences.loginPath && preferences.loginPath !== executablePath) {
    let previous;
    try {
      previous = readLogin(preferences.loginPath);
      if (previous.openAtLogin) {
        writeLogin(true, previous.executableWillLaunchAtLogin !== false);
        const actual = readLogin();
        if (!actual.openAtLogin || (actual.executableWillLaunchAtLogin !== false) !== (previous.executableWillLaunchAtLogin !== false)) throw new Error('A Windows nem alkalmazta az indítás frissítését.');
        const next = { ...preferences, loginPath: executablePath }; storage.write(file, next); preferences = next;
      }
    } catch {
      if (previous?.openAtLogin) { try { writeLogin(true, previous.executableWillLaunchAtLogin !== false, preferences.loginPath); } catch {} }
      notice = 'Az automatikus indítás frissítése nem sikerült. Nyisd meg az Indítás és tálca beállításait, és nyomj Mentést.';
    }
  }
  function status() {
    let openAtLogin = false, info = notice;
    if (startupSupported) {
      try {
        const actual = readLogin(); openAtLogin = actual.openAtLogin && actual.executableWillLaunchAtLogin !== false;
        if (actual.openAtLogin && actual.executableWillLaunchAtLogin === false) info = 'A Windows Feladatkezelőben az automatikus indítás le van tiltva. A kapcsoló bekapcsolásával és mentéssel engedélyezheted.';
      } catch { info = 'A Windows indítási beállítása nem olvasható. Próbáld újra a Mentés gombbal.'; }
    }
    return { startupSupported, trayAvailable: !!tray, openAtLogin: !!openAtLogin, closeToTray: !!tray && preferences.closeToTray, notice: info };
  }
  function save(input) {
    if (!input || Object.keys(input).some(key => !['openAtLogin', 'closeToTray'].includes(key)) || typeof input.openAtLogin !== 'boolean' || typeof input.closeToTray !== 'boolean') throw new Error('Érvénytelen indítási beállítás.');
    if (input.openAtLogin && !startupSupported) throw new Error('Az automatikus indítás a Windowsra készült programban állítható be.');
    if (input.closeToTray && !tray) throw new Error('Az óra melletti ikon nem érhető el.');
    let previous;
    try {
      if (startupSupported) {
        previous = readLogin(preferences.loginPath);
        writeLogin(input.openAtLogin);
        const actual = readLogin();
        if (!!actual.openAtLogin !== input.openAtLogin || input.openAtLogin && actual.executableWillLaunchAtLogin === false) throw new Error('A Windows nem alkalmazta az automatikus indítás beállítását.');
      }
      const next = { version: 1, ...input, loginPath: input.openAtLogin ? executablePath : '' };
      storage.write(file, next); preferences = next; notice = ''; return status();
    } catch (error) {
      if (previous) {
        try { writeLogin(previous.openAtLogin, previous.executableWillLaunchAtLogin !== false, preferences.loginPath || executablePath); }
        catch { notice = 'A Windows indítási beállítását ellenőrizd újra az Indítás és tálca ablakban.'; }
      }
      throw new Error('A beállítások mentése nem sikerült. ' + error.message);
    }
  }
  const trusted = event => event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame;
  ipcMain.handle('desktop-settings-load', event => trusted(event) ? { ok: true, ...status() } : { ok: false, error: 'Hozzáférés megtagadva.' });
  ipcMain.handle('desktop-settings-save', (event, input) => {
    if (!trusted(event)) return { ok: false, error: 'Hozzáférés megtagadva.' };
    try { return { ok: true, ...save(input) }; } catch (error) { return { ok: false, error: error.message, ...status() }; }
  });
  app.once('will-quit', () => { tray?.destroy(); tray = null; });
  return {
    show, openSettings, status,
    shouldStartHidden: () => !!tray && argv.includes(STARTUP_ARGS[0]),
    shouldHide: () => !!tray && preferences.closeToTray,
    hide: () => {
      if (!tray || win.isDestroyed()) { show(); return; }
      win.hide();
      if (!hiddenHint) { hiddenHint = true; balloon({ title: 'Töki Autó · tovább fut', content: 'A közös raktár és a telefonos kapcsolat működik. Megnyitás: kattints az óra melletti Töki Autó ikonra.', noSound: true }); }
    },
    notifyAlarm: active => {
      if (!tray) return;
      tray.setToolTip(active ? 'Töki Autó · esedékes emlékeztető' : 'Töki Autó Kft. · fut a háttérben');
      if (active && !alarmActive && !win.isVisible()) balloon({ title: 'Töki Autó · emlékeztető', content: 'Esedékes emlékeztetőd van. Kattints a Töki Autó ikonra a megnyitáshoz.', noSound: true });
      alarmActive = active;
    }
  };
}
module.exports = { create, LOGIN_NAME, STARTUP_ARGS };
