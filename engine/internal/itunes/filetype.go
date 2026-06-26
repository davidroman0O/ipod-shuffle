package itunes

import (
	"strings"
)

// File type codes stored in each iTunesSD track record.
const (
	FileTypeMP3 = 1 // .mp3 (and anything not AAC-like or WAV)
	FileTypeAAC = 2 // .m4a .m4b .m4p .aa
	FileTypeWAV = 4 // .wav
)

var aacLikeExtensions = map[string]bool{
	".m4a": true,
	".m4b": true,
	".m4p": true,
	".aa":  true,
}

// FileTypeForExt maps a path or extension to the iTunesSD filetype code.
// It mirrors the TypeScript getIpodFileType.
func FileTypeForExt(pathOrExt string) uint32 {
	ext := normalizeExt(pathOrExt)
	if ext == ".wav" {
		return FileTypeWAV
	}
	if aacLikeExtensions[ext] {
		return FileTypeAAC
	}
	return FileTypeMP3
}

// normalizeExt lowercases the extension including the leading dot. If the
// input has no dot it is treated as already an extension. Mirrors
// normalizeAudioExtension from the TS reference.
func normalizeExt(pathOrExt string) string {
	idx := strings.LastIndex(pathOrExt, ".")
	if idx == -1 {
		return strings.ToLower(pathOrExt)
	}
	return strings.ToLower(pathOrExt[idx:])
}
