import { motion } from 'framer-motion';

export default function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <motion.div
      className="glass-panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && (
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: accent ? 'rgba(212,175,55,0.14)' : 'rgba(255,255,255,0.06)',
              color: accent ? 'var(--gold-300)' : 'var(--text-1)',
            }}
          >
            <Icon size={15} />
          </div>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-0)', letterSpacing: -0.3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{sub}</div>}
    </motion.div>
  );
}
