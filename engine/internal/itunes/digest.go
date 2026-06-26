package itunes

import (
	"crypto/md5"
)

// md5First8 returns the first 8 bytes of the MD5 digest of text (UTF-8). It
// mirrors the TypeScript md5Bytes helper used to derive stable playlist IDs.
func md5First8(text string) []byte {
	sum := md5.Sum([]byte(text))
	return sum[:8]
}
