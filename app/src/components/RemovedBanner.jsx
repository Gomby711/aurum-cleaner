import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import UndoButton from './UndoButton';
import { formatBytes } from '../lib/format';
import { isMac, removedMessage } from '../lib/platform';

// Result strip shown after files are removed. On macOS it carries the Undo button.
export default function RemovedBanner({ result, onRestored }) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-panel"
          style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}
        >
          <CheckCircle2 size={17} color="var(--success)" />
          <span style={{ fontSize: 13, flex: 1 }}>
            {removedMessage(result, formatBytes)}
            {result.errors > 0 ? ` — ${result.errors} file(s) skipped.` : '.'}
            {result.blocked?.icloud > 0 && ` ${result.blocked.icloud} iCloud file(s) were left alone.`}
            {result.blocked?.protected > 0 && ` ${result.blocked.protected} protected item(s) were left alone.`}
            {isMac && result.batchId && (
              <span style={{ color: 'var(--text-2)' }}> Kept in Undo History so you can restore it.</span>
            )}
            {isMac && result.sentToTrash > 0 && (
              <span style={{ color: 'var(--text-2)' }}> {result.sentToTrash} item(s) on another disk went to its Trash instead.</span>
            )}
          </span>
          <UndoButton batchId={result.batchId} onRestored={onRestored} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
