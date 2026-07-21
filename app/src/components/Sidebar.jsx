import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Sparkles,
  PieChart,
  FileWarning,
  Copy,
  Bot,
  Settings as SettingsIcon,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'quick-clean', label: 'Quick Clean', icon: Sparkles },
  { id: 'disk-analyzer', label: 'Disk Analyzer', icon: PieChart },
  { id: 'large-files', label: 'Large Files', icon: FileWarning },
  { id: 'duplicates', label: 'Duplicates', icon: Copy },
  { id: 'claude-cleanup', label: 'Claude Cleanup', icon: Bot },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ active, onChange }) {
  return (
    <div
      style={{
        width: 216,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 12px',
        gap: 4,
        borderRight: '1px solid var(--border-subtle)',
        background: 'rgba(255,255,255,0.015)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: isActive ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
              color: isActive ? 'var(--gold-300)' : 'var(--text-1)',
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 500,
              textAlign: 'left',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 4,
                  bottom: 4,
                  width: 3,
                  borderRadius: 3,
                  background: 'var(--gold-gradient)',
                }}
              />
            )}
            <Icon size={16.5} strokeWidth={2} />
            {item.label}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <div
        style={{
          margin: '8px 6px 4px',
          padding: '12px 12px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.02))',
          border: '1px solid rgba(212,175,55,0.18)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-300)', letterSpacing: 0.4 }}>
          FREE FOREVER
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 3, lineHeight: 1.4 }}>
          Built for the community. No ads, no upsells.
        </div>
      </div>
    </div>
  );
}
