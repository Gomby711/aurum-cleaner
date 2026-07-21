import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Search, Trash2, Copy, CheckCircle2, ChevronDown } from 'lucide-react';
import PageShell from '../components/PageShell';
import ConfirmModal from '../components/ConfirmModal';
import { formatBytes } from '../lib/format';

export default function Duplicates({ defaultRoot }) {
  const [root, setRoot] = useState(defaultRoot);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
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
    setGroups([]);
    const id = `dup-${Date.now()}`;
    setScanId(id);
    const unsub = window.api.duplicates.onProgress((p) => {
      if (p.scanId === id) setProgress(p);
    });
    try {
      const results = await window.api.duplicates.scan(id, root, 1);
      setGroups(results);
      // auto-select all but the first (oldest kept) file in each group
      const auto = new Set();
      results.forEach((g) => g.files.slice(1).forEach((f) => auto.add(f)));
      setSelected(auto);
      setExpanded(new Set(results.slice(0, 5).map((g) => g.hash)));
    } finally {
      unsub();
      setScanning(false);
      setProgress(null);
    }
  }

  async function cancelScan() {
    if (scanId) await window.api.scan.cancel(scanId);
  }

  function toggleFile(path) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleExpand(hash) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }

  const wastedTotal = groups.reduce((sum, g) => sum + g.size * (g.files.length - 1), 0);
  const selectedPaths = [...selected];
  const selectedSize = groups.reduce((sum, g) => sum + g.files.filter((f) => selected.has(f)).length * g.size, 0);

  async function deleteSelected() {
    setConfirmOpen(false);
    const r = await window.api.files.trash(selectedPaths);
    setResult(r);
    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, files: g.files.filter((f) => !selected.has(f)) }))
        .filter((g) => g.files.length > 1)
    );
    setSelected(new Set());
  }

  return (
    <PageShell title="Duplicate Files" subtitle="Find identical files wasting space and keep just one copy of each.">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={chooseFolder}>
            <FolderOpen size={14} /> {root}
          </button>
          <div style={{ flex: 1 }} />
          {scanning ? (
            <button className="btn" onClick={cancelScan}>Cancel</button>
          ) : (
            <button className="btn btn-primary" onClick={scan}>
              <Search size={14} /> Scan for duplicates
            </button>
          )}
        </div>

        {scanning && (
          <div className="glass-panel" style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--text-2)' }}>
            Hashing candidates… {progress?.processed || 0}/{progress?.total || 0}
          </div>
        )}

        {!scanning && groups.length > 0 && (
          <div className="glass-panel" style={{ padding: '12px 18px', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span>{groups.length} duplicate group(s) found — <b>{formatBytes(wastedTotal)}</b> reclaimable</span>
            {selectedPaths.length > 0 && (
              <button className="btn btn-danger" onClick={() => setConfirmOpen(true)}>
                <Trash2 size={14} /> Remove {selectedPaths.length} ({formatBytes(selectedSize)})
              </button>
            )}
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
              <span style={{ fontSize: 13 }}>Sent <b>{formatBytes(result.freed)}</b> to the Recycle Bin.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="scroll-region" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.length === 0 && !scanning && (
            <div className="glass-panel" style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
              <Copy size={20} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>No scan results yet — pick a folder and scan for duplicates.</div>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.hash} className="glass-panel" style={{ padding: '12px 16px' }}>
              <button
                onClick={() => toggleExpand(g.hash)}
                style={{ background: 'none', border: 'none', color: 'inherit', width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}
              >
                <ChevronDown size={15} style={{ transform: expanded.has(g.hash) ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>
                  {g.files.length} copies · {formatBytes(g.size)} each
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{formatBytes(g.size * (g.files.length - 1))} wasted</span>
              </button>
              {expanded.has(g.hash) && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 24 }}>
                  {g.files.map((f, idx) => (
                    <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" className="checkbox" checked={selected.has(f)} onChange={() => toggleFile(f)} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: idx === 0 ? 'var(--text-0)' : 'var(--text-1)' }}>
                        {f}
                      </span>
                      {idx === 0 && <span className="risk-pill risk-safe" style={{ flexShrink: 0 }}>keep suggested</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Move duplicates to Recycle Bin?"
        description={`${selectedPaths.length} duplicate file(s) totaling ${formatBytes(selectedSize)} will be moved to the Recycle Bin.`}
        confirmLabel="Move to Recycle Bin"
        danger
        onConfirm={deleteSelected}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageShell>
  );
}
