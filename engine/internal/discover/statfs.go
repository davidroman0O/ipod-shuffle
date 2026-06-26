package discover

import (
	"os"

	"golang.org/x/sys/unix"
)

// VolumeStats holds the total and free byte counts for a mounted volume.
type VolumeStats struct {
	TotalBytes int64
	FreeBytes  int64
}

// StatfsMount reads filesystem statistics for mountPath via the unix statfs
// syscall. This is the reliable way to get capacity on macOS/Linux — it does
// not depend on parsing diskutil output (which is suppressed when invoked by
// non-TTY subprocesses) and avoids any PATH/subprocess fragility.
//
// Returns zero values (no error) when the path is not a stat-able mount.
func StatfsMount(mountPath string) (VolumeStats, error) {
	var stat unix.Statfs_t
	if err := unix.Statfs(mountPath, &stat); err != nil {
		if os.IsNotExist(err) {
			return VolumeStats{}, nil
		}
		return VolumeStats{}, err
	}
	// Block size * total blocks = total bytes; bavail = free for unprivileged.
	total := int64(stat.Blocks) * int64(stat.Bsize)
	free := int64(stat.Bavail) * int64(stat.Bsize)
	return VolumeStats{TotalBytes: total, FreeBytes: free}, nil
}
