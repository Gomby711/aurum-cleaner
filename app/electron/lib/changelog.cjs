const fs = require('fs');
const path = require('path');

function loadChangelog() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'changelog.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Entries newer than lastSeenVersion, up to and including currentVersion.
// If lastSeenVersion is null (first-ever launch), only the current version's entry is shown.
function entriesSince(lastSeenVersion, currentVersion) {
  const all = loadChangelog();
  if (!lastSeenVersion) {
    return all.filter((e) => e.version === currentVersion);
  }
  return all.filter(
    (e) => compareVersions(e.version, lastSeenVersion) > 0 && compareVersions(e.version, currentVersion) <= 0
  );
}

module.exports = { loadChangelog, entriesSince, compareVersions };
