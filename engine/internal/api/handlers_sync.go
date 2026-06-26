package api

import (
	"encoding/json"
	"net/http"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/itunes"
	"github.com/davidroman0O/ipod-shuffle/engine/internal/layout"
	"github.com/davidroman0O/ipod-shuffle/engine/internal/sync"
)

// handleSync is POST /v1/sync — streaming; see handlers_sync_stream.go.
// handleSyncPlan is POST /v1/sync/plan — dry-run: report copies/skips/deletes
// without touching the device.
func (s *Server) handleSyncPlan(w http.ResponseWriter, r *http.Request) {
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
	writeJSON(w, http.StatusOK, toPlanResponse(plan))
}

// decodeSyncRequest parses and validates a SyncRequest body.
func decodeSyncRequest(w http.ResponseWriter, r *http.Request) (SyncRequest, bool) {
	var req SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return req, false
	}
	if req.MountPath == "" {
		writeError(w, http.StatusBadRequest, "mountPath is required")
		return req, false
	}
	return req, true
}

// BuildEngineModel converts API inputs to engine types, assigning on-device
// paths from the request's track order.
func BuildEngineModel(req SyncRequest) ([]itunes.Track, []itunes.Playlist) {
	tracks := make([]itunes.Track, len(req.Tracks))
	for i, t := range req.Tracks {
		rel := layout.RelativePath(i, t.FileName)
		tracks[i] = itunes.Track{
			TrackID:      t.TrackID,
			SourcePath:   t.SourcePath,
			FileName:     t.FileName,
			RelativePath: rel,
			DatabasePath: layout.DatabasePath(rel),
			SizeBytes:    t.SizeBytes,
		}
	}
	playlists := make([]itunes.Playlist, len(req.Playlists))
	for i, p := range req.Playlists {
		ids := p.TrackIDs
		if ids == nil {
			ids = []string{}
		}
		playlists[i] = itunes.Playlist{PlaylistID: p.PlaylistID, Name: p.Name, TrackIDs: ids}
	}
	return tracks, playlists
}

func toPlanResponse(plan sync.SyncPlan) PlanResponse {
	copies := make([]copyView, len(plan.CopyOps))
	for i, c := range plan.CopyOps {
		copies[i] = copyView{RelativePath: c.RelativePath, Reason: string(c.Reason)}
	}
	deletes := plan.DeleteOps
	if deletes == nil {
		deletes = []string{}
	}
	warnings := plan.Warnings
	if warnings == nil {
		warnings = []string{}
	}
	return PlanResponse{
		MountPath:  plan.MountPath,
		TrackCount: len(plan.Tracks),
		Copies:     copies,
		Skips:      len(plan.SkipOps),
		Deletes:    deletes,
		Warnings:   warnings,
	}
}
func toSyncResponse(res sync.SyncResult) SyncResponse {
	manifest := make([]manifestView, len(res.Manifest))
	for i, m := range res.Manifest {
		manifest[i] = manifestView{TrackID: m.TrackID, RelativePath: m.RelativePath, SizeBytes: m.SizeBytes}
	}
	return SyncResponse{
		SyncedAt:             res.SyncedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		WrittenDatabaseBytes: res.WrittenDatabaseBytes,
		WrittenStatsBytes:    res.WrittenStatsBytes,
		Manifest:             manifest,
		Warnings:             res.Plan.Warnings,
	}
}
