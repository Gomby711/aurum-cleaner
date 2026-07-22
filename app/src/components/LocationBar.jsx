import { FolderOpen, HardDrive } from 'lucide-react';

// Lets the user jump straight to any drive's root, or browse to any
// folder on any drive via the native OS picker (which is not limited to
// the current drive).
export default function LocationBar({ drives, root, onSelectDrive, onChooseFolder, disabled }) {
  const currentLetter = root?.slice(0, 2)?.toUpperCase();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <HardDrive size={13} color="var(--text-2)" />
        <select
          value={drives?.some((d) => d.letter === currentLetter) ? currentLetter : ''}
          onChange={(e) => e.target.value && onSelectDrive(e.target.value)}
          disabled={disabled}
          style={{ padding: '9px 10px', fontSize: 12.5, fontWeight: 600 }}
        >
          <option value="" disabled>
            Jump to drive…
          </option>
          {(drives || []).map((d) => (
            <option key={d.letter} value={d.letter}>
              {d.letter} {d.label ? `(${d.label})` : ''}
            </option>
          ))}
        </select>
      </div>
      <button className="btn" onClick={onChooseFolder} disabled={disabled}>
        <FolderOpen size={14} /> {root}
      </button>
    </div>
  );
}
