package discover

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/identity"
)

// iPodControlDir is the marker directory whose presence identifies a volume as
// an iPod Shuffle.
const iPodControlDir = "iPod_Control"

// IsMountPath reports whether mountPath contains an iPod_Control directory,
// i.e. looks like a managed iPod Shuffle volume. Mirrors isIpodMountPath.
func IsMountPath(mountPath string, fsys FS) (bool, error) {
	_, err := fsys.Stat(filepath.Join(mountPath, iPodControlDir))
	if err == nil {
		return true, nil
	}
	if errors.Is(err, os.ErrNotExist) || isNotExist(err) {
		return false, nil
	}
	return false, err
}

// isNotExist tolerates wrapped/OS-specific not-exist errors.
func isNotExist(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, os.ErrNotExist)
}

// InspectMount runs `diskutil info` against mountPath and parses its output
// into a Device. It never returns an error for missing metadata — fields are
// simply left zero/empty. Mirrors inspectIpodMount.
func InspectMount(ctx context.Context, mountPath string, runner Runner) (Device, error) {
	abs := filepath.Clean(mountPath)
	res, _ := runner.Run(ctx, "diskutil", []string{"info", abs})
	values := parseDiskutilOutput(res.Stdout)

	volumeUUID := values["Volume UUID"]
	volumeName := values["Volume Name"]
	if volumeName == "" {
		volumeName = filepath.Base(abs)
	}

	dev := Device{
		ID:         volumeUUID,
		Name:       volumeName,
		MountPath:  abs,
		VolumeName: volumeName,
		VolumeUUID: volumeUUID,
		DeviceNode: values["Device Node"],
		MediaType:  values["Media Type"],
	}
	// ID falls back to the mount path when diskutil gives no UUID.
	if dev.ID == "" {
		dev.ID = abs
	}
	// Capacity via statfs — reliable regardless of how diskutil behaves when
	// invoked from a subprocess (its text output is suppressed outside a TTY).
	stats, err := StatfsMount(abs)
	if err == nil {
		dev.TotalBytes = stats.TotalBytes
		dev.FreeBytes = stats.FreeBytes
	}
	// Identity from the device's on-disk file — when present, its id+name are
	// authoritative (survives remounts, mount-path shifts, cross-machine moves).
	if ident, _ := ReadIdentityFromMount(abs); ident != nil {
		dev.Identity = ident
		dev.ID = ident.ID
		dev.Name = ident.Name
	}
	return dev, nil
}

// ReadIdentityFromMount reads the identity file from a mounted device and
// returns the API-facing shape, or nil when absent.
func ReadIdentityFromMount(mountPath string) (*DeviceIdentity, error) {
	f, err := identity.Read(mountPath)
	if err != nil || f == nil {
		return nil, err
	}
	dev := &DeviceIdentity{ID: f.ID, Name: f.Name}
	if f.Snapshot != nil {
		snap := &DeviceSnapshot{
			SyncedAt:    f.Snapshot.SyncedAt,
			TotalTracks: f.Snapshot.TotalTracks,
			Playlists:   make([]DeviceSnapshotPlaylist, len(f.Snapshot.Playlists)),
		}
		for i, p := range f.Snapshot.Playlists {
			tracks := make([]DeviceSnapshotTrack, len(p.Tracks))
			for j, t := range p.Tracks {
				tracks[j] = DeviceSnapshotTrack{
					ID: t.ID, FileName: t.FileName, SourcePath: t.SourcePath,
					DevicePath: t.DevicePath, SizeBytes: t.SizeBytes,
				}
			}
			snap.Playlists[i] = DeviceSnapshotPlaylist{ID: p.ID, Name: p.Name, Tracks: tracks}
		}
		dev.Snapshot = snap
	}
	return dev, nil
}

// Discover scans volumesRoot for directories that look like iPod Shuffle
// volumes and inspects each. Results are sorted by mount path for stable
// output. Mirrors discoverIpods.
func Discover(ctx context.Context, volumesRoot string, fsys FS, runner Runner) ([]Device, error) {
	root := filepath.Clean(volumesRoot)
	entries, err := fsys.ReadDir(root)
	if err != nil {
		return nil, err
	}

	var devices []Device
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		mountPath := filepath.Join(root, entry.Name())

		isIPod, err := IsMountPath(mountPath, fsys)
		if err != nil {
			return nil, err
		}
		if !isIPod {
			continue
		}
		dev, err := InspectMount(ctx, mountPath, runner)
		if err != nil {
			return nil, err
		}
		devices = append(devices, dev)
	}

	sort.Slice(devices, func(i, j int) bool {
		return devices[i].MountPath < devices[j].MountPath
	})
	return devices, nil
}
