import { Cloud } from 'lucide-react';
import { useICloud } from '../lib/icloud';
import { isMac, platform } from '../lib/platform';

const ASPECTS = [
  { key: 'drive', label: 'iCloud Drive', hint: 'Files in iCloud Drive' },
  { key: 'apps', label: 'App data', hint: "Other apps' iCloud folders (Pages, Numbers, Obsidian…). Delete with care — apps may need these." },
  { key: 'synced', label: 'Desktop & Documents', hint: 'Your Desktop and Documents folders, which are synced with iCloud on this Mac' },
];

// The iCloud checkboxes, shared by every tool. `aspects` limits which ones a tool offers.
export default function ICloudToggle({ aspects = ['drive', 'apps', 'synced'], disabled, title }) {
  const { opts, setAspect } = useICloud();
  if (!isMac) return null;

  const icloud = platform.icloud;
  const synced = icloud?.syncedFolders?.length > 0;
  const shown = ASPECTS.filter((a) => aspects.includes(a.key) && (a.key !== 'synced' || synced));
  if (shown.length === 0 || (!icloud?.driveExists && !synced)) return null;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-1)' }}
      title={title || 'iCloud is skipped unless you tick it. Anything in iCloud needs an extra confirmation before it is deleted.'}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-2)' }}>
        <Cloud size={13} /> Include iCloud:
      </span>
      {shown.map((a) => (
        <label key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: disabled ? 'default' : 'pointer' }} title={a.hint}>
          <input
            type="checkbox"
            className="checkbox"
            checked={!!opts[a.key]}
            disabled={disabled}
            onChange={(e) => setAspect(a.key, e.target.checked)}
          />
          {a.label}
        </label>
      ))}
    </div>
  );
}
