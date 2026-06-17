import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

import { isSupportedAudioPath } from "../domain/audio.ts";
import type {
  AppState,
  FileCopyOperation,
  FileSkipOperation,
  ManagedDeviceRecord,
  PlannedPlaylist,
  PlannedTrack,
  SyncPlan,
  TrackRecord,
} from "../domain/model.ts";

const TRACKS_PER_FOLDER = 128;

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function buildTrackUnion(state: AppState, device: ManagedDeviceRecord): TrackRecord[] {
  const playlistLookup = new Map(state.playlists.map((playlist) => [playlist.id, playlist]));
  const trackLookup = new Map(state.tracks.map((track) => [track.id, track]));
  const seenTrackIds = new Set<string>();
  const unionTracks: TrackRecord[] = [];

  for (const playlistId of device.playlistIds) {
    const playlist = playlistLookup.get(playlistId);
    if (!playlist) {
      continue;
    }

    for (const trackId of playlist.trackIds) {
      if (seenTrackIds.has(trackId)) {
        continue;
      }

      const track = trackLookup.get(trackId);
      if (!track || !track.exists) {
        continue;
      }

      seenTrackIds.add(trackId);
      unionTracks.push(track);
    }
  }

  return unionTracks;
}

function buildPlaylistsForDevice(state: AppState, device: ManagedDeviceRecord): PlannedPlaylist[] {
  return device.playlistIds
    .map((playlistId) => state.playlists.find((playlist) => playlist.id === playlistId))
    .filter((playlist): playlist is NonNullable<typeof playlist> => Boolean(playlist))
    .map((playlist) => ({
      playlistId: playlist.id,
      name: playlist.name,
      trackIds: [...playlist.trackIds],
    }));
}

function allocateRelativePath(index: number, fileName: string): string {
  const folderNumber = String(Math.floor(index / TRACKS_PER_FOLDER)).padStart(2, "0");
  const extension = basename(fileName).includes(".") ? `.${fileName.split(".").pop()}` : "";
  const generatedName = `S${String(index).padStart(5, "0")}${extension.toLowerCase()}`;

  return `iPod_Control/Music/F${folderNumber}/${generatedName}`;
}

export function buildPlannedTracks(state: AppState, device: ManagedDeviceRecord): PlannedTrack[] {
  return buildTrackUnion(state, device).map((track, index) => {
    const relativePath = allocateRelativePath(index, track.fileName);
    return {
      trackId: track.id,
      sourcePath: track.sourcePath,
      fileName: track.fileName,
      relativePath,
      databasePath: `/${toPortablePath(relativePath)}`,
      sizeBytes: track.sizeBytes,
    };
  });
}

async function collectExistingAudioFiles(mountPath: string): Promise<string[]> {
  const musicRoot = resolve(mountPath, "iPod_Control", "Music");
  const relativePaths: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (entry.isFile() && isSupportedAudioPath(entryPath)) {
        relativePaths.push(toPortablePath(relative(resolve(mountPath), entryPath)));
      }
    }
  }

  try {
    await walk(musicRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return relativePaths.sort();
}

async function computeFileActions(
  mountPath: string,
  plannedTracks: PlannedTrack[],
): Promise<{ copyOperations: FileCopyOperation[]; skipOperations: FileSkipOperation[]; deleteOperations: string[] }> {
  const copyOperations: FileCopyOperation[] = [];
  const skipOperations: FileSkipOperation[] = [];
  const plannedRelativePaths = new Set(plannedTracks.map((track) => track.relativePath));

  for (const track of plannedTracks) {
    const destinationPath = resolve(mountPath, track.relativePath);
    try {
      const destinationStats = await stat(destinationPath);
      if (destinationStats.size === track.sizeBytes) {
        skipOperations.push({
          sourcePath: track.sourcePath,
          destinationPath,
          relativePath: track.relativePath,
        });
      } else {
        copyOperations.push({
          sourcePath: track.sourcePath,
          destinationPath,
          relativePath: track.relativePath,
          reason: "size-mismatch",
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      copyOperations.push({
        sourcePath: track.sourcePath,
        destinationPath,
        relativePath: track.relativePath,
        reason: "missing",
      });
    }
  }

  const existingFiles = await collectExistingAudioFiles(mountPath);
  const deleteOperations = existingFiles.filter((relativePath) => !plannedRelativePaths.has(relativePath));

  return {
    copyOperations,
    skipOperations,
    deleteOperations,
  };
}

export async function planDeviceSync(
  state: AppState,
  device: ManagedDeviceRecord,
  mountPath: string,
): Promise<SyncPlan> {
  const plannedTracks = buildPlannedTracks(state, device);
  const plannedPlaylists = buildPlaylistsForDevice(state, device);
  const warnings: string[] = [];

  if (device.playlistIds.length === 0) {
    warnings.push("No playlists are assigned to this device.");
  }

  if (plannedTracks.length === 0) {
    warnings.push("No existing audio files are currently eligible for sync.");
  }

  for (const playlist of plannedPlaylists) {
    const existingTrackCount = playlist.trackIds.filter((trackId) =>
      plannedTracks.some((track) => track.trackId === trackId),
    ).length;

    if (existingTrackCount === 0) {
      warnings.push(`Playlist "${playlist.name}" has no existing tracks and will be skipped on the device.`);
    }
  }

  const actions = await computeFileActions(mountPath, plannedTracks);

  return {
    deviceId: device.id,
    deviceName: device.name,
    mountPath: resolve(mountPath),
    tracks: plannedTracks,
    playlists: plannedPlaylists,
    copyOperations: actions.copyOperations,
    skipOperations: actions.skipOperations,
    deleteOperations: actions.deleteOperations,
    warnings,
  };
}
