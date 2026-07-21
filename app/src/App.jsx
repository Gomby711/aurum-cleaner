import { useEffect, useState } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import QuickClean from './pages/QuickClean';
import DiskAnalyzer from './pages/DiskAnalyzer';
import LargeFiles from './pages/LargeFiles';
import Duplicates from './pages/Duplicates';
import ClaudeCleanup from './pages/ClaudeCleanup';
import Settings from './pages/Settings';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [drives, setDrives] = useState([]);
  const [activeDrive, setActiveDrive] = useState('C:');

  useEffect(() => {
    window.api?.drives.list().then((list) => {
      setDrives(list);
      if (list.length && !list.some((d) => d.letter === activeDrive)) {
        setActiveDrive(list[0].letter);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultRoot = `${activeDrive}\\Users`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TitleBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar active={page} onChange={setPage} />
        <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflow: 'hidden' }}>
          {page === 'dashboard' && (
            <Dashboard drives={drives} activeDrive={activeDrive} onSelectDrive={setActiveDrive} onNavigate={setPage} />
          )}
          {page === 'quick-clean' && <QuickClean />}
          {page === 'disk-analyzer' && <DiskAnalyzer defaultRoot={`${activeDrive}\\`} />}
          {page === 'large-files' && <LargeFiles defaultRoot={defaultRoot} />}
          {page === 'duplicates' && <Duplicates defaultRoot={defaultRoot} />}
          {page === 'claude-cleanup' && <ClaudeCleanup />}
          {page === 'settings' && <Settings />}
        </div>
      </div>
    </div>
  );
}
