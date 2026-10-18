const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createClassifier } = require('../electron/lib/macPaths.cjs');
const { createVault } = require('../electron/lib/undoVault.cjs');
const { scanMac, cleanMac } = require('../electron/ipc/quickCleanMac.cjs');

function write(p, bytes = 10) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.alloc(bytes, 1));
}

function fakeHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aurum-test-'));
  const home = path.join(root, 'home');
  const tmp = path.join(root, 'tmp');
  const vaultDir = path.join(root, 'vault');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(tmp, { recursive: true });
  return { root, home, tmp, vaultDir };
}

test('classifier protects personal data and flags iCloud', () => {
  const home = '/Users/sam';
  const { classify } = createClassifier({ home });
  for (const p of [
    '/Users/sam/Library/Messages/chat.db',
    '/Users/sam/Library/Mail/V10/x.emlx',
    '/Users/sam/Library/Calendars/abc.calendar',
    '/Users/sam/Library/Application Support/AddressBook/a.abcddb',
    '/Users/sam/Library/Containers/com.apple.mail/Data/foo',
    '/Users/sam/Library/Group Containers/group.com.apple.notes/db',
    '/Users/sam/Pictures/Photos Library.photoslibrary/originals/a.heic',
    '/Users/sam/Library/Application Support/MobileSync/Backup/x',
    '/System/Library/foo',
    '/USERS/SAM/LIBRARY/MESSAGES/chat.db', // case-insensitive volume
  ]) {
    assert.equal(classify(p).protected, true, p);
  }
  assert.equal(classify('/Users/sam/Library/Caches/com.spotify.client').protected, false);
  assert.equal(classify('/Users/sam/Movies/big.mov').protected, false);

  assert.equal(classify('/Users/sam/Library/Mobile Documents/com~apple~CloudDocs/a.pdf').icloud, true);
  assert.equal(classify('/Users/sam/Library/Mobile Documents/com~apple~CloudDocs/a.pdf').icloudKind, 'drive');
  assert.equal(classify('/Users/sam/Library/Mobile Documents/iCloud~com~apple~Pages/a.pages').icloudKind, 'apps');
  assert.equal(classify('/Users/sam/Library/CloudStorage/Dropbox/a.pdf').icloudKind, 'other');
  assert.equal(classify('/Users/sam/Movies/big.mov').icloud, false);

  // top-level folders can be browsed but never deleted whole
  assert.equal(classify('/Users/sam/Documents').guarded, true);
  assert.equal(classify('/Users/sam/Documents').protected, false);
  assert.equal(classify('/Users/sam/Documents/x.txt').guarded, false);
});

test('Desktop & Documents count as iCloud when iCloud sync is on', () => {
  const { classify } = createClassifier({ home: '/Users/sam', icloudSyncedFolders: ['/Users/sam/Documents'] });
  assert.equal(classify('/Users/sam/Documents/tax.pdf').icloud, true);
  assert.equal(classify('/Users/sam/Documents/tax.pdf').icloudKind, 'synced');
  assert.equal(classify('/Users/sam/Downloads/tax.pdf').icloud, false);
});

test('walk skip hides iCloud unless opted in, but never personal data', () => {
  const { makeSkip } = createClassifier({ home: '/Users/sam' });
  const drive = '/Users/sam/Library/Mobile Documents/com~apple~CloudDocs/x';
  const appData = '/Users/sam/Library/Mobile Documents/iCloud~md~obsidian/x';
  assert.equal(makeSkip({ kinds: [] })(drive), true);
  assert.equal(makeSkip({ kinds: ['drive'] })(drive), false);
  assert.equal(makeSkip({ kinds: ['drive'] })(appData), true, 'app data is a separate aspect');
  assert.equal(makeSkip({ kinds: ['drive', 'apps'] })(appData), false);
  assert.equal(makeSkip({ kinds: ['drive', 'apps', 'synced'] })('/Users/sam/Library/CloudStorage/Dropbox/a'), true, 'other providers never offered');
  assert.equal(makeSkip({ kinds: ['drive'] })('/Users/sam/Library/Messages'), true);
});

test('vault stages, restores to original location, and never overwrites', async () => {
  const { root, vaultDir } = fakeHome();
  const vault = createVault(vaultDir);
  const a = path.join(root, 'data', 'a.bin');
  const dir = path.join(root, 'data', 'folder');
  write(a, 100);
  write(path.join(dir, 'x.txt'), 50);

  const r = await vault.stage([a, dir], { label: 'Test' });
  assert.equal(r.count, 2);
  assert.equal(r.staged, 150);
  assert.equal(fs.existsSync(a), false);
  assert.equal(fs.existsSync(dir), false);
  assert.equal((await vault.list())[0].size, 150);

  // something new now sits where a.bin used to be
  write(a, 7);
  const back = await vault.restore(r.batchId);
  assert.equal(back.restored, 2);
  assert.equal(back.renamed, 1);
  assert.equal(fs.statSync(a).size, 7, 'existing file untouched');
  assert.equal(fs.statSync(path.join(root, 'data', 'a (restored).bin')).size, 100);
  assert.equal(fs.statSync(path.join(dir, 'x.txt')).size, 50);
  assert.deepEqual(await vault.list(), []);
});

test('vault purge frees space and expiry only removes old batches', async () => {
  const { root, vaultDir } = fakeHome();
  const vault = createVault(vaultDir);
  write(path.join(root, 'old.bin'), 20);
  write(path.join(root, 'new.bin'), 30);
  const old = await vault.stage([path.join(root, 'old.bin')]);
  // age the first batch by 10 days
  const mp = path.join(vaultDir, old.batchId, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mp, 'utf-8'));
  m.createdAt = Date.now() - 10 * 86400000;
  fs.writeFileSync(mp, JSON.stringify(m));
  const fresh = await vault.stage([path.join(root, 'new.bin')]);

  assert.equal((await vault.purgeExpired(7)).freed, 20);
  const left = await vault.list();
  assert.equal(left.length, 1);
  assert.equal(left[0].id, fresh.batchId);
  assert.equal((await vault.purgeAll()).freed, 30);
  assert.deepEqual(await vault.list(), []);
});

test('quick clean only touches junk; messages, mail, calendar, iCloud are untouched', async () => {
  const { home, tmp, vaultDir } = fakeHome();
  const lib = path.join(home, 'Library');
  const keep = [
    path.join(lib, 'Messages', 'chat.db'),
    path.join(lib, 'Mail', 'V10', 'a.emlx'),
    path.join(lib, 'Calendars', 'x.calendar', 'Info.plist'),
    path.join(lib, 'Mobile Documents', 'com~apple~CloudDocs', 'doc.pdf'),
    path.join(lib, 'Caches', 'com.apple.bird', 'cloud.db'),
    path.join(lib, 'Caches', 'CloudKit', 'ck.db'),
    path.join(lib, 'Caches', 'com.apple.Safari', 'Cache.db'), // browser category, checked separately
    path.join(home, 'Documents', 'thesis.docx'),
  ];
  const junk = [
    path.join(lib, 'Caches', 'com.spotify.client', 'blob', 'a'),
    path.join(lib, 'Logs', 'app.log'),
    path.join(lib, 'Logs', 'DiagnosticReports', 'crash.ips'),
    path.join(lib, 'Developer', 'Xcode', 'DerivedData', 'App-abc', 'Build', 'x.o'),
    path.join(lib, 'iTunes', 'iPhone Software Updates', 'iPhone.ipsw'),
    path.join(home, '.npm', '_cacache', 'content-v2', 'x'),
  ];
  [...keep, ...junk].forEach((p) => write(p, 1000));
  write(path.join(tmp, 'fresh.tmp'), 10); // too new to touch
  const oldTmp = path.join(tmp, 'old.tmp');
  write(oldTmp, 10);
  fs.utimesSync(oldTmp, new Date(Date.now() - 5 * 86400000), new Date(Date.now() - 5 * 86400000));

  const { classify } = createClassifier({ home });
  const scan = await scanMac({ home, tmpdir: tmp, classify });
  const byId = Object.fromEntries(scan.map((c) => [c.id, c]));
  assert.equal(byId['app-caches'].size, 1000);
  assert.equal(byId['user-logs'].size, 1000);
  assert.equal(byId['crash-reports'].size, 1000);
  assert.equal(byId['ios-firmware'].size, 1000);
  assert.equal(byId['npm-cache'].size, 1000);
  assert.equal(byId['temp-files'].size, 10);
  assert.equal(byId['browser-caches'].size, 1000);

  const vault = createVault(vaultDir);
  const everything = scan.filter((c) => !c.permanent && c.id !== 'macos-installers').map((c) => c.id);
  const result = await cleanMac(everything, {
    home, tmpdir: tmp, classify, vault, systemTrash: async () => {}, retentionDays: 7,
  });
  assert.equal(result.errors, 0);
  assert.ok(result.batchId);

  for (const p of keep.filter((k) => !k.includes('com.apple.Safari'))) {
    assert.equal(fs.existsSync(p), true, `should still exist: ${p}`);
  }
  for (const p of junk) assert.equal(fs.existsSync(p), false, `should be gone: ${p}`);
  assert.equal(fs.existsSync(path.join(tmp, 'fresh.tmp')), true);
  assert.equal(fs.existsSync(oldTmp), false);

  // one Undo brings every cleaned item back
  const back = await vault.restore(result.batchId);
  assert.equal(back.failed, 0);
  for (const p of junk) assert.equal(fs.existsSync(p), true, `should be restored: ${p}`);
  assert.equal(fs.existsSync(oldTmp), true);
});

test('Trash is permanent and is only emptied when asked for', async () => {
  const { home, tmp, vaultDir } = fakeHome();
  const f = path.join(home, '.Trash', 'old.txt');
  write(f, 40);
  const { classify } = createClassifier({ home });
  const vault = createVault(vaultDir);
  const base = { home, tmpdir: tmp, classify, vault, systemTrash: async () => {}, retentionDays: 7 };

  await cleanMac(['app-caches'], base);
  assert.equal(fs.existsSync(f), true);
  const r = await cleanMac(['trash'], base);
  assert.equal(r.freed, 40);
  assert.equal(fs.existsSync(f), false);
  assert.equal(r.batchId, null);
});

test('retention of 0 frees space immediately with no undo batch', async () => {
  const { home, tmp, vaultDir } = fakeHome();
  write(path.join(home, 'Library', 'Logs', 'a.log'), 25);
  const { classify } = createClassifier({ home });
  const vault = createVault(vaultDir);
  const r = await cleanMac(['user-logs'], { home, tmpdir: tmp, classify, vault, systemTrash: async () => {}, retentionDays: 0 });
  assert.equal(r.freed, 25);
  assert.equal(r.batchId, null);
  assert.deepEqual(await vault.list(), []);
});

test('macOS installers go to the system Trash, not the vault', async () => {
  const { home, tmp, vaultDir } = fakeHome();
  const { classify } = createClassifier({ home });
  const vault = createVault(vaultDir);
  const { buildMacCategories } = require('../electron/ipc/quickCleanMac.cjs');
  const cat = buildMacCategories(home, tmp).find((c) => c.id === 'macos-installers');
  assert.equal(cat.via, 'system-trash');
  assert.equal(cat.dirs[0].include('Install macOS Sequoia.app'), true);
  assert.equal(cat.dirs[0].include('Safari.app'), false);
  assert.ok(classify && vault);
});

// ---------- iCloud Cleanup ----------
const { scanICloud, findEvictable, containsCloudOnly } = require('../electron/ipc/icloudCleanup.cjs');

const YEARS = 365.25 * 86400000;
function age(p, years) {
  const t = new Date(Date.now() - years * YEARS);
  fs.utimesSync(p, t, t);
}

function icloudHome() {
  const f = fakeHome();
  const docs = path.join(f.home, 'Library', 'Mobile Documents');
  return { ...f, docs, drive: path.join(docs, 'com~apple~CloudDocs') };
}

test('iCloud scan lists only files older than the threshold, biggest first, with containers', async () => {
  const { home, drive, docs } = icloudHome();
  const old1 = path.join(drive, 'Taxes', '2015.pdf');
  const old2 = path.join(drive, 'old-video.mov');
  const recent = path.join(drive, 'recent.pdf');
  const appFile = path.join(docs, 'iCloud~md~obsidian', 'vault', 'note.md');
  write(old1, 3000); write(old2, 9000); write(recent, 50000); write(appFile, 500);
  age(old1, 8); age(old2, 6); age(recent, 1); age(appFile, 7);

  const { classify } = createClassifier({ home });
  const driveOnly = await scanICloud({ home, classify, kinds: ['drive'], olderThanYears: 5 });
  assert.deepEqual(driveOnly.files.map((f) => f.name), ['old-video.mov', '2015.pdf']);
  assert.equal(driveOnly.files[0].container, 'iCloud Drive');
  assert.equal(driveOnly.summary.oldBytes, 12000);
  assert.equal(driveOnly.summary.scannedFiles, 3, 'recent file counted as scanned but not listed');

  // app data is a separate aspect and only appears when asked for
  const withApps = await scanICloud({ home, classify, kinds: ['drive', 'apps'], olderThanYears: 5 });
  const app = withApps.files.find((f) => f.name === 'note.md');
  assert.equal(app.container, 'obsidian');
  assert.equal(app.kind, 'apps');

  // stricter threshold and min size
  const strict = await scanICloud({ home, classify, kinds: ['drive'], olderThanYears: 7, minSizeBytes: 1000 });
  assert.deepEqual(strict.files.map((f) => f.name), ['2015.pdf']);
  // nothing ticked → nothing scanned
  assert.equal((await scanICloud({ home, classify, kinds: [], olderThanYears: 5 })).files.length, 0);
});

test('iCloud scan treats packages as one item and flags cloud-only files', async () => {
  const { home, drive } = icloudHome();
  const pkg = path.join(drive, 'Report.pages');
  write(path.join(pkg, 'Index', 'Document.iwa'), 4000);
  write(path.join(pkg, 'Data', 'img.png'), 1000);
  age(pkg, 6);

  // a sparse file reports its full size but occupies no blocks — like an evicted iCloud file
  const cloud = path.join(drive, 'cloud-only.zip');
  fs.mkdirSync(drive, { recursive: true });
  fs.writeFileSync(cloud, '');
  fs.truncateSync(cloud, 2 * 1024 * 1024);
  age(cloud, 9);
  // legacy placeholder stubs are ignored
  write(path.join(drive, '.old.icloud'), 100);

  const { classify } = createClassifier({ home });
  const { files } = await scanICloud({ home, classify, kinds: ['drive'], olderThanYears: 5 });
  const names = files.map((f) => f.name);
  assert.deepEqual(names.sort(), ['Report.pages', 'cloud-only.zip']);
  const p = files.find((f) => f.name === 'Report.pages');
  assert.equal(p.size, 5000);
  assert.equal(p.isPackage, true);
  assert.equal(files.find((f) => f.name === 'cloud-only.zip').cloudOnly, true);
  assert.equal(await containsCloudOnly(cloud), true);
  assert.equal(await containsCloudOnly(pkg), false);
});

test('iCloud scan never lists protected data', async () => {
  const { home, drive } = icloudHome();
  const msg = path.join(home, 'Library', 'Messages', 'chat.db');
  write(msg, 100); age(msg, 9);
  write(path.join(drive, 'ok.txt'), 10); age(path.join(drive, 'ok.txt'), 9);
  const { classify } = createClassifier({ home });
  const { files } = await scanICloud({ home, classify, kinds: ['drive', 'apps', 'synced'], olderThanYears: 5 });
  assert.deepEqual(files.map((f) => f.name), ['ok.txt']);
});

test('evictable = downloaded iCloud Drive files untouched for a year', async () => {
  const { home, drive } = icloudHome();
  const stale = path.join(drive, 'stale.bin');
  const fresh = path.join(drive, 'fresh.bin');
  write(stale, 8192); write(fresh, 8192);
  age(stale, 2);
  const items = await findEvictable({ home });
  assert.deepEqual(items.map((i) => path.basename(i.path)), ['stale.bin']);
});

test('Quick Clean offers iCloud downloads only when asked, and evicts rather than deletes', async () => {
  const { home, tmp, vaultDir, drive } = icloudHome();
  const stale = path.join(drive, 'stale.bin');
  write(stale, 8192); age(stale, 2);
  const { classify } = createClassifier({ home });
  const evictable = () => findEvictable({ home });

  const off = await scanMac({ home, tmpdir: tmp, classify });
  assert.equal(off.some((c) => c.id === 'icloud-downloads'), false);
  const on = await scanMac({ home, tmpdir: tmp, classify, evictable });
  assert.equal(on.find((c) => c.id === 'icloud-downloads').fileCount, 1);

  const evicted = [];
  const r = await cleanMac(['icloud-downloads'], {
    home, tmpdir: tmp, classify, vault: createVault(vaultDir), systemTrash: async () => {}, retentionDays: 7,
    evict: async (p) => evicted.push(p), evictable,
  });
  assert.deepEqual(evicted, [stale]);
  assert.equal(fs.existsSync(stale), true, 'file itself is never deleted');
  assert.ok(r.freed > 0);
});
