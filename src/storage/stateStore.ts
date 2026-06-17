import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { AppState, ManagedDeviceRecord, PlaylistRecord, TrackRecord } from "../domain/model.ts";
import { createEmptyState } from "../domain/model.ts";
import { isSupportedAudioPath, normalizeAudioExtension } from "../domain/audio.ts";
import { resolveAppPaths, type AppPaths } from "./appHome.ts";

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => resolve(value)))];
}

function normalizeTrack(track: Partial<TrackRecord>): TrackRecord | null {
  if (!track.id || !track.sourcePath || !track.fileName || !track.addedAt || !track.updatedAt) {
    return null;
  }

  if (!isSupportedAudioPath(track.sourcePath)) {
    return null;
  }

  return {
    id: track.id,
    sourcePath: resolve(track.sourcePath),
    fileName: track.fileName,
    extension: normalizeAudioExtension(track.sourcePath) as TrackRecord["extension"],
    sizeBytes: typeof track.sizeBytes === "number" ? track.sizeBytes : 0,
    modifiedAtMs: typeof track.modifiedAtMs === "number" ? track.modifiedAtMs : 0,
    exists: track.exists !== false,
    addedAt: track.addedAt,
    updatedAt: track.updatedAt,
  };
}

function normalizePlaylist(playlist: Partial<PlaylistRecord>): PlaylistRecord | null {
  if (!playlist.id || !playlist.name || !playlist.createdAt || !playlist.updatedAt) {
    return null;
  }

  return {
    id: playlist.id,
    name: playlist.name,
    trackIds: Array.isArray(playlist.trackIds) ? playlist.trackIds.filter(Boolean) : [],
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };
}

function normalizeDevice(device: Partial<ManagedDeviceRecord>): ManagedDeviceRecord | null {
  if (!device.id || !device.name) {
    return null;
  }

  return {
    id: device.id,
    name: device.name,
    playlistIds: Array.isArray(device.playlistIds) ? device.playlistIds.filter(Boolean) : [],
    preferredMountPath: device.preferredMountPath ? resolve(device.preferredMountPath) : undefined,
    lastKnownMountPath: device.lastKnownMountPath ? resolve(device.lastKnownMountPath) : undefined,
    volumeUuid: device.volumeUuid,
    deviceNode: device.deviceNode,
    lastSeenAt: device.lastSeenAt,
    lastSyncAt: device.lastSyncAt,
    manifest: Array.isArray(device.manifest)
      ? device.manifest
          .filter((entry) => entry?.trackId && entry?.relativePath)
          .map((entry) => ({
            trackId: entry.trackId,
            relativePath: entry.relativePath,
            sizeBytes: typeof entry.sizeBytes === "number" ? entry.sizeBytes : 0,
          }))
      : [],
  };
}

export function normalizeState(input: unknown): AppState {
  if (!input || typeof input !== "object") {
    return createEmptyState();
  }

  const value = input as Partial<AppState>;

  return {
    version: 1,
    libraryRoots: Array.isArray(value.libraryRoots) ? dedupeStrings(value.libraryRoots.filter(Boolean)) : [],
    tracks: Array.isArray(value.tracks) ? (value.tracks.map(normalizeTrack).filter(Boolean) as TrackRecord[]) : [],
    playlists: Array.isArray(value.playlists)
      ? (value.playlists.map(normalizePlaylist).filter(Boolean) as PlaylistRecord[])
      : [],
    devices: Array.isArray(value.devices)
      ? (value.devices.map(normalizeDevice).filter(Boolean) as ManagedDeviceRecord[])
      : [],
  };
}

export class StateStore {
  constructor(private readonly paths: AppPaths = resolveAppPaths()) {}

  getPaths(): AppPaths {
    return this.paths;
  }

  async load(): Promise<AppState> {
    try {
      const raw = await readFile(this.paths.stateFile, "utf8");
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return createEmptyState();
      }

      throw error;
    }
  }

  async save(state: AppState): Promise<void> {
    const normalized = normalizeState(state);

    await mkdir(dirname(this.paths.stateFile), { recursive: true });
    await writeFile(this.paths.stateFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  }
}
