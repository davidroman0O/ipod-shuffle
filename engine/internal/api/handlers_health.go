package api

import (
	"encoding/json"
	"net/http"
)

// writeJSON encodes v as JSON with the given status, writing a plain-text error
// on encode failure (which should not happen for our response types).
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		_, _ = w.Write([]byte(`{"error":"encode failed"}`))
	}
}

// writeError writes a standard ErrorResponse.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, ErrorResponse{Error: msg})
}

// handleHealth is GET /v1/health.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
