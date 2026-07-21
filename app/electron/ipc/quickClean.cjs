const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const { dirSize } = require('../lib/fsWalk.cjs');

const home = os.homedir();
const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
const roamingAppData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
const windir = process.env.WINDIR || 'C:\\Windows';

// Each category targets the *contents* of a folder (never the folder itself),
// so re-creation by the OS/app on next launch just works.
function buildCategories() {
  return [
    {
      id: 'user-temp',
      label: 'User Temp Files',
      description: 'Leftover temp files created by apps and installers.',
      risk: 'safe',
      paths: [path.join(localAppData, 'Temp')],
    },
    {
      id: 'windows-temp',
      label: 'Windows Temp',
      description: 'System-wide temporary files.',
      risk: 'safe',
      paths: [path.join(windir, 'Temp')],
    },
    {
      id: 'recycle-bin',
      label: 'Recycle Bin',
      description: 'Files you already deleted, still taking up space.',
      risk: 'safe',
      special: 'recycle-bin',
    },
    {
      id: 'windows-update',
      label: 'Windows Update Cache',
      description: 'Downloaded update packages no longer needed after install.',
      risk: 'safe',
      paths: [path.join(windir, 'SoftwareDistribution', 'Download')],
    },
    {
      id: 'delivery-optimization',
      label: 'Delivery Optimization Cache',
      description: 'Peer-shared Windows Update chunks.',
      risk: 'safe',
      paths: [path.join(windir, 'SoftwareDistribution', 'DeliveryOptimization')],
    },
    {
      id: 'prefetch',
      label: 'Prefetch Data',
      description: 'Windows app-launch acceleration cache; safe to clear, rebuilds automatically.',
      risk: 'low',
      paths: [path.join(windir, 'Prefetch')],
    },
    {
      id: 'thumbnail-cache',
      label: 'Thumbnail Cache',
      description: 'Cached image/video thumbnails; Explorer regenerates as needed.',
      risk: 'low',
      paths: [path.join(localAppData, 'Microsoft', 'Windows', 'Explorer')],
      filter: (name) => /^thumbcache_.*\.db$/i.test(name) || /^iconcache.*\.db$/i.test(name),
    },
    {
      id: 'wer',
      label: 'Error Reports & Crash Dumps',
      description: 'Windows Error Reporting logs and minidumps.',
      risk: 'safe',
      paths: [
        path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'WER'),
        path.join(localAppData, 'CrashDumps'),
      ],
    },
    {
      id: 'chrome-cache',
      label: 'Chrome Browser Cache',
      description: 'Cached web content for Google Chrome.',
      risk: 'safe',
      paths: [path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache')],
    },
    {
      id: 'edge-cache',
      label: 'Edge Browser Cache',
      description: 'Cached web content for Microsoft Edge.',
      risk: 'safe',
      paths: [path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache')],
    },
    {
      id: 'firefox-cache',
      label: 'Firefox Browser Cache',
      description: 'Cached web content for Mozilla Firefox.',
      risk: 'safe',
      globProfiles: path.join(localAppData, 'Mozilla', 'Firefox', 'Profiles'),
      profileSubpath: 'cache2',
    },
    {
      id: 'directx-shader-cache',
      label: 'DirectX Shader Cache',
      description: 'Precompiled GPU shader cache; regenerates on next game/app launch.',
      risk: 'low',
      paths: [path.join(localAppData, 'D3DSCache'), path.join(localAppData, 'NVIDIA', 'DXCache')],
    },
    {
      id: 'windows-logs',
      label: 'Windows Log Files',
      description: 'System and setup log files.',
      risk: 'low',
      paths: [path.join(windir, 'Logs')],
    },
  ];
}

async function resolveFirefoxCachePaths(cat) {
  const paths = [];
  try {
    const profiles = await fs.promises.readdir(cat.globProfiles, { withFileTypes: true });
    for (const p of profiles) {
      if (p.isDirectory()) {
        paths.push(path.join(cat.globProfiles, p.name, cat.profileSubpath));
      }
    }
  } catch {
    // no firefox installed
  }
  return paths;
}

async function sizeOfCategory(cat) {
  if (cat.special === 'recycle-bin') {
    return getRecycleBinSize();
  }

  let paths = cat.paths || [];
  if (cat.globProfiles) {
    paths = await resolveFirefoxCachePaths(cat);
  }

  let total = 0;
  let fileCount = 0;
  let exists = false;

  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    exists = true;
    if (cat.filter) {
      try {
        const entries = await fs.promises.readdir(p);
        for (const name of entries) {
          if (cat.filter(name)) {
            try {
              const st = await fs.promises.stat(path.join(p, name));
              total += st.size;
              fileCount += 1;
            } catch {}
          }
        }
      } catch {}
    } else {
      const { size, fileCount: fc } = await dirSize(p);
      total += size;
      fileCount += fc;
    }
  }

  return { id: cat.id, size: total, fileCount, exists };
}

async function getRecycleBinSize() {
  const psScript =
    '$ns = (New-Object -ComObject Shell.Application).Namespace(10); ' +
    '$items = $ns.Items(); $sum = 0; $count = 0; ' +
    'foreach ($i in $items) { $sum += $i.ExtendedProperty("Size"); $count++ }; ' +
    '[PSCustomObject]@{ size = $sum; count = $count } | ConvertTo-Json -Compress';
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      psScript,
    ]);
    const parsed = JSON.parse(stdout.trim() || '{}');
    return { id: 'recycle-bin', size: Number(parsed.size) || 0, fileCount: Number(parsed.count) || 0, exists: true };
  } catch {
    return { id: 'recycle-bin', size: 0, fileCount: 0, exists: false };
  }
}

async function scanQuickClean(onProgress) {
  const categories = buildCategories();
  const results = [];
  for (const cat of categories) {
    const result = await sizeOfCategory(cat);
    results.push({
      id: cat.id,
      label: cat.label,
      description: cat.description,
      risk: cat.risk,
      size: result.size,
      fileCount: result.fileCount,
      exists: result.exists !== false,
    });
    if (onProgress) onProgress({ id: cat.id, done: true });
  }
  return results;
}

async function emptyDirContents(dirPath) {
  let freed = 0;
  let errors = 0;
  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return { freed, errors };
  }
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    try {
      const stat = await fs.promises.lstat(full);
      if (entry.isDirectory()) {
        const { size } = await dirSize(full);
        await fs.promises.rm(full, { recursive: true, force: true });
        freed += size;
      } else {
        freed += stat.size;
        await fs.promises.unlink(full);
      }
    } catch {
      errors += 1;
    }
  }
  return { freed, errors };
}

async function cleanCategory(categoryId) {
  const categories = buildCategories();
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return { freed: 0, errors: 1 };

  if (cat.special === 'recycle-bin') {
    try {
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Clear-RecycleBin -Force -ErrorAction SilentlyContinue',
      ]);
      return { freed: null, errors: 0 };
    } catch {
      return { freed: 0, errors: 1 };
    }
  }

  let paths = cat.paths || [];
  if (cat.globProfiles) {
    paths = await resolveFirefoxCachePaths(cat);
  }

  let freed = 0;
  let errors = 0;
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    if (cat.filter) {
      try {
        const entries = await fs.promises.readdir(p);
        for (const name of entries) {
          if (cat.filter(name)) {
            const full = path.join(p, name);
            try {
              const st = await fs.promises.stat(full);
              await fs.promises.unlink(full);
              freed += st.size;
            } catch {
              errors += 1;
            }
          }
        }
      } catch {
        errors += 1;
      }
    } else {
      const result = await emptyDirContents(p);
      freed += result.freed;
      errors += result.errors;
    }
  }
  return { freed, errors };
}

module.exports = { scanQuickClean, cleanCategory };
