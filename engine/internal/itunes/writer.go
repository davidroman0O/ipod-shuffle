package itunes

import (
	"encoding/binary"
)

// binaryWriter appends little-endian unsigned integers and fixed-width UTF-8
// strings to an internal byte slice. It is the direct port of the TypeScript
// BinaryWriter class. All multi-byte values are little-endian, which is what
// the iPod Shuffle expects on disk.
type binaryWriter struct {
	buf []byte
}

func (w *binaryWriter) writeU8(v uint8) { w.buf = append(w.buf, v) }

func (w *binaryWriter) writeU16(v uint16) {
	var b [2]byte
	binary.LittleEndian.PutUint16(b[:], v)
	w.buf = append(w.buf, b[:]...)
}

func (w *binaryWriter) writeU32(v uint32) {
	var b [4]byte
	binary.LittleEndian.PutUint32(b[:], v)
	w.buf = append(w.buf, b[:]...)
}

func (w *binaryWriter) writeU64(v uint64) {
	var b [8]byte
	binary.LittleEndian.PutUint64(b[:], v)
	w.buf = append(w.buf, b[:]...)
}

func (w *binaryWriter) writeBytes(b []byte) { w.buf = append(w.buf, b...) }

// writeFixedUtf8 encodes text as UTF-8, truncates to length bytes, and
// zero-pads the remainder. Mirrors BinaryWriter.writeFixedUtf8.
func (w *binaryWriter) writeFixedUtf8(text string, length int) {
	encoded := []byte(text)
	if len(encoded) > length {
		encoded = encoded[:length]
	}
	w.buf = append(w.buf, encoded...)
	for i := len(encoded); i < length; i++ {
		w.buf = append(w.buf, 0)
	}
}

func (w *binaryWriter) bytes() []byte { return w.buf }
