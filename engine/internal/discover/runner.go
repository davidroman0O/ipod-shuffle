package discover

import (
	"bytes"
	"context"
	"os"
	"os/exec"
)

// FS is the minimal filesystem surface discover needs.
type FS interface {
	// Stat returns FileInfo for name. An ENOENT-like error means "absent".
	Stat(name string) (os.FileInfo, error)
	// ReadDir lists directory entries.
	ReadDir(name string) ([]os.DirEntry, error)
}

// Runner runs an external command and returns its captured output.
type Runner interface {
	// Run executes command with args. The returned Result always carries the
	// captured streams regardless of exit code; err is non-nil only when the
	// command could not be started (the TS reference treats a missing diskutil
	// the same as empty output, so callers tolerate a zero Result).
	Run(ctx context.Context, command string, args []string) (Result, error)
}

// Result is the outcome of an external command.
type Result struct {
	ExitCode int
	Stdout   string
	Stderr   string
}

// osFS adapts the os package to the FS interface.
type osFS struct{}

func (osFS) Stat(name string) (os.FileInfo, error)      { return os.Stat(name) }
func (osFS) ReadDir(name string) ([]os.DirEntry, error) { return os.ReadDir(name) }

// DefaultFS is the production filesystem backed by the os package.
var DefaultFS FS = osFS{}

// execRunner adapts os/exec to the Runner interface.
type execRunner struct{}

func (execRunner) Run(ctx context.Context, command string, args []string) (Result, error) {
	cmd := exec.CommandContext(ctx, command, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	res := Result{Stdout: stdout.String(), Stderr: stderr.String()}
	if err := cmd.Run(); err != nil {
		// A non-zero exit is reported via ExitCode; only start/exec failures
		// propagate as err.
		if ee, ok := err.(*exec.ExitError); ok {
			res.ExitCode = ee.ExitCode()
			return res, nil
		}
		return res, err
	}
	res.ExitCode = 0
	return res, nil
}

// DefaultRunner is the production command runner backed by os/exec.
var DefaultRunner Runner = execRunner{}
