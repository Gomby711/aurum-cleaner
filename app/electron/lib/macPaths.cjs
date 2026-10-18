// Path safety rules for macOS.
//
// Two separate ideas:
//   protected — personal-data stores (Messages, Mail, Calendar, Photos library, …).
//               Aurum Cleaner will never list, stage, or delete these, from any tool.
//   icloud    — iCloud Drive and other cloud-synced folders. These are the user's call:
//               they are skipped unless the user opts in for a scan, and deleting
//               anything inside them needs an explicit extra acknowledgement.
const path = require('path');
const os = require('os');

// Relative to ~/Library
const PROTECTED_LIBRARY_DIRS = [
  'Messages',
  'Mail',
  'Calendars',
  'Reminders',
  'Safari',
  'Keychains',
  'Accounts',
  'Cookies',
  'Preferences',
  'Metadata',
  'IdentityServices',
  'Application Support/AddressBook',
  'Application Support/CallHistoryDB',
  'Application Support/CallHistoryTransactions',
  'Application Support/MobileSync', // iPhone / iPad backups
  'Application Support/iCloud',
  'Application Support/CloudDocs',
  'Application Support/Notes',
];

// Anything under these prefixes (relative to ~/Library) is Apple-app data.
const PROTECTED_LIBRARY_PREFIXES = [
  'Containers/com.apple.',
  'Group Containers/group.com.apple',
];

// iCloud locations, by "aspect" so each tool can let the user pick which to include:
//   drive   — iCloud Drive proper (Mobile Documents/com~apple~CloudDocs)
//   apps    — other apps' iCloud folders (Mobile Documents/iCloud~…)
//   synced  — Desktop / Documents when "Desktop & Documents Folders" is on in iCloud
//   other   — third-party cloud providers (Dropbox, Google Drive…) in ~/Library/CloudStorage;
//             never offered, always skipped
const ICLOUD_KINDS = ['drive', 'apps', 'synced'];

// Never offered for deletion from the file tools, even though they're not "personal data".
const SYSTEM_ROOTS = ['/system', '/usr', '/bin', '/sbin', '/etc', '/private/etc', '/library', '/cores', '/dev'];

function lower(p) {
  // APFS is case-insensitive by default, so compare case-insensitively.
  return path.resolve(p).toLowerCase();
}

function isInside(child, parent) {
  return child === parent || child.startsWith(parent + path.sep);
}

function createClassifier({ home = os.homedir(), icloudSyncedFolders = [] } = {}) {
  const lib = lower(path.join(home, 'Library'));

  const protectedDirs = PROTECTED_LIBRARY_DIRS.map((d) => lower(path.join(home, 'Library', d)));
  const protectedPrefixes = PROTECTED_LIBRARY_PREFIXES.map((d) => lower(path.join(home, 'Library', d)));
  const driveDir = lower(path.join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs'));
  const mobileDocs = lower(path.join(home, 'Library', 'Mobile Documents'));
  const cloudStorage = lower(path.join(home, 'Library', 'CloudStorage'));
  const syncedDirs = icloudSyncedFolders.map(lower);
  // Folder roots that must never be deleted as a whole.
  const wholeFolderGuards = new Set(
    [home, path.join(home, 'Library'), ...['Desktop', 'Documents', 'Downloads', 'Pictures', 'Movies', 'Music', 'Applications'].map((d) => path.join(home, d))].map(lower)
  );

  function classify(p) {
    const abs = lower(p);
    const segments = abs.split(path.sep);

    // `guarded` = a top-level folder that is fine to look inside but never to delete whole.
    const guarded = wholeFolderGuards.has(abs) || abs === '/';

    let isProtected = false;
    if (protectedDirs.some((d) => isInside(abs, d))) isProtected = true;
    else if (protectedPrefixes.some((d) => abs.startsWith(d))) isProtected = true;
    else if (SYSTEM_ROOTS.some((d) => isInside(abs, d))) isProtected = true;
    else if (segments.some((s) => /\.(photoslibrary|photolibrary|migratedphotolibrary)$/.test(s))) isProtected = true;

    let icloudKind = null;
    if (isInside(abs, driveDir)) icloudKind = 'drive';
    else if (isInside(abs, mobileDocs)) icloudKind = 'apps';
    else if (syncedDirs.some((d) => isInside(abs, d))) icloudKind = 'synced';
    else if (isInside(abs, cloudStorage)) icloudKind = 'other';
    return { protected: isProtected, guarded, icloud: icloudKind !== null, icloudKind };
  }

  // Skip predicate for directory walks. `kinds` is the set of iCloud aspects the user
  // ticked; everything iCloud-related that isn't ticked is hidden from the scan.
  function makeSkip({ kinds = [] } = {}) {
    const allowed = new Set(kinds);
    return (p) => {
      const c = classify(p);
      return c.protected || (c.icloud && !allowed.has(c.icloudKind));
    };
  }

  return { classify, makeSkip, libraryPath: lib };
}

// UI options → list of allowed kinds. Accepts { icloud: { drive, apps, synced } }.
function kindsFromOptions(opts) {
  const o = opts?.icloud || {};
  return ICLOUD_KINDS.filter((k) => o[k]);
}

module.exports = { createClassifier, kindsFromOptions, ICLOUD_KINDS };
