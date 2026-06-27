package api

import (
	"encoding/json"
	"net/http"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/identity"
)

// SetIdentityRequest is the body for POST /v1/devices/identity.
type SetIdentityRequest struct {
	MountPath string `json:"mountPath"`
	Name      string `json:"name"`
	ID        string `json:"id"` // optional — generated if absent
}

// handleSetIdentity is POST /v1/devices/identity — writes/updates the identity
// file on the device so it carries a stable id + chosen name.
func (s *Server) handleSetIdentity(w http.ResponseWriter, r *http.Request) {
	var req SetIdentityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}
	if req.MountPath == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "mountPath and name are required")
		return
	}

	// If writing for the first time and no id given, preserve an existing one or
	// leave it empty so the node (which knows the DB record id) can supply it.
	existing, _ := identity.Read(req.MountPath)
	id := req.ID
	if id == "" && existing != nil {
		id = existing.ID
	}
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required for a new identity")
		return
	}

	createdAt := ""
	if existing != nil {
		createdAt = existing.CreatedAt
	}
	f := identity.File{ID: id, Name: req.Name, CreatedAt: createdAt}
	if existing != nil {
		f.LastSyncAt = existing.LastSyncAt
	}
	if createdAt == "" {
		f.CreatedAt = s.now().UTC().Format("2006-01-02T15:04:05Z07:00")
	}

	if err := identity.Write(req.MountPath, f); err != nil {
		writeError(w, http.StatusInternalServerError, "write identity failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": f.ID, "name": f.Name})
}
