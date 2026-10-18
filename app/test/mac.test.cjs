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
  assert.equal(classify('/Users/sam/Library/CloudStorage/Dropbox/a.pdf').icloud, true);
  assert.equal(classify('/Users/sam/Movies/big.mov').icloud, false);

  // top-level folders can be browsed but never deleted whole
  assert.equal(classify('/Users/sam/Documents').guarded, true);
  assert.equal(classify('/Users/sam/Documents').protected, false);
  assert.equal(classify('/Users/sam/Documents/x.txt').guarded, false);
});

test('Desktop & Documents count as iCloud when iCloud sync is on', () => {
  const { classify } = createClassifier({ home: '/Users/sam', icloudSyncedFolders: ['/Users/sam/Documents'] });
  assert.equal(classify('/Users/sam/Documents/tax.pdf').icloud, true);
  assert.equal(classify('/Users/sam/Downloads/tax.pdf').icloud, false);
});

test('walk skip hides iCloud unless opted in, but never personal data', () => {
  const { makeSkip } = createClassifier({ home: '/Users/sam' });
  const icloud = '/Users/sam/Library/Mobile Documents/x';
  assert.equal(makeSkip({ includeICloud: false })(icloud), true);
  assert.equal(makeSkip({ includeICloud: true })(icloud), false);
  assert.equal(makeSkip({ includeICloud: true })('/Users/sam/Library/Messages'), true);
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
