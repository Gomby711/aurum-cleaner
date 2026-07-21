import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import PageShell from '../components/PageShell';
import ConfirmModal from '../components/ConfirmModal';
import { formatBytes, formatDate, daysAgo } from '../lib/format';

export default function ClaudeCleanup() {
  const [threshold, setThreshold] = useState(5);
  const [data, setData] = useState({ projects: [], orphanJobs: [], orphanHistory: [] });
  const [selected, setSelected] = useState(new Set());
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  const allItems = [
    ...data.projects.map((p) => ({ ...p, key: `project:${p.path}` })),
    ...data.orphanJobs.map((p) => ({ ...p, key: `orphan-job:${p.path}` })),
    ...data.orphanHistory.map((p) => ({ ...p, key: `orphan-history:${p.path}` })),
  ];

  async function scan() {
    setScanning(true);
    setResult(null);
    try {
      const d = await window.api.claudeCleanup.scan(threshold);
      setData(d);
      const keys = [
        ...d.projects.map((p) => `project:${p.path}`),
        ...d.orphanJobs.map((p) => `orphan-job:${p.path}`),
        ...d.orphanHistory.map((p) => `orphan-history:${p.path}`),
      ];
      setSelected(new Set(keys));
    } finally {
      setScanning(false);
    }
  }

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const chosen = allItems.filter((i) => selected.has(i.key));
  const totalSize = chosen.reduce((sum, i) => sum + i.size, 0);

  async function runClean() {
    setConfirmOpen(false);
    setCleaning(true);
    const r = await window.api.claudeCleanup.clean(chosen);
    setResult(r);
    setCleaning(false);
    scan();
  }

  return (
    <PageShell
      title="Claude Cleanup"
      subtitle="Purge stale Claude Code project logs, background jobs, and file-history for projects you haven't touched in a while."
      actions={
        <>
          <div style={thresholdWrap}>
            <Clock size={13} color="var(--text-2)" />
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Inactive for</span>
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))}
              style={thresholdInput}
            />
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>days</span>
          </div>
          <button className="btn" onClick={scan} disabled={scanning || cleaning}>
            <RefreshCw size={14} className={scanning ? 'spin' : ''} />
            Rescan
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <div className="glass-panel" style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(212,175,55,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} color="var(--gold-300)" />
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{chosen.length} stale item(s) selected</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{formatBytes(totalSize)}</div>
            </div>
          </div>
          <button className="btn btn-primary" disabled={scanning || cleaning || chosen.length === 0} onClick={() => setConfirmOpen(true)}>
            {cleaning ? 'Cleaning…' : `Clean ${chosen.length} item(s)`}
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
              <span style={{ fontSize: 13 }}>Freed <b>{formatBytes(result.freed)}</b> of disk space.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="scroll-region" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allItems.length === 0 && !scanning && (
            <div className="glass-panel" style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
              No stale Claude Code data found beyond {threshold} days. You're all clean.
            </div>
          )}
          {allItems.map((item) => (
            <label
              key={item.key}
              className="glass-panel"
              style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
            >
              <input type="checkbox" className="checkbox" checked={selected.has(item.key)} onChange={() => toggle(item.key)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <span className="risk-pill risk-safe">{typeLabel(item.type)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>
                  Last active {formatDate(item.lastActive)} ({daysAgo(item.lastActive)}d ago)
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, minWidth: 90, textAlign: 'right' }}>{formatBytes(item.size)}</div>
            </label>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Clean stale Claude data?"
        description={`This will permanently delete ${formatBytes(totalSize)} of chat logs, job data, and file-history for ${chosen.length} stale item(s). Active projects are never touched.`}
        confirmLabel="Clean now"
        onConfirm={runClean}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageShell>
  );
}

function typeLabel(type) {
  if (type === 'project') return 'project';
  if (type === 'orphan-job') return 'orphan job';
  return 'orphan history';
}

const thresholdWrap = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'rgba(255,255,255,0.03)',
};

const thresholdInput = {
  width: 36,
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--text-0)',
  fontSize: 13,
  fontWeight: 700,
  textAlign: 'center',
};
