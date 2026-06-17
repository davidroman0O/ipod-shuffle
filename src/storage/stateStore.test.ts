import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { normalizeState, StateStore } from "./stateStore.ts";

const cleanupPaths: string[] = [];

afterEach(async () => {
  while (cleanupPaths.length > 0) {
    const path = cleanupPaths.pop();
    if (path) {
      await rm(path, { recursive: true, force: true });
    }
  }
});

describe("state store", () => {
  test("normalizes invalid input into a safe empty state", () => {
    expect(normalizeState(null)).toEqual({
      version: 1,
      libraryRoots: [],
      tracks: [],
      playlists: [],
      devices: [],
    });
  });

  test("saves and loads normalized state", async () => {
    const appHome = await mkdtemp(join(tmpdir(), "ipod-shuffle-store-"));
    cleanupPaths.push(appHome);

    const store = new StateStore({
      appHome,
      stateFile: join(appHome, "state.json"),
    });

    await store.save({
      version: 1,
      libraryRoots: ["/tmp/music", "/tmp/music"],
      tracks: [
        {
          id: "track-1",
          sourcePath: "/tmp/music/song.mp3",
          fileName: "song.mp3",
          extension: ".mp3",
          sizeBytes: 10,
          modifiedAtMs: 20,
          exists: true,
          addedAt: "2026-06-17T00:00:00.000Z",
          updatedAt: "2026-06-17T00:00:00.000Z",
        },
      ],
      playlists: [
        {
          id: "playlist-1",
          name: "Daily",
          trackIds: ["track-1"],
          createdAt: "2026-06-17T00:00:00.000Z",
          updatedAt: "2026-06-17T00:00:00.000Z",
        },
      ],
      devices: [
        {
          id: "device-1",
          name: "Shuffle",
          playlistIds: ["playlist-1"],
          manifest: [],
        },
      ],
    });

    const loaded = await store.load();
    expect(loaded.libraryRoots).toEqual(["/tmp/music"]);
    expect(loaded.tracks).toHaveLength(1);
    expect(loaded.playlists[0]?.trackIds).toEqual(["track-1"]);
    expect(loaded.devices[0]?.name).toBe("Shuffle");
  });
});
