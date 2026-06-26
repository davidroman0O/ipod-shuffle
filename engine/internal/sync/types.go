package sync

import (
	"time"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/itunes"
)

// CopyReason explains why a track must be copied rather than skipped.
type CopyReason string

const (
	ReasonMissing      CopyReason = "missing"       // destination absent
	ReasonSizeMismatch CopyReason = "size-mismatch" // destination present but wrong size
)

// CopyOp is a file that must be copied from Source to Destination.
type CopyOp struct {
	Source       string
	Destination  string
	RelativePath string
	Reason       CopyReason
}

// SkipOp is a file already present with the correct size.
type SkipOp struct {
	Source       string
	Destination  string
	RelativePath string
}

// ManifestEntry records a track as written to the device.
type ManifestEntry struct {
	TrackID      string `json:"trackId"`
	RelativePath string `json:"relativePath"`
	SizeBytes    int64  `json:"sizeBytes"`
}

// SyncPlan is the dry-run result of comparing the desired track/playlist set
// with the current on-device state. It mirrors SyncPlan in the TS reference.
type SyncPlan struct {
	MountPath   string
	Tracks      []itunes.Track
	Playlists   []itunes.Playlist
	CopyOps     []CopyOp
	SkipOps     []SkipOp
	DeleteOps   []string // relative paths to remove
	Warnings    []string
}

// SyncResult is the outcome of executing a SyncPlan. It mirrors SyncResult.
type SyncResult struct {
	Plan                 SyncPlan
	SyncedAt             time.Time
	WrittenDatabaseBytes int
	WrittenStatsBytes    int
	Manifest             []ManifestEntry
}
