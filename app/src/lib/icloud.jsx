import { createContext, useContext, useMemo, useState } from 'react';

// Which iCloud "aspects" the user has opted into. One shared setting so the checkbox
// behaves the same in every tool. Deliberately not persisted: every launch starts with
// iCloud excluded.
//   drive   iCloud Drive
//   apps    other apps' iCloud data
//   synced  Desktop & Documents, when synced with iCloud
const ICloudContext = createContext(null);

export function ICloudProvider({ children }) {
  const [opts, setOpts] = useState({ drive: false, apps: false, synced: false });
  const value = useMemo(
    () => ({
      opts,
      setAspect: (key, on) => setOpts((prev) => ({ ...prev, [key]: on })),
      anyOn: opts.drive || opts.apps || opts.synced,
    }),
    [opts]
  );
  return <ICloudContext.Provider value={value}>{children}</ICloudContext.Provider>;
}

export function useICloud() {
  const ctx = useContext(ICloudContext);
  if (!ctx) throw new Error('useICloud must be used inside <ICloudProvider>');
  return ctx;
}
