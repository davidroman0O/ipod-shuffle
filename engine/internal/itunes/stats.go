package itunes

import "encoding/binary"

// BuildITunesStats writes the iTunesStats file: a u32 entry count, a u32 zero,
// then one 32-byte entry per track whose first u32 is 32 (the entry size).
// Mirrors buildITunesStats in ipodStats.ts.
func BuildITunesStats(trackCount int) []byte {
	buf := make([]byte, 8+trackCount*32)
	binary.LittleEndian.PutUint32(buf[0:4], uint32(trackCount))
	binary.LittleEndian.PutUint32(buf[4:8], 0)
	for i := 0; i < trackCount; i++ {
		off := 8 + i*32
		binary.LittleEndian.PutUint32(buf[off:off+4], 32)
	}
	return buf
}
