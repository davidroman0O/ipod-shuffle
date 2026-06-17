import { createHash } from "node:crypto";

import { getIpodFileType } from "../domain/audio.ts";
import type { PlannedPlaylist, PlannedTrack } from "../domain/model.ts";

class BinaryWriter {
  private readonly chunks: number[] = [];

  writeU8(value: number): void {
    this.chunks.push(value & 0xff);
  }

  writeU16(value: number): void {
    this.chunks.push(value & 0xff, (value >>> 8) & 0xff);
  }

  writeU32(value: number): void {
    this.chunks.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
  }

  writeU64(value: number): void {
    this.writeU32(value & 0xffffffff);
    this.writeU32(Math.floor(value / 0x1_0000_0000));
  }

  writeBytes(values: Uint8Array): void {
    for (const value of values) {
      this.chunks.push(value);
    }
  }

  writeFixedUtf8(text: string, length: number): void {
    const encoded = new TextEncoder().encode(text);
    const truncated = encoded.slice(0, length);
    this.writeBytes(truncated);
    for (let index = truncated.length; index < length; index += 1) {
      this.writeU8(0);
    }
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

function md5Bytes(text: string): Uint8Array {
  return createHash("md5").update(text, "utf8").digest().subarray(0, 8);
}

function buildTrackRecord(track: PlannedTrack): Uint8Array {
  const writer = new BinaryWriter();
  writer.writeFixedUtf8("rths", 4);
  writer.writeU32(0x174);
  writer.writeU32(0);
  writer.writeU32(0);
  writer.writeU32(0);
  writer.writeU32(getIpodFileType(track.fileName));
  writer.writeFixedUtf8(track.databasePath, 256);
  writer.writeU32(0);
  writer.writeU8(1);
  writer.writeU8(0);
  writer.writeU8(0);
  writer.writeU8(0);
  writer.writeU32(0x200);
  writer.writeU32(0x200);
  writer.writeU32(0);
  writer.writeU32(0);
  writer.writeU32(0);
  writer.writeU32(0);
  writer.writeU32(0);
  writer.writeU16(1);
  writer.writeU16(0);
  writer.writeU64(0);
  writer.writeBytes(md5Bytes(track.fileName));
  writer.writeU32(0);
  writer.writeBytes(new Uint8Array(32));
  return writer.toUint8Array();
}

function buildTrackHeader(trackRecords: Uint8Array[]): Uint8Array {
  const writer = new BinaryWriter();
  writer.writeFixedUtf8("hths", 4);
  writer.writeU32(20 + trackRecords.length * 4);
  writer.writeU32(trackRecords.length);
  writer.writeU64(0);

  let currentOffset = 20 + trackRecords.length * 4;
  for (const trackRecord of trackRecords) {
    writer.writeU32(64 + currentOffset);
    currentOffset += trackRecord.length;
  }

  for (const trackRecord of trackRecords) {
    writer.writeBytes(trackRecord);
  }

  return writer.toUint8Array();
}

function buildPlaylistRecord(name: string, trackIndexes: number[], type: 1 | 2): Uint8Array {
  const writer = new BinaryWriter();
  writer.writeFixedUtf8("lphs", 4);
  writer.writeU32(44 + trackIndexes.length * 4);
  writer.writeU32(trackIndexes.length);
  writer.writeU32(trackIndexes.length);
  writer.writeBytes(type === 1 ? new Uint8Array(8) : md5Bytes(name));
  writer.writeU32(type);
  writer.writeBytes(new Uint8Array(16));

  for (const trackIndex of trackIndexes) {
    writer.writeU32(trackIndex);
  }

  return writer.toUint8Array();
}

function resolvePlayablePlaylists(playlists: PlannedPlaylist[], trackIndexById: Map<string, number>) {
  return playlists
    .map((playlist) => ({
      name: playlist.name,
      trackIndexes: playlist.trackIds
        .map((trackId) => trackIndexById.get(trackId))
        .filter((trackIndex): trackIndex is number => typeof trackIndex === "number"),
    }))
    .filter((playlist) => playlist.trackIndexes.length > 0);
}

function buildPlaylistHeader(
  trackCount: number,
  resolvedPlaylists: Array<{ name: string; trackIndexes: number[] }>,
  baseOffset: number,
) {
  const playlistChunks: Uint8Array[] = [];
  const masterTrackIndexes = Array.from({ length: trackCount }, (_, index) => index);
  playlistChunks.push(buildPlaylistRecord("All Songs", masterTrackIndexes, 1));

  for (const playlist of resolvedPlaylists) {
    playlistChunks.push(buildPlaylistRecord(playlist.name, playlist.trackIndexes, 2));
  }

  const writer = new BinaryWriter();
  writer.writeFixedUtf8("hphs", 4);
  writer.writeU32(20 + playlistChunks.length * 4);
  writer.writeU32(playlistChunks.length);
  writer.writeU16(0xffff);
  writer.writeU16(0x0001);
  writer.writeU16(0xffff);
  writer.writeU16(0x0000);

  let currentOffset = 20 + playlistChunks.length * 4;
  for (const chunk of playlistChunks) {
    writer.writeU32(baseOffset + currentOffset);
    currentOffset += chunk.length;
  }

  for (const chunk of playlistChunks) {
    writer.writeBytes(chunk);
  }

  return writer.toUint8Array();
}

function buildEmptyDatabase(): Uint8Array {
  return Uint8Array.from([
    0x62, 0x64, 0x68, 0x73,
    0x01, 0x00, 0x01, 0x02,
    0x40, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x40, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x68, 0x70, 0x68, 0x73,
    0x44, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0xff, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x00,
    0xff, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x00,
    0xff, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x00,
    0xff, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x00,
    0xff, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

export function buildITunesSD(tracks: PlannedTrack[], playlists: PlannedPlaylist[]): Uint8Array {
  if (tracks.length === 0) {
    return buildEmptyDatabase();
  }

  const trackRecords = tracks.map(buildTrackRecord);
  const trackHeader = buildTrackHeader(trackRecords);
  const trackIndexById = new Map(tracks.map((track, index) => [track.trackId, index]));
  const resolvedPlaylists = resolvePlayablePlaylists(playlists, trackIndexById);
  const playlistHeader = buildPlaylistHeader(tracks.length, resolvedPlaylists, 64 + trackHeader.length);

  const writer = new BinaryWriter();
  writer.writeFixedUtf8("bdhs", 4);
  writer.writeU32(0x02000003);
  writer.writeU32(64);
  writer.writeU32(tracks.length);
  writer.writeU32(resolvedPlaylists.length + 1);
  writer.writeU64(0);
  writer.writeU8(0);
  writer.writeU8(0);
  writer.writeU16(0);
  writer.writeU32(tracks.length);
  writer.writeU32(64);
  writer.writeU32(64 + trackHeader.length);
  writer.writeBytes(new Uint8Array(20));
  writer.writeBytes(trackHeader);
  writer.writeBytes(playlistHeader);

  return writer.toUint8Array();
}
