# Claude Cleanup

Two tools for reclaiming disk space:

## `cleanup.ps1`

A standalone PowerShell script that purges stale Claude Code chat logs, background
jobs, and file-history for projects inactive beyond a configurable threshold.

```powershell
./cleanup.ps1 -ThresholdDays 5
```

## `app/` — Aurum Cleaner

A free desktop storage-cleaning app for Windows (Electron + React), built around
the same idea, expanded into a full toolset:

- **Dashboard** — per-drive usage donut chart and top-level storage breakdown
- **Quick Clean** — one-click purge of temp files, browser caches, Windows Update
  cache, prefetch, thumbnail cache, recycle bin, and more
- **Disk Analyzer** — a WinDirStat-style treemap to drill into what's eating space
- **Large Files** — find and remove (to Recycle Bin) oversized files
- **Duplicates** — find and remove duplicate files by content hash
- **Claude Cleanup** — the original `cleanup.ps1` logic, built into the app

### Development

```powershell
cd app
npm install
npm run dev:all      # Vite dev server + Electron together
```

### Building a Windows installer

```powershell
cd app
npm run build:electron
```
