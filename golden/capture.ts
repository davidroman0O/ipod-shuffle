/**
 * Golden-master capture harness.
 *
 * Runs the CURRENT TypeScript reference implementation (src/services/ipodDatabase.ts
 * and src/services/ipodStats.ts) over a fixed, deterministic set of inputs and
 * dumps the resulting iTunesSD / iTunesStats bytes to golden/.
 *
 * These byte vectors are the contract the future Go port of the binary writers
 * must reproduce EXACTLY. One wrong offset corrupts a device's database.
 *
 * Run: bun run scripts/capture-golden.ts
 *
 * Scenarios are engineered to exercise every branch:
 *   - empty:       0 tracks  -> buildEmptyDatabase() path
 *   - single-mp3:  1 mp3, no named playlists (only the implicit "All Songs" master)
 *   - mixed:       mp3(=1)/m4a(=2)/wav(=4) filetype codes + a named + an empty playlist
 *   - ghost:       a playlist referencing a trackId that does not exist in the track set
 *
 * Determinism note: buildITunesSD is fully deterministic given PlannedTrack/PlannedPlaylist.
 * The only randomness in the wider app lives in the controller (crypto.randomUUID(),
 * new Date().toISOString()) which we bypass by calling the builders directly.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { buildITunesSD } from "./reference/services/ipodDatabase.ts";
import { buildITunesStats } from "./reference/services/ipodStats.ts";
import type { PlannedPlaylist, PlannedTrack } from "./reference/domain/model.ts";

interface Scenario {
  name: string;
  description: string;
  tracks: PlannedTrack[];
  playlists: PlannedPlaylist[];
}

function track(
  trackId: string,
  fileName: string,
  sizeBytes: number,
  index: number,
): PlannedTrack {
  const folder = String(Math.floor(index / 128)).padStart(2, "0");
  const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
  const relativePath = `iPod_Control/Music/F${folder}/S${String(index).padStart(5, "0")}${ext.toLowerCase()}`;
  return {
    trackId,
    sourcePath: `/library/${fileName}`,
    fileName,
    relativePath,
    databasePath: `/${relativePath}`,
    sizeBytes,
  };
}

const scenarios: Scenario[] = [
  {
    name: "empty",
    description: "0 tracks — exercises buildEmptyDatabase() fallback path",
    tracks: [],
    playlists: [],
  },
  {
    name: "single-mp3",
    description: "1 mp3, no named playlists — only the implicit 'All Songs' master list",
    tracks: [track("t1", "song.mp3", 12345, 0)],
    playlists: [],
  },
  {
    name: "mixed",
    description: "mp3(1) + m4a(2) + wav(4) filetype codes, one named playlist + one empty (filtered)",
    tracks: [
      track("t1", "a.mp3", 1000, 0),
      track("t2", "b.m4a", 2000, 1),
      track("t3", "c.wav", 3000, 2),
    ],
    playlists: [
      { playlistId: "p1", name: "Chill", trackIds: ["t1", "t2"] },
      { playlistId: "p2", name: "Empty", trackIds: [] },
    ],
  },
  {
    name: "ghost",
    description: "playlist referencing a trackId absent from the track set (resolvePlayablePlaylists filter)",
    tracks: [track("t1", "real.mp3", 5000, 0), track("t2", "also.mp3", 6000, 1)],
    playlists: [
      { playlistId: "p1", name: "Good", trackIds: ["t1", "t2"] },
      { playlistId: "p2", name: "Haunted", trackIds: ["t1", "does-not-exist"] },
    ],
  },
];

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function main(): Promise<void> {
  const outDir = join(dirname(import.meta.dir), "golden");
  await mkdir(outDir, { recursive: true });

  const manifest: Array<Record<string, unknown>> = [];

  for (const scenario of scenarios) {
    const iTunesSD = buildITunesSD(scenario.tracks, scenario.playlists);
    const iTunesStats = buildITunesStats(scenario.tracks.length);

    await writeFile(join(outDir, `${scenario.name}.iTunesSD.bin`), iTunesSD);
    await writeFile(join(outDir, `${scenario.name}.iTunesStats.bin`), iTunesStats);
    await writeFile(
      join(outDir, `${scenario.name}.inputs.json`),
      `${JSON.stringify(
        { description: scenario.description, tracks: scenario.tracks, playlists: scenario.playlists },
        null,
        2,
      )}\n`,
    );

    manifest.push({
      name: scenario.name,
      description: scenario.description,
      trackCount: scenario.tracks.length,
      namedPlaylistCount: scenario.playlists.length,
      iTunesSD: {
        bytes: iTunesSD.length,
        sha256: createHash("sha256").update(iTunesSD).digest("hex"),
        base64: toBase64(iTunesSD),
        hexHead: toHex(iTunesSD.slice(0, 32)),
      },
      iTunesStats: {
        bytes: iTunesStats.length,
        sha256: createHash("sha256").update(iTunesStats).digest("hex"),
        base64: toBase64(iTunesStats),
      },
    });
  }

  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Captured ${scenarios.length} golden scenarios to ${outDir}\n`);
  for (const entry of manifest) {
    console.log(
      `  ${entry.name}  tracks=${entry.trackCount}  ` +
        `iTunesSD=${(entry.iTunesSD as { bytes: number }).bytes}B ` +
        `iTunesStats=${(entry.iTunesStats as { bytes: number }).bytes}B`,
    );
  }
}

await main();
