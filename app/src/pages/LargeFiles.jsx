import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Search, Trash2, FileWarning, CheckCircle2 } from 'lucide-react';
import PageShell from '../components/PageShell';
import ConfirmModal from '../components/ConfirmModal';
import { formatBytes, formatDate } from '../lib/format';

export default function LargeFiles({ defaultRoot }) {
  const [root, setRoot] = useState(defaultRoot);
  const [minSize, setMinSize] = useState(200);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [scanId, setScanId] = useState(null);

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
      const results = await window.api.largeFiles.scan(id, root, minSize);
      setFiles(results);
      setSelected(new Set());
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

  async function deleteSelected() {
    setConfirmOpen(false);
    const r = await window.api.files.trash(selectedFiles.map((f) => f.path));
    setResult(r);
    setFiles((prev) => prev.filter((f) => !selected.has(f.path)));
    setSelected(new Set());
  }

  return (
    <PageShell title="Large Files" subtitle="Find the biggest space hogs on your drive and send them to the Recycle Bin.">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={chooseFolder}>
            <FolderOpen size={14} /> {root}
          </button>
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

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-panel"
              style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}
            >
              <CheckCircle2 size={17} color="var(--success)" />
              <span style={{ fontSize: 13 }}>
                Sent <b>{formatBytes(result.freed)}</b> to the Recycle Bin
                {result.errors > 0 ? ` — ${result.errors} file(s) skipped.` : '.'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {selectedFiles.length > 0 && (
          <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>
              {selectedFiles.length} selected — {formatBytes(totalSelected)}
            </span>
            <button className="btn btn-danger" onClick={() => setConfirmOpen(true)}>
              <Trash2 size={14} /> Move to Recycle Bin
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
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
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
        title="Move to Recycle Bin?"
        description={`${selectedFiles.length} file(s) totaling ${formatBytes(totalSelected)} will be moved to the Recycle Bin. You can restore them from there if needed.`}
        confirmLabel="Move to Recycle Bin"
        danger
        onConfirm={deleteSelected}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageShell>
  );
}
