# Claude Cleanup

Two tools for reclaiming disk space:

## `cleanup.ps1`

A standalone PowerShell script that purges stale Claude Code chat logs, background
jobs, and file-history for projects inactive beyond a configurable threshold.

```powershell
./cleanup.ps1 -ThresholdDays 5
```

## `app/` — Aurum Cleaner

A free desktop storage-cleaning app for **Windows and macOS** (Electron + React), built
around the same idea, expanded into a full toolset. Mac users: see
[INSTALL-MAC.md](INSTALL-MAC.md) — it's a normal drag-to-Applications install.

- **Dashboard** — per-drive usage donut chart and top-level storage breakdown
- **Quick Clean** — one-click purge of temp files, browser caches, Windows Update
  cache, prefetch, thumbnail cache, recycle bin, and more
- **Disk Analyzer** — a WinDirStat-style treemap to drill into what's eating space
- **Large Files** — find and remove (to Recycle Bin) oversized files
- **Duplicates** — find and remove duplicate files by content hash
- **Claude Cleanup** — the original `cleanup.ps1` logic, built into the app
- **Undo History** *(macOS)* — everything removed can be restored with one click

On macOS, Quick Clean only touches caches, logs, old updates and developer leftovers —
never Messages, Mail, Calendar, Photos, Notes or iCloud. iCloud is opt-in per scan and
needs an extra confirmation before anything in it is deleted.

### Development

```powershell
cd app
npm install
npm run dev:all      # Vite dev server + Electron together
```

### Building installers

```bash
cd app
npm run build:electron   # Windows installer (run on Windows)
npm run build:mac        # macOS DMG + ZIP, universal (run on a Mac)
npm test                 # safety-rule and undo tests
```

### Releasing

Push a tag like `v1.2.0`; `.github/workflows/release.yml` builds Windows and macOS on
GitHub's runners and attaches them to a draft release.

**Making the Mac app open with no warning at all** needs an Apple Developer ID
certificate (Apple Developer Program, $99/yr) so the app can be signed and notarized.
Add these repository secrets and the workflow does it automatically:

| Secret | What |
| --- | --- |
| `MAC_CERT_P12_BASE64` | Developer ID Application certificate (.p12), base64-encoded |
| `MAC_CERT_PASSWORD` | Password for that .p12 |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-character team ID |

Without them the app is still ad-hoc signed, and users clear a one-time
**Privacy & Security → Open Anyway** prompt (no Terminal).
