// electron/main.js — Main process for the E8 ⇄ Platonics Studio desktop app.
//
// Launches a BrowserWindow pointing at the built dist/index.html. The dist is
// fully self-contained (all JS/CSS/data inlined) except for the three CDN
// imports (three.js, lil-gui, chroma, simplex-noise). To run offline, run
// `npm run build:offline` first, which vendors those deps and rewrites the
// dist to reference them locally.
//
// Run (dev):  npm run electron:dev   — launches against the current dist build
// Run (pkg):  npm run electron:dist  — packages a standalone .exe/.app/.AppImage
//
// Why Electron over Tauri: this repo's toolchain has Node + npm but no Rust/
// cargo. Electron ships its own Chromium so the WebGL2 + GPU path matches what
// the browser smoke tests already exercise.

const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');

// Point at the built dist. The dev flow is: `python scripts/build.py` then
// `npm run electron:dev`. The dist is regenerated on every build.
const DIST_INDEX = path.resolve(__dirname, '..', 'dist', 'index.html');
const MAX_SAVE_BYTES = 256 * 1024 * 1024;

let mainWindow = null;

function isAppFileUrl(url) {
  try {
    return path.resolve(fileURLToPath(url)) === DIST_INDEX;
  } catch {
    return false;
  }
}

function openExternalHttp(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      shell.openExternal(url).catch(() => {});
      return true;
    }
  } catch {}
  return false;
}

function sanitizeDefaultName(defaultName) {
  const raw = typeof defaultName === 'string' ? defaultName : '';
  const leaf = raw.split(/[\\/]/).pop() || 'e8-export.bin';
  const safe = leaf.replace(/[<>:"|?*\x00-\x1F]/g, '_').trim().slice(0, 128);
  return safe || 'e8-export.bin';
}

function bytesToBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return Buffer.from(bytes);
  if (bytes instanceof Uint8Array) return Buffer.from(bytes);
  if (Array.isArray(bytes)) return Buffer.from(bytes);
  if (bytes && bytes.buffer instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(bytes.buffer, bytes.byteOffset || 0, bytes.byteLength));
  }
  throw new Error('Invalid export payload');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#07070c',
    title: 'E8 ⇄ Platonics Studio',
    // A frameless-friendly title bar style on macOS; standard elsewhere.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      // preload lets the renderer ask the main process for native actions
      // (file save dialogs, etc.) without exposing the full Node API.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // WebGL + GPU compositing — required for three.js. Ensure hardware
      // acceleration stays on (it's on by default unless a flag disables it).
      webgl: true,
      sandbox: true,
    },
  });

  // Deny renderer-created windows by default. HTTP(S) links open in the user's
  // browser; other schemes such as javascript:, file:, and custom protocols stay
  // out of the desktop shell.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (openExternalHttp(url)) {
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppFileUrl(url)) return;
    event.preventDefault();
    openExternalHttp(url);
  });

  // Load the self-contained dist. file:// is fine because build.py inlines all
  // local modules + JSON data. The only external requests are the CDN imports,
  // which work online; for offline use run build:offline to vendor them.
  mainWindow.loadFile(DIST_INDEX);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Native Save handler for the renderer's window.e8desktop.saveBlob(). The
// renderer sends the export bytes; we show the OS Save dialog and write the
// file. Returns the chosen path, or null if the user cancelled.
ipcMain.handle('e8:save-blob', async (_evt, { bytes, defaultName }) => {
  const buffer = bytesToBuffer(bytes);
  if (buffer.length <= 0) throw new Error('Cannot save an empty export');
  if (buffer.length > MAX_SAVE_BYTES) throw new Error('Export is too large to save safely');

  const name = sanitizeDefaultName(defaultName);
  const ext = (path.extname(name).slice(1) || 'bin').replace(/[^A-Za-z0-9]/g, '').slice(0, 16) || 'bin';
  const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
    title: 'Save E8 export',
    defaultPath: name,
    filters: [
      { name: `${ext.toUpperCase()} file`, extensions: [ext] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.promises.writeFile(result.filePath, buffer);
  return result.filePath;
});

// A minimal app menu with reload + fullscreen + devtools shortcuts, since the
// default menu is stripped on some platforms.
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createWindow();
  buildMenu();
  app.on('activate', () => {
    // macOS: re-create a window when the dock icon is clicked with none open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS apps commonly stay active until explicitly quit.
  if (process.platform !== 'darwin') app.quit();
});
