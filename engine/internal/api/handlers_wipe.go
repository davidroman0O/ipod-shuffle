package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/identity"
	"github.com/davidroman0O/ipod-shuffle/engine/internal/itunes"
	"github.com/davidroman0O/ipod-shuffle/engine/internal/sync"
)

// WipeRequest is the body for POST /v1/devices/wipe.
type WipeRequest struct {
	MountPath string `json:"mountPath"`
}

// handleWipe is POST /v1/devices/wipe — erases all audio from the device:
// writes empty iTunesSD + iTunesStats, deletes all files under Music/, prunes
// empty folders, and clears the identity snapshot. The device identity (id +
// name) survives so the device keeps its name.
func (s *Server) handleWipe(w http.ResponseWriter, r *http.Request) {
	var req WipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}
	if req.MountPath == "" {
		writeError(w, http.StatusBadRequest, "mountPath is required")
		return
	}

	fsys := s.syncFS
	mount := req.MountPath
	musicDir := filepath.Join(mount, sync.MusicDirPath())
	itunesDir := filepath.Join(mount, "iPod_Control", "iTunes")

	// 1. Write empty databases FIRST so a crash mid-wipe leaves the device in a
	//    valid-but-empty state, not pointing at deleted files.
	emptySD := itunes.BuildITunesSD(nil, nil)
	emptyStats := itunes.BuildITunesStats(0)
	if err := fsys.MkdirAll(itunesDir, 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "mkdir iTunes: "+err.Error())
		return
	}
	if err := fsys.WriteFile(filepath.Join(itunesDir, "iTunesSD"), emptySD, 0o644); err != nil {
		writeError(w, http.StatusInternalServerError, "write iTunesSD: "+err.Error())
		return
	}
	if err := fsys.WriteFile(filepath.Join(itunesDir, "iTunesStats"), emptyStats, 0o644); err != nil {
		writeError(w, http.StatusInternalServerError, "write iTunesStats: "+err.Error())
		return
	}

	// 2. Delete all audio files under iPod_Control/Music/F##/
	deleted := 0
	_ = filepath.WalkDir(musicDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable
		}
		if !d.IsDir() {
			if e := fsys.Remove(path); e == nil {
				deleted++
			}
		}
		return nil
	})

	// 3. Prune empty F## folders.
	entries, _ := os.ReadDir(musicDir)
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		folder := filepath.Join(musicDir, e.Name())
		inner, err := os.ReadDir(folder)
		if err == nil && len(inner) == 0 {
			_ = fsys.Remove(folder)
		}
	}

	// 4. Clear the identity snapshot (keep id + name so the device keeps its identity).
	if f, _ := identity.Read(mount); f != nil {
		f.Snapshot = nil
		f.LastSyncAt = ""
		_ = identity.Write(mount, *f)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"wiped":       true,
		"deletedFiles": deleted,
	})
	_ = fmt.Sprintf("wiped %d files from %s", deleted, mount)
}
