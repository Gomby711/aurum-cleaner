import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

// `ackLabel`, when set, adds a checkbox that must be ticked before Confirm is enabled —
// used for the extra "yes, delete from iCloud" acknowledgement.
export default function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', danger, ackLabel, onConfirm, onCancel }) {
  const [acked, setAcked] = useState(false);
  useEffect(() => {
    if (!open) setAcked(false);
  }, [open]);
  const blocked = !!ackLabel && !acked;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="glass-panel"
            style={{ width: 420, padding: 24, background: 'var(--bg-2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: danger ? 'rgba(239,90,111,0.15)' : 'rgba(212,175,55,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={17} color={danger ? 'var(--danger)' : 'var(--gold-300)'} />
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-1)', marginTop: 6, lineHeight: 1.5 }}>
                  {description}
                </div>
              </div>
            </div>
            {ackLabel && (
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.45, cursor: 'pointer' }}>
                <input type="checkbox" className="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} style={{ marginTop: 2 }} />
                <span>{ackLabel}</span>
              </label>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button className="btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={onConfirm}
                disabled={blocked}
                style={blocked ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
