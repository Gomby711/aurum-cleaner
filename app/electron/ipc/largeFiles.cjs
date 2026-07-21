const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['$Recycle.Bin', 'System Volume Information', 'Windows']);

async function findLargeFiles(rootPath, minSizeBytes, { signal, onProgress, limit = 500 } = {}) {
  const results = [];
  let scannedDirs = 0;

  async function walk(dir) {
    if (signal && signal.aborted) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    scannedDirs += 1;
    if (onProgress && scannedDirs % 50 === 0) onProgress({ scannedDirs, current: dir, found: results.length });

    for (const entry of entries) {
      if (signal && signal.aborted) return;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(full);
          if (stat.size >= minSizeBytes) {
            results.push({
              path: full,
              name: entry.name,
              size: stat.size,
              modified: stat.mtime.toISOString(),
              ext: path.extname(entry.name).toLowerCase(),
            });
          }
        } catch {
          // skip locked files
        }
      }
    }
  }

  await walk(rootPath);
  results.sort((a, b) => b.size - a.size);
  if (onProgress) onProgress({ scannedDirs, found: results.length, done: true });
  return results.slice(0, limit);
}

module.exports = { findLargeFiles };
