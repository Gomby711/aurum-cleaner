import { useState } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import { Search, ChevronLeft, Trash2 } from 'lucide-react';
import PageShell from '../components/PageShell';
import ConfirmModal from '../components/ConfirmModal';
import LocationBar from '../components/LocationBar';
import { formatBytes } from '../lib/format';

const PALETTE = ['#f4e2a6', '#e8c874', '#d4af37', '#c19a2e', '#a9821f', '#8a6a19'];

export default function DiskAnalyzer({ drives, defaultRoot }) {
  const [root, setRoot] = useState(defaultRoot);
  const [history, setHistory] = useState([]);
  const [tree, setTree] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [scanId, setScanId] = useState(null);

  async function chooseFolder() {
    const picked = await window.api.dialog.chooseFolder(root);
    if (picked) {
      setRoot(picked);
      setHistory([]);
    }
  }

  function selectDrive(letter) {
    setRoot(`${letter}\\`);
    setHistory([]);
    setTree(null);
  }

  async function scan(path = root, pushHistory = true) {
    setScanning(true);
    const id = `treemap-${Date.now()}`;
    setScanId(id);
    const unsub = window.api.diskAnalyzer.onProgress((p) => {
      if (p.scanId === id) setProgress(p);
    });
    try {
      const result = await window.api.diskAnalyzer.scan(id, path, 1);
      if (pushHistory && tree && tree.path !== path) {
        setHistory((h) => [...h, tree.path]);
      }
      setTree(result);
      setRoot(path);
    } finally {
      unsub();
      setScanning(false);
      setProgress(null);
    }
  }

  async function cancelScan() {
    if (scanId) await window.api.scan.cancel(scanId);
  }

  function goBack() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    scan(prev, false);
  }

  function drillInto(node) {
    if (node.type !== 'folder' || !node.children || node.children.length === 0) return;
    scan(node.path);
  }

  const data = tree?.children?.filter((c) => c.size > 0) || [];

  return (
    <PageShell title="Disk Analyzer" subtitle="A WinDirStat-style map of exactly what's taking up your space.">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {history.length > 0 && (
            <button className="btn" onClick={goBack} disabled={scanning}>
              <ChevronLeft size={14} />
            </button>
          )}
          <LocationBar drives={drives} root={root} onSelectDrive={selectDrive} onChooseFolder={chooseFolder} disabled={scanning} />
          <div style={{ flex: 1 }} />
          {scanning ? (
            <button className="btn" onClick={cancelScan}>Cancel</button>
          ) : (
            <button className="btn btn-primary" onClick={() => scan(root)}>
              <Search size={14} /> Analyze
            </button>
          )}
        </div>

        {scanning && (
          <div className="glass-panel" style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--text-2)' }}>
            Analyzing… {progress?.scanned || 0} folders processed
          </div>
        )}

        {!scanning && tree && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16 }}>
            <div className="glass-panel" style={{ flex: 2, padding: 14, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={data}
                  dataKey="size"
                  nameKey="name"
                  stroke="rgba(8,8,11,0.6)"
                  fill="#d4af37"
                  isAnimationActive
                  content={<TreemapCell onDrill={drillInto} />}
                />
              </ResponsiveContainer>
            </div>
            <div className="glass-panel" style={{ flex: 1, padding: 18, minWidth: 220, overflowY: 'auto' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Contents</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 14 }}>Total {formatBytes(tree.size)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...data].sort((a, b) => b.size - a.size).map((c, i) => (
                  <div
                    key={c.path}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: c.type === 'folder' ? 'pointer' : 'default' }}
                    onClick={() => drillInto(c)}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-1)' }}>{c.name}</span>
                    <span style={{ color: 'var(--text-2)', flexShrink: 0 }}>{formatBytes(c.size)}</span>
                    {c.type === 'file' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmTarget(c);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', display: 'flex', flexShrink: 0 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!scanning && !tree && (
          <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 13 }}>
            Pick a folder and click Analyze to see a visual size breakdown.
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmTarget}
        title="Move to Recycle Bin?"
        description={confirmTarget ? `"${confirmTarget.name}" (${formatBytes(confirmTarget.size)}) will be moved to the Recycle Bin.` : ''}
        confirmLabel="Move to Recycle Bin"
        danger
        onConfirm={async () => {
          await window.api.files.trash([confirmTarget.path]);
          setConfirmTarget(null);
          scan(root, false);
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </PageShell>
  );
}

function TreemapCell(props) {
  const { x, y, width, height, index, name, size, payload, onDrill } = props;
  if (width < 2 || height < 2) return null;
  const color = PALETTE[index % PALETTE.length];
  const showLabel = width > 55 && height > 28;
  return (
    <g onClick={() => payload && onDrill(payload)} style={{ cursor: payload?.type === 'folder' ? 'pointer' : 'default' }}>
      <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.85} stroke="rgba(8,8,11,0.7)" strokeWidth={1.5} rx={3} />
      {showLabel && (
        <text x={x + 8} y={y + 18} fontSize={11.5} fontWeight={700} fill="#16130a">
          {name}
        </text>
      )}
      {showLabel && (
        <text x={x + 8} y={y + 32} fontSize={10} fill="#3a2f10">
          {formatBytes(size)}
        </text>
      )}
    </g>
  );
}
