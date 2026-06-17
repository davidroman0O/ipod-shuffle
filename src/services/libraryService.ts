import { readdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

import type { AppState, PlaylistTrackView, TrackRecord } from "../domain/model.ts";
import { isSupportedAudioPath, normalizeAudioExtension } from "../domain/audio.ts";

export interface LibraryFs {
  readdir: typeof readdir;
  stat: typeof stat;
}

const defaultFs: LibraryFs = {
  readdir,
  stat,
};

function buildTrackRecord(sourcePath: string, sizeBytes: number, modifiedAtMs: number, nowIso: string): TrackRecord {
  const resolvedPath = resolve(sourcePath);

  return {
    id: crypto.randomUUID(),
    sourcePath: resolvedPath,
    fileName: basename(resolvedPath),
    extension: normalizeAudioExtension(resolvedPath) as TrackRecord["extension"],
    sizeBytes,
    modifiedAtMs,
    exists: true,
    addedAt: nowIso,
    updatedAt: nowIso,
  };
}

function updateTrackRecord(track: TrackRecord, sizeBytes: number, modifiedAtMs: number, nowIso: string): TrackRecord {
  return {
    ...track,
    fileName: basename(track.sourcePath),
    sizeBytes,
    modifiedAtMs,
    exists: true,
    updatedAt: nowIso,
  };
}

export async function upsertTrackFromPath(
  state: AppState,
  sourcePath: string,
  nowIso: string,
  fs: LibraryFs = defaultFs,
): Promise<{ state: AppState; track: TrackRecord; created: boolean }> {
  const resolvedPath = resolve(sourcePath);

  if (!isSupportedAudioPath(resolvedPath)) {
    throw new Error(`Unsupported audio file: ${resolvedPath}`);
  }

  const stats = await fs.stat(resolvedPath);

  if (!stats.isFile()) {
    throw new Error(`Expected an audio file, got: ${resolvedPath}`);
  }

  const existing = state.tracks.find((track) => track.sourcePath === resolvedPath);

  if (!existing) {
    const createdTrack = buildTrackRecord(resolvedPath, stats.size, stats.mtimeMs, nowIso);
    return {
      state: {
        ...state,
        tracks: [...state.tracks, createdTrack],
      },
      track: createdTrack,
      created: true,
    };
  }

  const updatedTrack = updateTrackRecord(existing, stats.size, stats.mtimeMs, nowIso);

  return {
    state: {
      ...state,
      tracks: state.tracks.map((track) => (track.id === updatedTrack.id ? updatedTrack : track)),
    },
    track: updatedTrack,
    created: false,
  };
}

async function scanDirectory(rootPath: string, fs: LibraryFs, tracks: string[]): Promise<void> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = resolve(rootPath, entry.name);

    if (entry.isDirectory()) {
      await scanDirectory(entryPath, fs, tracks);
      continue;
    }

    if (entry.isFile() && isSupportedAudioPath(entryPath)) {
      tracks.push(entryPath);
    }
  }
}

export async function scanLibraryRoots(
  state: AppState,
  nowIso: string,
  fs: LibraryFs = defaultFs,
): Promise<{ state: AppState; importedCount: number }> {
  let nextState = state;
  let importedCount = 0;

  for (const root of state.libraryRoots) {
    const audioFiles: string[] = [];
    await scanDirectory(root, fs, audioFiles);

    for (const audioFile of audioFiles) {
      const result = await upsertTrackFromPath(nextState, audioFile, nowIso, fs);
      nextState = result.state;
      if (result.created) {
        importedCount += 1;
      }
    }
  }

  return {
    state: nextState,
    importedCount,
  };
}

export async function revalidateTracks(
  state: AppState,
  nowIso: string,
  fs: LibraryFs = defaultFs,
): Promise<AppState> {
  const updatedTracks = await Promise.all(
    state.tracks.map(async (track) => {
      try {
        const stats = await fs.stat(track.sourcePath);
        if (!stats.isFile()) {
          return { ...track, exists: false, updatedAt: nowIso };
        }

        return updateTrackRecord(track, stats.size, stats.mtimeMs, nowIso);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return {
            ...track,
            exists: false,
            updatedAt: nowIso,
          };
        }

        throw error;
      }
    }),
  );

  return {
    ...state,
    tracks: updatedTracks,
  };
}

export function getPlaylistTrackViews(state: AppState, playlistId: string): PlaylistTrackView[] {
  const playlist = state.playlists.find((entry) => entry.id === playlistId);

  if (!playlist) {
    return [];
  }

  return playlist.trackIds
    .map((trackId) => state.tracks.find((track) => track.id === trackId))
    .filter((track): track is TrackRecord => Boolean(track))
    .map((track) => ({
      playlistId,
      trackId: track.id,
      fileName: track.fileName,
      sourcePath: track.sourcePath,
      exists: track.exists,
      sizeBytes: track.sizeBytes,
      extension: track.extension,
    }));
}
