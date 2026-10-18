import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';
import PageShell from '../components/PageShell';
import ConfirmModal from '../components/ConfirmModal';
import { formatBytes } from '../lib/format';
import { useNotify } from '../lib/notifications';
import UndoButton from '../components/UndoButton';
import { isMac } from '../lib/platform';
import ICloudToggle from '../components/ICloudToggle';
import { useICloud } from '../lib/icloud';

export default function QuickClean({ active }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);
  const { opts: icloud } = useICloud();
  const notify = useNotify();
  const activeRef = useRef(active);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (active && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      scan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // keepResult: refresh the list after a clean without hiding the result banner (and its Undo button).
  // Ticking/unticking iCloud adds or removes its Quick Clean item, so refresh the list.
  useEffect(() => {
    if (hasLoadedRef.current) scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icloud.drive]);

  async function scan({ keepResult = false } = {}) {
    setScanning(true);
    if (!keepResult) setResult(null);
    try {
      const data = await window.api.quickClean.scan({ icloud: { drive: icloud.drive } });
      setCategories(data);
      // Never pre-tick anything permanent (e.g. emptying the Trash).
      setSelected(new Set(data.filter((c) => c.exists && c.size > 0 && !c.permanent).map((c) => c.id)));
      if (!activeRef.current) notify('Quick Clean scan finished.');
    } finally {
      setScanning(false);
    }
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCategories = categories.filter((c) => selected.has(c.id));
  const totalSelected = selectedCategories.reduce((sum, c) => sum + c.size, 0);

  async function runClean() {
    setConfirmOpen(false);
    setCleaning(true);
    const r = await window.api.quickClean.cleanMany(selectedCategories.map((c) => c.id), { icloud: { drive: icloud.drive } });
    setResult({ freed: r.freed || 0, errors: r.errors || 0, batchId: r.batchId });
    setCleaning(false);
    if (!activeRef.current) notify(`Quick Clean ${isMac ? 'removed' : 'freed'} ${formatBytes(r.freed || 0)}.`);
    scan({ keepResult: true });
  }

  return (
    <PageShell
      title="Quick Clean"
      subtitle={isMac ? "Safe, one-click cleanup of caches, logs, old updates and developer leftovers." : "Safe, one-click cleanup of temp files, caches, and the recycle bin."}
      actions={
        <>
          <ICloudToggle
            aspects={['drive']}
            disabled={scanning || cleaning}
            title="Adds an option to free up space used by old iCloud Drive downloads. Nothing is deleted from iCloud."
          />
          <button className="btn" onClick={scan} disabled={scanning || cleaning}>
            <RefreshCw size={14} className={scanning ? 'spin' : ''} />
            Rescan
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <div
          className="glass-panel"
          style={{
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: 'rgba(212,175,55,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} color="var(--gold-300)" />
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Selected for cleanup</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{formatBytes(totalSelected)}</div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={scanning || cleaning || selectedCategories.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            {cleaning ? 'Cleaning…' : `Clean ${selectedCategories.length} item(s)`}
          </button>
        </div>

        {isMac && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text-2)', padding: '0 4px' }}>
            <ShieldCheck size={15} color="var(--success)" />
            Messages, Mail, Calendar, Photos, Notes and everything in iCloud are never touched by Quick Clean.
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
              <span style={{ fontSize: 13, flex: 1 }}>
                {isMac ? 'Removed' : 'Freed'} <b>{formatBytes(result.freed)}</b>
                {result.errors > 0 ? ` — ${result.errors} item(s) were skipped (in use).` : '.'}
                {isMac && result.batchId && (
                  <span style={{ color: 'var(--text-2)' }}> Kept in Undo History — free the space for good from there when you're happy.</span>
                )}
              </span>
              <UndoButton batchId={result.batchId} onRestored={() => scan({ keepResult: true })} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="scroll-region" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categories.map((cat) => (
            <label
              key={cat.id}
              className="glass-panel"
              style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: cat.exists ? 1 : 0.45,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                className="checkbox"
                checked={selected.has(cat.id)}
                disabled={!cat.exists}
                onChange={() => toggle(cat.id)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{cat.label}</span>
                  <span className={`risk-pill risk-${cat.risk === 'permanent' ? 'low' : cat.risk}`}>
                    {cat.risk === 'permanent' ? 'permanent' : cat.risk}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{cat.description}</div>
                {cat.needsFullDiskAccess && (
                  <div style={{ fontSize: 11.5, color: 'var(--gold-300)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Lock size={11} /> macOS is blocking access. Grant Full Disk Access in Settings to include this.
                  </div>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, minWidth: 90, textAlign: 'right' }}>
                {scanning ? '…' : formatBytes(cat.size)}
              </div>
            </label>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Clean selected items?"
        description={
          isMac
            ? `This will remove ${formatBytes(totalSelected)} of cache and junk data across ${selectedCategories.length} categories. You'll get an Undo button right after.${selectedCategories.some((c) => c.permanent) ? ' Emptying the Trash is permanent and cannot be undone.' : ''}`
            : `This will permanently remove ${formatBytes(totalSelected)} of temporary/cache data across ${selectedCategories.length} categories. This action cannot be undone (the Recycle Bin category empties it permanently).`
        }
        confirmLabel="Clean now"
        onConfirm={runClean}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageShell>
  );
}
