import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { syncDevice } from "./deviceSync.ts";
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

function makeState(trackPath: string, mountPath: string): AppState {
  return {
    ...createEmptyState(),
    tracks: [
      {
        id: "track-1",
        sourcePath: trackPath,
        fileName: "track-1.mp3",
        extension: ".mp3",
        sizeBytes: 5,
        modifiedAtMs: 1,
        exists: true,
        addedAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z",
      },
    ],
    playlists: [
      {
        id: "playlist-1",
        name: "Carry",
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
        lastKnownMountPath: mountPath,
        manifest: [],
      },
    ],
  };
}

describe("device sync", () => {
  test("copies tracks and writes database files", async () => {
    const sourceDir = await makeTempDir("ipod-shuffle-sync-source-");
    const mountPath = await makeTempDir("ipod-shuffle-sync-device-");
    await mkdir(join(mountPath, "iPod_Control", "Music", "F00"), { recursive: true });
    await mkdir(join(mountPath, "iPod_Control", "iTunes"), { recursive: true });
    await writeFile(join(mountPath, "iPod_Control", "Music", "F00", "old.mp3"), "old");

    const trackPath = join(sourceDir, "track-1.mp3");
    await writeFile(trackPath, "12345");

    const state = makeState(trackPath, mountPath);
    const result = await syncDevice(state, state.devices[0]!, "2026-06-17T00:10:00.000Z");

    expect(result.plan.tracks).toHaveLength(1);
    expect(result.updatedDevice.lastSyncAt).toBe("2026-06-17T00:10:00.000Z");

    const copied = await readFile(resolve(mountPath, "iPod_Control", "Music", "F00", "S00000.mp3"), "utf8");
    expect(copied).toBe("12345");

    const stats = await readFile(resolve(mountPath, "iPod_Control", "iTunes", "iTunesStats"));
    expect(stats[0]).toBe(1);

    const database = await readFile(resolve(mountPath, "iPod_Control", "iTunes", "iTunesSD"));
    expect(new TextDecoder().decode(database.slice(0, 4))).toBe("bdhs");
  });
});
