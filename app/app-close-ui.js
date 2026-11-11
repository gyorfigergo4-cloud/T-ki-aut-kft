(function () {
  let handling = false;
  async function requestClose(token, action = 'quit') {
    if (handling) return;
    handling = true;
    let approved = false;
    try {
      if (window.WorkOrdersUI && !window.WorkOrdersUI.canLeave()) return;
      if(window.InventoryUI&&!window.InventoryUI.canClose()){window.NoteReviewUI.showError('Várd meg a raktárművelet befejezését.');return;}
      if (window.GarageUI && !window.GarageUI.canClose()) return;
      if (action === 'hide') { if (!window.NotesCheckBeforeHide()) return; }
      else if (!await window.NotesPrepareClose()) return;
      // Prevent new edits while the final save queues are being flushed.
      document.body.inert = true;
      await window.NotesFlushForClose();
      if (window.WorkOrdersUI) await window.WorkOrdersUI.flush();
      if (window.GarageUI) await window.GarageUI.flush();
      approved = true;
    } catch(error) {
      document.body.inert = false;
      window.NoteReviewUI.showError('A mentés nem sikerült, ezért a program nyitva maradt. Ellenőrizd a szabad lemezterületet, majd próbáld újra. '+(error?.message||''));
    } finally {
      if (!approved || action === 'hide') document.body.inert = false;
      window.notesAPI.completeAppClose({ token, approved });
      handling = false;
    }
  }
  window.notesAPI.onAppCloseRequested?.(requestClose);
  window.notesAPI.appCloseReady?.();
})();
