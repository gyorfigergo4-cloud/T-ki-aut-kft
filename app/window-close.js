// Keep the native window alive until the editor explicitly approves this request.
// A renderer unload event cannot reliably pause an already-started native close.
function attach({ win, app, ipcMain, newToken }) {
  let pending = null, ready = false, approved = false, quitting = false;
  function notify() { if (ready && pending) win.webContents.send('request-app-close', pending); }
  win.on('close', event => {
    if (approved) return;
    event.preventDefault();
    if (pending) return;
    pending = newToken(); notify();
  });
  app.on('before-quit', event => {
    if (approved || win.isDestroyed()) return;
    event.preventDefault(); quitting = true; win.close();
  });
  ipcMain.on('app-close-ready', event => {
    if (event.sender !== win.webContents) return;
    ready = true; notify();
  });
  ipcMain.on('complete-app-close', (event, response) => {
    if (event.sender !== win.webContents || !pending || response?.token !== pending) return;
    pending = null;
    if (response.approved !== true) { quitting = false; return; }
    approved = true;
    if (quitting) app.quit(); else win.close();
  });
}
module.exports = { attach };
