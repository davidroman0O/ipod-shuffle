package audio

import "testing"

func TestNormalizeExtension(t *testing.T) {
	cases := map[string]string{
		"song.mp3":   ".mp3",
		"song.MP3":   ".mp3",
		"a.b.m4a":    ".m4a",
		"mp3":        "mp3", // no dot → treated as extension
		"/x/y/z.WAV": ".wav",
	}
	for in, want := range cases {
		if got := NormalizeExtension(in); got != want {
			t.Errorf("NormalizeExtension(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsSupported(t *testing.T) {
	supported := []string{"a.mp3", "b.m4a", "c.m4b", "d.m4p", "e.aa", "f.wav", "g.MP3"}
	for _, p := range supported {
		if !IsSupported(p) {
			t.Errorf("IsSupported(%q) = false, want true", p)
		}
	}
	unsupported := []string{"a.flac", "b.ogg", "c", "d.txt", "e.mp4"}
	for _, p := range unsupported {
		if IsSupported(p) {
			t.Errorf("IsSupported(%q) = true, want false", p)
		}
	}
}
