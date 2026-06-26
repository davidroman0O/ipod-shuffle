package layout

import "testing"

func TestRelativePath(t *testing.T) {
	cases := []struct {
		index    int
		fileName string
		want     string
	}{
		{0, "song.mp3", "iPod_Control/Music/F00/S00000.mp3"},
		{1, "song.M4A", "iPod_Control/Music/F00/S00001.m4a"},
		{127, "x.wav", "iPod_Control/Music/F00/S00127.wav"},
		{128, "y.mp3", "iPod_Control/Music/F01/S00128.mp3"},
		{256, "z", "iPod_Control/Music/F02/S00256"},
		{13000, "big.mp3", "iPod_Control/Music/F101/S13000.mp3"}, // 13000/128 = 101
	}
	for _, c := range cases {
		if got := RelativePath(c.index, c.fileName); got != c.want {
			t.Errorf("RelativePath(%d, %q) = %q, want %q", c.index, c.fileName, got, c.want)
		}
	}
}

func TestDatabasePath(t *testing.T) {
	got := DatabasePath("iPod_Control/Music/F00/S00000.mp3")
	want := "/iPod_Control/Music/F00/S00000.mp3"
	if got != want {
		t.Errorf("DatabasePath = %q, want %q", got, want)
	}
}

func TestToPortablePath(t *testing.T) {
	if got := ToPortablePath("a\\b\\c"); got != "a/b/c" {
		t.Errorf("ToPortablePath = %q, want a/b/c", got)
	}
	if got := ToPortablePath("a/b/c"); got != "a/b/c" {
		t.Errorf("ToPortablePath = %q, want a/b/c", got)
	}
}
