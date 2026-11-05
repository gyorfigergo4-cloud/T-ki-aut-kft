(function () {
  let handling = false;
  async function requestClose(token) {
    if (handling) return;
    handling = true;
    let approved = false;
    try {
      if (window.WorkOrdersUI && !window.WorkOrdersUI.canLeave()) return;
      if (window.GarageUI && !window.GarageUI.canClose()) return;
      if (!await window.NotesPrepareClose()) return;
      // Prevent new edits while the final save queues are being flushed.
      document.body.inert = true;
      await window.NotesFlushForClose();
      if (window.WorkOrdersUI) await window.WorkOrdersUI.flush();
      if (window.GarageUI) await window.GarageUI.flush();
      approved = true;
    } catch {
      document.body.inert = false;
      window.NoteReviewUI.showError('A mentés nem sikerült, ezért a program nyitva maradt. Ellenőrizd a szabad lemezterületet, majd próbáld újra.');
    } finally {
      if (!approved) document.body.inert = false;
      window.notesAPI.completeAppClose({ token, approved });
      handling = false;
    }
  }
  window.notesAPI.onAppCloseRequested?.(requestClose);
  window.notesAPI.appCloseReady?.();
})();
