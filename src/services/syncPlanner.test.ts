import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { buildPlannedTracks, planDeviceSync } from "./syncPlanner.ts";
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

function makeState(trackAPath: string, trackBPath: string, mountPath: string): AppState {
  return {
    ...createEmptyState(),
    tracks: [
      {
        id: "track-a",
        sourcePath: trackAPath,
        fileName: "track-a.mp3",
        extension: ".mp3",
        sizeBytes: 3,
        modifiedAtMs: 1,
        exists: true,
        addedAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z",
      },
      {
        id: "track-b",
        sourcePath: trackBPath,
        fileName: "track-b.m4a",
        extension: ".m4a",
        sizeBytes: 4,
        modifiedAtMs: 1,
        exists: true,
        addedAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z",
      },
    ],
    playlists: [
      {
        id: "playlist-1",
        name: "Morning",
        trackIds: ["track-a", "track-b"],
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

describe("sync planner", () => {
  test("allocates deterministic relative paths", async () => {
    const mountPath = await makeTempDir("ipod-shuffle-plan-");
    const sourceDir = await makeTempDir("ipod-shuffle-source-");
    const trackAPath = join(sourceDir, "track-a.mp3");
    const trackBPath = join(sourceDir, "track-b.m4a");
    await writeFile(trackAPath, "aaa");
    await writeFile(trackBPath, "bbbb");

    const state = makeState(trackAPath, trackBPath, mountPath);
    const planned = buildPlannedTracks(state, state.devices[0]!);
    expect(planned[0]?.relativePath).toBe("iPod_Control/Music/F00/S00000.mp3");
    expect(planned[1]?.relativePath).toBe("iPod_Control/Music/F00/S00001.m4a");
  });

  test("computes copy, skip, delete, and warning operations", async () => {
    const mountPath = await makeTempDir("ipod-shuffle-device-");
    const sourceDir = await makeTempDir("ipod-shuffle-sources-");
    const musicDir = join(mountPath, "iPod_Control", "Music", "F00");
    await mkdir(musicDir, { recursive: true });

    const trackAPath = join(sourceDir, "track-a.mp3");
    const trackBPath = join(sourceDir, "track-b.m4a");
    await writeFile(trackAPath, "aaa");
    await writeFile(trackBPath, "bbbb");

    await writeFile(join(musicDir, "S00000.mp3"), "aaa");
    await writeFile(join(musicDir, "orphan.mp3"), "gone");

    const state = makeState(trackAPath, trackBPath, mountPath);
    const plan = await planDeviceSync(state, state.devices[0]!, mountPath);

    expect(plan.skipOperations).toHaveLength(1);
    expect(plan.copyOperations).toHaveLength(1);
    expect(plan.deleteOperations).toEqual(["iPod_Control/Music/F00/orphan.mp3"]);
    expect(plan.warnings).toEqual([]);
  });
});
