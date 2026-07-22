const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function statePath() {
  return path.join(app.getPath('userData'), 'update-state.json');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf-8'));
  } catch {
    return { lastSeenVersion: null };
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(statePath(), JSON.stringify(state, null, 2));
  } catch {
    // best-effort
  }
}

function getLastSeenVersion() {
  return readState().lastSeenVersion;
}

function setLastSeenVersion(version) {
  writeState({ ...readState(), lastSeenVersion: version });
}

module.exports = { getLastSeenVersion, setLastSeenVersion };
