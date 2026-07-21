const fs = require('fs');
const path = require('path');

// Recursively sums the size of a directory. Tolerates permission errors,
// junctions/symlinks (skipped to avoid cycles), and reparse points.
async function dirSize(dirPath, { signal } = {}) {
  let total = 0;
  let fileCount = 0;

  async function walk(current) {
    if (signal && signal.aborted) return;
    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (signal && signal.aborted) return;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(full);
          total += stat.size;
          fileCount += 1;
        } catch {
          // skip locked/inaccessible files
        }
      }
    }
  }

  await walk(dirPath);
  return { size: total, fileCount };
}

// Builds a shallow tree (depth-limited) of folder sizes for treemap rendering.
// Deeper content is aggregated into the folder's total but not expanded further.
async function buildTree(rootPath, maxDepth, { signal, onProgress } = {}) {
  let scanned = 0;

  async function node(current, depth) {
    if (signal && signal.aborted) return null;
    const name = path.basename(current) || current;
    let stat;
    try {
      stat = await fs.promises.lstat(current);
    } catch {
      return null;
    }
    if (stat.isSymbolicLink()) return null;

    if (stat.isFile()) {
      return { name, path: current, size: stat.size, type: 'file' };
    }

    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return { name, path: current, size: 0, type: 'folder', children: [], inaccessible: true };
    }

    scanned += 1;
    if (onProgress && scanned % 25 === 0) onProgress({ scanned, current });

    if (depth >= maxDepth) {
      const { size } = await dirSize(current, { signal });
      return { name, path: current, size, type: 'folder', children: [], collapsed: true };
    }

    const children = [];
    let size = 0;
    for (const entry of entries) {
      if (signal && signal.aborted) return null;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(current, entry.name);
      const child = await node(full, depth + 1);
      if (child) {
        children.push(child);
        size += child.size;
      }
    }
    children.sort((a, b) => b.size - a.size);
    return { name, path: current, size, type: 'folder', children };
  }

  return node(rootPath, 0);
}

module.exports = { dirSize, buildTree };
