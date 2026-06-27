// Package identity reads and writes a small JSON file on the device that gives
// it a stable, user-chosen identity — surviving remounts, mount-path shifts,
// and moves between machines. The file lives at
// iPod_Control/.ipod-shuffle-identity.json.
//
// The file also stores a snapshot of the last successful sync: the playlists,
// their tracks with source + on-device paths and sizes. This lets the UI show
// exactly what's on the device and diff it against what would sync.
package identity

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// SnapshotTrack is a single track as it was written to the device during the
// last sync.
type SnapshotTrack struct {
	ID         string `json:"id"`
	FileName   string `json:"fileName"`
	SourcePath string `json:"sourcePath"`
	DevicePath string `json:"devicePath"`
	SizeBytes  int64  `json:"sizeBytes"`
}

// SnapshotPlaylist is a playlist as it was synced to the device.
type SnapshotPlaylist struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Tracks   []SnapshotTrack `json:"tracks"`
}

// Snapshot is the complete state of the last successful sync — the source of
// truth for "what's on this device right now".
type Snapshot struct {
	SyncedAt     string            `json:"syncedAt"`
	Playlists    []SnapshotPlaylist `json:"playlists"`
	TotalTracks  int               `json:"totalTracks"`
}

// File is the on-disk identity document.
type File struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	CreatedAt  string    `json:"createdAt,omitempty"`
	LastSyncAt string    `json:"lastSyncAt,omitempty"`
	Snapshot   *Snapshot `json:"snapshot,omitempty"`
}

// Dir is the device directory holding the identity file.
const Dir = "iPod_Control"

// FileName is the identity file name (hidden).
const FileName = ".ipod-shuffle-identity.json"

// Path returns the absolute path to the identity file on a mounted device.
func Path(mountPath string) string {
	return filepath.Join(mountPath, Dir, FileName)
}

// Read loads the identity file from a mounted device. Returns nil (no error)
// when the file is absent — callers treat that as "unnamed device".
func Read(mountPath string) (*File, error) {
	data, err := os.ReadFile(Path(mountPath))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var f File
	if err := json.Unmarshal(data, &f); err != nil {
		// Corrupt file — treat as absent so the caller can regenerate.
		return nil, nil
	}
	if f.ID == "" {
		return nil, nil
	}
	return &f, nil
}

// Write writes the identity file to the device, creating the iPod_Control dir
// if needed.
func Write(mountPath string, f File) error {
	dir := filepath.Join(mountPath, Dir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(Path(mountPath), append(data, '\n'), 0o644)
}

// WriteSnapshot writes a complete sync snapshot to the identity file, preserving
// the existing id/name/createdAt. Called at sync completion.
func WriteSnapshot(mountPath string, snap Snapshot) error {
	f, err := Read(mountPath)
	if err != nil {
		return err
	}
	if f == nil {
		// No identity file yet — create a minimal one (the node will fill the
		// id/name via setIdentity on the next rename or discover).
		return nil
	}
	f.Snapshot = &snap
	f.LastSyncAt = snap.SyncedAt
	return Write(mountPath, *f)
}

// UpdateSync stamps lastSyncAt on an existing identity (no-op if absent).
func UpdateSync(mountPath, syncedAt string) error {
	f, err := Read(mountPath)
	if err != nil || f == nil {
		return err
	}
	f.LastSyncAt = syncedAt
	return Write(mountPath, *f)
}
