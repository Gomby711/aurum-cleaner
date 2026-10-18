import { useEffect, useRef, useState } from 'react';
import { Search, Trash2, FileWarning, Cloud } from 'lucide-react';
import PageShell from '../components/PageShell';
import ConfirmModal from '../components/ConfirmModal';
import LocationBar from '../components/LocationBar';
import { formatBytes, formatDate } from '../lib/format';
import { useNotify } from '../lib/notifications';
import { useICloud } from '../lib/icloud';
import RemovedBanner from '../components/RemovedBanner';
import { isMac, moveToTrashLabel, removedMessage } from '../lib/platform';

export default function LargeFiles({ drives, defaultRoot, active }) {
  const [root, setRoot] = useState(defaultRoot);
  const [minSize, setMinSize] = useState(200);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [scanId, setScanId] = useState(null);
  const { opts: icloud } = useICloud();
  const notify = useNotify();
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  async function chooseFolder() {
    const picked = await window.api.dialog.chooseFolder(root);
    if (picked) setRoot(picked);
  }

  async function scan() {
    setScanning(true);
    setResult(null);
    setFiles([]);
    const id = `large-${Date.now()}`;
    setScanId(id);
    const unsub = window.api.largeFiles.onProgress((p) => {
      if (p.scanId === id) setProgress(p);
    });
    try {
      const results = await window.api.largeFiles.scan(id, root, minSize, { icloud });
      setFiles(results);
      setSelected(new Set());
      if (!activeRef.current) notify(`Large Files scan finished — ${results.length} file(s) found.`);
    } finally {
      unsub();
      setScanning(false);
      setProgress(null);
    }
  }

  async function cancelScan() {
    if (scanId) await window.api.scan.cancel(scanId);
  }

  function toggle(path) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const selectedFiles = files.filter((f) => selected.has(f.path));
  const totalSelected = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  const icloudSelected = selectedFiles.filter((f) => f.icloud).length;

  async function deleteSelected() {
    setConfirmOpen(false);
    const r = await window.api.files.trash(selectedFiles.map((f) => f.path), {
      allowICloud: icloudSelected > 0,
      label: 'Large Files',
    });
    setResult(r);
    setFiles((prev) => prev.filter((f) => !selected.has(f.path)));
    setSelected(new Set());
    if (!activeRef.current) notify(`Large Files: ${removedMessage(r, formatBytes).toLowerCase()}.`);
  }

  return (
    <PageShell title="Large Files" subtitle={`Find the biggest space hogs on your drive and send them to the ${isMac ? 'Undo History' : 'Recycle Bin'}.`}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <LocationBar drives={drives} root={root} onSelectDrive={(d) => setRoot(d.root)} onChooseFolder={chooseFolder} disabled={scanning} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Min size (MB)</span>
            <input
              type="number"
              value={minSize}
              min={1}
              onChange={(e) => setMinSize(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 70, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: 6, color: 'var(--text-0)', padding: '6px 8px', fontSize: 12.5 }}
            />
          </div>
          <div style={{ flex: 1 }} />
          {scanning ? (
            <button className="btn" onClick={cancelScan}>Cancel</button>
          ) : (
            <button className="btn btn-primary" onClick={scan}>
              <Search size={14} /> Scan
            </button>
          )}
        </div>

        {scanning && (
          <div className="glass-panel" style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--text-2)' }}>
            Scanning… {progress?.scannedDirs || 0} folders checked, {progress?.found || 0} matches so far
          </div>
        )}

        <RemovedBanner result={result} />

        {selectedFiles.length > 0 && (
          <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>
              {selectedFiles.length} selected — {formatBytes(totalSelected)}
            </span>
            <button className="btn btn-danger" onClick={() => setConfirmOpen(true)}>
              <Trash2 size={14} /> {moveToTrashLabel}
            </button>
          </div>
        )}

        <div className="scroll-region" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.length === 0 && !scanning && (
            <div className="glass-panel" style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
              <FileWarning size={20} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>No scan results yet — pick a folder and hit Scan.</div>
            </div>
          )}
          {files.map((f) => (
            <label key={f.path} className="glass-panel" style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" className="checkbox" checked={selected.has(f.path)} onChange={() => toggle(f.path)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {f.name}
                  {f.icloud && <span className="risk-pill risk-low" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Cloud size={10} /> iCloud</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.path} · modified {formatDate(f.modified)}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, minWidth: 84, textAlign: 'right' }}>{formatBytes(f.size)}</div>
            </label>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={isMac ? 'Remove these files?' : 'Move to Recycle Bin?'}
        description={`${selectedFiles.length} file(s) totaling ${formatBytes(totalSelected)} will be ${isMac ? 'removed. You can undo this from the banner afterwards or from Undo History' : 'moved to the Recycle Bin. You can restore them from there if needed'}.${icloudSelected > 0 ? ` ${icloudSelected} of them are in iCloud.` : ''}`}
        ackLabel={icloudSelected > 0 ? 'I understand iCloud files are also deleted from iCloud.com and my other devices.' : undefined}
        confirmLabel={moveToTrashLabel}
        danger
        onConfirm={deleteSelected}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageShell>
  );
}
