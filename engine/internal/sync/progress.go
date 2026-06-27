package sync

import (
	"path/filepath"
	"time"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/identity"
	"github.com/davidroman0O/ipod-shuffle/engine/internal/itunes"
)

// ProgressEvent is a single progress update emitted during sync execution.
// The `Type` field discriminates the payload shape for consumers (NDJSON stream).
type ProgressEvent struct {
	Type string `json:"type"`

	// "start" event
	TotalTracks   int `json:"totalTracks,omitempty"`
	TotalCopies   int `json:"totalCopies,omitempty"`
	TotalDeletes  int `json:"totalDeletes,omitempty"`

	// "progress" event (during copy/delete)
	Phase   string `json:"phase,omitempty"`   // "copy" | "delete" | "write-db"
	Current int    `json:"current,omitempty"` // 1-based index of the item being processed
	Total   int    `json:"total,omitempty"`   // total items in this phase
	Path    string `json:"path,omitempty"`    // the file path being processed

	// "done" event
	WrittenDatabaseBytes int              `json:"writtenDatabaseBytes,omitempty"`
	WrittenStatsBytes    int              `json:"writtenStatsBytes,omitempty"`
	Manifest             []ManifestEntry  `json:"manifest,omitempty"`
	SyncedAt             string           `json:"syncedAt,omitempty"`

	// "error" event
	Error string `json:"error,omitempty"`
}

// Progress is the callback signature the executor calls as it works.
// It receives events for start, per-file progress, and completion.
type Progress func(ev ProgressEvent)

// ExecuteWithProgress runs a sync, calling progress for each phase. It is the
// streaming variant of Execute — the caller (HTTP handler) flushes each event
// to the client as NDJSON so the browser sees live copy progress.
func ExecuteWithProgress(plan SyncPlan, fsys FS, now time.Time, progress Progress) (SyncResult, error) {
	if progress != nil {
		progress(ProgressEvent{
			Type:        "start",
			TotalTracks: len(plan.Tracks),
			TotalCopies: len(plan.CopyOps),
			TotalDeletes: len(plan.DeleteOps),
		})
	}

	// Ensure the device carries an identity file stamped with this sync time.
	// Non-fatal — the sync should still proceed even if writing fails.
	_ = identity.UpdateSync(plan.MountPath, now.UTC().Format("2006-01-02T15:04:05Z07:00"))

	if err := ensureLayout(plan.MountPath, fsys); err != nil {
		return SyncResult{}, err
	}

	// Phase: delete
	if progress != nil && len(plan.DeleteOps) > 0 {
		progress(ProgressEvent{Type: "progress", Phase: "delete", Total: len(plan.DeleteOps), Current: 0})
	}
	if err := removeFilesWithProgress(plan.MountPath, plan.DeleteOps, fsys, progress); err != nil {
		return SyncResult{}, err
	}

	// Phase: copy
	if progress != nil && len(plan.CopyOps) > 0 {
		progress(ProgressEvent{Type: "progress", Phase: "copy", Total: len(plan.CopyOps), Current: 0})
	}
	if err := copyFilesWithProgress(plan.CopyOps, fsys, progress); err != nil {
		return SyncResult{}, err
	}

	if err := pruneEmptyFolders(plan.MountPath, fsys); err != nil {
		return SyncResult{}, err
	}

	// Phase: write-db
	if progress != nil {
		progress(ProgressEvent{Type: "progress", Phase: "write-db"})
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

	result := SyncResult{
		Plan:                 plan,
		SyncedAt:             now,
		WrittenDatabaseBytes: len(sd),
		WrittenStatsBytes:    len(stats),
		Manifest:             buildManifest(plan.Tracks),
	}

	// Write the sync snapshot to the identity file so the UI can show what's
	// on the device and diff it against future syncs.
	snap := buildSnapshot(plan, now)
	_ = identity.WriteSnapshot(plan.MountPath, snap)

	if progress != nil {
		progress(ProgressEvent{
			Type:                 "done",
			WrittenDatabaseBytes: len(sd),
			WrittenStatsBytes:    len(stats),
			Manifest:             result.Manifest,
			SyncedAt:             now.UTC().Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	return result, nil
}

// buildSnapshot turns a completed SyncPlan into an identity snapshot.
func buildSnapshot(plan SyncPlan, now time.Time) identity.Snapshot {
	trackMap := make(map[string]identity.SnapshotTrack, len(plan.Tracks))
	for _, t := range plan.Tracks {
		trackMap[t.TrackID] = identity.SnapshotTrack{
			ID:         t.TrackID,
			FileName:   t.FileName,
			SourcePath: t.SourcePath,
			DevicePath: t.DatabasePath,
			SizeBytes:  t.SizeBytes,
		}
	}
	playlists := make([]identity.SnapshotPlaylist, 0, len(plan.Playlists))
	for _, p := range plan.Playlists {
		tracks := make([]identity.SnapshotTrack, 0, len(p.TrackIDs))
		for _, id := range p.TrackIDs {
			if t, ok := trackMap[id]; ok {
				tracks = append(tracks, t)
			}
		}
		playlists = append(playlists, identity.SnapshotPlaylist{
			ID:     p.PlaylistID,
			Name:   p.Name,
			Tracks: tracks,
		})
	}
	return identity.Snapshot{
		SyncedAt:    now.UTC().Format("2006-01-02T15:04:05Z07:00"),
		Playlists:   playlists,
		TotalTracks: len(plan.Tracks),
	}
}

func removeFilesWithProgress(mountPath string, relPaths []string, fsys FS, progress Progress) error {
	for i, rel := range relPaths {
		full := filepath.Join(mountPath, filepath.FromSlash(rel))
		if progress != nil {
			progress(ProgressEvent{Phase: "delete", Current: i + 1, Total: len(relPaths), Path: rel})
		}
		if err := fsys.Remove(full); err != nil && !isNotExist(err) {
			return err
		}
	}
	return nil
}

func copyFilesWithProgress(ops []CopyOp, fsys FS, progress Progress) error {
	for i, op := range ops {
		if err := fsys.MkdirAll(filepath.Dir(op.Destination), 0o755); err != nil {
			return err
		}
		if progress != nil {
			progress(ProgressEvent{Phase: "copy", Current: i + 1, Total: len(ops), Path: op.RelativePath})
		}
		if err := fsys.Copy(op.Source, op.Destination); err != nil {
			return err
		}
	}
	return nil
}
