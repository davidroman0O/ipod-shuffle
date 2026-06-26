package itunes

// playlistType is the per-playlist type code stored in the "lphs" record.
const (
	// playlistTypeMaster is the implicit "All Songs" master list; its id field
	// is eight zero bytes rather than an MD5 digest.
	playlistTypeMaster uint32 = 1
	// playlistTypeNamed is a user-defined playlist; its id field is the first 8
	// bytes of MD5(name).
	playlistTypeNamed uint32 = 2
)

// resolvedPlaylist is a named playlist whose track IDs have been mapped to
// concrete track indexes. Playlists that resolve to zero tracks are dropped
// before reaching this type.
type resolvedPlaylist struct {
	name         string
	trackIndexes []uint32
}

// buildPlaylistRecord writes a single "lphs" playlist record. Mirrors
// buildPlaylistRecord in ipodDatabase.ts.
func buildPlaylistRecord(name string, trackIndexes []uint32, ptype uint32) []byte {
	w := &binaryWriter{}
	w.writeFixedUtf8("lphs", 4)
	w.writeU32(uint32(44 + len(trackIndexes)*4))
	w.writeU32(uint32(len(trackIndexes)))
	w.writeU32(uint32(len(trackIndexes)))
	if ptype == playlistTypeMaster {
		w.writeBytes(make([]byte, 8))
	} else {
		w.writeBytes(md5First8(name))
	}
	w.writeU32(ptype)
	w.writeBytes(make([]byte, 16))
	for _, idx := range trackIndexes {
		w.writeU32(idx)
	}
	return w.bytes()
}

// resolvePlayablePlaylists maps each playlist's track IDs to concrete track
// indexes via trackIndexByID and drops any playlist that resolves to zero
// tracks. Mirrors resolvePlayablePlaylists in ipodDatabase.ts.
func resolvePlayablePlaylists(playlists []Playlist, trackIndexByID map[string]uint32) []resolvedPlaylist {
	out := make([]resolvedPlaylist, 0, len(playlists))
	for _, p := range playlists {
		indexes := make([]uint32, 0, len(p.TrackIDs))
		for _, id := range p.TrackIDs {
			if idx, ok := trackIndexByID[id]; ok {
				indexes = append(indexes, idx)
			}
		}
		if len(indexes) == 0 {
			continue
		}
		out = append(out, resolvedPlaylist{name: p.Name, trackIndexes: indexes})
	}
	return out
}

// buildPlaylistHeader writes the "hphs" playlist header: the implicit master
// "All Songs" list followed by each resolved named playlist. baseOffset is the
// absolute byte offset where this header begins in the iTunesSD file.
// Mirrors buildPlaylistHeader in ipodDatabase.ts.
func buildPlaylistHeader(trackCount int, resolved []resolvedPlaylist, baseOffset uint32) []byte {
	chunks := make([][]byte, 0, 1+len(resolved))

	masterIndexes := make([]uint32, trackCount)
	for i := 0; i < trackCount; i++ {
		masterIndexes[i] = uint32(i)
	}
	chunks = append(chunks, buildPlaylistRecord("All Songs", masterIndexes, playlistTypeMaster))

	for _, p := range resolved {
		chunks = append(chunks, buildPlaylistRecord(p.name, p.trackIndexes, playlistTypeNamed))
	}

	w := &binaryWriter{}
	w.writeFixedUtf8("hphs", 4)
	w.writeU32(uint32(20 + len(chunks)*4))
	w.writeU32(uint32(len(chunks)))
	w.writeU16(0xffff)
	w.writeU16(0x0001)
	w.writeU16(0xffff)
	w.writeU16(0x0000)

	currentOffset := uint32(20 + len(chunks)*4)
	for _, c := range chunks {
		w.writeU32(baseOffset + currentOffset)
		currentOffset += uint32(len(c))
	}
	for _, c := range chunks {
		w.writeBytes(c)
	}
	return w.bytes()
}
