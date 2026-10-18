const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

// Drive shape shared by both platforms:
//   id       stable identifier (Windows "C:", macOS volume mount path)
//   name     short display name
//   label    optional volume label
//   root     where the Dashboard / Disk Analyzer start
//   userRoot where Large Files / Duplicates start
async function listDrivesWindows() {
  const psScript =
    'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ' +
    'Select-Object DeviceID,Size,FreeSpace,VolumeName | ConvertTo-Json -Compress';
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      psScript,
    ]);
    let parsed = JSON.parse(stdout.trim() || '[]');
    if (!Array.isArray(parsed)) parsed = [parsed];
    return parsed.map((d) => ({
      id: d.DeviceID,
      name: d.DeviceID,
      label: d.VolumeName || 'Local Disk',
      root: `${d.DeviceID}\\`,
      userRoot: `${d.DeviceID}\\Users`,
      size: Number(d.Size) || 0,
      free: Number(d.FreeSpace) || 0,
      used: (Number(d.Size) || 0) - (Number(d.FreeSpace) || 0),
    }));
  } catch (err) {
    return [];
  }
}

async function volumeStats(p) {
  const st = await fs.promises.statfs(p);
  const size = Number(st.blocks) * Number(st.bsize);
  const free = Number(st.bavail) * Number(st.bsize);
  return { size, free, used: size - free };
}

// macOS: the startup disk (measured via the home folder, which sits on the Data volume
// and so reports the real container usage) plus anything mounted under /Volumes.
async function listDrivesMac() {
  const home = os.homedir();
  const drives = [];

  let startupName = 'Macintosh HD';
  let volumeNames = [];
  try {
    volumeNames = await fs.promises.readdir('/Volumes');
  } catch {
    // no /Volumes
  }

  const external = [];
  for (const name of volumeNames) {
    const full = path.join('/Volumes', name);
    try {
      if ((await fs.promises.realpath(full)) === '/') {
        startupName = name; // the boot volume shows up here as a symlink to "/"
        continue;
      }
      external.push({ name, full });
    } catch {
      // unreadable mount
    }
  }

  try {
    const stats = await volumeStats(home);
    drives.push({
      id: '/',
      name: startupName,
      label: 'Startup disk',
      root: home,
      userRoot: home,
      ...stats,
    });
  } catch {
    // fall through with whatever we have
  }

  for (const v of external) {
    try {
      const stats = await volumeStats(v.full);
      if (stats.size === 0) continue;
      drives.push({ id: v.full, name: v.name, label: 'External', root: v.full, userRoot: v.full, ...stats });
    } catch {
      // skip
    }
  }
  return drives;
}

async function listDrives() {
  return process.platform === 'darwin' ? listDrivesMac() : listDrivesWindows();
}

module.exports = { listDrives };
