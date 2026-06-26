function writeU32(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

export function buildITunesStats(trackCount: number): Uint8Array {
  const buffer = new Uint8Array(8 + trackCount * 32);
  writeU32(buffer, 0, trackCount);
  writeU32(buffer, 4, 0);

  for (let index = 0; index < trackCount; index += 1) {
    writeU32(buffer, 8 + index * 32, 32);
  }

  return buffer;
}
