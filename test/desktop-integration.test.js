const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const Store = require('../app/desktop-settings-store');
const { create, LOGIN_NAME, STARTUP_ARGS } = require('../app/desktop-integration');
const exe = 'C:\\Users\\Teszt\\AppData\\Local\\TokiAuto\\app-new\\TokiAuto-win32-x64\\TokiAuto.exe';
const copy = value => JSON.parse(JSON.stringify(value));
function setup(options = {}) {
  const app = new EventEmitter(), ipcMain = { handlers: {}, handle(name, handler) { this.handlers[name] = handler; } }, calls = [], balloons = [];
  app.isPackaged = options.packaged !== false; app.getPath = () => '/tmp/desktop-fixture'; app.quit = () => { calls.push('quit'); };
  let preferences = copy(options.preferences || Store.defaults()), registry = options.registry ? copy(options.registry) : null, visible = true, minimized = false, tray;
  app.getLoginItemSettings = ({ path: query, args }) => {
    const match = registry && registry.path.toLowerCase() === query.toLowerCase() && JSON.stringify(registry.args) === JSON.stringify(args);
    return { openAtLogin: !!match, executableWillLaunchAtLogin: !!match && registry.enabled, launchItems: match ? [{ ...copy(registry), scope: 'user' }] : [] };
  };
  app.setLoginItemSettings = value => { calls.push(copy(value)); if (options.registryFailure) throw new Error('registry denied'); registry = value.openAtLogin ? { ...copy(value), scope: 'user' } : null; };
  const win = { webContents: Object.assign(new EventEmitter(), { mainFrame: {}, isLoadingMainFrame: () => false, send: (...args) => calls.push(args) }), isDestroyed: () => false, isMinimized: () => minimized, restore: () => { minimized = false; }, isVisible: () => visible, show: () => { visible = true; }, focus: () => calls.push('focus'), hide: () => { visible = false; } };
  class FakeTray extends EventEmitter {
    constructor(icon) { super(); if (options.trayFailure) throw Error('no tray'); this.icon = icon; tray = this; }
    setToolTip(text) { this.tooltip = text; } setContextMenu(menu) { this.menu = menu; } displayBalloon(value) { balloons.push(value); } destroy() { this.destroyed = true; }
  }
  const storage = { read: () => copy(preferences), write: (_, value) => { if (options.storageFailure) throw Error('disk full'); preferences = copy(value); } };
  const desktop = create({ app, win, ipcMain, Tray: FakeTray, Menu: { buildFromTemplate: value => value }, iconPath: 'brand.ico', platform: options.platform || 'win32', executablePath: exe, argv: options.argv || [], storage });
  const event = { sender: win.webContents, senderFrame: win.webContents.mainFrame };
  return { app, win, desktop, calls, balloons, tray: () => tray, visible: () => visible, minimize: () => { minimized = true; }, preferences: () => copy(preferences), registry: () => copy(registry), save: (input, source = event) => ipcMain.handlers['desktop-settings-save'](source, input), load: () => ipcMain.handlers['desktop-settings-load'](event) };
}
test('Windows startup is opt-in; branded tray opens/restores, exposes settings and explicit Quit', () => {
  const s = setup(); assert.equal(s.desktop.status().openAtLogin, false); assert.equal(s.calls.length, 0); assert.equal(s.desktop.shouldHide(), true); assert.equal(s.tray().icon, 'brand.ico');
  s.desktop.hide(); assert.equal(s.visible(), false); assert.equal(s.balloons.length, 1); s.desktop.show(); s.desktop.hide(); assert.equal(s.balloons.length, 1); s.minimize(); s.tray().emit('click'); assert.equal(s.visible(), true);
  s.tray().menu[1].click(); assert.ok(s.calls.some(value => Array.isArray(value) && value[0] === 'open-desktop-settings')); s.tray().menu[3].click(); assert.equal(s.calls.at(-1), 'quit');
  s.app.emit('will-quit'); assert.equal(s.tray().destroyed, true);
});
test('login entry uses a stable name, the current executable and background argument; switches survive reload', () => {
  const s = setup(); const result = s.save({ openAtLogin: true, closeToTray: false }); assert.equal(result.ok, true); assert.equal(result.openAtLogin, true); assert.equal(s.desktop.shouldHide(), false);
  assert.equal(s.registry().name, LOGIN_NAME); assert.equal(s.registry().path, exe); assert.deepEqual(s.registry().args, STARTUP_ARGS); assert.equal(s.preferences().loginPath, exe);
  const reopened = setup({ preferences: s.preferences(), registry: s.registry(), argv: ['app', '--toki-background'] }); assert.equal(reopened.desktop.shouldStartHidden(), true); assert.equal(reopened.desktop.shouldHide(), false); assert.equal(reopened.calls.length, 0);
  assert.equal(reopened.save({ openAtLogin: false, closeToTray: true }).ok, true); assert.equal(reopened.registry(), null); assert.equal(reopened.desktop.shouldHide(), true);
});
test('version update refreshes an existing startup path and preserves external Task Manager disabling', () => {
  const old = 'C:\\Old version\\TokiAuto.exe', preferences = { ...Store.defaults(), openAtLogin: true, loginPath: old };
  for (const enabled of [true, false]) {
    const s = setup({ preferences, registry: { name: LOGIN_NAME, path: old, args: STARTUP_ARGS, enabled } });
    assert.equal(s.registry().path, exe); assert.equal(s.registry().enabled, enabled); assert.equal(s.preferences().loginPath, exe); assert.equal(s.load().openAtLogin, enabled);
  }
  const removed = setup({ preferences }); assert.equal(removed.registry(), null); assert.equal(removed.calls.length, 0);
});
test('settings do not treat somebody else’s startup entry as the app’s own entry', () => {
  const s = setup({ registry: { name: 'AnotherStartup', path: exe, args: STARTUP_ARGS, enabled: true } }); assert.equal(s.load().openAtLogin, false); assert.equal(s.calls.length, 0);
});
test('storage failure rolls back the login change; registry errors leave preferences unchanged', () => {
  const s = setup({ storageFailure: true }); const result = s.save({ openAtLogin: true, closeToTray: false }); assert.equal(result.ok, false); assert.match(result.error, /disk full/); assert.equal(s.registry(), null); assert.equal(s.desktop.shouldHide(), true);
  const denied = setup({ registryFailure: true }); assert.equal(denied.save({ openAtLogin: true, closeToTray: false }).ok, false); assert.equal(denied.preferences().openAtLogin, false);
});
test('failed version-migration save restores the previous startup path', () => {
  const old = 'C:\\Old\\TokiAuto.exe', s = setup({ storageFailure: true, preferences: { ...Store.defaults(), openAtLogin: true, loginPath: old }, registry: { name: LOGIN_NAME, path: old, args: STARTUP_ARGS, enabled: true } });
  assert.equal(s.registry().path, old); assert.equal(s.preferences().loginPath, old); assert.match(s.load().notice, /frissítése nem sikerült/);
});
test('unsupported platforms and missing tray never launch invisibly or hide the only window', () => {
  for (const options of [{ platform: 'linux' }, { trayFailure: true }]) { const s = setup({ ...options, argv: ['--toki-background'] }); assert.equal(s.desktop.shouldStartHidden(), false); assert.equal(s.desktop.shouldHide(), false); s.desktop.hide(); assert.equal(s.visible(), true); }
  const dev = setup({ packaged: false }); assert.equal(dev.save({ openAtLogin: true, closeToTray: true }).ok, false); assert.equal(dev.calls.length, 0);
});
test('startup IPC is restricted to our main frame and accepts only the two boolean choices', () => {
  const s = setup(); assert.equal(s.save({ openAtLogin: true, closeToTray: true }, { sender: s.win.webContents, senderFrame: {} }).ok, false); assert.equal(s.save({ openAtLogin: 'true', closeToTray: true }).ok, false); assert.equal(s.save({ openAtLogin: true, closeToTray: true, path: 'evil.exe' }).ok, false); assert.equal(s.calls.length, 0);
});
test('hidden reminder balloon is shown once per active interval and returns to the window', () => {
  const s = setup(); s.desktop.hide(); s.desktop.notifyAlarm(true); s.desktop.notifyAlarm(true); assert.equal(s.balloons.length, 2); assert.match(s.tray().tooltip, /emlékeztető/); s.desktop.notifyAlarm(false); s.desktop.notifyAlarm(true); assert.equal(s.balloons.length, 3); s.tray().emit('balloon-click'); assert.equal(s.visible(), true);
});
test('settings persist separately from customer records, with a recoverable backup; corrupt settings are not erased', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toki-desktop-')), file = path.join(dir, 'desktop-settings.json');
  try { assert.deepEqual(Store.read(file), Store.defaults()); const value = { ...Store.defaults(), openAtLogin: true, loginPath: exe }; Store.write(file, value); assert.deepEqual(Store.read(file), value); Store.write(file, Store.defaults()); assert.deepEqual(JSON.parse(fs.readFileSync(file + '.bak')), value); fs.writeFileSync(file, 'broken'); assert.throws(() => Store.read(file)); assert.equal(fs.readFileSync(file, 'utf8'), 'broken'); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
