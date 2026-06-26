package discover

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// fakeFS is an in-memory FS for deterministic discover tests.
type fakeFS struct {
	dirs   map[string]bool // directory paths that exist
	entries map[string][]fakeEntry
}

type fakeEntry struct {
	name  string
	isDir bool
}

func (f fakeFS) Stat(name string) (os.FileInfo, error) {
	if f.dirs[name] {
		return fakeInfo{name: filepath.Base(name), isDir: true}, nil
	}
	return nil, os.ErrNotExist
}

func (f fakeFS) ReadDir(name string) ([]os.DirEntry, error) {
	es, ok := f.entries[name]
	if !ok {
		return nil, os.ErrNotExist
	}
	out := make([]os.DirEntry, 0, len(es))
	for _, e := range es {
		out = append(out, fakeEntryInfo{e})
	}
	return out, nil
}

// fakeInfo / fakeEntryInfo implement os.FileInfo / os.DirEntry minimally.
type fakeInfo struct {
	name  string
	isDir bool
}

func (f fakeInfo) Name() string       { return f.name }
func (f fakeInfo) IsDir() bool        { return f.isDir }
func (f fakeInfo) Size() int64        { return 0 }
func (f fakeInfo) Mode() os.FileMode  { return 0 }
func (f fakeInfo) ModTime() time.Time { return time.Time{} }
func (f fakeInfo) Sys() any           { return nil }

type fakeEntryInfo struct{ e fakeEntry }

func (f fakeEntryInfo) Name() string               { return f.e.name }
func (f fakeEntryInfo) IsDir() bool                { return f.e.isDir }
func (f fakeEntryInfo) Type() os.FileMode          { return 0 }
func (f fakeEntryInfo) Info() (os.FileInfo, error) { return fakeInfo{f.e.name, f.e.isDir}, nil }

// fakeRunner returns canned diskutil output per mount path.
type fakeRunner struct {
	outputs map[string]string // mount path -> stdout
	called  bool
}

func (f *fakeRunner) Run(_ context.Context, command string, args []string) (Result, error) {
	f.called = true
	if command != "diskutil" || len(args) < 2 {
		return Result{}, nil
	}
	mount := args[1]
	if out, ok := f.outputs[mount]; ok {
		return Result{ExitCode: 0, Stdout: out}, nil
	}
	return Result{ExitCode: 0}, nil
}

func TestParseDiskutilOutput(t *testing.T) {
	out := "   Volume UUID:           ABC-123\n   Volume Name:           IPOD\n   Volume Total Space:   1.0 GB (1000000000 Bytes)\n"
	v := parseDiskutilOutput(out)
	if v["Volume UUID"] != "ABC-123" {
		t.Errorf("uuid = %q", v["Volume UUID"])
	}
	if v["Volume Name"] != "IPOD" {
		t.Errorf("name = %q", v["Volume Name"])
	}
	n, ok := parseSizeFromDiskutilLine(v["Volume Total Space"])
	if !ok || n != 1000000000 {
		t.Errorf("size = %d ok=%v", n, ok)
	}
}

func TestIsMountPath(t *testing.T) {
	fsys := fakeFS{dirs: map[string]bool{"/mnt/ipod/iPod_Control": true}}
	got, err := IsMountPath("/mnt/ipod", fsys)
	if err != nil {
		t.Fatal(err)
	}
	if !got {
		t.Fatal("expected ipod mount to be detected")
	}

	got, err = IsMountPath("/mnt/usb", fsys)
	if err != nil {
		t.Fatal(err)
	}
	if got {
		t.Fatal("non-ipod mount should not be detected")
	}
}

func TestInspectMount(t *testing.T) {
	runner := &fakeRunner{outputs: map[string]string{
		"/mnt/ipod": "Volume UUID: ABC\nVolume Name: MyPod\nDevice Node: /dev/disk2\nVolume Total Space: 1 GB (1000 Bytes)\nVolume Free Space: 500 MB (500 Bytes)\n",
	}}
	dev, err := InspectMount(context.Background(), "/mnt/ipod", runner)
	if err != nil {
		t.Fatal(err)
	}
	if dev.ID != "ABC" || dev.Name != "MyPod" || dev.DeviceNode != "/dev/disk2" {
		t.Errorf("unexpected device: %+v", dev)
	}
	if dev.TotalBytes != 1000 || dev.FreeBytes != 500 {
		t.Errorf("sizes wrong: total=%d free=%d", dev.TotalBytes, dev.FreeBytes)
	}
}

func TestInspectMount_FallsBackToMountPath(t *testing.T) {
	runner := &fakeRunner{outputs: map[string]string{"/mnt/x": "Volume Name: X\n"}}
	dev, _ := InspectMount(context.Background(), "/mnt/x", runner)
	if dev.ID != "/mnt/x" {
		t.Errorf("expected fallback id /mnt/x, got %q", dev.ID)
	}
}

func TestDiscover(t *testing.T) {
	fsys := fakeFS{
		dirs: map[string]bool{
			"/Volumes/iPod/iPod_Control":  true,
			"/Volumes/USB/iPod_Control":   false,
			"/Volumes/.hidden/iPod_Control": true,
		},
		entries: map[string][]fakeEntry{
			"/Volumes": {
				{name: "iPod", isDir: true},
				{name: "USB", isDir: true},
				{name: ".hidden", isDir: true},
				{name: "readme.txt", isDir: false},
			},
		},
	}
	runner := &fakeRunner{outputs: map[string]string{
		"/Volumes/iPod": "Volume UUID: UUID1\nVolume Name: Pod1\n",
	}}
	devs, err := Discover(context.Background(), "/Volumes", fsys, runner)
	if err != nil {
		t.Fatal(err)
	}
	if len(devs) != 1 {
		t.Fatalf("expected 1 device, got %d: %+v", len(devs), devs)
	}
	if devs[0].ID != "UUID1" || devs[0].MountPath != "/Volumes/iPod" {
		t.Errorf("wrong device: %+v", devs[0])
	}
}

// Ensure errors propagate from ReadDir.
func TestDiscover_ReadDirError(t *testing.T) {
	fsys := fakeFS{} // no entries for /Volumes
	_, err := Discover(context.Background(), "/Volumes", fsys, &fakeRunner{})
	if err == nil || !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected ErrNotExist, got %v", err)
	}
}
