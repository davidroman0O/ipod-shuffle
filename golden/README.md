# golden/

Byte-exact reference vectors for the iPod Shuffle `iTunesSD` and `iTunesStats`
binary databases, produced by the original TypeScript implementation in
`src/services/ipodDatabase.ts` and `src/services/ipodStats.ts`.

These are the **contract** for the Go port. The Go writers must reproduce these
bytes bit-for-bit. One wrong offset corrupts a device's database.

## How they were made

```bash
bun run scripts/capture-golden.ts
```

The harness calls the builders directly with fixed, deterministic inputs (no
`crypto.randomUUID()`, no timestamps — those live only in the controller, which
we bypass). Re-running produces byte-identical output (verified).

## Scenarios

| name         | tracks | playlists | branch exercised                                |
| ------------ | ------ | --------- | ----------------------------------------------- |
| `empty`      | 0      | 0         | `buildEmptyDatabase()` fallback                 |
| `single-mp3` | 1      | 0         | implicit "All Songs" master only                |
| `mixed`      | 3      | 2         | filetype codes mp3(1)/m4a(2)/wav(4) + empty-pl filter |
| `ghost`      | 2      | 2         | playlist referencing a non-existent trackId     |

## Files per scenario

- `<name>.inputs.json` — exact `PlannedTrack[]` + `PlannedPlaylist[]` fed in
- `<name>.iTunesSD.bin` — expected `iTunesSD` bytes
- `<name>.iTunesStats.bin` — expected `iTunesStats` bytes
- `manifest.json` — byte length + SHA256 + base64 for every output

## Golden test contract for the Go port

For each scenario, the Go test must:

1. Load `<name>.inputs.json` → build the equivalent Go structs.
2. Produce `iTunesSD` and `iTunesStats` via the Go writers.
3. Assert byte-equality against `<name>.iTunesSD.bin` / `<name>.iTunesStats.bin`.
4. (belt-and-suspenders) assert the SHA256 matches `manifest.json`.

All four scenarios must pass before the TS writers are deleted.
