package discover

import (
	"regexp"
	"strconv"
	"strings"
)

// parseDiskutilOutput turns diskutil's "Key: Value" lines into a map. Lines
// without a colon are ignored. Mirrors parseDiskutilOutput in deviceDiscovery.ts.
func parseDiskutilOutput(output string) map[string]string {
	values := make(map[string]string)
	for _, line := range strings.Split(output, "\n") {
		sep := strings.Index(line, ":")
		if sep == -1 {
			continue
		}
		key := strings.TrimSpace(line[:sep])
		if key == "" {
			continue
		}
		values[key] = strings.TrimSpace(line[sep+1:])
	}
	return values
}

var bytesRe = regexp.MustCompile(`\((\d+) Bytes\)`)

// parseSizeFromDiskutilLine extracts the "(NNN Bytes)" count from a diskutil
// value line. Returns 0,false when absent. Mirrors parseSizeFromDiskutilLine.
func parseSizeFromDiskutilLine(line string) (int64, bool) {
	m := bytesRe.FindStringSubmatch(line)
	if m == nil {
		return 0, false
	}
	n, err := strconv.ParseInt(m[1], 10, 64)
	if err != nil {
		return 0, false
	}
	return n, true
}
