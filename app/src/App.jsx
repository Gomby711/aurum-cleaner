import { useEffect, useState } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import WhatsNewModal from './components/WhatsNewModal';
import UpdateBanner from './components/UpdateBanner';
import { NotificationProvider } from './lib/notifications';
import { isMac, platform } from './lib/platform';
import Dashboard from './pages/Dashboard';
import QuickClean from './pages/QuickClean';
import DiskAnalyzer from './pages/DiskAnalyzer';
import LargeFiles from './pages/LargeFiles';
import Duplicates from './pages/Duplicates';
import ClaudeCleanup from './pages/ClaudeCleanup';
import UndoHistory from './pages/UndoHistory';
import Settings from './pages/Settings';

function PageSlot({ visible, children }) {
  return <div style={{ display: visible ? 'block' : 'none', height: '100%' }}>{children}</div>;
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [drives, setDrives] = useState([]);
  const [activeDrive, setActiveDrive] = useState(null);
  const [drivesLoaded, setDrivesLoaded] = useState(false);

  useEffect(() => {
    if (!window.api) {
      setDrivesLoaded(true);
      return;
    }
    window.api.drives
      .list()
      .then((list) => {
        setDrives(list);
        if (list.length) setActiveDrive(list[0].id);
      })
      .finally(() => setDrivesLoaded(true));
  }, []);

  const drive = drives.find((d) => d.id === activeDrive);
  // Fall back to sensible defaults if the drive list couldn't be read.
  const fallbackRoot = isMac ? platform.home : 'C:\\';
  const fallbackUserRoot = isMac ? platform.home : 'C:\\Users';
  const analyzerRoot = drive?.root ?? fallbackRoot;
  const defaultRoot = drive?.userRoot ?? fallbackUserRoot;

  return (
    <NotificationProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <TitleBar />
        <WhatsNewModal />
        <UpdateBanner />
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <Sidebar active={page} onChange={setPage} />
          <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflow: 'hidden' }}>
            {!drivesLoaded ? null : (<>
            {/* Every tool page stays mounted so an in-progress scan/delete keeps running
                and its state is preserved when you switch away and come back. */}
            <PageSlot visible={page === 'dashboard'}>
              <Dashboard drives={drives} activeDrive={activeDrive} onSelectDrive={setActiveDrive} onNavigate={setPage} />
            </PageSlot>
            <PageSlot visible={page === 'quick-clean'}>
              <QuickClean active={page === 'quick-clean'} />
            </PageSlot>
            <PageSlot visible={page === 'disk-analyzer'}>
              <DiskAnalyzer drives={drives} defaultRoot={analyzerRoot} active={page === 'disk-analyzer'} />
            </PageSlot>
            <PageSlot visible={page === 'large-files'}>
              <LargeFiles drives={drives} defaultRoot={defaultRoot} active={page === 'large-files'} />
            </PageSlot>
            <PageSlot visible={page === 'duplicates'}>
              <Duplicates drives={drives} defaultRoot={defaultRoot} active={page === 'duplicates'} />
            </PageSlot>
            <PageSlot visible={page === 'claude-cleanup'}>
              <ClaudeCleanup active={page === 'claude-cleanup'} />
            </PageSlot>
            {platform.supportsUndo && (
              <PageSlot visible={page === 'undo'}>
                <UndoHistory active={page === 'undo'} />
              </PageSlot>
            )}
            <PageSlot visible={page === 'settings'}>
              <Settings />
            </PageSlot>
            </>)}
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
}
