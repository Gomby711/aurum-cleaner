import { useEffect, useState } from 'react';
import { Gem, ShieldCheck, Heart, RefreshCw, History, Lock } from 'lucide-react';
import PageShell from '../components/PageShell';
import { isMac } from '../lib/platform';

const STATUS_LABEL = {
  'up-to-date': "You're up to date.",
  downloading: (s) => `Downloading update v${s.version}…`,
  ready: (s) => `Update v${s.version} downloaded — restart to install.`,
  manual: (s) => `Version ${s.version} is available.`,
  error: (s) => s.message || 'Could not check for updates.',
};

const RETENTION_OPTIONS = [
  { value: 0, label: 'Free space immediately (no undo)' },
  { value: 1, label: 'Keep for 1 day' },
  { value: 7, label: 'Keep for 7 days' },
  { value: 30, label: 'Keep for 30 days' },
];

export default function Settings() {
  const [version, setVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [retention, setRetention] = useState(7);
  const [fda, setFda] = useState(null);

  useEffect(() => {
    window.api?.app.getVersion().then(setVersion);
  }, []);

  useEffect(() => {
    if (!isMac) return;
    window.api.settings.get().then((st) => setRetention(st.undoRetentionDays));
    window.api.system.fullDiskAccess().then(setFda);
  }, []);

  const changeRetention = async (days) => {
    setRetention(days);
    await window.api.settings.set({ undoRetentionDays: days });
  };

  useEffect(() => {
    const unsub = window.api?.updates?.onStatus((s) => {
      setUpdateStatus(s);
      setChecking(false);
    });
    return unsub;
  }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    setUpdateStatus(null);
    const result = await window.api?.updates?.checkNow();
    if (!result?.checking) {
      // dev mode, or no update feed configured — no status event will follow
      setChecking(false);
      setUpdateStatus({ state: 'error', message: 'Updates are unavailable in this build.' });
    }
  };

  return (
    <PageShell title="Settings" subtitle="About Aurum Cleaner.">
      <div className="scroll-region" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
        <div className="glass-panel" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(212,175,55,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Gem size={20} color="var(--gold-300)" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Aurum Cleaner {version && <span style={{ color: 'var(--text-2)', fontWeight: 500, fontSize: 12.5 }}>v{version}</span>}</div>
            <p style={{ fontSize: 13, color: 'var(--text-1)', marginTop: 8, lineHeight: 1.6 }}>
              {isMac
                ? 'A free, no-nonsense storage cleanup tool for Mac — Quick Clean for caches, logs and old updates, a visual Disk Analyzer, large-file and duplicate finders, plus a dedicated Claude Code project cleaner. Everything it removes can be undone.'
                : 'A free, no-nonsense storage cleanup tool for Windows — Quick Clean for temp/cache junk, a WinDirStat-style Disk Analyzer, large-file and duplicate finders, plus a dedicated Claude Code project cleaner.'}
            </p>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn"
                style={{ padding: '6px 12px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={checkForUpdates}
                disabled={checking}
              >
                <RefreshCw size={13} className={checking ? 'spin' : undefined} />
                {checking ? 'Checking…' : 'Check for updates'}
              </button>
              {updateStatus && !checking && (
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                  {typeof STATUS_LABEL[updateStatus.state] === 'function'
                    ? STATUS_LABEL[updateStatus.state](updateStatus)
                    : STATUS_LABEL[updateStatus.state] || null}
                </span>
              )}
              {updateStatus?.state === 'manual' && (
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => window.api.updates.openReleases()}>
                  Download
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(74,217,145,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={20} color="var(--success)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Safety first</div>
            <p style={{ fontSize: 13, color: 'var(--text-1)', marginTop: 8, lineHeight: 1.6 }}>
              {isMac
                ? "Nothing is deleted straight away: removed items wait in Undo History so you can restore them. Quick Clean only touches well-known cache, log and developer-leftover locations — never Messages, Mail, Calendar, Notes, Photos or Keychain. iCloud is skipped unless you tick it for a scan, and anything in iCloud needs an extra confirmation, because deleting it there removes it from all your devices."
                : 'Large Files and Duplicates always move items to the Recycle Bin — never a permanent delete. Quick Clean only ever touches well-known temp/cache locations, and always asks for confirmation with an exact size preview before removing anything.'}
            </p>
          </div>
        </div>

        {isMac && (
          <div className="glass-panel" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(212,175,55,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <History size={20} color="var(--gold-300)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Undo history</div>
              <p style={{ fontSize: 13, color: 'var(--text-1)', marginTop: 8, lineHeight: 1.6 }}>
                How long removed items stay restorable. Disk space only comes back once they're gone for good.
              </p>
              <select value={retention} onChange={(e) => changeRetention(Number(e.target.value))} style={{ marginTop: 10, padding: '8px 10px', fontSize: 12.5 }}>
                {RETENTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isMac && (
          <div className="glass-panel" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(212,175,55,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Lock size={20} color="var(--gold-300)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Full Disk Access{' '}
                {fda?.supported && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: fda.granted ? 'var(--success)' : 'var(--gold-300)' }}>
                    {fda.granted ? '· Granted' : '· Not granted'}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-1)', marginTop: 8, lineHeight: 1.6 }}>
                Optional. macOS hides a few places (Safari's cache, the Trash) from apps until you allow it. Aurum Cleaner works without it — those items just show as unavailable.
              </p>
              {!fda?.granted && (
                <button className="btn" style={{ marginTop: 10, padding: '6px 12px', fontSize: 12.5 }} onClick={() => window.api.system.openFullDiskAccess()}>
                  Open Privacy Settings
                </button>
              )}
            </div>
          </div>
        )}

        <div className="glass-panel" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(212,175,55,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Heart size={20} color="var(--gold-300)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Free, forever</div>
            <p style={{ fontSize: 13, color: 'var(--text-1)', marginTop: 8, lineHeight: 1.6 }}>
              No ads, no telemetry, no premium tier. Built to give back a bit of disk space to the
              people who need it.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
