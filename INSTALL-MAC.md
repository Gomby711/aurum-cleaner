# Installing Aurum Cleaner on a Mac

1. Download **Aurum Cleaner-x.y.z-universal.dmg** from the
   [latest release](https://github.com/Gomby711/aurum-cleaner/releases/latest).
   It runs natively on both Apple Silicon and Intel Macs.
2. Open the DMG and drag **Aurum Cleaner** onto the **Applications** folder.
3. Open it from Applications.

No Terminal commands are ever needed.

## If macOS says it can't verify the app

Releases that are signed and notarized with an Apple Developer ID open like any other app.
If you downloaded a build that isn't, macOS shows a one-time prompt the first time:

1. Click **Done** (not "Move to Trash") on the warning.
2. Open **System Settings → Privacy & Security**.
3. Scroll to **Security** and click **Open Anyway** next to "Aurum Cleaner", then confirm
   with your password or Touch ID.

You only do this once. (On macOS 14 and earlier you can instead right-click the app in
Applications and choose **Open**.)

## Permissions

Aurum Cleaner works without any special permissions. macOS will ask the first time it
looks in Desktop, Documents or Downloads — that's normal. Two things are hidden from
apps unless you grant **Full Disk Access** (Settings → Full Disk Access shows the status
and a button that opens the right pane): Safari's cache and the contents of your Trash.
Those show as unavailable otherwise.

## What it will and won't touch

| Never touched | Cleaned by Quick Clean |
| --- | --- |
| Messages, Mail, Calendar, Reminders, Notes, Contacts | App caches and browser caches |
| Photos libraries | App logs and crash reports |
| Keychain, Safari history/bookmarks, iPhone backups | Temp files older than 3 days |
| iCloud Drive and other cloud-synced folders (unless *you* include them in a scan) | Old iPhone/iPad update files |
| Anything outside the locations above | Leftover "Install macOS" apps, Xcode build data, npm cache |

Everything Aurum removes is held in **Undo History** — restore it with the Undo button
right after a clean, or any time from the Undo History page. Disk space comes back when
items are freed for good: automatically after your retention period (7 days by default,
configurable in Settings) or when you press **Free space now**.

iCloud files are only offered in Large Files, Duplicates and Disk Analyzer when you tick
**Include iCloud Drive**, and deleting one requires an extra confirmation, because it
also removes the file from iCloud.com and your other devices.
