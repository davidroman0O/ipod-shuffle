# ipod-shuffle

A component for the iPod Shuffle, in three parts:

1. **`engine/`** — a stateless **Go device engine**: discovers volumes, syncs
   audio, writes the proprietary `iTunesSD`/`iTunesStats` databases.
2. **`services/`** — a **Moleculer node** (the product layer): manages *your*
   library, playlists, and devices; orchestrates the Go engine; contributes
   `ipod*` actions to a federated mesh.
3. **`web/`** — a **SvelteKit + Svelte 5** UI (shadcn-svelte + sveltednd) to
   manage it all: drag-to-reorder playlists, detect missing files, sync devices.

```
 ┌─────────────┐        ┌──────────────────────┐        ┌──────────────┐
 │  web/ (UI)  │  HTTP  │  services/ (Moleculer)│  HTTP  │ engine/ (Go) │
 │  SvelteKit  │──────▶ │  ipod* actions       │──────▶ │  stateless   │
 │  port 5173  │        │  port 3280           │        │  port 8765   │
 └─────────────┘        └──────────┬───────────┘        └──────────────┘
                                   │ NATS transporter (optional — federates
                                   │ into a wider mesh; not needed for solo use)
```

### Layering rules

- **`*.db.service.js`** files own a single collection via `@moleculer/database`
  and expose data only through actions.
- **Business services** (`ipodLibrary`, `ipodDevices`, `ipodSync`) hold no data;
  they call the `*.db` services and `ipodEngine`.
- **`ipodEngine`** is the sole HTTP boundary to the Go process.
- The **Go engine** is fully **stateless**: every request carries a resolved
  `{mount, tracks[], playlists[]}`; it never sees your library or playlists.

---

## Quick start (3 terminals)

You need **Go ≥ 1.26** and **Node ≥ 22.13**. (NATS is optional — only if you want
the node to federate into a wider mesh; solo use runs without it.)

### Terminal 1 — Go engine

```bash
cd engine
go run ./cmd/ipod serve
# → "ipod engine listening on http://127.0.0.1:8765"
```

### Terminal 2 — Moleculer node

```bash
cd services
npm install
npm run dev          # hot-reload; serves the API on :3280
```

> No NATS server installed? The node runs **standalone by default** (transporter
> disabled). To federate into a wider mesh, run a NATS server and set
> `TRANSPORTER=NATS`:
> ```bash
> TRANSPORTER=NATS npm run dev
> ```

### Terminal 3 — Web UI

```bash
cd web
npm install
npm run dev          # → http://localhost:5173
```

Open **http://localhost:5173**. You'll land on **Devices**; the sidebar shows a
live engine-status pill. Add a library folder under **Library**, build a playlist
under **Playlists** (drag to reorder), then plug in an iPod and hit **Sync now**.

---

## Configuration

All config is env-driven. Defaults work for solo local use.

| Var              | Where    | Default                          | Purpose                                            |
| ---------------- | -------- | -------------------------------- | -------------------------------------------------- |
| `IPOD_ENGINE_LISTEN_ADDR` | engine | `127.0.0.1:8765`               | Go engine listen address                           |
| `IPOD_ENGINE_URL`         | services | `http://127.0.0.1:8765`       | Where the node finds the Go engine                 |
| `TRANSPORTER`             | services | `` (empty = standalone)       | Moleculer transporter; set to `NATS` to federate   |
| `NAMESPACE`               | services | `` (empty)                    | Moleculer mesh namespace                           |
| `PORT`                    | services | `3280`                        | API gateway port                                   |
| `METRICS_PORT`            | services | `3380`                        | Prometheus metrics port                            |
| `IPOD_FS_ROOT`             | services | `/`                           | Root the server-side folder picker may browse      |
| `IPOD_IMPORTS_DIR`         | services | `./data/uploads`              | Where uploaded audio files are stored              |
| `VITE_API_BASE_URL`       | web      | `` (uses dev proxy → `:3280`)  | Absolute gateway URL in production (dev proxies `/api`) |
| `VITE_API_PROXY_TARGET`   | web      | `http://localhost:3280`       | Target the dev proxy forwards `/api` to            |

---

## CLI (Go engine)

```bash
cd engine
go run ./cmd/ipod --help
go run ./cmd/ipod serve                 # HTTP server on :8765
go run ./cmd/ipod devices               # list discovered iPods (JSON)
go run ./cmd/ipod sync -f request.json  # one-shot sync from a JSON request
```

The engine's HTTP contract is documented in [`engine/openapi.yaml`](engine/openapi.yaml).

---

## Test

```bash
# Go engine — includes byte-exact golden tests for the format writers
cd engine && go test ./...

# Moleculer services
cd services && npm test

# Web app (unit tests + typecheck)
cd web && npm test
cd web && npm run check
```

---

## Layout

```
engine/      Go device engine (Cobra/Viper, stdlib HTTP). Own go.mod.
  internal/
    itunes/  iTunesSD / iTunesStats binary writers  ← the crown jewel
    layout/  on-device path allocation (F##/S#####)
    audio/   extension classification
    discover/ diskutil parsing, volume discovery
    sync/    dry-run planner + executor
    api/     stateless HTTP handlers
  cmd/ipod/  `ipod serve` + subcommands
  openapi.yaml  the engine HTTP contract

services/    Moleculer node (scaffolded via the Moleculer CLI)
  services/  one service per file; *Db.db.service.js own data
  lib/       engine HTTP client, fs scanner, audio
  moleculer.config.js  namespace + transporter (env-driven)

  Notable services:
  ipodFs           server-side directory browser (folder picker)
  ipodImports      multipart audio upload → managed library dir + track
  api /upload/track  multipart ingest endpoint

web/         SvelteKit + Svelte 5 UI (runes mode)
  src/lib/components/  decomposed: per-domain (devices/, playlists/, library/)
  src/lib/api/         typed per-domain API client
  src/routes/          thin page orchestrators (devices, playlists, library)

golden/      Byte-exact reference vectors for the format writers
  reference/  the original TypeScript writers (provenance)
  capture.ts  regenerates golden/*.bin from the reference
```

## The crown jewel

`iTunesSD`/`iTunesStats` are reverse-engineered Apple-proprietary binary
formats. The Go `internal/itunes` package is a port of the original TypeScript
writers and is verified **byte-exact** against golden vectors captured from that
reference. See [`golden/README.md`](golden/README.md). One wrong offset corrupts
a device's database, so this port is gated on reproducing every golden vector.

## Status

Refactored from a single-commit TypeScript TUI prototype into the engine +
mesh-node + web split above. The original format logic survives as
`golden/reference/` and is reproduced exactly by the Go port.
