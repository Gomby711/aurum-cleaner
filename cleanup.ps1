# Claude stale-project cleanup
# Purges chat logs, jobs, and file-history for projects inactive beyond $ThresholdDays.
param(
    [int]$ThresholdDays = 5
)

$claudeDir  = "C:\Users\leete\.claude"
$projectsDir = "$claudeDir\projects"
$jobsDir     = "$claudeDir\jobs"
$historyDir  = "$claudeDir\file-history"
$logFile     = "$claudeDir\cleanup-log.txt"

$cutoff = (Get-Date).AddDays(-$ThresholdDays)

function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Write-Host $line
    Add-Content $logFile $line -Encoding utf8
}

function Remove-SafeItem($path) {
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Track which job/history IDs are handled via projects so we can skip them in orphan sweep
$handledIds = @{}

Log "=== Cleanup run  (threshold: $ThresholdDays days, cutoff: $cutoff) ==="

# --- Phase 1: stale projects ---
Get-ChildItem $projectsDir -Directory | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
    $proj = $_

    # Collect job IDs linked inside this project folder
    $linkedJobIds = Get-ChildItem $proj.FullName -Directory | Select-Object -ExpandProperty Name

    $freedBytes = 0

    # Delete .jsonl chat logs
    Get-ChildItem $proj.FullName -File -Filter "*.jsonl" | ForEach-Object {
        $freedBytes += $_.Length
        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    }

    # Delete linked jobs and their file-history entries
    foreach ($id in $linkedJobIds) {
        $handledIds[$id] = $true

        $jobPath  = "$jobsDir\$id"
        $histPath = "$historyDir\$id"

        Get-ChildItem $jobPath  -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $freedBytes += $_.Length }
        Get-ChildItem $histPath -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $freedBytes += $_.Length }

        Remove-SafeItem $jobPath
        Remove-SafeItem $histPath
        Remove-SafeItem "$($proj.FullName)\$id"
    }

    $freedMB = [math]::Round($freedBytes / 1MB, 2)
    Log "PURGED project '$($proj.Name)'  (last active: $($proj.LastWriteTime.ToString('yyyy-MM-dd')), freed: $freedMB MB)"
}

# --- Phase 2: orphaned jobs with no project link ---
Get-ChildItem $jobsDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $cutoff -and -not $handledIds.ContainsKey($_.Name) } |
    ForEach-Object {
        $freedBytes = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $freedMB = [math]::Round($freedBytes / 1MB, 2)
        Remove-SafeItem $_.FullName
        Log "PURGED orphan job '$($_.Name)'  (freed: $freedMB MB)"
    }

# --- Phase 3: orphaned file-history entries ---
Get-ChildItem $historyDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $cutoff -and -not $handledIds.ContainsKey($_.Name) } |
    ForEach-Object {
        $freedBytes = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $freedMB = [math]::Round($freedBytes / 1MB, 2)
        Remove-SafeItem $_.FullName
        Log "PURGED orphan history '$($_.Name)'  (freed: $freedMB MB)"
    }

Log "=== Done ==="
