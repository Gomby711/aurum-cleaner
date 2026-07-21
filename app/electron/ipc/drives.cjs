const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

async function listDrives() {
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
      letter: d.DeviceID,
      label: d.VolumeName || 'Local Disk',
      size: Number(d.Size) || 0,
      free: Number(d.FreeSpace) || 0,
      used: (Number(d.Size) || 0) - (Number(d.FreeSpace) || 0),
    }));
  } catch (err) {
    return [];
  }
}

module.exports = { listDrives };
