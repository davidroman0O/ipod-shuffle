package itunes

// Track is a single resolved track as the engine receives it from the caller.
// It mirrors the TypeScript PlannedTrack.
type Track struct {
	// TrackID is the caller's stable identifier for the track.
	TrackID string
	// SourcePath is the absolute host path the audio file is copied from.
	SourcePath string
	// FileName is the base name (e.g. "song.mp3"); its extension drives the
	// iTunes filetype code.
	FileName string
	// RelativePath is the on-device path under the mount root, e.g.
	// "iPod_Control/Music/F00/S00000.mp3".
	RelativePath string
	// DatabasePath is RelativePath with a leading slash, as stored in iTunesSD.
	DatabasePath string
	// SizeBytes is the file size in bytes.
	SizeBytes int64
}

// Playlist is a resolved playlist for a device sync. It mirrors the TypeScript
// PlannedPlaylist.
type Playlist struct {
	PlaylistID string
	Name       string
	// TrackIDs references Track.TrackID values. IDs not present in the track
	// set are silently dropped (see resolvePlayablePlaylists).
	TrackIDs []string
}
