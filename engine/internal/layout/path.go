// Package layout assigns on-device file paths for synced tracks. It is the
// port of the allocation logic in src/services/syncPlanner.ts (TRACKS_PER_FOLDER
// and allocateRelativePath) plus the portable-path helpers.
//
// The iPod Shuffle expects audio under iPod_Control/Music/F##/S#####.<ext>,
// with at most 128 files per folder. File names are generated deterministically
// (S + 5-digit index) so re-syncs are stable.
package layout

import "strings"

// TracksPerFolder is the maximum number of audio files placed in each F## folder.
const TracksPerFolder = 128

// MusicDir is the on-device directory holding the F## folders.
const MusicDir = "iPod_Control/Music"

// ToPortablePath converts an OS-specific path (which may use the platform
// separator) to a forward-slash portable path. On Unix this is the identity.
func ToPortablePath(p string) string {
	return strings.ReplaceAll(p, "\\", "/")
}

// RelativePath builds the on-device path for the track at the given index,
// e.g. index 0 → "iPod_Control/Music/F00/S00000.mp3". Mirrors
// allocateRelativePath in syncPlanner.ts.
func RelativePath(index int, fileName string) string {
	folder := pad2(index / TracksPerFolder)
	ext := extension(fileName)
	name := "S" + pad5(index) + strings.ToLower(ext)
	return MusicDir + "/F" + folder + "/" + name
}

// DatabasePath is the path as stored inside iTunesSD: the relative path with a
// leading slash. Mirrors the databasePath derivation in buildPlannedTracks.
func DatabasePath(relativePath string) string {
	return "/" + ToPortablePath(relativePath)
}

// extension returns ".ext" for fileName (lower-cased by the caller via the name
// generator), or "" if it has no extension. Mirrors the inline extension
// extraction in allocateRelativePath.
func extension(fileName string) string {
	dot := strings.LastIndex(fileName, ".")
	if dot == -1 {
		return ""
	}
	return fileName[dot:]
}

func pad2(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func pad5(n int) string {
	s := itoa(n)
	for len(s) < 5 {
		s = "0" + s
	}
	return s
}

// itoa is a tiny allocator-free int→string for the hot path. path.Itoa would
// also be fine; this keeps the package dependency-free.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
