package sync

import (
	"path/filepath"
	"time"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/itunes"
)

// itunesDir is the on-device directory holding iTunesSD and iTunesStats.
const itunesDir = "iPod_Control/iTunes"

// Execute applies a plan: ensures the device layout, removes stale files,
// copies new/changed files, prunes empty folders, and writes the iTunesSD and
// iTunesStats databases. It mirrors syncDevice in the TS reference but receives
// an already-resolved plan (track union is a product-layer concern).
func Execute(plan SyncPlan, fsys FS) (SyncResult, error) {
	return ExecuteAt(plan, fsys, time.Now())
}

// ExecuteAt is Execute with an injectable clock, for deterministic tests.
func ExecuteAt(plan SyncPlan, fsys FS, now time.Time) (SyncResult, error) {
	if err := ensureLayout(plan.MountPath, fsys); err != nil {
		return SyncResult{}, err
	}
	if err := removeFiles(plan.MountPath, plan.DeleteOps, fsys); err != nil {
		return SyncResult{}, err
	}
	if err := copyFiles(plan.CopyOps, fsys); err != nil {
		return SyncResult{}, err
	}
	if err := pruneEmptyFolders(plan.MountPath, fsys); err != nil {
		return SyncResult{}, err
	}

	sd := itunes.BuildITunesSD(plan.Tracks, plan.Playlists)
	stats := itunes.BuildITunesStats(len(plan.Tracks))

	sdPath := filepath.Join(plan.MountPath, filepath.FromSlash(itunesDir), "iTunesSD")
	statsPath := filepath.Join(plan.MountPath, filepath.FromSlash(itunesDir), "iTunesStats")
	if err := fsys.WriteFile(sdPath, sd, 0o644); err != nil {
		return SyncResult{}, err
	}
	if err := fsys.WriteFile(statsPath, stats, 0o644); err != nil {
		return SyncResult{}, err
	}

	return SyncResult{
		Plan:                 plan,
		SyncedAt:             now,
		WrittenDatabaseBytes: len(sd),
		WrittenStatsBytes:    len(stats),
		Manifest:             buildManifest(plan.Tracks),
	}, nil
}

func ensureLayout(mountPath string, fsys FS) error {
	if err := fsys.MkdirAll(filepath.Join(mountPath, filepath.FromSlash(musicRoot)), 0o755); err != nil {
		return err
	}
	return fsys.MkdirAll(filepath.Join(mountPath, filepath.FromSlash(itunesDir)), 0o755)
}

func removeFiles(mountPath string, relPaths []string, fsys FS) error {
	for _, rel := range relPaths {
		full := filepath.Join(mountPath, filepath.FromSlash(rel))
		if err := fsys.Remove(full); err != nil && !isNotExist(err) {
			return err
		}
	}
	return nil
}

func copyFiles(ops []CopyOp, fsys FS) error {
	for _, op := range ops {
		if err := fsys.MkdirAll(filepath.Dir(op.Destination), 0o755); err != nil {
			return err
		}
		if err := fsys.Copy(op.Source, op.Destination); err != nil {
			return err
		}
	}
	return nil
}

// pruneEmptyFolders removes F## folders under the music root that have no
// remaining files after copy/delete.
func pruneEmptyFolders(mountPath string, fsys FS) error {
	root := filepath.Join(mountPath, filepath.FromSlash(musicRoot))
	entries, err := fsys.ReadDir(root)
	if err != nil {
		if isNotExist(err) {
			return nil
		}
		return err
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		folder := filepath.Join(root, e.Name())
		inner, err := fsys.ReadDir(folder)
		if err != nil {
			return err
		}
		if len(inner) == 0 {
			if err := fsys.Remove(folder); err != nil && !isNotExist(err) {
				return err
			}
		}
	}
	return nil
}

func buildManifest(tracks []itunes.Track) []ManifestEntry {
	out := make([]ManifestEntry, len(tracks))
	for i, t := range tracks {
		out[i] = ManifestEntry{TrackID: t.TrackID, RelativePath: t.RelativePath, SizeBytes: t.SizeBytes}
	}
	return out
}
