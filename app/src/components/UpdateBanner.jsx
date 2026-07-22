import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DownloadCloud, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function UpdateBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const unsub = window.api?.updates?.onStatus((s) => setStatus(s));
    return unsub;
  }, []);

  if (!status || status.state === 'up-to-date' || status.state === 'error') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="glass-panel"
        style={{
          position: 'fixed',
          top: 52,
          right: 24,
          zIndex: 150,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--bg-2)',
        }}
      >
        {status.state === 'downloading' && (
          <>
            <RefreshCw size={16} className="spin" color="var(--gold-300)" />
            <span style={{ fontSize: 12.5 }}>Downloading update v{status.version}…</span>
          </>
        )}
        {status.state === 'ready' && (
          <>
            <CheckCircle2 size={16} color="var(--success)" />
            <span style={{ fontSize: 12.5 }}>Update v{status.version} ready</span>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => window.api.updates.installNow()}>
              <DownloadCloud size={13} /> Restart & install
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
