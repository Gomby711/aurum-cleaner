const info = window.api?.platform ?? { os: 'win32', home: '', sep: '\\', supportsUndo: false };

export const platform = info;
export const isMac = info.os === 'darwin';

// Where removed files end up, in the words each platform's users expect.
export const trashLabel = isMac ? 'Undo History' : 'Recycle Bin';
export const moveToTrashLabel = isMac ? 'Remove (can undo)' : 'Move to Recycle Bin';

export function removedMessage(result, formatBytes) {
  const size = formatBytes(result.freed);
  return isMac ? `Removed ${size}` : `Sent ${size} to the Recycle Bin`;
}
