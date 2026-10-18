import { FolderOpen, HardDrive, Cloud } from 'lucide-react';
import { isMac } from '../lib/platform';

// Finds the drive a path lives on (longest matching drive id wins, so a path under
// /Volumes/Backup is matched to "Backup", not the startup disk "/").
function driveFor(drives, root) {
  const lower = (root || '').toLowerCase();
  return [...(drives || [])]
    .filter((d) => (d.id === '/' ? lower.startsWith('/') : lower.startsWith(d.id.toLowerCase())))
    .sort((a, b) => b.id.length - a.id.length)[0];
}

// Lets the user jump straight to any drive, or browse to any folder via the native
// OS picker. On macOS it also carries the explicit opt-in for scanning iCloud Drive.
export default function LocationBar({ drives, root, onSelectDrive, onChooseFolder, disabled, includeICloud, onToggleICloud }) {
  const current = driveFor(drives, root);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <HardDrive size={13} color="var(--text-2)" />
        <select
          value={current?.id ?? ''}
          onChange={(e) => {
            const picked = (drives || []).find((d) => d.id === e.target.value);
            if (picked) onSelectDrive(picked);
          }}
          disabled={disabled}
          style={{ padding: '9px 10px', fontSize: 12.5, fontWeight: 600 }}
        >
          <option value="" disabled>
            Jump to drive…
          </option>
          {(drives || []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.label ? `(${d.label})` : ''}
            </option>
          ))}
        </select>
      </div>
      <button className="btn" onClick={onChooseFolder} disabled={disabled}>
        <FolderOpen size={14} /> {root}
      </button>
      {isMac && onToggleICloud && (
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-1)', cursor: 'pointer' }}
          title="iCloud Drive is skipped by default. Turn this on to include it — you'll be asked before anything in iCloud is deleted."
        >
          <input type="checkbox" className="checkbox" checked={!!includeICloud} onChange={(e) => onToggleICloud(e.target.checked)} disabled={disabled} />
          <Cloud size={13} color="var(--text-2)" /> Include iCloud Drive
        </label>
      )}
    </div>
  );
}
