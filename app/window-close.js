// Keep the native window alive until the editor explicitly approves this request.
// A renderer unload event cannot reliably pause an already-started native close.
function attach({ win, app, ipcMain, newToken, shouldHide = () => false, hide = () => {}, reveal = () => {} }) {
  let pending = null, ready = false, approved = false, quitting = false;
  function notify() { if (ready && pending) win.webContents.send('request-app-close', pending.token, pending.action); }
  function request(action) { pending = { token: newToken(), action }; notify(); }
  win.on('close', event => {
    if (approved) return;
    event.preventDefault();
    if (pending) return;
    request(!quitting && shouldHide() ? 'hide' : 'quit');
  });
  app.on('before-quit', event => {
    if (approved || win.isDestroyed()) return;
    event.preventDefault(); quitting = true; reveal(); win.close();
  });
  ipcMain.on('app-close-ready', event => {
    if (event.sender !== win.webContents) return;
    ready = true; notify();
  });
  ipcMain.on('complete-app-close', (event, response) => {
    if (event.sender !== win.webContents || !pending || response?.token !== pending.token) return;
    const action = pending.action;
    pending = null;
    if (response.approved !== true) { quitting = false; reveal(); return; }
    if (action === 'hide') {
      if (quitting) { reveal(); request('quit'); } else hide();
      return;
    }
    approved = true;
    app.quit();
  });
}
module.exports = { attach };
