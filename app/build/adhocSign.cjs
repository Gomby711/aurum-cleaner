// electron-builder afterSign hook.
//
// When there is no Apple Developer ID certificate (CSC_LINK unset), the app would be left
// completely unsigned — and on Apple Silicon an unsigned app is reported as "damaged and
// can't be opened", which can only be worked around from Terminal. Ad-hoc signing it gives
// the normal "unidentified developer" prompt instead, which users clear in
// System Settings → Privacy & Security → Open Anyway (no Terminal needed).
//
// With a Developer ID certificate this does nothing; electron-builder signs and notarizes.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.platform !== 'darwin') return; // cross-building from Linux/Windows can't run codesign
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • no Developer ID certificate found — ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
