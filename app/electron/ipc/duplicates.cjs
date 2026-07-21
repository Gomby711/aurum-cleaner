const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SKIP_DIRS = new Set(['$Recycle.Bin', 'System Volume Information', 'Windows']);

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function findDuplicates(rootPath, { signal, onProgress, minSizeBytes = 1024 * 1024 } = {}) {
  const bySize = new Map();

  async function walk(dir) {
    if (signal && signal.aborted) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
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
          if (stat.size < minSizeBytes) continue;
          const arr = bySize.get(stat.size) || [];
          arr.push(full);
          bySize.set(stat.size, arr);
        } catch {
          // skip
        }
      }
    }
  }

  await walk(rootPath);

  const candidates = [...bySize.entries()].filter(([, files]) => files.length > 1);
  const groups = [];
  let processed = 0;
  const totalCandidateFiles = candidates.reduce((sum, [, files]) => sum + files.length, 0);

  for (const [size, files] of candidates) {
    const byHash = new Map();
    for (const file of files) {
      if (signal && signal.aborted) return groups;
      processed += 1;
      if (onProgress && processed % 10 === 0) {
        onProgress({ processed, total: totalCandidateFiles });
      }
      try {
        const hash = await hashFile(file);
        const arr = byHash.get(hash) || [];
        arr.push(file);
        byHash.set(hash, arr);
      } catch {
        // skip unreadable file
      }
    }
    for (const [hash, matchedFiles] of byHash.entries()) {
      if (matchedFiles.length > 1) {
        groups.push({ hash, size, files: matchedFiles });
      }
    }
  }

  groups.sort((a, b) => b.size * b.files.length - a.size * a.files.length);
  if (onProgress) onProgress({ processed, total: totalCandidateFiles, done: true });
  return groups;
}

module.exports = { findDuplicates };
