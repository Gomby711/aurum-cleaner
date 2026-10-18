import { useState } from 'react';
import { Undo2 } from 'lucide-react';

// "Undo" for a batch just removed on macOS. Moves everything back where it came from.
export default function UndoButton({ batchId, onRestored }) {
  const [state, setState] = useState('idle'); // idle | working | done | partial
  if (!batchId) return null;

  async function undo() {
    setState('working');
    const r = await window.api.undo.restore(batchId);
    setState(r.failed > 0 ? 'partial' : 'done');
    onRestored?.(r);
  }

  if (state === 'done') {
    return <span style={{ fontSize: 12.5, color: 'var(--success)', fontWeight: 600 }}>Restored ✓</span>;
  }
  if (state === 'partial') {
    return <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Some items couldn't be restored — see Undo History.</span>;
  }
  return (
    <button className="btn" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={undo} disabled={state === 'working'}>
      <Undo2 size={13} /> {state === 'working' ? 'Restoring…' : 'Undo'}
    </button>
  );
}
