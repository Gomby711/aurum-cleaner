const { contextBridge, ipcRenderer } = require('electron');

function on(channel, callback) {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  drives: {
    list: () => ipcRenderer.invoke('drives:list'),
  },
  quickClean: {
    scan: () => ipcRenderer.invoke('quickClean:scan'),
    clean: (categoryId) => ipcRenderer.invoke('quickClean:clean', categoryId),
    onProgress: (cb) => on('quickClean:progress', cb),
  },
  claudeCleanup: {
    scan: (thresholdDays) => ipcRenderer.invoke('claudeCleanup:scan', thresholdDays),
    clean: (items) => ipcRenderer.invoke('claudeCleanup:clean', items),
  },
  diskAnalyzer: {
    scan: (scanId, rootPath, maxDepth) => ipcRenderer.invoke('diskAnalyzer:scan', scanId, rootPath, maxDepth),
    onProgress: (cb) => on('diskAnalyzer:progress', cb),
  },
  largeFiles: {
    scan: (scanId, rootPath, minSizeMB) => ipcRenderer.invoke('largeFiles:scan', scanId, rootPath, minSizeMB),
    onProgress: (cb) => on('largeFiles:progress', cb),
  },
  duplicates: {
    scan: (scanId, rootPath, minSizeMB) => ipcRenderer.invoke('duplicates:scan', scanId, rootPath, minSizeMB),
    onProgress: (cb) => on('duplicates:progress', cb),
  },
  scan: {
    cancel: (scanId) => ipcRenderer.invoke('scan:cancel', scanId),
  },
  files: {
    trash: (paths) => ipcRenderer.invoke('files:trash', paths),
    showInFolder: (filePath) => ipcRenderer.invoke('files:showInFolder', filePath),
  },
  dialog: {
    chooseFolder: (defaultPath) => ipcRenderer.invoke('dialog:chooseFolder', defaultPath),
  },
  updates: {
    getWhatsNew: () => ipcRenderer.invoke('updates:getWhatsNew'),
    installNow: () => ipcRenderer.invoke('updates:installNow'),
    checkNow: () => ipcRenderer.invoke('updates:checkNow'),
    onStatus: (cb) => on('updates:status', cb),
  },
});
