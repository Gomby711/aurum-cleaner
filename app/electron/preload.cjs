const { contextBridge, ipcRenderer } = require('electron');

function on(channel, callback) {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  platform: ipcRenderer.sendSync('platform:info'),
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  drives: {
    list: () => ipcRenderer.invoke('drives:list'),
  },
  quickClean: {
    scan: (opts) => ipcRenderer.invoke('quickClean:scan', opts),
    cleanMany: (categoryIds, opts) => ipcRenderer.invoke('quickClean:cleanMany', categoryIds, opts),
    onProgress: (cb) => on('quickClean:progress', cb),
  },
  claudeCleanup: {
    scan: (thresholdDays) => ipcRenderer.invoke('claudeCleanup:scan', thresholdDays),
    clean: (items) => ipcRenderer.invoke('claudeCleanup:clean', items),
  },
  diskAnalyzer: {
    scan: (scanId, rootPath, maxDepth, opts) => ipcRenderer.invoke('diskAnalyzer:scan', scanId, rootPath, maxDepth, opts),
    onProgress: (cb) => on('diskAnalyzer:progress', cb),
  },
  largeFiles: {
    scan: (scanId, rootPath, minSizeMB, opts) => ipcRenderer.invoke('largeFiles:scan', scanId, rootPath, minSizeMB, opts),
    onProgress: (cb) => on('largeFiles:progress', cb),
  },
  duplicates: {
    scan: (scanId, rootPath, minSizeMB, opts) => ipcRenderer.invoke('duplicates:scan', scanId, rootPath, minSizeMB, opts),
    onProgress: (cb) => on('duplicates:progress', cb),
  },
  scan: {
    cancel: (scanId) => ipcRenderer.invoke('scan:cancel', scanId),
  },
  files: {
    trash: (paths, opts) => ipcRenderer.invoke('files:trash', paths, opts),
    classify: (paths) => ipcRenderer.invoke('files:classify', paths),
    showInFolder: (filePath) => ipcRenderer.invoke('files:showInFolder', filePath),
  },
  dialog: {
    chooseFolder: (defaultPath) => ipcRenderer.invoke('dialog:chooseFolder', defaultPath),
  },
  icloud: {
    scan: (scanId, opts) => ipcRenderer.invoke('icloud:scan', scanId, opts),
    onProgress: (cb) => on('icloud:progress', cb),
    evict: (paths) => ipcRenderer.invoke('icloud:evict', paths),
    openSettings: () => ipcRenderer.invoke('icloud:openSettings'),
  },
  undo: {
    list: () => ipcRenderer.invoke('undo:list'),
    details: (id) => ipcRenderer.invoke('undo:details', id),
    restore: (id) => ipcRenderer.invoke('undo:restore', id),
    purge: (id) => ipcRenderer.invoke('undo:purge', id),
    purgeAll: () => ipcRenderer.invoke('undo:purgeAll'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  system: {
    fullDiskAccess: () => ipcRenderer.invoke('system:fullDiskAccess'),
    openFullDiskAccess: () => ipcRenderer.invoke('system:openFullDiskAccess'),
  },
  updates: {
    openReleases: () => ipcRenderer.invoke('updates:openReleases'),
    getWhatsNew: () => ipcRenderer.invoke('updates:getWhatsNew'),
    installNow: () => ipcRenderer.invoke('updates:installNow'),
    checkNow: () => ipcRenderer.invoke('updates:checkNow'),
    onStatus: (cb) => on('updates:status', cb),
  },
});
