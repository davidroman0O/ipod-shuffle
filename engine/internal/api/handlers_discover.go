package api

import (
	"net/http"
	"strings"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/discover"
)

// handleDiscover is GET /v1/discover — scans the volumes root for iPod volumes.
func (s *Server) handleDiscover(w http.ResponseWriter, r *http.Request) {
	devices, err := discover.Discover(r.Context(), s.volumesRoot, s.discoverFS, s.runner)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "discover failed: "+err.Error())
		return
	}
	if devices == nil {
		devices = []discover.Device{}
	}
	writeJSON(w, http.StatusOK, devices)
}

// handleInspect is GET /v1/devices/inspect?mount=<path>.
func (s *Server) handleInspect(w http.ResponseWriter, r *http.Request) {
	mount := strings.TrimSpace(r.URL.Query().Get("mount"))
	if mount == "" {
		writeError(w, http.StatusBadRequest, "missing 'mount' query parameter")
		return
	}
	dev, err := discover.InspectMount(r.Context(), mount, s.runner)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "inspect failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, dev)
}
