# ipod-shuffle

Terminal workbench for managing host-side playlists and syncing them to one or more iPod Shuffle devices.

## What it does

- Stores global playlists and track paths in a local state file.
- Lets you browse the filesystem and add supported audio files to playlists.
- Tracks missing files so stale playlist entries are visible before sync.
- Discovers mounted iPod Shuffle volumes under `/Volumes` and supports manual mount paths.
- Assigns playlists per device.
- Copies tracks into `iPod_Control/Music/*`, then writes `iTunesSD` and `iTunesStats` in TypeScript.

Supported audio extensions:

- `.mp3`
- `.m4a`
- `.m4b`
- `.m4p`
- `.aa`
- `.wav`

## Install

```bash
bun install
```

For a global CLI during development:

```bash
bun link
ipod-shuffle
```

## Run

```bash
bun run src/index.tsx
```

or, after linking:

```bash
ipod-shuffle
```

## Controls

- `Tab`: cycle focus
- `Ctrl+R`: refresh device discovery and file existence checks
- `q`: quit
- Browser tab:
  - `Enter`: open directory or add selected file to the current playlist
  - `Backspace`: go to parent directory
  - `i`: import the current directory as a library root
  - `r`: rescan imported library roots
- Playlists tab:
  - `Enter` in the name field: create a playlist
  - `x`: remove the selected track from the playlist
- Devices tab:
  - `Enter` on a playlist assignment: toggle whether that playlist belongs on the selected device
- Sync tab:
  - `s`: sync the selected mounted device

## State

By default the app stores its state here on macOS:

```text
~/Library/Application Support/ipod-shuffle/state.json
```

Override that location with:

```bash
IPOD_SHUFFLE_HOME=/custom/path ipod-shuffle
```

## Test

```bash
bun test
bun test --coverage --coverage-reporter=text
```
