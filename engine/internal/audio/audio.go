// Package audio classifies audio file paths by extension. It is the port of
// src/domain/audio.ts (minus the filetype mapping, which lives in the itunes
// package since it is iTunes-specific knowledge).
package audio

import "strings"

// SupportedExtensions are the audio extensions the iPod Shuffle accepts.
var SupportedExtensions = []string{".mp3", ".m4a", ".m4b", ".m4p", ".aa", ".wav"}

var supportedSet = func() map[string]bool {
	m := make(map[string]bool, len(SupportedExtensions))
	for _, e := range SupportedExtensions {
		m[e] = true
	}
	return m
}()

// NormalizeExtension lowercases the extension including the leading dot. If the
// input has no dot it is treated as already an extension. Mirrors
// normalizeAudioExtension.
func NormalizeExtension(pathOrExt string) string {
	idx := strings.LastIndex(pathOrExt, ".")
	if idx == -1 {
		return strings.ToLower(pathOrExt)
	}
	return strings.ToLower(pathOrExt[idx:])
}

// IsSupported reports whether path has a supported audio extension.
func IsSupported(path string) bool {
	return supportedSet[NormalizeExtension(path)]
}
