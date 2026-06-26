package sync

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/itunes"
)

// memFS is an in-memory filesystem for sync tests. Paths use forward slashes
// in the map; methods convert via filepath for cleanliness, but we keep it
// simple by normalising to forward slash keys.
type memFS struct {
	files map[string][]byte // abs forward-slash path -> content
	dirs  map[string]bool   // abs forward-slash path -> exists
}

func newMemFS() *memFS {
	return &memFS{files: map[string][]byte{}, dirs: map[string]bool{}}
}

func toKey(p string) string { return filepath.ToSlash(filepath.Clean(p)) }

func (m *memFS) Stat(name string) (os.FileInfo, error) {
	k := toKey(name)
	if b, ok := m.files[k]; ok {
		return memInfo{name: k, size: int64(len(b)), isDir: false}, nil
	}
	if m.dirs[k] {
		return memInfo{name: k, size: 0, isDir: true}, nil
	}
	return nil, os.ErrNotExist
}
func (m *memFS) MkdirAll(name string, _ os.FileMode) error {
	k := toKey(name)
	parts := strings.Split(k, "/")
	cur := ""
	for _, part := range parts {
		if part == "" {
			cur = "/"
			continue
		}
		if cur == "/" {
			cur = "/" + part
		} else {
			cur = cur + "/" + part
		}
		m.dirs[cur] = true
	}
	m.dirs[k] = true
	return nil
}
func (m *memFS) Remove(name string) error {
	k := toKey(name)
	delete(m.files, k)
	if m.dirs[k] {
		delete(m.dirs, k)
	}
	return nil
}
func (m *memFS) ReadDir(name string) ([]os.DirEntry, error) {
	k := toKey(name)
	prefix := strings.TrimSuffix(k, "/") + "/"
	var out []os.DirEntry
	seen := map[string]bool{}
	for path := range m.files {
		if !strings.HasPrefix(path, prefix) {
			continue
		}
		rest := strings.TrimPrefix(path, prefix)
		if strings.Contains(rest, "/") {
			// nested: record the immediate child dir
			child := prefix + rest[:strings.Index(rest, "/")]
			if !seen[child] {
				seen[child] = true
				out = append(out, memEntry{name: rest[:strings.Index(rest, "/")], isDir: true})
			}
			continue
		}
		out = append(out, memEntry{name: rest, isDir: false})
	}
	for path := range m.dirs {
		if path == k {
			continue
		}
		if !strings.HasPrefix(path, prefix) {
			continue
		}
		rest := strings.TrimPrefix(path, prefix)
		if strings.Contains(rest, "/") {
			continue
		}
		if rest == "" || seen[path] {
			continue
		}
		seen[path] = true
		out = append(out, memEntry{name: rest, isDir: true})
	}
	if len(out) == 0 && !m.dirs[k] {
		return nil, os.ErrNotExist
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name() < out[j].Name() })
	return out, nil
}
func (m *memFS) WriteFile(name string, data []byte, _ os.FileMode) error {
	k := toKey(name)
	// ensure parent dirs recorded
	for d := filepath.ToSlash(filepath.Dir(name)); d != "." && d != "/" && d != ""; d = filepath.ToSlash(filepath.Dir(d)) {
		m.dirs[toKey(d)] = true
	}
	m.files[k] = data
	return nil
}
func (m *memFS) Copy(src, dst string) error {
	b, ok := m.files[toKey(src)]
	if !ok {
		return os.ErrNotExist
	}
	return m.WriteFile(dst, b, 0o644)
}

type memInfo struct {
	name  string
	size  int64
	isDir bool
}

func (m memInfo) Name() string       { return filepath.Base(m.name) }
func (m memInfo) IsDir() bool        { return m.isDir }
func (m memInfo) Size() int64        { return m.size }
func (m memInfo) Mode() os.FileMode  { return 0 }
func (m memInfo) ModTime() (t time.Time) { return }
func (m memInfo) Sys() any           { return nil }

type memEntry struct {
	name  string
	isDir bool
}

func (e memEntry) Name() string               { return e.name }
func (e memEntry) IsDir() bool                { return e.isDir }
func (e memEntry) Type() os.FileMode          { return 0 }
func (e memEntry) Info() (os.FileInfo, error) { return memInfo{name: e.name, isDir: e.isDir}, nil }

func mkTrack(id, file string, size int64, index int) itunes.Track {
	rel := "iPod_Control/Music/F00/S" + pad(index) + ext(file)
	return itunes.Track{
		TrackID:      id,
		SourcePath:   "/lib/" + file,
		FileName:     file,
		RelativePath: rel,
		DatabasePath: "/" + rel,
		SizeBytes:    size,
	}
}
func pad(n int) string {
	s := ""
	v := n
	for i := 0; i < 5; i++ {
		s = string(rune('0'+v%10)) + s
		v /= 10
	}
	return s
}
func ext(f string) string {
	i := strings.LastIndex(f, ".")
	if i == -1 {
		return ""
	}
	return strings.ToLower(f[i:])
}

// seedSource writes a fake source library into memFS at /lib.
func seedSource(m *memFS, files map[string]string) {
	for name, content := range files {
		m.WriteFile("/lib/"+name, []byte(content), 0o644)
	}
}

func TestPlan_DetectsCopySkipDelete(t *testing.T) {
	src := newMemFS()
	seedSource(src, map[string]string{"a.mp3": "aaaa", "b.mp3": "bbbbbb", "c.mp3": "cccccccc"})
	// Pre-seed the device: b.mp3 already present correct size (skip), plus a
	// stale orphan d.mp3 to be deleted.
	mount := "/mnt/ipod"
	src.WriteFile(mount+"/iPod_Control/Music/F00/S00001.mp3", []byte("bbbbbb"), 0o644) // matches b
	src.WriteFile(mount+"/iPod_Control/Music/F00/S00099.mp3", []byte("stale"), 0o644)  // orphan

	tracks := []itunes.Track{
		mkTrack("t1", "a.mp3", 4, 0),
		mkTrack("t2", "b.mp3", 6, 1),
		mkTrack("t3", "c.mp3", 8, 2),
	}
	plan, err := Plan(mount, tracks, nil, src)
	if err != nil {
		t.Fatal(err)
	}

	if len(plan.SkipOps) != 1 {
		t.Errorf("expected 1 skip, got %d", len(plan.SkipOps))
	}
	if len(plan.CopyOps) != 2 {
		t.Errorf("expected 2 copies (a,c), got %d: %+v", len(plan.CopyOps), plan.CopyOps)
	}
	// reasons
	for _, c := range plan.CopyOps {
		if c.Reason != ReasonMissing {
			t.Errorf("copy %s reason = %s, want missing", c.RelativePath, c.Reason)
		}
	}
	if len(plan.DeleteOps) != 1 || plan.DeleteOps[0] != "iPod_Control/Music/F00/S00099.mp3" {
		t.Errorf("delete ops wrong: %+v", plan.DeleteOps)
	}
}

func TestPlan_SizeMismatchIsCopy(t *testing.T) {
	src := newMemFS()
	seedSource(src, map[string]string{"a.mp3": "longer"})
	mount := "/mnt/ipod"
	// destination present but too small
	src.WriteFile(mount+"/iPod_Control/Music/F00/S00000.mp3", []byte("short"), 0o644)

	tracks := []itunes.Track{mkTrack("t1", "a.mp3", 7, 0)}
	plan, err := Plan(mount, tracks, nil, src)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.CopyOps) != 1 || plan.CopyOps[0].Reason != ReasonSizeMismatch {
		t.Errorf("expected size-mismatch copy, got %+v", plan.CopyOps)
	}
}

func TestExecute_WritesDatabasesAndManifest(t *testing.T) {
	src := newMemFS()
	seedSource(src, map[string]string{"a.mp3": "AAAA", "b.mp3": "BBBBBB"})

	mount := "/mnt/ipod"
	tracks := []itunes.Track{
		mkTrack("t1", "a.mp3", 4, 0),
		mkTrack("t2", "b.mp3", 6, 1),
	}
	playlists := []itunes.Playlist{{PlaylistID: "p1", Name: "Mix", TrackIDs: []string{"t1", "t2"}}}

	plan, err := Plan(mount, tracks, playlists, src)
	if err != nil {
		t.Fatal(err)
	}
	res, err := ExecuteAt(plan, src, time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}

	// databases written with non-zero bytes
	if res.WrittenDatabaseBytes == 0 || res.WrittenStatsBytes == 0 {
		t.Fatalf("expected written bytes, got db=%d stats=%d", res.WrittenDatabaseBytes, res.WrittenStatsBytes)
	}
	sd := src.files[toKey(mount+"/iPod_Control/iTunes/iTunesSD")]
	if len(sd) != res.WrittenDatabaseBytes {
		t.Errorf("iTunesSD on disk %d != reported %d", len(sd), res.WrittenDatabaseBytes)
	}
	if string(sd[:4]) != "bdhs" {
		t.Errorf("iTunesSD magic wrong: % x", sd[:4])
	}

	// both tracks copied to device
	if _, ok := src.files[toKey(mount+"/iPod_Control/Music/F00/S00000.mp3")]; !ok {
		t.Error("track a.mp3 not copied")
	}
	if _, ok := src.files[toKey(mount+"/iPod_Control/Music/F00/S00001.mp3")]; !ok {
		t.Error("track b.mp3 not copied")
	}

	// manifest reflects both tracks
	if len(res.Manifest) != 2 {
		t.Errorf("manifest len = %d, want 2", len(res.Manifest))
	}
}

func TestExecute_RemovesOrphans(t *testing.T) {
	src := newMemFS()
	seedSource(src, map[string]string{"a.mp3": "AAAA"})
	mount := "/mnt/ipod"
	src.WriteFile(mount+"/iPod_Control/Music/F00/S00088.mp3", []byte("orphan"), 0o644)

	tracks := []itunes.Track{mkTrack("t1", "a.mp3", 4, 0)}
	plan, err := Plan(mount, tracks, nil, src)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ExecuteAt(plan, src, time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, ok := src.files[toKey(mount+"/iPod_Control/Music/F00/S00088.mp3")]; ok {
		t.Error("orphan not removed")
	}
}

func TestPlan_EmptyTracksWarns(t *testing.T) {
	src := newMemFS()
	plan, err := Plan("/mnt/ipod", nil, nil, src)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Warnings) == 0 {
		t.Error("expected a warning for empty sync")
	}
}
