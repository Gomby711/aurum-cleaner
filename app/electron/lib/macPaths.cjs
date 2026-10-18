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

const ICLOUD_LIBRARY_DIRS = ['Mobile Documents', 'CloudStorage'];

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
  const icloudDirs = [
    ...ICLOUD_LIBRARY_DIRS.map((d) => lower(path.join(home, 'Library', d))),
    ...icloudSyncedFolders.map(lower),
  ];
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

    const isICloud = icloudDirs.some((d) => isInside(abs, d));
    return { protected: isProtected, guarded, icloud: isICloud };
  }

  // Skip predicate for directory walks.
  function makeSkip({ includeICloud = false } = {}) {
    return (p) => {
      const c = classify(p);
      return c.protected || (c.icloud && !includeICloud);
    };
  }

  return { classify, makeSkip, libraryPath: lib };
}

module.exports = { createClassifier };
