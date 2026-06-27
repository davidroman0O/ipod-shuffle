// Package discover finds mounted iPod Shuffle volumes and inspects them via the
// host's disk tooling (diskutil on macOS; lsblk/udev on Linux is a future
// addition). It is the port of src/services/deviceDiscovery.ts.
//
// All filesystem and process access goes through small interfaces so the logic
// is fully unit-testable without a real device or disk.
package discover

// Device is a discovered or inspected iPod Shuffle volume. It mirrors
// DiscoveredDevice in the TS reference.
type Device struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	MountPath  string `json:"mountPath"`
	VolumeName string `json:"volumeName,omitempty"`
	VolumeUUID string `json:"volumeUuid,omitempty"`
	DeviceNode string `json:"deviceNode,omitempty"`
	MediaType  string `json:"mediaType,omitempty"`
	TotalBytes int64  `json:"totalBytes"`
	FreeBytes  int64  `json:"freeBytes"`
	// Identity is read from the device's iPod_Control/.ipod-shuffle-identity.json
	// file. When present, its ID is authoritative (survives remounts).
	Identity *DeviceIdentity `json:"identity,omitempty"`
}

// DeviceIdentity mirrors identity.File but is API-facing.
type DeviceIdentity struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Snapshot *DeviceSnapshot `json:"snapshot,omitempty"`
}

// DeviceSnapshot is the last-sync state as seen from the engine.
type DeviceSnapshot struct {
	SyncedAt    string                   `json:"syncedAt,omitempty"`
	TotalTracks int                      `json:"totalTracks,omitempty"`
	Playlists   []DeviceSnapshotPlaylist `json:"playlists,omitempty"`
}

type DeviceSnapshotPlaylist struct {
	ID     string                 `json:"id"`
	Name   string                 `json:"name"`
	Tracks []DeviceSnapshotTrack  `json:"tracks"`
}

type DeviceSnapshotTrack struct {
	ID         string `json:"id"`
	FileName   string `json:"fileName"`
	SourcePath string `json:"sourcePath"`
	DevicePath string `json:"devicePath"`
	SizeBytes  int64  `json:"sizeBytes"`
}
