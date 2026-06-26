// Package itunes writes the binary iTunesSD and iTunesStats databases that an
// iPod Shuffle reads from iPod_Control/iTunes/.
//
// The byte layout is a reverse-engineered Apple-proprietary format. The writers
// here are the port of the original TypeScript reference implementation in
// src/services/ipodDatabase.ts and must remain byte-exact — a single wrong
// offset corrupts a device's database.
//
// Golden reference vectors live in testdata/golden and are asserted in
// golden_test.go.
package itunes
