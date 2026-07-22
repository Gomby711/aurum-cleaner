import { Minus, Square, X } from 'lucide-react';
import BrandMark from './BrandMark';

export default function TitleBar() {
  const api = window.api;

  return (
    <div
      style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        WebkitAppRegion: 'drag',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14 }}>
        <BrandMark size={17} />
        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, color: 'var(--text-1)' }}>
          AURUM <span className="gold-text">CLEANER</span>
        </span>
      </div>
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <TitleBtn onClick={() => api?.window.minimize()}>
          <Minus size={14} />
        </TitleBtn>
        <TitleBtn onClick={() => api?.window.maximize()}>
          <Square size={11} />
        </TitleBtn>
        <TitleBtn onClick={() => api?.window.close()} danger>
          <X size={14} />
        </TitleBtn>
      </div>
    </div>
  );
}

function TitleBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 46,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: 'var(--text-1)',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? '#ef5a6f' : 'rgba(255,255,255,0.06)';
        e.currentTarget.style.color = danger ? '#1a0a0d' : 'var(--text-0)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--text-1)';
      }}
    >
      {children}
    </button>
  );
}
