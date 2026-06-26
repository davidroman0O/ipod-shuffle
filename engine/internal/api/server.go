// Package api exposes the engine over a small stateless HTTP/JSON API. The
// server is the sole surface the Moleculer product layer calls; it holds no
// product state and takes fully-resolved track/playlist sets per request.
//
// All device I/O flows through injected filesystem and command-runner seams so
// handlers are unit-testable without a real device.
package api

import (
	"net/http"
	"time"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/discover"
	"github.com/davidroman0O/ipod-shuffle/engine/internal/sync"
)

// Server wires the engine's discover + sync capabilities behind HTTP handlers.
// It has no mutable state of its own; every request is resolved independently.
type Server struct {
	discoverFS  discover.FS
	runner      discover.Runner
	syncFS      sync.FS
	volumesRoot string
	now         func() time.Time
}

// Option configures a Server.
type Option func(*Server)

// WithDiscoverFS overrides the filesystem used for device discovery.
func WithDiscoverFS(fs discover.FS) Option { return func(s *Server) { s.discoverFS = fs } }

// WithRunner overrides the external-command runner used by discovery.
func WithRunner(r discover.Runner) Option { return func(s *Server) { s.runner = r } }

// WithSyncFS overrides the filesystem used for sync reads/writes.
func WithSyncFS(fs sync.FS) Option { return func(s *Server) { s.syncFS = fs } }

// WithVolumesRoot overrides the volumes root scanned by discovery.
func WithVolumesRoot(root string) Option { return func(s *Server) { s.volumesRoot = root } }

// WithClock overrides the clock used to stamp sync results (tests).
func WithClock(now func() time.Time) Option { return func(s *Server) { s.now = now } }

// NewServer builds a Server backed by the real os/exec defaults plus the given
// volumes root, applying any options.
func NewServer(volumesRoot string, opts ...Option) *Server {
	s := &Server{
		discoverFS:  discover.DefaultFS,
		runner:      discover.DefaultRunner,
		syncFS:      sync.DefaultFS,
		volumesRoot: volumesRoot,
		now:         time.Now,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Routes returns the HTTP handler for all engine endpoints.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", s.handleHealth)
	mux.HandleFunc("GET /v1/discover", s.handleDiscover)
	mux.HandleFunc("GET /v1/devices/inspect", s.handleInspect)
	mux.HandleFunc("POST /v1/sync/plan", s.handleSyncPlan)
	mux.HandleFunc("POST /v1/sync", s.handleSync)
	return mux
}
