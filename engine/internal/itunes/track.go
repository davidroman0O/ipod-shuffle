package itunes

// buildTrackRecord writes a single "rths" track record (0x174 = 372 bytes).
// It mirrors buildTrackRecord in ipodDatabase.ts exactly.
func buildTrackRecord(t Track) []byte {
	w := &binaryWriter{}
	w.writeFixedUtf8("rths", 4)
	w.writeU32(0x174)
	w.writeU32(0)
	w.writeU32(0)
	w.writeU32(0)
	w.writeU32(FileTypeForExt(t.FileName))
	w.writeFixedUtf8(t.DatabasePath, 256)
	w.writeU32(0)
	w.writeU8(1)
	w.writeU8(0)
	w.writeU8(0)
	w.writeU8(0)
	w.writeU32(0x200)
	w.writeU32(0x200)
	w.writeU32(0)
	w.writeU32(0)
	w.writeU32(0)
	w.writeU32(0)
	w.writeU32(0)
	w.writeU16(1)
	w.writeU16(0)
	w.writeU64(0)
	w.writeBytes(md5First8(t.FileName))
	w.writeU32(0)
	w.writeBytes(make([]byte, 32))
	return w.bytes()
}
