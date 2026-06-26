package sync

import (
	"errors"
	"io"
	"os"
)

// FS is the filesystem surface the sync planner and executor need. It is the
// single seam through which all device I/O flows, keeping the package fully
// unit-testable against a fake filesystem.
type FS interface {
	Stat(name string) (os.FileInfo, error)
	MkdirAll(name string, perm os.FileMode) error
	Remove(name string) error
	ReadDir(name string) ([]os.DirEntry, error)
	WriteFile(name string, data []byte, perm os.FileMode) error
	Copy(src, dst string) error
}

// osFS is the production FS backed by the os package.
type osFS struct{}

func (osFS) Stat(name string) (os.FileInfo, error)              { return os.Stat(name) }
func (osFS) MkdirAll(name string, perm os.FileMode) error       { return os.MkdirAll(name, perm) }
func (osFS) Remove(name string) error                           { return os.Remove(name) }
func (osFS) ReadDir(name string) ([]os.DirEntry, error)         { return os.ReadDir(name) }
func (osFS) WriteFile(name string, data []byte, perm os.FileMode) error {
	return os.WriteFile(name, data, perm)
}
func (osFS) Copy(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// DefaultFS is the production filesystem.
var DefaultFS FS = osFS{}

// isNotExist reports whether err means "path does not exist".
func isNotExist(err error) bool {
	return err != nil && (errors.Is(err, os.ErrNotExist))
}
