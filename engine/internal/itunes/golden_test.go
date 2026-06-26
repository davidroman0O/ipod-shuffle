package itunes

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// goldenDir holds the reference vectors captured from the TypeScript
// implementation. They are the contract this Go port must reproduce exactly.
const goldenDir = "testdata/golden"

var goldenScenarios = []string{"empty", "single-mp3", "mixed", "ghost"}

// goldenInput mirrors the JSON written by scripts/capture-golden.ts.
type goldenInput struct {
	Tracks []struct {
		TrackID      string `json:"trackId"`
		SourcePath   string `json:"sourcePath"`
		FileName     string `json:"fileName"`
		RelativePath string `json:"relativePath"`
		DatabasePath string `json:"databasePath"`
		SizeBytes    int64  `json:"sizeBytes"`
	} `json:"tracks"`
	Playlists []struct {
		PlaylistID string   `json:"playlistId"`
		Name       string   `json:"name"`
		TrackIDs   []string `json:"trackIds"`
	} `json:"playlists"`
}

// manifestEntry mirrors a single element of manifest.json.
type manifestEntry struct {
	Name        string `json:"name"`
	ITunesSD    hashed `json:"iTunesSD"`
	ITunesStats hashed `json:"iTunesStats"`
}

type hashed struct {
	Bytes  int    `json:"bytes"`
	SHA256 string `json:"sha256"`
}

func loadManifest(t *testing.T) []manifestEntry {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(goldenDir, "manifest.json"))
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	var entries []manifestEntry
	if err := json.Unmarshal(raw, &entries); err != nil {
		t.Fatalf("unmarshal manifest: %v", err)
	}
	return entries
}

func toTracks(in goldenInput) []Track {
	tracks := make([]Track, len(in.Tracks))
	for i, tr := range in.Tracks {
		tracks[i] = Track{
			TrackID:      tr.TrackID,
			SourcePath:   tr.SourcePath,
			FileName:     tr.FileName,
			RelativePath: tr.RelativePath,
			DatabasePath: tr.DatabasePath,
			SizeBytes:    tr.SizeBytes,
		}
	}
	return tracks
}

func toPlaylists(in goldenInput) []Playlist {
	playlists := make([]Playlist, len(in.Playlists))
	for i, p := range in.Playlists {
		playlists[i] = Playlist{PlaylistID: p.PlaylistID, Name: p.Name, TrackIDs: p.TrackIDs}
	}
	return playlists
}

func loadGoldenInput(t *testing.T, name string) goldenInput {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(goldenDir, name+".inputs.json"))
	if err != nil {
		t.Fatalf("read %s inputs: %v", name, err)
	}
	var in goldenInput
	if err := json.Unmarshal(raw, &in); err != nil {
		t.Fatalf("unmarshal %s inputs: %v", name, err)
	}
	return in
}

func TestBuildITunesSD_MatchesGolden(t *testing.T) {
	manifest := loadManifest(t)
	byName := make(map[string]manifestEntry, len(manifest))
	for _, e := range manifest {
		byName[e.Name] = e
	}

	for _, name := range goldenScenarios {
		name := name
		t.Run(name, func(t *testing.T) {
			in := loadGoldenInput(t, name)
			got := BuildITunesSD(toTracks(in), toPlaylists(in))

			want, err := os.ReadFile(filepath.Join(goldenDir, name+".iTunesSD.bin"))
			if err != nil {
				t.Fatalf("read golden bin: %v", err)
			}
			if !bytes.Equal(got, want) {
				t.Fatalf("iTunesSD byte mismatch for %s: got %d bytes, want %d bytes\nfirst diff region:\n got: % x\nwant: % x",
					name, len(got), len(want), got[:min(64, len(got))], want[:min(64, len(want))])
			}

			// Belt-and-suspenders: assert the manifest's recorded SHA256 too.
			sum := sha256.Sum256(got)
			if hex.EncodeToString(sum[:]) != byName[name].ITunesSD.SHA256 {
				t.Fatalf("iTunesSD sha256 mismatch for %s", name)
			}
		})
	}
}

func TestBuildITunesStats_MatchesGolden(t *testing.T) {
	manifest := loadManifest(t)
	byName := make(map[string]manifestEntry, len(manifest))
	for _, e := range manifest {
		byName[e.Name] = e
	}

	for _, name := range goldenScenarios {
		name := name
		t.Run(name, func(t *testing.T) {
			in := loadGoldenInput(t, name)
			got := BuildITunesStats(len(in.Tracks))

			want, err := os.ReadFile(filepath.Join(goldenDir, name+".iTunesStats.bin"))
			if err != nil {
				t.Fatalf("read golden bin: %v", err)
			}
			if !bytes.Equal(got, want) {
				t.Fatalf("iTunesStats byte mismatch for %s: got %d bytes, want %d bytes",
					name, len(got), len(want))
			}

			sum := sha256.Sum256(got)
			if hex.EncodeToString(sum[:]) != byName[name].ITunesStats.SHA256 {
				t.Fatalf("iTunesStats sha256 mismatch for %s", name)
			}
		})
	}
}

