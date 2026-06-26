package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/sync"
)

// handleSync is POST /v1/sync — execute a sync, streaming NDJSON progress as it
// works so the caller (the Moleculer node) can relay live copy progress. The
// sync can take minutes for large libraries over USB, so the response is a
// chunked stream (flushed per file), not a single JSON blob.
func (s *Server) handleSync(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeSyncRequest(w, r)
	if !ok {
		return
	}
	tracks, playlists := BuildEngineModel(req)

	plan, err := sync.Plan(req.MountPath, tracks, playlists, s.syncFS)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "plan failed: "+err.Error())
		return
	}

	// Set up the streaming response. NDJSON = one JSON object per line, flushed.
	flusher, _ := w.(http.Flusher)
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	result, err := sync.ExecuteWithProgress(plan, s.syncFS, s.now(), func(ev sync.ProgressEvent) {
		line, _ := json.Marshal(ev)
		fmt.Fprintf(w, "%s\n", line)
		if flusher != nil {
			flusher.Flush()
		}
	})

	if err != nil {
		// Send an error event; the stream is already 200/headers-sent.
		errEv, _ := json.Marshal(sync.ProgressEvent{Type: "error", Error: err.Error()})
		fmt.Fprintf(w, "%s\n", errEv)
		if flusher != nil {
			flusher.Flush()
		}
		return
	}

	_ = result // already sent via the "done" progress event
}
