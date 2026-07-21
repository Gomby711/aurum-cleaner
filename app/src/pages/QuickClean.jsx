import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import PageShell from '../components/PageShell';
import ConfirmModal from '../components/ConfirmModal';
import { formatBytes } from '../lib/format';

export default function QuickClean() {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    scan();
  }, []);

  async function scan() {
    setScanning(true);
    setResult(null);
    try {
      const data = await window.api.quickClean.scan();
      setCategories(data);
      setSelected(new Set(data.filter((c) => c.exists && c.size > 0).map((c) => c.id)));
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
    let freed = 0;
    let errors = 0;
    for (const cat of selectedCategories) {
      const r = await window.api.quickClean.clean(cat.id);
      freed += r.freed || 0;
      errors += r.errors || 0;
    }
    setResult({ freed, errors });
    setCleaning(false);
    scan();
  }

  return (
    <PageShell
      title="Quick Clean"
      subtitle="Safe, one-click cleanup of temp files, caches, and the recycle bin."
      actions={
        <button className="btn" onClick={scan} disabled={scanning || cleaning}>
          <RefreshCw size={14} className={scanning ? 'spin' : ''} />
          Rescan
        </button>
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
                Freed <b>{formatBytes(result.freed)}</b>
                {result.errors > 0 ? ` — ${result.errors} item(s) were skipped (in use).` : '.'}
              </span>
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
                  <span className={`risk-pill risk-${cat.risk}`}>{cat.risk}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{cat.description}</div>
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
        description={`This will permanently remove ${formatBytes(totalSelected)} of temporary/cache data across ${selectedCategories.length} categories. This action cannot be undone (the Recycle Bin category empties it permanently).`}
        confirmLabel="Clean now"
        onConfirm={runClean}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageShell>
  );
}
