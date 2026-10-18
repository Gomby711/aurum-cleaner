import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Trash2, Cloud, CloudOff, HardDrive, FolderSearch, ExternalLink, ShieldAlert } from 'lucide-react';
import PageShell from '../components/PageShell';
import ConfirmModal from '../components/ConfirmModal';
import RemovedBanner from '../components/RemovedBanner';
import { formatBytes, formatDate } from '../lib/format';
import { useNotify } from '../lib/notifications';
import { platform } from '../lib/platform';

const RENDER_LIMIT = 500;
const YEAR_OPTIONS = [1, 2, 3, 5, 7, 10];

function yearsAgo(iso) {
  const years = (Date.now() - new Date(iso).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return years < 1 ? 'under a year ago' : `${Math.floor(years)} year${Math.floor(years) === 1 ? '' : 's'} ago`;
}

// Where is this file, relative to the iCloud folder it lives in? (More useful than the full path.)
function shortPath(f) {
  const marker = f.kind === 'drive' ? 'com~apple~CloudDocs/' : f.kind === 'apps' ? 'Mobile Documents/' : null;
  if (marker && f.path.includes(marker)) return f.path.split(marker)[1];
  return f.path.replace(platform.home, '~');
}

export default function ICloudCleanup({ active }) {
  const syncedAvailable = (platform.icloud?.syncedFolders?.length || 0) > 0;
  const [aspects, setAspects] = useState({ drive: true, apps: false, synced: syncedAvailable });
  const [years, setYears] = useState(5);
  const [minSizeMB, setMinSizeMB] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [scanId, setScanId] = useState(null);
  const [data, setData] = useState(null); // { files, summary }
  const [container, setContainer] = useState('all');
  const [sortBy, setSortBy] = useState('size');
  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEvict, setConfirmEvict] = useState(false);
  const [result, setResult] = useState(null);
  const [evictResult, setEvictResult] = useState(null);
  const notify = useNotify();
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const anyAspect = aspects.drive || aspects.apps || aspects.synced;

  async function scan() {
    setScanning(true);
    setResult(null);
    setEvictResult(null);
    setData(null);
    setSelected(new Set());
    setContainer('all');
    const id = `icloud-${Date.now()}`;
    setScanId(id);
    const unsub = window.api.icloud.onProgress((p) => {
      if (p.scanId === id) setProgress(p);
    });
    try {
      const r = await window.api.icloud.scan(id, { icloud: aspects, olderThanYears: years, minSizeMB });
      setData(r);
      if (!activeRef.current) notify(`iCloud scan finished — ${r.files.length} old file(s) found.`);
    } finally {
      unsub();
      setScanning(false);
      setProgress(null);
    }
  }

  async function cancelScan() {
    if (scanId) await window.api.scan.cancel(scanId);
  }

  const files = useMemo(() => data?.files || [], [data]);
  const summary = data?.summary;

  const shown = useMemo(() => {
    const list = container === 'all' ? files : files.filter((f) => f.container === container);
    return [...list].sort((a, b) => (sortBy === 'size' ? b.size - a.size : new Date(a.modified) - new Date(b.modified)));
  }, [files, container, sortBy]);

  const visible = shown.slice(0, RENDER_LIMIT);
  const selectedFiles = files.filter((f) => selected.has(f.path));
  const selectedSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const cloudOnlySelected = selectedFiles.filter((f) => f.cloudOnly).length;
  const downloadedSelected = selectedFiles.filter((f) => !f.cloudOnly);
  const appDataSelected = selectedFiles.filter((f) => f.kind === 'apps').length;

  function toggle(p) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function selectShown() {
    setSelected((prev) => new Set([...prev, ...visible.map((f) => f.path)]));
  }

  function dropFromList(paths) {
    const gone = new Set(paths);
    setData((d) => ({ ...d, files: d.files.filter((f) => !gone.has(f.path)) }));
    setSelected(new Set());
  }

  async function deleteSelected() {
    setConfirmDelete(false);
    const paths = selectedFiles.map((f) => f.path);
    const r = await window.api.files.trash(paths, { allowICloud: true, label: 'iCloud Cleanup' });
    dropFromList(paths);
    setResult(r);
    if (!activeRef.current) notify(`iCloud Cleanup: removed ${formatBytes(r.freed)} from iCloud.`);
  }

  async function evictSelected() {
    setConfirmEvict(false);
    const r = await window.api.icloud.evict(downloadedSelected.map((f) => f.path));
    setEvictResult(r);
    if (!activeRef.current) notify(`iCloud Cleanup: freed ${formatBytes(r.freed)} on this Mac.`);
  }

  const aspectBox = (key, label, hint, disabled) => (
    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }} title={hint}>
      <input
        type="checkbox"
        className="checkbox"
        checked={aspects[key]}
        disabled={disabled || scanning}
        onChange={(e) => setAspects((a) => ({ ...a, [key]: e.target.checked }))}
      />
      {label}
    </label>
  );

  return (
    <PageShell
      title="iCloud Cleanup"
      subtitle="Find old files taking up your iCloud storage, review the list, and choose exactly what goes."
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-2)' }}>Not modified in</span>
            <select value={years} onChange={(e) => setYears(Number(e.target.value))} disabled={scanning} style={{ padding: '7px 9px', fontSize: 12.5, fontWeight: 600 }}>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}+ year{y === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-2)' }}>Min size (MB)</span>
            <input
              type="number"
              min={0}
              value={minSizeMB}
              disabled={scanning}
              onChange={(e) => setMinSizeMB(Math.max(0, Number(e.target.value) || 0))}
              style={{ width: 64, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: 6, color: 'var(--text-0)', padding: '6px 8px', fontSize: 12.5 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Cloud size={13} color="var(--text-2)" />
            {aspectBox('drive', 'iCloud Drive', 'Files in iCloud Drive', !platform.icloud?.driveExists)}
            {aspectBox('apps', 'App data', "Other apps' iCloud folders (Pages, Numbers, Obsidian…). Apps may need these files — review carefully.", !platform.icloud?.driveExists)}
            {syncedAvailable && aspectBox('synced', 'Desktop & Documents', 'Your Desktop and Documents folders, synced with iCloud on this Mac')}
          </div>
          <div style={{ flex: 1 }} />
          {scanning ? (
            <button className="btn" onClick={cancelScan}>Cancel</button>
          ) : (
            <button className="btn btn-primary" onClick={scan} disabled={!anyAspect}>
              <Search size={14} /> Find old files
            </button>
          )}
        </div>

        {!platform.icloud?.driveExists && !syncedAvailable && (
          <div className="glass-panel" style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-1)' }}>
            iCloud Drive doesn't appear to be turned on for this Mac. Turn it on in System Settings → Apple Account → iCloud to see its files here.
          </div>
        )}

        {scanning && (
          <div className="glass-panel" style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--text-2)' }}>
            Scanning iCloud… {progress?.scannedFiles || 0} files checked, {progress?.found || 0} old files so far
          </div>
        )}

        {summary && !scanning && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Stat label="Checked" value={formatBytes(summary.scannedBytes)} sub={`${summary.scannedFiles.toLocaleString()} files in iCloud`} />
            <Stat label={`Not modified in ${years}+ years`} value={formatBytes(summary.oldBytes)} sub={`${summary.oldCount.toLocaleString()} files`} accent />
            <Stat label="Only in the cloud" value={formatBytes(summary.cloudOnlyBytes)} sub="not downloaded to this Mac" />
          </div>
        )}

        {summary && !scanning && summary.containers.some((c) => c.oldCount > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Where it lives:</span>
            <Chip active={container === 'all'} onClick={() => setContainer('all')}>All ({summary.oldCount})</Chip>
            {summary.containers.filter((c) => c.oldCount > 0).map((c) => (
              <Chip key={c.name} active={container === c.name} onClick={() => setContainer(c.name)}>
                {c.name} · {formatBytes(c.oldSize)}
              </Chip>
            ))}
          </div>
        )}

        <RemovedBanner result={result} />
        {evictResult && (
          <div className="glass-panel" style={{ padding: '14px 20px', fontSize: 13 }}>
            Freed <b>{formatBytes(evictResult.freed)}</b> on this Mac — those files are still in iCloud and download again when you open them
            {evictResult.errors > 0 ? ` (${evictResult.errors} couldn't be removed from this Mac).` : '.'}
          </div>
        )}

        {files.length > 0 && !scanning && (
          <div className="glass-panel" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>
              {selectedFiles.length > 0 ? (
                <>
                  <b>{selectedFiles.length}</b> selected — {formatBytes(selectedSize)}
                </>
              ) : (
                'Tick files to remove, or select everything shown.'
              )}
            </span>
            <button className="btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={selectShown}>Select shown</button>
            {selectedFiles.length > 0 && (
              <button className="btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setSelected(new Set())}>Clear</button>
            )}
            <div style={{ flex: 1 }} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '6px 9px', fontSize: 12 }}>
              <option value="size">Largest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button className="btn" disabled={downloadedSelected.length === 0} onClick={() => setConfirmEvict(true)} title="Removes the copy on this Mac only. The file stays in iCloud.">
              <HardDrive size={14} /> Free this Mac's copy ({downloadedSelected.length})
            </button>
            <button className="btn btn-danger" disabled={selectedFiles.length === 0} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} /> Delete from iCloud
            </button>
          </div>
        )}

        <div className="scroll-region" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!data && !scanning && (
            <div className="glass-panel" style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
              <Cloud size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>Choose how old a file must be and which parts of iCloud to look in, then press <b>Find old files</b>.</div>
              <div>Nothing is deleted until you tick files and confirm.</div>
            </div>
          )}
          {data && files.length === 0 && !scanning && (
            <div className="glass-panel" style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
              No files found that haven't been modified in {years}+ years. Try a shorter time or a smaller minimum size.
            </div>
          )}
          {visible.map((f) => (
            <label key={f.path} className="glass-panel" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" className="checkbox" checked={selected.has(f.path)} onChange={() => toggle(f.path)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  {f.cloudOnly ? (
                    <span className="risk-pill risk-low" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}><CloudOff size={10} /> Cloud only</span>
                  ) : (
                    <span className="risk-pill risk-safe" style={{ flexShrink: 0 }}>On this Mac</span>
                  )}
                  {f.kind === 'apps' && <span className="risk-pill risk-low" style={{ flexShrink: 0 }}>{f.container} data</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shortPath(f)} · modified {formatDate(f.modified)} ({yearsAgo(f.modified)})
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  window.api.files.showInFolder(f.path);
                }}
                title="Show in Finder"
                style={{ background: 'none', border: 'none', color: 'var(--text-2)', display: 'flex', flexShrink: 0 }}
              >
                <FolderSearch size={15} />
              </button>
              <div style={{ fontSize: 14, fontWeight: 700, minWidth: 84, textAlign: 'right' }}>{formatBytes(f.size)}</div>
            </label>
          ))}
          {shown.length > RENDER_LIMIT && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', padding: '4px 6px' }}>
              Showing the first {RENDER_LIMIT} of {shown.length.toLocaleString()}. Raise the minimum size or pick a folder above to narrow the list.
            </div>
          )}
          {summary?.truncated && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', padding: '4px 6px' }}>
              More old files exist than can be listed. Delete some or raise the minimum size to see the rest.
            </div>
          )}

          <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <ShieldAlert size={16} color="var(--text-2)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, flex: 1 }}>
              iCloud Photos, device backups and iCloud Mail don't show up as files on your Mac, so they can't be listed here.
              They're often the biggest users of iCloud storage — review them in System Settings.
            </div>
            <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => window.api.icloud.openSettings()}>
              <ExternalLink size={13} /> Open iCloud settings
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete from iCloud?"
        description={
          `${selectedFiles.length} file(s) totaling ${formatBytes(selectedSize)} will be deleted from iCloud, which also removes them from your iPhone, iPad and iCloud.com. ` +
          (downloadedSelected.length > 0 ? `On this Mac (can be undone): ${downloadedSelected.length}. ` : '') +
          (cloudOnlySelected > 0 ? `Cloud only (go to the Trash; recoverable from iCloud.com → Recently Deleted for 30 days): ${cloudOnlySelected}. ` : '') +
          (appDataSelected > 0 ? `App data: ${appDataSelected} — an app may stop working if it needs these.` : '')
        }
        ackLabel="I've looked at this list and understand these files are deleted from iCloud and my other devices."
        confirmLabel="Delete from iCloud"
        danger
        onConfirm={deleteSelected}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={confirmEvict}
        title="Free this Mac's copy?"
        description={`${downloadedSelected.length} downloaded file(s) will be removed from this Mac only. They stay in iCloud and download again whenever you open them. Nothing is deleted from iCloud.`}
        confirmLabel="Free space on this Mac"
        onConfirm={evictSelected}
        onCancel={() => setConfirmEvict(false)}
      />
    </PageShell>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div className="glass-panel" style={{ padding: '12px 18px', minWidth: 170 }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ? 'var(--gold-300)' : 'var(--text-0)', marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 11px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${active ? 'rgba(212,175,55,0.5)' : 'var(--border-subtle)'}`,
        background: active ? 'rgba(212,175,55,0.14)' : 'rgba(255,255,255,0.03)',
        color: active ? 'var(--gold-300)' : 'var(--text-1)',
      }}
    >
      {children}
    </button>
  );
}
