// Ports the logic of the original cleanup.ps1 script: purges stale Claude Code
// project chat logs, linked jobs, and file-history entries beyond a threshold.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { dirSize } = require('../lib/fsWalk.cjs');

const claudeDir = path.join(os.homedir(), '.claude');
const projectsDir = path.join(claudeDir, 'projects');
const jobsDir = path.join(claudeDir, 'jobs');
const historyDir = path.join(claudeDir, 'file-history');

async function safeReaddir(dir) {
  try {
    return await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function sizeOfPath(p) {
  try {
    const stat = await fs.promises.lstat(p);
    if (stat.isDirectory()) {
      const { size } = await dirSize(p);
      return size;
    }
    return stat.size;
  } catch {
    return 0;
  }
}

async function scanStaleProjects(thresholdDays) {
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
  const projects = await safeReaddir(projectsDir);
  const handledIds = new Set();
  const items = [];

  for (const proj of projects) {
    if (!proj.isDirectory()) continue;
    const projPath = path.join(projectsDir, proj.name);
    const stat = await fs.promises.stat(projPath);
    if (stat.mtimeMs >= cutoff) continue;

    const linked = await safeReaddir(projPath);
    const linkedIds = linked.filter((e) => e.isDirectory()).map((e) => e.name);
    linkedIds.forEach((id) => handledIds.add(id));

    let size = 0;
    const jsonlFiles = (await safeReaddir(projPath)).filter(
      (e) => e.isFile() && e.name.endsWith('.jsonl')
    );
    for (const f of jsonlFiles) {
      size += await sizeOfPath(path.join(projPath, f.name));
    }
    for (const id of linkedIds) {
      size += await sizeOfPath(path.join(jobsDir, id));
      size += await sizeOfPath(path.join(historyDir, id));
      size += await sizeOfPath(path.join(projPath, id));
    }

    items.push({
      type: 'project',
      name: proj.name,
      path: projPath,
      lastActive: stat.mtime.toISOString(),
      size,
      linkedIds,
    });
  }

  // Orphaned jobs / history not linked to any (even active) project
  const orphanJobs = [];
  for (const j of await safeReaddir(jobsDir)) {
    if (!j.isDirectory() || handledIds.has(j.name)) continue;
    const jPath = path.join(jobsDir, j.name);
    const stat = await fs.promises.stat(jPath);
    if (stat.mtimeMs >= cutoff) continue;
    orphanJobs.push({
      type: 'orphan-job',
      name: j.name,
      path: jPath,
      lastActive: stat.mtime.toISOString(),
      size: await sizeOfPath(jPath),
    });
  }

  const orphanHistory = [];
  for (const h of await safeReaddir(historyDir)) {
    if (!h.isDirectory() || handledIds.has(h.name)) continue;
    const hPath = path.join(historyDir, h.name);
    const stat = await fs.promises.stat(hPath);
    if (stat.mtimeMs >= cutoff) continue;
    orphanHistory.push({
      type: 'orphan-history',
      name: h.name,
      path: hPath,
      lastActive: stat.mtime.toISOString(),
      size: await sizeOfPath(hPath),
    });
  }

  return { projects: items, orphanJobs, orphanHistory };
}

async function removeSafe(p) {
  try {
    await fs.promises.rm(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function cleanStaleItems(items) {
  let freed = 0;
  for (const item of items) {
    if (item.type === 'project') {
      const projPath = item.path;
      const jsonlFiles = (await safeReaddir(projPath)).filter(
        (e) => e.isFile() && e.name.endsWith('.jsonl')
      );
      for (const f of jsonlFiles) {
        const full = path.join(projPath, f.name);
        freed += await sizeOfPath(full);
        await removeSafe(full);
      }
      for (const id of item.linkedIds || []) {
        const jobPath = path.join(jobsDir, id);
        const histPath = path.join(historyDir, id);
        const linkPath = path.join(projPath, id);
        freed += await sizeOfPath(jobPath);
        freed += await sizeOfPath(histPath);
        freed += await sizeOfPath(linkPath);
        await removeSafe(jobPath);
        await removeSafe(histPath);
        await removeSafe(linkPath);
      }
    } else {
      freed += await sizeOfPath(item.path);
      await removeSafe(item.path);
    }
  }
  return { freed };
}

module.exports = { scanStaleProjects, cleanStaleItems };
