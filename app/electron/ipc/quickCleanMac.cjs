// macOS Quick Clean.
//
// Only regenerable junk: caches, logs, crash reports, developer build data, old
// iPhone/iPad firmware downloads, leftover macOS installers. It deliberately never
// touches Messages, Mail, Calendar, Notes, Photos, Keychain, or anything in iCloud.
// Removed items go to the Undo vault (see undoVault.cjs) so they can be restored.
const fs = require('fs');
const path = require('path');
const { dirSize } = require('../lib/fsWalk.cjs');

const DAY = 24 * 60 * 60 * 1000;

// Browser caches live inside ~/Library/Caches, so the general "App Caches" category
// leaves them out to avoid counting them twice.
const BROWSER_CACHE_FOLDERS = ['Google', 'Firefox', 'Microsoft Edge', 'BraveSoftware'];

function isAppleOrCloudCache(name) {
  return /^com\.apple\./i.test(name) || /icloud|cloudkit|^cloudd$/i.test(name);
}

function buildMacCategories(home, tmpdir) {
  const lib = path.join(home, 'Library');
  return [
    {
      id: 'app-caches',
      label: 'App Caches',
      description: "Cached data from your apps (Spotify, Slack, Homebrew…). Apps rebuild it as needed. Apple's own and iCloud caches are left alone.",
      risk: 'safe',
      dirs: [
        {
          dir: path.join(lib, 'Caches'),
          exclude: (name) => isAppleOrCloudCache(name) || BROWSER_CACHE_FOLDERS.includes(name),
        },
      ],
    },
    {
      id: 'browser-caches',
      label: 'Browser Caches',
      description: 'Cached web content for Safari, Chrome, Firefox, Edge and Brave. History, bookmarks and passwords are not touched.',
      risk: 'safe',
      dirs: [
        { dir: path.join(lib, 'Caches', 'com.apple.Safari') },
        { dir: path.join(lib, 'Caches', 'Google', 'Chrome') },
        { dir: path.join(lib, 'Caches', 'Firefox', 'Profiles') },
        { dir: path.join(lib, 'Caches', 'Microsoft Edge') },
        { dir: path.join(lib, 'Caches', 'BraveSoftware') },
      ],
    },
    {
      id: 'user-logs',
      label: 'App Logs',
      description: 'Log files written by apps and the system for your user account.',
      risk: 'safe',
      dirs: [{ dir: path.join(lib, 'Logs'), exclude: (name) => name === 'DiagnosticReports' }],
    },
    {
      id: 'crash-reports',
      label: 'Crash Reports',
      description: 'Diagnostic reports from apps that crashed.',
      risk: 'safe',
      dirs: [{ dir: path.join(lib, 'Logs', 'DiagnosticReports') }],
    },
    {
      id: 'temp-files',
      label: 'Temporary Files',
      description: "Leftover temp files that haven't been touched in 3+ days.",
      risk: 'safe',
      dirs: [{ dir: tmpdir, minAgeDays: 3 }],
    },
    {
      id: 'ios-firmware',
      label: 'iPhone & iPad Software Updates',
      description: 'Old iOS/iPadOS update files (.ipsw) downloaded to this Mac. They can be re-downloaded if ever needed.',
      risk: 'safe',
      dirs: [
        { dir: path.join(lib, 'iTunes', 'iPhone Software Updates') },
        { dir: path.join(lib, 'iTunes', 'iPad Software Updates') },
        { dir: path.join(lib, 'iTunes', 'iPod Software Updates') },
      ],
    },
    {
      id: 'macos-installers',
      label: 'Leftover macOS Installers',
      description: 'Install macOS apps left in Applications after an upgrade (often 10+ GB). Moved to the Trash — restore with Put Back.',
      risk: 'low',
      via: 'system-trash',
      dirs: [{ dir: '/Applications', include: (name) => /^Install (macOS|OS X) .*\.app$/i.test(name) }],
    },
    {
      id: 'xcode-build',
      label: 'Xcode Build Data',
      description: 'DerivedData and simulator caches. Xcode regenerates them on the next build.',
      risk: 'low',
      dirs: [
        { dir: path.join(lib, 'Developer', 'Xcode', 'DerivedData') },
        { dir: path.join(lib, 'Developer', 'CoreSimulator', 'Caches') },
      ],
    },
    {
      id: 'xcode-device-support',
      label: 'Xcode Device Support',
      description: 'Debug symbols for old iOS versions. Re-created when you next connect a device.',
      risk: 'low',
      dirs: [
        { dir: path.join(lib, 'Developer', 'Xcode', 'iOS DeviceSupport') },
        { dir: path.join(lib, 'Developer', 'Xcode', 'watchOS DeviceSupport') },
      ],
    },
    {
      id: 'npm-cache',
      label: 'npm Cache',
      description: 'Downloaded package cache for Node.js developers.',
      risk: 'safe',
      dirs: [{ dir: path.join(home, '.npm', '_cacache') }],
    },
    {
      id: 'trash',
      label: 'Trash',
      description: "Items you've already thrown away. Emptying it is permanent and can't be undone from Aurum.",
      risk: 'permanent',
      permanent: true,
      dirs: [{ dir: path.join(home, '.Trash') }],
    },
  ];
}

// Lists the top-level entries a category would remove. Never follows symlinks.
async function listEntries(cat, classify) {
  const entries = [];
  let blockedByPermissions = false;
  let anyDirExists = false;

  for (const spec of cat.dirs) {
    let names;
    try {
      names = await fs.promises.readdir(spec.dir, { withFileTypes: true });
      anyDirExists = true;
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'EACCES') {
        blockedByPermissions = true;
        anyDirExists = true;
      }
      continue;
    }
    for (const d of names) {
      if (d.name === '.DS_Store' || d.name === '.localized') continue;
      if (spec.include && !spec.include(d.name)) continue;
      if (spec.exclude && spec.exclude(d.name)) continue;
      const full = path.join(spec.dir, d.name);
      if (classify && classify(full).protected) continue; // belt and braces
      let st;
      try {
        st = await fs.promises.lstat(full);
      } catch {
        continue;
      }
      if (spec.minAgeDays && Date.now() - st.mtimeMs < spec.minAgeDays * DAY) continue;
      entries.push({ path: full, isDir: st.isDirectory() && !st.isSymbolicLink(), lstatSize: st.size });
    }
  }
  return { entries, blockedByPermissions, exists: anyDirExists };
}

async function sizeEntries(entries) {
  let size = 0;
  let fileCount = 0;
  for (const e of entries) {
    if (e.isDir) {
      const r = await dirSize(e.path);
      size += r.size;
      fileCount += r.fileCount;
    } else {
      size += e.lstatSize;
      fileCount += 1;
    }
  }
  return { size, fileCount };
}

async function scanMac({ home, tmpdir, classify, onProgress }) {
  const results = [];
  for (const cat of buildMacCategories(home, tmpdir)) {
    const { entries, blockedByPermissions, exists } = await listEntries(cat, classify);
    const { size, fileCount } = await sizeEntries(entries);
    results.push({
      id: cat.id,
      label: cat.label,
      description: cat.description,
      risk: cat.risk,
      size,
      fileCount,
      exists: exists && !(blockedByPermissions && entries.length === 0),
      needsFullDiskAccess: blockedByPermissions,
      permanent: !!cat.permanent,
    });
    if (onProgress) onProgress({ id: cat.id, done: true });
  }
  return results;
}

// Cleans the given categories in one go. `vault` stages removable items for undo;
// `systemTrash(path)` is used for installers; permanent categories (Trash) are deleted outright.
async function cleanMac(categoryIds, { home, tmpdir, classify, vault, systemTrash, retentionDays }) {
  const toStage = [];
  const toSystemTrash = [];
  const toDelete = [];

  for (const cat of buildMacCategories(home, tmpdir)) {
    if (!categoryIds.includes(cat.id)) continue;
    const { entries } = await listEntries(cat, classify);
    for (const e of entries) {
      if (cat.permanent) toDelete.push(e);
      else if (cat.via === 'system-trash') toSystemTrash.push(e);
      else toStage.push(e);
    }
  }

  let freed = 0;
  let errors = 0;
  let batchId = null;
  let heldForUndo = 0;

  if (toStage.length > 0) {
    const r = await vault.stage(
      toStage.map((e) => e.path),
      { label: 'Quick Clean' }
    );
    errors += r.failed.length;
    batchId = r.batchId;
    if (batchId && retentionDays === 0) {
      freed += (await vault.purge(batchId)).freed;
      batchId = null;
    } else {
      heldForUndo += r.staged;
      freed += r.staged;
    }
  }

  for (const e of toSystemTrash) {
    try {
      const size = e.isDir ? (await dirSize(e.path)).size : e.lstatSize;
      await systemTrash(e.path);
      freed += size;
    } catch {
      errors += 1;
    }
  }

  for (const e of toDelete) {
    try {
      const size = e.isDir ? (await dirSize(e.path)).size : e.lstatSize;
      await fs.promises.rm(e.path, { recursive: true, force: true });
      freed += size;
    } catch {
      errors += 1;
    }
  }

  return { freed, errors, batchId, heldForUndo, trashedCount: toSystemTrash.length };
}

module.exports = { scanMac, cleanMac, buildMacCategories };
