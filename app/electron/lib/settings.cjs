const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  // How long removed items stay restorable in Undo History (macOS). 0 = free space immediately.
  undoRetentionDays: 7,
};

function filePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(filePath(), 'utf-8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function setSettings(patch) {
  const next = { ...getSettings() };
  if (Number.isFinite(patch?.undoRetentionDays) && patch.undoRetentionDays >= 0) {
    next.undoRetentionDays = Math.floor(patch.undoRetentionDays);
  }
  try {
    fs.writeFileSync(filePath(), JSON.stringify(next, null, 2));
  } catch {
    // best-effort
  }
  return next;
}

module.exports = { getSettings, setSettings };
