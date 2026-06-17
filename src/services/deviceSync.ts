import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { AppState, ManagedDeviceRecord, SyncResult } from "../domain/model.ts";
import { buildITunesSD } from "./ipodDatabase.ts";
import { buildITunesStats } from "./ipodStats.ts";
import { isIpodMountPath } from "./deviceDiscovery.ts";
import { planDeviceSync } from "./syncPlanner.ts";

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function ensureIpodLayout(mountPath: string): Promise<void> {
  await ensureDirectory(resolve(mountPath, "iPod_Control", "Music"));
  await ensureDirectory(resolve(mountPath, "iPod_Control", "iTunes"));
}

async function removePlannedFiles(mountPath: string, relativePaths: string[]): Promise<void> {
  for (const relativePath of relativePaths) {
    await rm(resolve(mountPath, relativePath), { force: true });
  }
}

async function copyPlannedFiles(plan: Awaited<ReturnType<typeof planDeviceSync>>): Promise<void> {
  for (const operation of plan.copyOperations) {
    await ensureDirectory(dirname(operation.destinationPath));
    await copyFile(operation.sourcePath, operation.destinationPath);
  }
}

async function pruneEmptyMusicFolders(mountPath: string): Promise<void> {
  const musicRoot = resolve(mountPath, "iPod_Control", "Music");
  const entries = await readdir(musicRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const folderPath = join(musicRoot, entry.name);
    const folderEntries = await readdir(folderPath);
    if (folderEntries.length === 0) {
      await rm(folderPath, { recursive: true, force: true });
    }
  }
}

export async function syncDevice(
  state: AppState,
  device: ManagedDeviceRecord,
  nowIso: string,
): Promise<SyncResult> {
  const mountPath = device.lastKnownMountPath ?? device.preferredMountPath;

  if (!mountPath || !(await isIpodMountPath(mountPath))) {
    throw new Error(`Device "${device.name}" is not currently mounted.`);
  }

  const plan = await planDeviceSync(state, device, mountPath);

  await ensureIpodLayout(mountPath);
  await removePlannedFiles(mountPath, plan.deleteOperations);
  await copyPlannedFiles(plan);
  await pruneEmptyMusicFolders(mountPath);

  const iTunesSD = buildITunesSD(plan.tracks, plan.playlists);
  const iTunesStats = buildITunesStats(plan.tracks.length);

  await writeFile(resolve(mountPath, "iPod_Control", "iTunes", "iTunesSD"), iTunesSD);
  await writeFile(resolve(mountPath, "iPod_Control", "iTunes", "iTunesStats"), iTunesStats);

  const updatedDevice: ManagedDeviceRecord = {
    ...device,
    lastKnownMountPath: mountPath,
    lastSyncAt: nowIso,
    manifest: plan.tracks.map((track) => ({
      trackId: track.trackId,
      relativePath: track.relativePath,
      sizeBytes: track.sizeBytes,
    })),
  };

  return {
    plan,
    syncedAt: nowIso,
    writtenDatabaseBytes: iTunesSD.length,
    writtenStatsBytes: iTunesStats.length,
    updatedDevice,
  };
}
