// Undo vault: instead of deleting, items are moved into a private holding folder
// (on the same disk, so the move is instant) along with a manifest recording where
// each one came from. "Undo" moves them back; space is only actually freed when a
// batch is purged — manually, or automatically once it is older than the retention.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dirSize } = require('./fsWalk.cjs');

const MANIFEST = 'manifest.json';

async function exists(p) {
  try {
    await fs.promises.lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function moveAcross(src, dest) {
  try {
    await fs.promises.rename(src, dest);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fs.promises.cp(src, dest, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
    await fs.promises.rm(src, { recursive: true, force: true });
  }
}

// "name.ext" -> "name (restored).ext" -> "name (restored 2).ext" …
async function freeName(target) {
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  for (let n = 1; n < 1000; n += 1) {
    const candidate = path.join(dir, `${base} (restored${n > 1 ? ` ${n}` : ''})${ext}`);
    if (!(await exists(candidate))) return candidate;
  }
  return path.join(dir, `${base} (restored ${Date.now()})${ext}`);
}

function createVault(rootDir) {
  const batchPath = (id) => path.join(rootDir, id);

  async function readManifest(id) {
    try {
      return JSON.parse(await fs.promises.readFile(path.join(batchPath(id), MANIFEST), 'utf-8'));
    } catch {
      return null;
    }
  }

  async function writeManifest(manifest) {
    await fs.promises.writeFile(path.join(batchPath(manifest.id), MANIFEST), JSON.stringify(manifest));
  }

  // Moves `paths` into a new batch. Returns what was staged and what failed.
  async function stage(paths, { label = 'Cleanup' } = {}) {
    const id = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const itemsDir = path.join(batchPath(id), 'items');
    await fs.promises.mkdir(itemsDir, { recursive: true });

    const entries = [];
    const failed = [];
    let staged = 0;

    try {
      for (const original of paths) {
        try {
          const st = await fs.promises.lstat(original);
          const isDir = st.isDirectory();
          const size = isDir ? (await dirSize(original)).size : st.size;
          const stored = path.join('items', String(entries.length));
          await moveAcross(original, path.join(batchPath(id), stored));
          entries.push({ original, stored, size, isDir });
          staged += size;
        } catch (err) {
          failed.push({ path: original, code: err.code || 'ERR' });
        }
      }
    } finally {
      if (entries.length > 0) {
        await writeManifest({ id, label, createdAt: Date.now(), entries });
      } else {
        await fs.promises.rm(batchPath(id), { recursive: true, force: true });
      }
    }

    return { batchId: entries.length > 0 ? id : null, staged, count: entries.length, failed };
  }

  async function list() {
    let dirs;
    try {
      dirs = await fs.promises.readdir(rootDir, { withFileTypes: true });
    } catch {
      return [];
    }
    const batches = [];
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const m = await readManifest(d.name);
      if (!m) continue;
      batches.push({
        id: m.id,
        label: m.label,
        createdAt: m.createdAt,
        count: m.entries.length,
        size: m.entries.reduce((sum, e) => sum + (e.size || 0), 0),
      });
    }
    return batches.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function details(id) {
    const m = await readManifest(id);
    if (!m) return null;
    return { ...m, entries: m.entries.map(({ original, size, isDir }) => ({ original, size, isDir })) };
  }

  // Puts everything in a batch back where it came from. If something now occupies the
  // original location, the restored copy gets a " (restored)" suffix — nothing is overwritten.
  async function restore(id) {
    const m = await readManifest(id);
    if (!m) return { restored: 0, renamed: 0, failed: 0, missing: true };

    const remaining = [];
    let restored = 0;
    let renamed = 0;

    for (const entry of m.entries) {
      const src = path.join(batchPath(id), entry.stored);
      try {
        await fs.promises.mkdir(path.dirname(entry.original), { recursive: true });
        let target = entry.original;
        if (await exists(target)) {
          target = await freeName(target);
          renamed += 1;
        }
        await moveAcross(src, target);
        restored += 1;
      } catch {
        remaining.push(entry);
      }
    }

    if (remaining.length === 0) {
      await fs.promises.rm(batchPath(id), { recursive: true, force: true });
    } else {
      await writeManifest({ ...m, entries: remaining });
    }
    return { restored, renamed, failed: remaining.length };
  }

  // Permanently deletes a batch. This is the only point where space is really freed.
  async function purge(id) {
    const m = await readManifest(id);
    const size = m ? m.entries.reduce((sum, e) => sum + (e.size || 0), 0) : 0;
    await fs.promises.rm(batchPath(id), { recursive: true, force: true });
    return { freed: size };
  }

  async function purgeAll() {
    let freed = 0;
    for (const b of await list()) freed += (await purge(b.id)).freed;
    return { freed };
  }

  async function purgeExpired(retentionDays) {
    if (!retentionDays || retentionDays <= 0) return { freed: 0 };
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let freed = 0;
    for (const b of await list()) {
      if (b.createdAt < cutoff) freed += (await purge(b.id)).freed;
    }
    return { freed };
  }

  return { rootDir, stage, list, details, restore, purge, purgeAll, purgeExpired };
}

module.exports = { createVault };
