// iCloud Cleanup (macOS).
//
// Finds files in iCloud that are old and probably unneeded, so the user can review the
// list and decide. Unlike the local-disk tools it deliberately *includes* files that exist
// only in the cloud ("optimized"/dataless): those still count against iCloud storage.
//
// Nothing here deletes anything; it only reads. Removal goes through files:trash, which
// requires the user's explicit iCloud acknowledgement.
const fs = require('fs');
const path = require('path');
const { dirSize } = require('../lib/fsWalk.cjs');

const YEAR = 365.25 * 24 * 60 * 60 * 1000;

// Folders macOS stores as a single document (shown as one file in Finder).
const PACKAGE_RE = /\.(pages|numbers|key|rtfd|sparsebundle|sparseimage|band|logicx|bundle|dtbase|xcodeproj|playground)$/i;

// A downloaded file has blocks on disk. A cloud-only ("dataless") file reports its full
// size but occupies none, so blocks === 0.
function isCloudOnly(stat) {
  return stat.size > 0 && stat.blocks === 0;
}

// Folder under Mobile Documents → friendly name.
//   com~apple~CloudDocs → "iCloud Drive";  iCloud~md~obsidian → "obsidian"
function containerName(mobileDocsDir, filePath) {
  const rel = path.relative(mobileDocsDir, filePath);
  const first = rel.split(path.sep)[0] || '';
  if (first === 'com~apple~CloudDocs') return 'iCloud Drive';
  const parts = first.split('~');
  return parts[parts.length - 1] || first || 'iCloud';
}

// Roots to walk for the chosen aspects.
function rootsFor({ home, kinds, syncedFolders }) {
  const mobileDocs = path.join(home, 'Library', 'Mobile Documents');
  const roots = [];
  if (kinds.includes('drive')) roots.push({ dir: path.join(mobileDocs, 'com~apple~CloudDocs'), kind: 'drive' });
  if (kinds.includes('apps')) {
    roots.push({ dir: mobileDocs, kind: 'apps', skipNames: new Set(['com~apple~CloudDocs']) });
  }
  if (kinds.includes('synced')) {
    for (const dir of syncedFolders) roots.push({ dir, kind: 'synced' });
  }
  return { roots, mobileDocs };
}

async function scanICloud({
  home,
  classify,
  kinds,
  syncedFolders = [],
  olderThanYears = 5,
  minSizeBytes = 0,
  signal,
  onProgress,
  limit = 3000,
  now = Date.now(),
}) {
  const cutoff = now - olderThanYears * YEAR;
  const { roots, mobileDocs } = rootsFor({ home, kinds, syncedFolders });

  const files = [];
  const containers = new Map(); // name → { size, count, oldSize, oldCount }
  let scannedFiles = 0;
  let scannedBytes = 0;

  function note(container, size, old) {
    const c = containers.get(container) || { name: container, size: 0, count: 0, oldSize: 0, oldCount: 0 };
    c.size += size;
    c.count += 1;
    if (old) {
      c.oldSize += size;
      c.oldCount += 1;
    }
    containers.set(container, c);
  }

  async function consider(full, stat, kind, container, size) {
    scannedFiles += 1;
    scannedBytes += size;
    const old = stat.mtimeMs < cutoff;
    note(container, size, old && size >= minSizeBytes);
    if (!old || size < minSizeBytes) return;
    files.push({
      path: full,
      name: path.basename(full),
      size,
      modified: stat.mtime.toISOString(),
      added: stat.birthtime ? stat.birthtime.toISOString() : null,
      kind,
      container,
      cloudOnly: isCloudOnly(stat),
      isPackage: stat.isDirectory(),
    });
    if (onProgress && files.length % 25 === 0) onProgress({ scannedFiles, found: files.length });
  }

  async function walk(dir, root) {
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
      const name = entry.name;
      // .DS_Store, and legacy ".name.icloud" placeholders whose real size is unknowable.
      if (name === '.DS_Store' || name === '.localized' || /^\..*\.icloud$/.test(name)) continue;
      if (dir === root.dir && root.skipNames && root.skipNames.has(name)) continue;
      const full = path.join(dir, name);
      const c = classify(full);
      if (c.protected) continue;
      // The "apps" root sits above iCloud Drive; classify tells us which aspect a path is in.
      if (c.icloudKind && c.icloudKind !== root.kind) continue;

      const container = root.kind === 'synced' ? path.basename(root.dir) : containerName(mobileDocs, full);

      if (entry.isDirectory()) {
        if (PACKAGE_RE.test(name)) {
          try {
            const st = await fs.promises.lstat(full);
            const { size } = await dirSize(full, { signal });
            await consider(full, st, root.kind, container, size);
          } catch {
            // skip
          }
          continue;
        }
        await walk(full, root);
      } else if (entry.isFile()) {
        try {
          const st = await fs.promises.lstat(full);
          await consider(full, st, root.kind, container, st.size);
        } catch {
          // skip
        }
      }
    }
  }

  for (const root of roots) {
    try {
      await fs.promises.access(root.dir);
    } catch {
      continue; // e.g. iCloud Drive not enabled
    }
    await walk(root.dir, root);
  }

  files.sort((a, b) => b.size - a.size);
  const shown = files.slice(0, limit);
  const summary = {
    scannedFiles,
    scannedBytes,
    oldCount: files.length,
    oldBytes: files.reduce((sum, f) => sum + f.size, 0),
    cloudOnlyBytes: files.filter((f) => f.cloudOnly).reduce((sum, f) => sum + f.size, 0),
    truncated: files.length > shown.length,
    containers: [...containers.values()].sort((a, b) => b.oldSize - a.oldSize || b.size - a.size),
    roots: roots.map((r) => r.dir),
  };
  if (onProgress) onProgress({ scannedFiles, found: files.length, done: true });
  return { files: shown, summary };
}

// Downloaded iCloud Drive files not touched in a year: removing the local copy frees disk
// space while the file stays safely in iCloud. Used by Quick Clean and the iCloud tool.
async function findEvictable({ home, olderThanDays = 365, now = Date.now(), signal }) {
  const root = path.join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
  const cutoff = now - olderThanDays * 24 * 60 * 60 * 1000;
  const items = [];

  async function walk(dir) {
    if (signal && signal.aborted) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name === '.DS_Store' || /^\..*\.icloud$/.test(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const st = await fs.promises.lstat(full);
          const local = st.blocks * 512;
          if (!isCloudOnly(st) && local > 0 && st.mtimeMs < cutoff && st.atimeMs < cutoff) {
            items.push({ path: full, size: local });
          }
        } catch {
          // skip
        }
      }
    }
  }

  await walk(root);
  return items;
}

// True if the path (or anything inside it, for folders/packages) isn't downloaded locally.
async function containsCloudOnly(p) {
  let st;
  try {
    st = await fs.promises.lstat(p);
  } catch {
    return false;
  }
  if (!st.isDirectory()) return isCloudOnly(st);
  let entries;
  try {
    entries = await fs.promises.readdir(p, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    if (/^\..*\.icloud$/.test(e.name)) return true;
    if (await containsCloudOnly(path.join(p, e.name))) return true;
  }
  return false;
}

module.exports = { scanICloud, findEvictable, isCloudOnly, containsCloudOnly, containerName };
