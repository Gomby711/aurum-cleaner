const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// `trash` is an ESM-only package; load it lazily from this CJS main process.
let trashModulePromise;
function loadTrash() {
  if (!trashModulePromise) {
    trashModulePromise = import('trash').then((mod) => mod.default);
  }
  return trashModulePromise;
}

const { listDrives } = require('./ipc/drives.cjs');
const { scanQuickClean, cleanCategory } = require('./ipc/quickClean.cjs');
const { scanStaleProjects, cleanStaleItems } = require('./ipc/claudeCleanup.cjs');
const { findLargeFiles } = require('./ipc/largeFiles.cjs');
const { findDuplicates } = require('./ipc/duplicates.cjs');
const { buildTree, dirSize } = require('./lib/fsWalk.cjs');

const isDev = !app.isPackaged;
let mainWindow;

// Track in-flight cancellable scans keyed by a client-provided scan id.
const activeScans = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#0b0b0f',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- window chrome controls (custom frameless title bar) ---
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

// --- drives ---
ipcMain.handle('drives:list', async () => listDrives());

// --- quick clean ---
ipcMain.handle('quickClean:scan', async (event) => {
  return scanQuickClean((progress) => {
    event.sender.send('quickClean:progress', progress);
  });
});
ipcMain.handle('quickClean:clean', async (_event, categoryId) => cleanCategory(categoryId));

// --- claude cleanup ---
ipcMain.handle('claudeCleanup:scan', async (_event, thresholdDays) => scanStaleProjects(thresholdDays));
ipcMain.handle('claudeCleanup:clean', async (_event, items) => cleanStaleItems(items));

// --- disk analyzer (treemap) ---
ipcMain.handle('diskAnalyzer:scan', async (event, scanId, rootPath, maxDepth) => {
  const controller = new AbortController();
  activeScans.set(scanId, controller);
  try {
    const tree = await buildTree(rootPath, maxDepth ?? 2, {
      signal: controller.signal,
      onProgress: (p) => event.sender.send('diskAnalyzer:progress', { scanId, ...p }),
    });
    return tree;
  } finally {
    activeScans.delete(scanId);
  }
});

// --- large files ---
ipcMain.handle('largeFiles:scan', async (event, scanId, rootPath, minSizeMB) => {
  const controller = new AbortController();
  activeScans.set(scanId, controller);
  try {
    return await findLargeFiles(rootPath, minSizeMB * 1024 * 1024, {
      signal: controller.signal,
      onProgress: (p) => event.sender.send('largeFiles:progress', { scanId, ...p }),
    });
  } finally {
    activeScans.delete(scanId);
  }
});

// --- duplicates ---
ipcMain.handle('duplicates:scan', async (event, scanId, rootPath, minSizeMB) => {
  const controller = new AbortController();
  activeScans.set(scanId, controller);
  try {
    return await findDuplicates(rootPath, {
      signal: controller.signal,
      minSizeBytes: minSizeMB * 1024 * 1024,
      onProgress: (p) => event.sender.send('duplicates:progress', { scanId, ...p }),
    });
  } finally {
    activeScans.delete(scanId);
  }
});

// --- shared: cancel a scan ---
ipcMain.handle('scan:cancel', async (_event, scanId) => {
  const controller = activeScans.get(scanId);
  if (controller) controller.abort();
  return true;
});

// --- file operations ---
ipcMain.handle('files:trash', async (_event, filePaths) => {
  const trash = await loadTrash();
  let freed = 0;
  let errors = 0;
  for (const p of filePaths) {
    try {
      const stat = await fs.promises.stat(p);
      const size = stat.isDirectory() ? (await dirSize(p)).size : stat.size;
      await trash(p);
      freed += size;
    } catch {
      errors += 1;
    }
  }
  return { freed, errors };
});

ipcMain.handle('files:showInFolder', async (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('dialog:chooseFolder', async (_event, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath,
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
