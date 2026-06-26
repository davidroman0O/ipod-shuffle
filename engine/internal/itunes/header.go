package itunes

// buildTrackHeader writes the "hths" track header: a preamble followed by one
// u32 absolute offset per track record, then the records themselves.
//
// Offsets are absolute from the start of the iTunesSD file: the bdhs header is
// 64 bytes (base), then this header's own preamble (20 + 4*count), then the
// records. Mirrors buildTrackHeader in ipodDatabase.ts.
func buildTrackHeader(trackRecords [][]byte) []byte {
	w := &binaryWriter{}
	w.writeFixedUtf8("hths", 4)
	w.writeU32(uint32(20 + len(trackRecords)*4))
	w.writeU32(uint32(len(trackRecords)))
	w.writeU64(0)

	currentOffset := uint32(20 + len(trackRecords)*4)
	for _, rec := range trackRecords {
		w.writeU32(64 + currentOffset)
		currentOffset += uint32(len(rec))
	}

	for _, rec := range trackRecords {
		w.writeBytes(rec)
	}
	return w.bytes()
}
