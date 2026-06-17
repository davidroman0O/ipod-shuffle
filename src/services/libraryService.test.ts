import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { addTrackToPlaylistRecord } from "./stateOperations.ts";
import { getPlaylistTrackViews, revalidateTracks, scanLibraryRoots, upsertTrackFromPath } from "./libraryService.ts";
import { createEmptyState, type AppState } from "../domain/model.ts";

const cleanupPaths: string[] = [];

async function makeTempDir(prefix: string) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  cleanupPaths.push(directory);
  return directory;
}

afterEach(async () => {
  while (cleanupPaths.length > 0) {
    const path = cleanupPaths.pop();
    if (path) {
      await rm(path, { recursive: true, force: true });
    }
  }
});

describe("library service", () => {
  test("imports a single audio file and revalidates existence", async () => {
    const libraryDir = await makeTempDir("ipod-shuffle-library-");
    const trackPath = join(libraryDir, "song.mp3");
    await writeFile(trackPath, "abc123");

    const now = "2026-06-17T00:00:00.000Z";
    const created = await upsertTrackFromPath(createEmptyState(), trackPath, now);

    expect(created.created).toBe(true);
    expect(created.track.fileName).toBe("song.mp3");

    await rm(trackPath);
    const revalidated = await revalidateTracks(created.state, "2026-06-17T00:05:00.000Z");
    expect(revalidated.tracks[0]?.exists).toBe(false);
  });

  test("scans library roots recursively and exposes playlist track views", async () => {
    const libraryDir = await makeTempDir("ipod-shuffle-scan-");
    const albumDir = join(libraryDir, "Artist", "Album");
    await mkdir(albumDir, { recursive: true });
    await writeFile(join(albumDir, "one.mp3"), "1");
    await writeFile(join(albumDir, "two.m4a"), "22");
    await writeFile(join(albumDir, "skip.txt"), "nope");

    let state: AppState = {
      ...createEmptyState(),
      libraryRoots: [libraryDir],
      playlists: [
        {
          id: "playlist-1",
          name: "Imported",
          trackIds: [],
          createdAt: "2026-06-17T00:00:00.000Z",
          updatedAt: "2026-06-17T00:00:00.000Z",
        },
      ],
    };

    const scanned = await scanLibraryRoots(state, "2026-06-17T00:00:00.000Z");
    expect(scanned.importedCount).toBe(2);
    expect(scanned.state.tracks).toHaveLength(2);

    state = addTrackToPlaylistRecord(
      scanned.state,
      "playlist-1",
      scanned.state.tracks[0]!.id,
      "2026-06-17T00:01:00.000Z",
    );

    const views = getPlaylistTrackViews(state, "playlist-1");
    expect(views).toHaveLength(1);
    expect(views[0]?.exists).toBe(true);
  });
});
