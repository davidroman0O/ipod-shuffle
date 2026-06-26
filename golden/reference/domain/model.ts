import type { SupportedAudioExtension } from "./audio.ts";

export interface TrackRecord {
  id: string;
  sourcePath: string;
  fileName: string;
  extension: SupportedAudioExtension;
  sizeBytes: number;
  modifiedAtMs: number;
  exists: boolean;
  addedAt: string;
  updatedAt: string;
}

export interface PlaylistRecord {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DeviceManifestEntry {
  trackId: string;
  relativePath: string;
  sizeBytes: number;
}

export interface ManagedDeviceRecord {
  id: string;
  name: string;
  playlistIds: string[];
  preferredMountPath?: string;
  lastKnownMountPath?: string;
  volumeUuid?: string;
  deviceNode?: string;
  lastSeenAt?: string;
  lastSyncAt?: string;
  manifest: DeviceManifestEntry[];
}

export interface AppState {
  version: 1;
  libraryRoots: string[];
  tracks: TrackRecord[];
  playlists: PlaylistRecord[];
  devices: ManagedDeviceRecord[];
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  mountPath: string;
  volumeName?: string;
  volumeUuid?: string;
  deviceNode?: string;
  mediaType?: string;
  totalBytes?: number;
  freeBytes?: number;
}

export interface PlaylistTrackView {
  playlistId: string;
  trackId: string;
  fileName: string;
  sourcePath: string;
  exists: boolean;
  sizeBytes: number;
  extension: SupportedAudioExtension;
}

export interface PlannedTrack {
  trackId: string;
  sourcePath: string;
  fileName: string;
  relativePath: string;
  databasePath: string;
  sizeBytes: number;
}

export interface PlannedPlaylist {
  playlistId: string;
  name: string;
  trackIds: string[];
}

export interface FileCopyOperation {
  sourcePath: string;
  destinationPath: string;
  relativePath: string;
  reason: "missing" | "size-mismatch";
}

export interface FileSkipOperation {
  sourcePath: string;
  destinationPath: string;
  relativePath: string;
}

export interface SyncPlan {
  deviceId: string;
  deviceName: string;
  mountPath: string;
  tracks: PlannedTrack[];
  playlists: PlannedPlaylist[];
  copyOperations: FileCopyOperation[];
  skipOperations: FileSkipOperation[];
  deleteOperations: string[];
  warnings: string[];
}

export interface SyncResult {
  plan: SyncPlan;
  syncedAt: string;
  writtenDatabaseBytes: number;
  writtenStatsBytes: number;
  updatedDevice: ManagedDeviceRecord;
}

export interface ControllerSnapshot {
  state: AppState;
  discoveredDevices: DiscoveredDevice[];
}

export function createEmptyState(): AppState {
  return {
    version: 1,
    libraryRoots: [],
    tracks: [],
    playlists: [],
    devices: [],
  };
}
