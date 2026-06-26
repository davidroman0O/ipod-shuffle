package api

// SyncRequest is the body for POST /v1/sync and /v1/sync/plan. The caller
// supplies tracks in the desired device order; the engine assigns on-device
// paths (F##/S#####) from that order, so callers never need to know the layout.
type SyncRequest struct {
	MountPath string         `json:"mountPath"`
	Tracks    []TrackInput   `json:"tracks"`
	Playlists []PlaylistInput `json:"playlists"`
}

// TrackInput is a track the caller wants on the device.
type TrackInput struct {
	TrackID    string `json:"trackId"`
	SourcePath string `json:"sourcePath"`
	FileName   string `json:"fileName"`
	SizeBytes  int64  `json:"sizeBytes"`
}

// PlaylistInput is a named playlist referencing TrackInput.TrackID values.
type PlaylistInput struct {
	PlaylistID string   `json:"playlistId"`
	Name       string   `json:"name"`
	TrackIDs   []string `json:"trackIds"`
}

// PlanResponse is the dry-run result for POST /v1/sync/plan.
type PlanResponse struct {
	MountPath  string             `json:"mountPath"`
	TrackCount int                `json:"trackCount"`
	Copies     []copyView         `json:"copies"`
	Skips      int                `json:"skips"`
	Deletes    []string           `json:"deletes"`
	Warnings   []string           `json:"warnings"`
}

type copyView struct {
	RelativePath string `json:"relativePath"`
	Reason       string `json:"reason"`
}

// SyncResponse is the executed-sync result for POST /v1/sync.
type SyncResponse struct {
	SyncedAt            string          `json:"syncedAt"`
	WrittenDatabaseBytes int            `json:"writtenDatabaseBytes"`
	WrittenStatsBytes   int             `json:"writtenStatsBytes"`
	Manifest            []manifestView  `json:"manifest"`
	Warnings            []string        `json:"warnings"`
}

type manifestView struct {
	TrackID      string `json:"trackId"`
	RelativePath string `json:"relativePath"`
	SizeBytes    int64  `json:"sizeBytes"`
}

// ErrorResponse is the standard error envelope.
type ErrorResponse struct {
	Error string `json:"error"`
}
