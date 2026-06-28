# Error Catalog

> Every error type thrown by ipod-shuffle services. Maps to HTTP status codes
> per HTTP API Guide §3. The API gateway converts these to RFC 9457 Problem
> Details responses automatically.

---

## Error Types

### Validation Errors (4xx)

| Error Code | HTTP | Moleculer Error Type | When | Example |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` | Invalid params (wrong type, missing structure) | `POST /playlists { name: 123 }` |
| `MISSING_ID` | 400 | `MoleculerClientError` | Missing required ID field | `GET /playlists/` (no id) |
| `UNSUPPORTED_AUDIO` | 422 | `MoleculerError` | File extension not in supported list | `.flac` file added |
| `NOT_A_FILE` | 422 | `MoleculerError` | Path points to a directory, not a file | `POST /library/tracks { sourcePath: "/dir" }` |
| `EMPTY_NAME` | 422 | `MoleculerError` | Playlist/group name is empty after trimming | `POST /playlists { name: "   " }` |
| `EXPECTED_DIRECTORY` | 422 | `MoleculerError` | Library root path is not a directory | `POST /library/roots { rootPath: "/file.txt" }` |

### Conflict Errors (409)

| Error Code | HTTP | When |
|---|---|---|
| `DUPLICATE_NAME` | 409 | Playlist name already exists (case-insensitive) |
| `ALREADY_RUNNING` | 409 | A sync is already running on this device |
| `DEVICE_NOT_MOUNTED` | 409 | Device record exists but no mount path available |

### Not Found Errors (404)

| Error Code | HTTP | When |
|---|---|---|
| `PLAYLIST_NOT_FOUND` | 404 | Playlist ID doesn't exist |
| `DEVICE_NOT_FOUND` | 404 | Device ID doesn't exist |
| `ENTITY_NOT_FOUND` | 404 | Generic — entity ID doesn't exist (from @moleculer/database) |
| `PATH_NOT_FOUND` | 404 | Filesystem path doesn't exist (ENOENT) |
| `PATH_NO_ACCESS` | 403 | Filesystem path exists but no read permission (EACCES) |
| `PATH_OUTSIDE_ROOT` | 403 | Requested path is outside the configured IPOD_FS_ROOT |

### Engine Errors (5xx)

| Error Code | HTTP | When |
|---|---|---|
| `ENGINE_UNREACHABLE` | 503 | Go engine not responding on configured port |
| `ENGINE_RESPONDED_ERROR` | 500 | Engine returned non-2xx (passed through with status) |
| `SYNC_FAILED` | 500 | Sync execution failed (copy error, write error) |

### Internal Errors (500)

| Error Code | HTTP | When |
|---|---|---|
| `INTERNAL_ERROR` | 500 | Unhandled exception |
| `CONTEXT_EXPIRED` | 500 | Background task used expired ctx (should use broker.call) |

---

## Error Response Format (RFC 9457)

All errors are returned as `application/problem+json`:

```json
{
  "type": "https://errors.ipod-shuffle.dev/duplicate_name",
  "title": "MoleculerError",
  "status": 409,
  "detail": "Playlist \"Rock\" already exists.",
  "instance": "/api/playlists",
  "requestId": "req_01JABCDEF",
  "errors": [
    { "field": "name", "message": "Playlist name must be unique" }
  ]
}
```

## Error Handling Rules (per Moleculer Guide §4)

1. **Normalize at boundaries**: wrap external errors (Go engine, filesystem) into `MoleculerError`
2. **Never leak transport errors**: DB errors get wrapped with operation context
3. **Retryable vs non-retryable**: temporary failures (503) → `MoleculerRetryableError`; business denials (409, 422) → NOT retryable
4. **HTTP status mapping**: 400/404/409/422/429/500/503 — each has a distinct meaning (see HTTP API Guide §3)
