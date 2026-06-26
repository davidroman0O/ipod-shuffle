package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/discover"
)

// memFS is a unified in-memory filesystem satisfying both discover.FS and the
// (separate) sync.FS interface used by the engine. It keeps the api tests free
// of real device I/O.
type memFS struct {
	files map[string][]byte
	dirs  map[string]bool
}

func newMemFS() *memFS {
	return &memFS{files: map[string][]byte{}, dirs: map[string]bool{}}
}

func key(p string) string { return filepath.ToSlash(filepath.Clean(p)) }

func (m *memFS) Stat(name string) (os.FileInfo, error) {
	k := key(name)
	if b, ok := m.files[k]; ok {
		return fileStat{name: k, size: int64(len(b))}, nil
	}
	if m.dirs[k] {
		return fileStat{name: k, isDir: true}, nil
	}
	return nil, os.ErrNotExist
}
func (m *memFS) MkdirAll(name string, _ os.FileMode) error {
	m.dirs[key(name)] = true
	return nil
}
func (m *memFS) Remove(name string) error {
	k := key(name)
	delete(m.files, k)
	delete(m.dirs, k)
	return nil
}
func (m *memFS) ReadDir(name string) ([]os.DirEntry, error) {
	k := key(name)
	prefix := strings.TrimSuffix(k, "/") + "/"
	if k == "/" || k == "." {
		prefix = "/"
	}
	seen := map[string]bool{}
	var out []os.DirEntry
	addChild := func(child, displayName string, isDir bool) {
		if seen[child] {
			return
		}
		seen[child] = true
		out = append(out, dirEntry{name: displayName, isDir: isDir})
	}
	for path := range m.files {
		if !strings.HasPrefix(path, prefix) {
			continue
		}
		rest := strings.TrimPrefix(path, prefix)
		if i := strings.Index(rest, "/"); i >= 0 {
			addChild(prefix+rest[:i], rest[:i], true)
		} else {
			addChild(path, rest, false)
		}
	}
	for path := range m.dirs {
		if path == k || !strings.HasPrefix(path, prefix) {
			continue
		}
		rest := strings.TrimPrefix(path, prefix)
		if i := strings.Index(rest, "/"); i >= 0 {
			addChild(prefix+rest[:i], rest[:i], true)
		} else if rest != "" {
			addChild(path, rest, true)
		}
	}
	if len(out) == 0 && !m.dirs[k] {
		return nil, os.ErrNotExist
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name() < out[j].Name() })
	return out, nil
}
func (m *memFS) WriteFile(name string, data []byte, _ os.FileMode) error {
	m.files[key(name)] = data
	return nil
}
func (m *memFS) Copy(src, dst string) error {
	b, ok := m.files[key(src)]
	if !ok {
		return os.ErrNotExist
	}
	m.files[key(dst)] = b
	return nil
}

type fileStat struct {
	name  string
	size  int64
	isDir bool
}

func (s fileStat) Name() string         { return filepath.Base(s.name) }
func (s fileStat) IsDir() bool          { return s.isDir }
func (s fileStat) Size() int64          { return s.size }
func (s fileStat) Mode() os.FileMode    { return 0 }
func (s fileStat) ModTime() time.Time   { return time.Time{} }
func (s fileStat) Sys() any             { return nil }

type dirEntry struct {
	name  string
	isDir bool
}

func (e dirEntry) Name() string               { return e.name }
func (e dirEntry) IsDir() bool                { return e.isDir }
func (e dirEntry) Type() os.FileMode          { return 0 }
func (e dirEntry) Info() (os.FileInfo, error) { return fileStat{name: e.name, isDir: e.isDir}, nil }

// fakeRunner returns canned diskutil output per mount.
type fakeRunner struct {
	out map[string]string
}

func (f fakeRunner) Run(_ context.Context, cmd string, args []string) (discover.Result, error) {
	if cmd != "diskutil" || len(args) < 2 {
		return discover.Result{}, nil
	}
	if out, ok := f.out[args[1]]; ok {
		return discover.Result{Stdout: out}, nil
	}
	return discover.Result{}, nil
}

func newTestServer(t *testing.T) (*Server, *memFS) {
	t.Helper()
	fs := newMemFS()
	s := NewServer("/Volumes",
		WithDiscoverFS(fs),
		WithSyncFS(fs),
		WithRunner(fakeRunner{out: map[string]string{
			"/Volumes/iPod": "Volume UUID: UUID1\nVolume Name: Pod1\nVolume Total Space: 1 GB (1000 Bytes)\n",
		}}),
		WithClock(func() time.Time { return time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC) }),
	)
	return s, fs
}

func do(t *testing.T, h http.Handler, method, target string, body io.Reader) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, body)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

func TestHealth(t *testing.T) {
	s, _ := newTestServer(t)
	w := do(t, s.Routes(), "GET", "/v1/health", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestDiscover(t *testing.T) {
	s, fs := newTestServer(t)
	fs.WriteFile("/Volumes/iPod/iPod_Control/.keep", []byte("x"), 0o644)
	fs.dirs["/Volumes/iPod/iPod_Control"] = true
	fs.dirs["/Volumes"] = true
	fs.dirs["/Volumes/iPod"] = true
	// emulate directory entries by relying on ReadDir derivation
	w := do(t, s.Routes(), "GET", "/v1/discover", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}
	var devs []discover.Device
	if err := json.Unmarshal(w.Body.Bytes(), &devs); err != nil {
		t.Fatal(err)
	}
	if len(devs) != 1 || devs[0].ID != "UUID1" {
		t.Errorf("unexpected devices: %+v", devs)
	}
}

func TestInspect(t *testing.T) {
	s, _ := newTestServer(t)
	w := do(t, s.Routes(), "GET", "/v1/devices/inspect?mount=/Volumes/iPod", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}
	var dev discover.Device
	if err := json.Unmarshal(w.Body.Bytes(), &dev); err != nil {
		t.Fatal(err)
	}
	if dev.ID != "UUID1" || dev.TotalBytes != 1000 {
		t.Errorf("unexpected device: %+v", dev)
	}
}

func TestInspect_MissingParam(t *testing.T) {
	s, _ := newTestServer(t)
	w := do(t, s.Routes(), "GET", "/v1/devices/inspect", nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestSyncPlan(t *testing.T) {
	s, fs := newTestServer(t)
	fs.WriteFile("/src/a.mp3", []byte("AAAA"), 0o644)

	body := `{"mountPath":"/mnt/ipod","tracks":[{"trackId":"t1","sourcePath":"/src/a.mp3","fileName":"a.mp3","sizeBytes":4}],"playlists":[]}`
	w := do(t, s.Routes(), "POST", "/v1/sync/plan", strings.NewReader(body))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}
	var resp PlanResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.TrackCount != 1 || len(resp.Copies) != 1 {
		t.Errorf("unexpected plan: %+v", resp)
	}
}

func TestSync(t *testing.T) {
	s, fs := newTestServer(t)
	fs.WriteFile("/src/a.mp3", []byte("AAAA"), 0o644)

	body := `{"mountPath":"/mnt/ipod","tracks":[{"trackId":"t1","sourcePath":"/src/a.mp3","fileName":"a.mp3","sizeBytes":4}],"playlists":[{"playlistId":"p1","name":"Mix","trackIds":["t1"]}]}`
	w := do(t, s.Routes(), "POST", "/v1/sync", strings.NewReader(body))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}
	var resp SyncResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.WrittenDatabaseBytes == 0 || len(resp.Manifest) != 1 {
		t.Errorf("unexpected sync response: %+v", resp)
	}
	// databases written to device
	if _, ok := fs.files["/mnt/ipod/iPod_Control/iTunes/iTunesSD"]; !ok {
		t.Error("iTunesSD not written to device")
	}
}

func TestSync_MissingMount(t *testing.T) {
	s, _ := newTestServer(t)
	body := `{"tracks":[]}`
	w := do(t, s.Routes(), "POST", "/v1/sync", strings.NewReader(body))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}
}

func TestSync_InvalidJSON(t *testing.T) {
	s, _ := newTestServer(t)
	w := do(t, s.Routes(), "POST", "/v1/sync", bytes.NewReader([]byte("not json")))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", w.Code)
	}
}
