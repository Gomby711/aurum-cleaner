const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

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
const { getLastSeenVersion, setLastSeenVersion } = require('./lib/updateState.cjs');
const { entriesSince } = require('./lib/changelog.cjs');
const { getSettings, setSettings } = require('./lib/settings.cjs');
const { createVault } = require('./lib/undoVault.cjs');
const { createClassifier } = require('./lib/macPaths.cjs');
const { scanMac, cleanMac } = require('./ipc/quickCleanMac.cjs');

const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';
const RELEASES_URL = 'https://github.com/Gomby711/aurum-cleaner/releases/latest';
let mainWindow;

// --- macOS safety layer: protected paths, iCloud awareness, undo vault ---
let classifier = createClassifier({ home: os.homedir() });
let vault = null;

function execFileText(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, (err, stdout) => resolve(err ? '' : String(stdout).trim()));
  });
}

// When "Desktop & Documents Folders" is on in iCloud settings, those folders sync to iCloud
// even though they live in the home folder — so treat them as iCloud locations too.
async function refreshClassifier() {
  const home = os.homedir();
  const synced = [];
  if ((await execFileText('defaults', ['read', 'com.apple.finder', 'FXICloudDriveDesktop'])) === '1') {
    synced.push(path.join(home, 'Desktop'));
  }
  if ((await execFileText('defaults', ['read', 'com.apple.finder', 'FXICloudDriveDocuments'])) === '1') {
    synced.push(path.join(home, 'Documents'));
  }
  classifier = createClassifier({ home, icloudSyncedFolders: synced });
}

function scanOptions(opts) {
  if (!isMac) return {};
  return {
    skip: classifier.makeSkip({ includeICloud: !!opts?.includeICloud }),
    classify: classifier.classify,
    skipCloudOnly: true,
  };
}

// Track in-flight cancellable scans keyed by a client-provided scan id.
const activeScans = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#0b0b0f',
    // Windows: fully custom frameless chrome. macOS: keep the native traffic lights.
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 13 } }
      : { frame: false, titleBarStyle: 'hidden' }),
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

app.whenReady().then(async () => {
  if (isMac) {
    vault = createVault(path.join(app.getPath('userData'), 'UndoVault'));
    await fs.promises.mkdir(vault.rootDir, { recursive: true });
    await refreshClassifier();
    vault.purgeExpired(getSettings().undoRetentionDays).catch(() => {});
  }
  createWindow();
  setupAutoUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- auto-update + "what's new" ---
// macOS can only swap an app in place when it's signed with a Developer ID. Builds without
// one (ad-hoc signed) tell the user a new version exists and open the download page instead.
async function canSelfUpdate() {
  if (!isMac) return true;
  const bundle = path.resolve(process.execPath, '..', '..', '..');
  const out = await new Promise((resolve) => {
    execFile('codesign', ['-dv', '--verbose=2', bundle], (_err, _stdout, stderr) => resolve(String(stderr)));
  });
  return /Authority=Developer ID Application/.test(out);
}

async function setupAutoUpdates() {
  if (isDev) return; // no update feed in development

  const selfUpdate = await canSelfUpdate();
  autoUpdater.autoDownload = selfUpdate;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updates:status', {
      state: selfUpdate ? 'downloading' : 'manual',
      version: info.version,
    });
  });
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updates:status', { state: 'up-to-date' });
  });
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updates:status', {
      state: 'ready',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    });
  });
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updates:status', { state: 'error', message: err?.message });
  });

  autoUpdater.checkForUpdates().catch(() => {
    // offline or no releases yet — non-fatal
  });
}

ipcMain.handle('updates:installNow', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('updates:checkNow', () => {
  if (isDev) return { checking: false };
  autoUpdater.checkForUpdates().catch(() => {});
  return { checking: true };
});

// Returns changelog entries newer than the last version this user has seen,
// then marks the current version as seen.
ipcMain.handle('updates:getWhatsNew', () => {
  const currentVersion = app.getVersion();
  const lastSeen = getLastSeenVersion();
  const entries = entriesSince(lastSeen, currentVersion);
  setLastSeenVersion(currentVersion);
  return { entries, currentVersion };
});

// --- window chrome controls (custom frameless title bar) ---
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

// --- app info ---
ipcMain.handle('app:getVersion', () => app.getVersion());

// --- drives ---
ipcMain.handle('drives:list', async () => listDrives());

// --- quick clean ---
ipcMain.handle('quickClean:scan', async (event) => {
  const onProgress = (progress) => event.sender.send('quickClean:progress', progress);
  if (isMac) {
    return scanMac({ home: os.homedir(), tmpdir: os.tmpdir(), classify: classifier.classify, onProgress });
  }
  return scanQuickClean(onProgress);
});
ipcMain.handle('quickClean:cleanMany', async (_event, categoryIds) => {
  if (isMac) {
    return cleanMac(categoryIds, {
      home: os.homedir(),
      tmpdir: os.tmpdir(),
      classify: classifier.classify,
      vault,
      systemTrash: trashOnMac,
      retentionDays: getSettings().undoRetentionDays,
    });
  }
  let freed = 0;
  let errors = 0;
  for (const id of categoryIds) {
    const r = await cleanCategory(id);
    freed += r.freed || 0;
    errors += r.errors || 0;
  }
  return { freed, errors };
});

// --- claude cleanup ---
ipcMain.handle('claudeCleanup:scan', async (_event, thresholdDays) => scanStaleProjects(thresholdDays));
ipcMain.handle('claudeCleanup:clean', async (_event, items) => {
  if (!isMac) return cleanStaleItems(items);
  const retentionDays = getSettings().undoRetentionDays;
  const result = await cleanStaleItems(items, {
    stage: async (paths) => {
      const r = await vault.stage(paths, { label: 'Claude Cleanup' });
      if (r.batchId && retentionDays === 0) {
        await vault.purge(r.batchId);
        return { batchId: null };
      }
      return { batchId: r.batchId };
    },
  });
  return result;
});

// --- disk analyzer (treemap) ---
ipcMain.handle('diskAnalyzer:scan', async (event, scanId, rootPath, maxDepth, opts) => {
  const controller = new AbortController();
  activeScans.set(scanId, controller);
  try {
    const tree = await buildTree(rootPath, maxDepth ?? 2, {
      ...scanOptions(opts),
      signal: controller.signal,
      onProgress: (p) => event.sender.send('diskAnalyzer:progress', { scanId, ...p }),
    });
    return tree;
  } finally {
    activeScans.delete(scanId);
  }
});

// --- large files ---
ipcMain.handle('largeFiles:scan', async (event, scanId, rootPath, minSizeMB, opts) => {
  const controller = new AbortController();
  activeScans.set(scanId, controller);
  try {
    return await findLargeFiles(rootPath, minSizeMB * 1024 * 1024, {
      ...scanOptions(opts),
      signal: controller.signal,
      onProgress: (p) => event.sender.send('largeFiles:progress', { scanId, ...p }),
    });
  } finally {
    activeScans.delete(scanId);
  }
});

// --- duplicates ---
ipcMain.handle('duplicates:scan', async (event, scanId, rootPath, minSizeMB, opts) => {
  const controller = new AbortController();
  activeScans.set(scanId, controller);
  try {
    return await findDuplicates(rootPath, {
      ...scanOptions(opts),
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
// Moves one item to the system Trash (macOS). Used for things that can't go in the
// undo vault: items on another disk, and root-owned installers.
async function trashOnMac(p) {
  try {
    await shell.trashItem(p);
  } catch {
    // Root-owned items (e.g. "Install macOS …app") need Finder, which asks for the
    // password with the normal macOS prompt.
    const script = `tell application "Finder" to delete POSIX file ${JSON.stringify(p)}`;
    await new Promise((resolve, reject) =>
      execFile('osascript', ['-e', script], (e) => (e ? reject(e) : resolve()))
    );
  }
}

async function trashOnMacWithUndo(filePaths, opts = {}) {
  let freed = 0;
  let errors = 0;
  const blocked = { protected: 0, icloud: 0 };
  const allowed = [];

  for (const p of filePaths) {
    const c = classifier.classify(p);
    if (c.protected || c.guarded) blocked.protected += 1;
    else if (c.icloud && !opts.allowICloud) blocked.icloud += 1;
    else allowed.push(p);
  }

  // The vault lives on the startup disk; moving a big file from another disk into it
  // would be slow and eat startup-disk space, so those go to that disk's own Trash instead.
  const vaultDev = (await fs.promises.stat(vault.rootDir)).dev;
  const sameDisk = [];
  const otherDisk = [];
  for (const p of allowed) {
    try {
      ((await fs.promises.lstat(p)).dev === vaultDev ? sameDisk : otherDisk).push(p);
    } catch {
      errors += 1;
    }
  }

  let batchId = null;
  if (sameDisk.length > 0) {
    const r = await vault.stage(sameDisk, { label: opts.label || 'Removed files' });
    errors += r.failed.length;
    freed += r.staged;
    batchId = r.batchId;
    if (batchId && getSettings().undoRetentionDays === 0) {
      await vault.purge(batchId);
      batchId = null;
    }
  }

  let sentToTrash = 0;
  for (const p of otherDisk) {
    try {
      const stat = await fs.promises.lstat(p);
      const size = stat.isDirectory() ? (await dirSize(p)).size : stat.size;
      await trashOnMac(p);
      freed += size;
      sentToTrash += 1;
    } catch {
      errors += 1;
    }
  }

  return { freed, errors, batchId, blocked, sentToTrash };
}

ipcMain.handle('files:trash', async (_event, filePaths, opts) => {
  if (isMac) return trashOnMacWithUndo(filePaths, opts);
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

// Tells the UI which of these paths are in iCloud, so it can ask for the extra confirmation.
ipcMain.handle('files:classify', async (_event, filePaths) => {
  const icloud = [];
  if (isMac) {
    for (const p of filePaths) if (classifier.classify(p).icloud) icloud.push(p);
  }
  return { icloud };
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

// --- platform info (read synchronously by the preload script) ---
ipcMain.on('platform:info', (event) => {
  event.returnValue = {
    os: process.platform,
    home: os.homedir(),
    sep: path.sep,
    supportsUndo: isMac,
  };
});

// --- undo history (macOS) ---
ipcMain.handle('undo:list', async () => (vault ? vault.list() : []));
ipcMain.handle('undo:details', async (_event, id) => (vault ? vault.details(id) : null));
ipcMain.handle('undo:restore', async (_event, id) => (vault ? vault.restore(id) : { restored: 0, failed: 0 }));
ipcMain.handle('undo:purge', async (_event, id) => (vault ? vault.purge(id) : { freed: 0 }));
ipcMain.handle('undo:purgeAll', async () => (vault ? vault.purgeAll() : { freed: 0 }));

// --- settings ---
ipcMain.handle('settings:get', async () => getSettings());
ipcMain.handle('settings:set', async (_event, patch) => {
  const next = setSettings(patch);
  if (vault) vault.purgeExpired(next.undoRetentionDays).catch(() => {});
  return next;
});

// --- macOS permissions ---
ipcMain.handle('system:fullDiskAccess', async () => {
  if (!isMac) return { supported: false };
  try {
    await fs.promises.readdir(path.join(os.homedir(), 'Library', 'Safari'));
    return { supported: true, granted: true };
  } catch (err) {
    return { supported: true, granted: err.code !== 'EPERM' && err.code !== 'EACCES' };
  }
});
ipcMain.handle('system:openFullDiskAccess', async () => {
  if (!isMac) return false;
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
  return true;
});

ipcMain.handle('updates:openReleases', async () => {
  await shell.openExternal(RELEASES_URL);
});
