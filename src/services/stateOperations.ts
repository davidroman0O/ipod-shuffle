import type { AppState, DiscoveredDevice, ManagedDeviceRecord, PlaylistRecord } from "../domain/model.ts";

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function trimName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function createPlaylistRecord(state: AppState, playlistId: string, name: string, nowIso: string): AppState {
  const trimmedName = trimName(name);

  if (!trimmedName) {
    throw new Error("Playlist name cannot be empty.");
  }

  if (state.playlists.some((playlist) => playlist.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error(`Playlist "${trimmedName}" already exists.`);
  }

  const playlist: PlaylistRecord = {
    id: playlistId,
    name: trimmedName,
    trackIds: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return {
    ...state,
    playlists: [...state.playlists, playlist],
  };
}

export function addTrackToPlaylistRecord(
  state: AppState,
  playlistId: string,
  trackId: string,
  nowIso: string,
): AppState {
  return {
    ...state,
    playlists: state.playlists.map((playlist) =>
      playlist.id !== playlistId
        ? playlist
        : {
            ...playlist,
            trackIds: dedupe([...playlist.trackIds, trackId]),
            updatedAt: nowIso,
          },
    ),
  };
}

export function removeTrackFromPlaylistRecord(
  state: AppState,
  playlistId: string,
  trackId: string,
  nowIso: string,
): AppState {
  return {
    ...state,
    playlists: state.playlists.map((playlist) =>
      playlist.id !== playlistId
        ? playlist
        : {
            ...playlist,
            trackIds: playlist.trackIds.filter((existingTrackId) => existingTrackId !== trackId),
            updatedAt: nowIso,
          },
    ),
  };
}

export function addLibraryRootRecord(state: AppState, rootPath: string): AppState {
  return {
    ...state,
    libraryRoots: dedupe([...state.libraryRoots, rootPath]),
  };
}

export function togglePlaylistAssignmentRecord(
  state: AppState,
  deviceId: string,
  playlistId: string,
): AppState {
  return {
    ...state,
    devices: state.devices.map((device) => {
      if (device.id !== deviceId) {
        return device;
      }

      const nextPlaylistIds = device.playlistIds.includes(playlistId)
        ? device.playlistIds.filter((existingPlaylistId) => existingPlaylistId !== playlistId)
        : [...device.playlistIds, playlistId];

      return {
        ...device,
        playlistIds: nextPlaylistIds,
      };
    }),
  };
}

function createDeviceFromDiscovery(discoveredDevice: DiscoveredDevice, nowIso: string): ManagedDeviceRecord {
  return {
    id: discoveredDevice.volumeUuid ?? discoveredDevice.mountPath,
    name: discoveredDevice.name,
    playlistIds: [],
    preferredMountPath: discoveredDevice.mountPath,
    lastKnownMountPath: discoveredDevice.mountPath,
    volumeUuid: discoveredDevice.volumeUuid,
    deviceNode: discoveredDevice.deviceNode,
    lastSeenAt: nowIso,
    manifest: [],
  };
}

export function mergeDiscoveredDevicesRecord(
  state: AppState,
  discoveredDevices: DiscoveredDevice[],
  nowIso: string,
): AppState {
  const nextDevices = [...state.devices];

  for (const discoveredDevice of discoveredDevices) {
    const existingIndex = nextDevices.findIndex(
      (device) =>
        (device.volumeUuid && discoveredDevice.volumeUuid && device.volumeUuid === discoveredDevice.volumeUuid) ||
        device.preferredMountPath === discoveredDevice.mountPath ||
        device.lastKnownMountPath === discoveredDevice.mountPath,
    );

    if (existingIndex === -1) {
      nextDevices.push(createDeviceFromDiscovery(discoveredDevice, nowIso));
      continue;
    }

    const existing = nextDevices[existingIndex];
    if (!existing) {
      continue;
    }

    nextDevices[existingIndex] = {
      ...existing,
      name: discoveredDevice.name,
      preferredMountPath: discoveredDevice.mountPath,
      lastKnownMountPath: discoveredDevice.mountPath,
      volumeUuid: discoveredDevice.volumeUuid ?? existing.volumeUuid,
      deviceNode: discoveredDevice.deviceNode ?? existing.deviceNode,
      lastSeenAt: nowIso,
    };
  }

  return {
    ...state,
    devices: nextDevices,
  };
}

export function updateDeviceAfterSyncRecord(state: AppState, updatedDevice: ManagedDeviceRecord): AppState {
  return {
    ...state,
    devices: state.devices.map((device) => (device.id === updatedDevice.id ? updatedDevice : device)),
  };
}
