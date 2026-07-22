import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function WhatsNewModal() {
  const [data, setData] = useState(null);

  useEffect(() => {
    window.api?.updates?.getWhatsNew().then((result) => {
      if (result?.entries?.length) setData(result);
    });
  }, []);

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="glass-panel"
            style={{ width: 460, maxHeight: '70vh', padding: 28, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={19} color="var(--gold-300)" />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  What's new in <span className="gold-text">v{data.currentVersion}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Aurum Cleaner just updated</div>
              </div>
            </div>

            <div className="scroll-region" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {data.entries.map((entry) => (
                <div key={entry.version}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold-300)', marginBottom: 8 }}>
                    v{entry.version} {entry.date ? `· ${entry.date}` : ''}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {entry.changes.map((c, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => setData(null)}>
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
