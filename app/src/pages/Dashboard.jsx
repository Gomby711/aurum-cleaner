import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Sparkles, RefreshCw, Gauge } from 'lucide-react';
import DonutChart from '../components/DonutChart';
import StatCard from '../components/StatCard';
import PageShell from '../components/PageShell';
import { formatBytes } from '../lib/format';

export default function Dashboard({ drives, activeDrive, onSelectDrive, onNavigate }) {
  const [breakdown, setBreakdown] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(0);

  const drive = useMemo(() => drives.find((d) => d.letter === activeDrive), [drives, activeDrive]);

  useEffect(() => {
    if (!drive) return;
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive?.letter]);

  async function runScan() {
    if (!drive) return;
    setScanning(true);
    setBreakdown(null);
    const scanId = `dash-${Date.now()}`;
    const unsub = window.api.diskAnalyzer.onProgress((p) => {
      if (p.scanId === scanId) setScanned(p.scanned || 0);
    });
    try {
      const tree = await window.api.diskAnalyzer.scan(scanId, `${drive.letter}\\`, 1);
      setBreakdown(tree);
    } finally {
      unsub();
      setScanning(false);
    }
  }

  const topFolders = (breakdown?.children || []).slice(0, 6);
  const maxSize = topFolders[0]?.size || 1;

  return (
    <PageShell
      title="Dashboard"
      subtitle="A bird's-eye view of your storage, right where you need it."
      actions={
        <>
          <select
            value={activeDrive}
            onChange={(e) => onSelectDrive(e.target.value)}
            style={selectStyle}
          >
            {drives.map((d) => (
              <option key={d.letter} value={d.letter}>
                {d.letter} {d.label ? `(${d.label})` : ''}
              </option>
            ))}
          </select>
          <button className="btn" onClick={runScan} disabled={scanning}>
            <RefreshCw size={14} className={scanning ? 'spin' : ''} />
            {scanning ? `Scanning… ${scanned}` : 'Rescan'}
          </button>
        </>
      }
    >
      <div className="scroll-region" style={{ height: '100%', paddingRight: 4 }}>
        <div style={{ display: 'flex', gap: 18, marginBottom: 18, flexWrap: 'wrap' }}>
          <div className="glass-panel" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 28, flex: '1 1 320px' }}>
            {drive && <DonutChart used={drive.used} free={drive.free} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <LegendRow color="var(--gold-500)" label="Used space" value={drive ? formatBytes(drive.used) : '—'} />
              <LegendRow color="rgba(255,255,255,0.18)" label="Free space" value={drive ? formatBytes(drive.free) : '—'} />
              <LegendRow color="transparent" label="Total capacity" value={drive ? formatBytes(drive.size) : '—'} />
            </div>
          </div>

          <StatCard icon={HardDrive} label="Drive" value={activeDrive} sub={drive?.label || 'Local Disk'} accent />
          <StatCard
            icon={Gauge}
            label="Used %"
            value={drive ? `${Math.round((drive.used / drive.size) * 100)}%` : '—'}
            sub={drive && drive.used / drive.size > 0.85 ? 'Running low — clean up recommended' : 'Healthy headroom'}
          />
        </div>

        <div style={{ display: 'flex', gap: 18, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div className="glass-panel" style={{ padding: 22, flex: '2 1 420px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 16 }}>Top-level storage breakdown</div>
            {scanning && !breakdown && (
              <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Scanning {drive?.letter}\ … {scanned} folders analyzed</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topFolders.map((f) => (
                <div key={f.path}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-1)' }}>{f.name}</span>
                    <span style={{ color: 'var(--text-2)' }}>{formatBytes(f.size)}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(f.size / maxSize) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{ height: '100%', background: 'var(--gold-gradient)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 22, flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Recommended actions</div>
            <ActionRow
              icon={Sparkles}
              title="Run Quick Clean"
              desc="Temp files, caches & recycle bin"
              onClick={() => onNavigate('quick-clean')}
            />
            <ActionRow
              icon={HardDrive}
              title="Explore Disk Analyzer"
              desc="Visualize what's eating your space"
              onClick={() => onNavigate('disk-analyzer')}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function LegendRow({ color, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color, border: color === 'transparent' ? '1px solid var(--border-subtle)' : 'none' }} />
      <div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn"
      style={{ justifyContent: 'flex-start', padding: '12px 14px', height: 'auto', textAlign: 'left' }}
    >
      <Icon size={17} color="var(--gold-300)" />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{desc}</div>
      </div>
    </button>
  );
}

const selectStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-0)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 600,
};
