import { useEffect, useState } from 'react';
import { Gem, ShieldCheck, Heart, RefreshCw } from 'lucide-react';
import PageShell from '../components/PageShell';

const STATUS_LABEL = {
  'up-to-date': "You're up to date.",
  downloading: (s) => `Downloading update v${s.version}…`,
  ready: (s) => `Update v${s.version} downloaded — restart to install.`,
  error: (s) => s.message || 'Could not check for updates.',
};

export default function Settings() {
  const [version, setVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);

  useEffect(() => {
    window.api?.app.getVersion().then(setVersion);
  }, []);

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
              A free, no-nonsense storage cleanup tool for Windows — Quick Clean for temp/cache junk,
              a WinDirStat-style Disk Analyzer, large-file and duplicate finders, plus a dedicated
              Claude Code project cleaner.
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
              Large Files and Duplicates always move items to the Recycle Bin — never a permanent
              delete. Quick Clean only ever touches well-known temp/cache locations, and always asks
              for confirmation with an exact size preview before removing anything.
            </p>
          </div>
        </div>

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
