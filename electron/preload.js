// electron/preload.js — Bridges the renderer (the E8 studio web app) to native
// desktop capabilities via contextBridge.
//
// The studio is designed browser-first, so its exports are intentionally thin:
// we only expose capabilities the web build can't do on its own. Right now
// that's a richer file-save (native Save dialog + chosen path) used by the
// PNG/SVG/WebM export actions. The web build already falls back to download
// blobs, so the desktop path is strictly additive.
//
// IMPORTANT: `dialog` and `fs` are MAIN-process modules — they are NOT available
// in a preload (renderer) script. The save therefore round-trips to the main
// process over IPC (ipcMain.handle('e8:save-blob', …) in electron/main.js). An
// earlier version called `dialog.showSaveDialog` directly here, which threw
// "Cannot read properties of undefined (reading 'showSaveDialog')" the first
// time saveBlob() was invoked — the desktop save path never worked.
//
// Renderer usage:
//   if (window.e8desktop?.available) {
//     const path = await window.e8desktop.saveBlob(blob, 'e8.png');
//   }

const { contextBridge, ipcRenderer } = require('electron');

const MAX_SAVE_BYTES = 256 * 1024 * 1024;

contextBridge.exposeInMainWorld('e8desktop', {
  /** True when running inside the Electron desktop shell. */
  available: true,

  /**
   * Show a native Save dialog and write the blob to the chosen path.
   * Returns the saved path, or null if the user cancelled.
   */
  async saveBlob(blob, defaultName) {
    if (!blob || typeof blob.arrayBuffer !== 'function' || typeof blob.size !== 'number') {
      throw new Error('saveBlob expected a Blob');
    }
    if (blob.size <= 0) throw new Error('Cannot save an empty export');
    if (blob.size > MAX_SAVE_BYTES) throw new Error('Export is too large to save safely');
    // Blobs don't survive the IPC structured clone in every Electron version,
    // so serialize to bytes here and rehydrate a Buffer on the main side.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return ipcRenderer.invoke('e8:save-blob', { bytes, defaultName });
  },

  /** The platform string (win32 / darwin / linux) — for platform-specific UI. */
  platform: process.platform,
});
