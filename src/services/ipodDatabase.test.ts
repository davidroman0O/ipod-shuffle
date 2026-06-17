import { describe, expect, test } from "bun:test";

import { buildITunesSD } from "./ipodDatabase.ts";

describe("iTunesSD writer", () => {
  test("writes an empty database blob", () => {
    const blob = buildITunesSD([], []);
    expect(blob.length).toBe(132);
    expect(new TextDecoder().decode(blob.slice(0, 4))).toBe("bdhs");
  });

  test("writes a populated database blob", () => {
    const blob = buildITunesSD(
      [
        {
          trackId: "track-a",
          sourcePath: "/tmp/a.mp3",
          fileName: "a.mp3",
          relativePath: "iPod_Control/Music/F00/S00000.mp3",
          databasePath: "/iPod_Control/Music/F00/S00000.mp3",
          sizeBytes: 3,
        },
      ],
      [
        {
          playlistId: "playlist-1",
          name: "One",
          trackIds: ["track-a"],
        },
      ],
    );

    expect(new TextDecoder().decode(blob.slice(0, 4))).toBe("bdhs");
    expect(new TextDecoder().decode(blob.slice(64, 68))).toBe("hths");
    expect(new TextDecoder().decode(blob.slice(88, 92))).toBe("rths");
    expect(blob.length).toBeGreaterThan(500);
  });
});
