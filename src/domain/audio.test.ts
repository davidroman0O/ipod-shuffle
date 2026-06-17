import { describe, expect, test } from "bun:test";

import { getIpodFileType, isSupportedAudioPath, normalizeAudioExtension } from "./audio.ts";

describe("audio helpers", () => {
  test("normalizes and recognizes supported extensions", () => {
    expect(normalizeAudioExtension("/music/Track.MP3")).toBe(".mp3");
    expect(isSupportedAudioPath("/music/Track.MP3")).toBe(true);
    expect(isSupportedAudioPath("/music/notes.txt")).toBe(false);
  });

  test("maps file types to iPod values", () => {
    expect(getIpodFileType("song.mp3")).toBe(1);
    expect(getIpodFileType("podcast.m4b")).toBe(2);
    expect(getIpodFileType("spoken.aa")).toBe(2);
    expect(getIpodFileType("wave.wav")).toBe(4);
  });
});
