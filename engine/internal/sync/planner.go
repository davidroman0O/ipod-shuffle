package sync

import (
	"path/filepath"
	"sort"
	"strings"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/audio"
	"github.com/davidroman0O/ipod-shuffle/engine/internal/itunes"
)

// musicRoot is the on-device directory holding the F## folders, relative to the
// mount root.
const musicRoot = "iPod_Control/Music"

// MusicDirPath returns the on-device music directory (relative to the mount).
func MusicDirPath() string { return musicRoot }

// Plan computes the set of copy/skip/delete operations needed to make the
// device at mountPath match the given tracks and playlists. It performs no
// writes. Mirrors planDeviceSync + computeFileActions in the TS reference.
func Plan(mountPath string, tracks []itunes.Track, playlists []itunes.Playlist, fsys FS) (SyncPlan, error) {
	abs := filepath.Clean(mountPath)
	plan := SyncPlan{MountPath: abs, Tracks: tracks, Playlists: playlists}

	if len(tracks) == 0 {
		plan.Warnings = append(plan.Warnings, "No existing audio files are currently eligible for sync.")
	}

	copyOps, skipOps, err := computeFileActions(abs, tracks, fsys)
	if err != nil {
		return plan, err
	}
	plan.CopyOps = copyOps
	plan.SkipOps = skipOps

	deleteOps, err := computeDeletions(abs, tracks, fsys)
	if err != nil {
		return plan, err
	}
	plan.DeleteOps = deleteOps

	plan.Warnings = append(plan.Warnings, emptyPlaylistWarnings(tracks, playlists)...)

	return plan, nil
}

// computeFileActions classifies each track as a copy or skip by comparing the
// destination size to the source size.
func computeFileActions(mountPath string, tracks []itunes.Track, fsys FS) ([]CopyOp, []SkipOp, error) {
	var copies []CopyOp
	var skips []SkipOp
	for _, t := range tracks {
		dst := filepath.Join(mountPath, filepath.FromSlash(t.RelativePath))
		info, err := fsys.Stat(dst)
		if err == nil {
			if info.Size() == t.SizeBytes {
				skips = append(skips, SkipOp{Source: t.SourcePath, Destination: dst, RelativePath: t.RelativePath})
				continue
			}
			copies = append(copies, CopyOp{Source: t.SourcePath, Destination: dst, RelativePath: t.RelativePath, Reason: ReasonSizeMismatch})
			continue
		}
		if !isNotExist(err) {
			return nil, nil, err
		}
		copies = append(copies, CopyOp{Source: t.SourcePath, Destination: dst, RelativePath: t.RelativePath, Reason: ReasonMissing})
	}
	return copies, skips, nil
}

// computeDeletions walks the device music tree and reports existing audio files
// not in the planned set.
func computeDeletions(mountPath string, tracks []itunes.Track, fsys FS) ([]string, error) {
	planned := make(map[string]bool, len(tracks))
	for _, t := range tracks {
		planned[t.RelativePath] = true
	}

	existing, err := collectExistingAudio(mountPath, fsys)
	if err != nil {
		return nil, err
	}

	var deletes []string
	for _, rel := range existing {
		if !planned[rel] {
			deletes = append(deletes, rel)
		}
	}
	sort.Strings(deletes)
	return deletes, nil
}

// collectExistingAudio walks iPod_Control/Music under mountPath and returns the
// portable (forward-slash) relative paths of supported audio files.
func collectExistingAudio(mountPath string, fsys FS) ([]string, error) {
	root := filepath.Join(mountPath, musicRoot)
	var rels []string
	err := walk(root, fsys, func(fullPath string) {
		rel := filepath.ToSlash(relFromRoot(mountPath, fullPath))
		if audio.IsSupported(rel) {
			rels = append(rels, rel)
		}
	})
	if err != nil {
		if isNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	return rels, nil
}

// walk recursively visits regular files under root, calling fn for each.
func walk(root string, fsys FS, fn func(fullPath string)) error {
	entries, err := fsys.ReadDir(root)
	if err != nil {
		return err
	}
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		full := filepath.Join(root, name)
		if e.IsDir() {
			if err := walk(full, fsys, fn); err != nil {
				return err
			}
			continue
		}
		if e.Type().IsRegular() {
			fn(full)
		}
	}
	return nil
}

// relFromRoot computes the path of fullPath relative to base, in OS-native form.
func relFromRoot(base, fullPath string) string {
	rel, err := filepath.Rel(base, fullPath)
	if err != nil {
		return fullPath
	}
	return rel
}

// emptyPlaylistWarnings emits a warning for each named playlist whose tracks
// are all absent from the planned set (i.e. would be skipped on the device).
func emptyPlaylistWarnings(tracks []itunes.Track, playlists []itunes.Playlist) []string {
	present := make(map[string]bool, len(tracks))
	for _, t := range tracks {
		present[t.TrackID] = true
	}
	var warnings []string
	for _, p := range playlists {
		if p.Name == "" || p.Name == "All Songs" {
			continue
		}
		any := false
		for _, id := range p.TrackIDs {
			if present[id] {
				any = true
				break
			}
		}
		if !any {
			warnings = append(warnings, "Playlist "+quote(p.Name)+" has no existing tracks and will be skipped on the device.")
		}
	}
	return warnings
}

func quote(s string) string { return "\"" + s + "\"" }
