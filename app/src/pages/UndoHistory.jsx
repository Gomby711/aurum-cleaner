import { useEffect, useState } from 'react';
import { ChevronDown, Undo2, Trash2, History } from 'lucide-react';
import PageShell from '../components/PageShell';
import ConfirmModal from '../components/ConfirmModal';
import { formatBytes } from '../lib/format';
import { useNotify } from '../lib/notifications';

function timeAgo(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function UndoHistory({ active }) {
  const [batches, setBatches] = useState([]);
  const [retention, setRetention] = useState(7);
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'one' | 'all', batch? }
  const notify = useNotify();

  async function refresh() {
    setBatches(await window.api.undo.list());
  }

  useEffect(() => {
    if (!active) return;
    refresh();
    window.api.settings.get().then((s) => setRetention(s.undoRetentionDays));
  }, [active]);

  async function toggle(id) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!details[id]) {
      const d = await window.api.undo.details(id);
      setDetails((prev) => ({ ...prev, [id]: d }));
    }
  }

  async function restore(batch) {
    setBusy(batch.id);
    const r = await window.api.undo.restore(batch.id);
    setBusy(null);
    notify(
      r.failed > 0
        ? `Restored ${r.restored} item(s); ${r.failed} couldn't be put back.`
        : `Restored ${r.restored} item(s) to where they were.`
    );
    refresh();
  }

  async function runPurge() {
    const c = confirm;
    setConfirm(null);
    const r = c.kind === 'all' ? await window.api.undo.purgeAll() : await window.api.undo.purge(c.batch.id);
    notify(`Freed ${formatBytes(r.freed)} for good.`);
    refresh();
  }

  const total = batches.reduce((sum, b) => sum + b.size, 0);

  return (
    <PageShell
      title="Undo History"
      subtitle="Everything Aurum Cleaner removed is kept here first, so a bad call is never final."
      actions={
        <button className="btn btn-danger" disabled={batches.length === 0} onClick={() => setConfirm({ kind: 'all' })}>
          <Trash2 size={14} /> Free {formatBytes(total)} now
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <div className="glass-panel" style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.55 }}>
          Space from removed items isn't returned to your Mac until they leave this list.{' '}
          {retention > 0
            ? `They're deleted for good automatically after ${retention} day${retention === 1 ? '' : 's'} (change this in Settings), or whenever you press “Free space now”.`
            : 'Your setting is to free space immediately, so new removals will not appear here.'}
        </div>

        <div className="scroll-region" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {batches.length === 0 && (
            <div className="glass-panel" style={{ padding: 28, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
              <History size={20} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>Nothing to undo. Items you remove will show up here.</div>
            </div>
          )}
          {batches.map((b) => (
            <div key={b.id} className="glass-panel" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => toggle(b.id)}
                  style={{ background: 'none', border: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 10, flex: 1, padding: 0, textAlign: 'left' }}
                >
                  <ChevronDown size={15} style={{ transform: expanded === b.id ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                      {b.count} item(s) · {formatBytes(b.size)} · {timeAgo(b.createdAt)}
                    </div>
                  </div>
                </button>
                <button className="btn" onClick={() => restore(b)} disabled={busy === b.id}>
                  <Undo2 size={13} /> {busy === b.id ? 'Restoring…' : 'Restore'}
                </button>
                <button className="btn" onClick={() => setConfirm({ kind: 'one', batch: b })} title="Delete for good and free the space">
                  <Trash2 size={13} />
                </button>
              </div>
              {expanded === b.id && (
                <div style={{ marginTop: 12, paddingLeft: 25, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                  {(details[b.id]?.entries || []).slice(0, 200).map((e) => (
                    <div key={e.original} style={{ display: 'flex', gap: 10, fontSize: 11.5, color: 'var(--text-2)' }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.original}</span>
                      <span style={{ flexShrink: 0 }}>{formatBytes(e.size)}</span>
                    </div>
                  ))}
                  {(details[b.id]?.entries?.length || 0) > 200 && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>…and {details[b.id].entries.length - 200} more</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={!!confirm}
        title="Delete for good?"
        description={
          confirm?.kind === 'all'
            ? `This permanently deletes everything in Undo History (${formatBytes(total)}). You won't be able to restore any of it.`
            : confirm
              ? `This permanently deletes “${confirm.batch.label}” (${formatBytes(confirm.batch.size)}). You won't be able to restore it.`
              : ''
        }
        confirmLabel="Delete for good"
        danger
        onConfirm={runPurge}
        onCancel={() => setConfirm(null)}
      />
    </PageShell>
  );
}
