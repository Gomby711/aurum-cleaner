import { motion } from 'framer-motion';

export default function PageShell({ title, subtitle, actions, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', gap: 22, height: '100%' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 5 }}>{subtitle}</p>
          )}
        </div>
        {actions && <div style={{ display: 'flex', gap: 10 }}>{actions}</div>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </motion.div>
  );
}
