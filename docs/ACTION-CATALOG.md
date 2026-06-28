# Action Catalog

> Every public Moleculer action exposed by the ipod-shuffle services.
> Auto-generated conventions: `service.action`, params, HTTP alias, type.

---

## Data-Owner Services

### ipodTracksDb

| Action | Required Params | Optional Params | HTTP | Description |
|---|---|---|---|---|
| `upsertRecord` | `sourcePath`, `fileName`, `extension`, `sizeBytes`, `modifiedAtMs` | — | — | Insert/update track by source path |
| `resolveByIds` | `ids` (string[]) | — | — | Resolve tracks by IDs, order-preserving |
| `listAll` | — | — | — | Return all tracks (unpaginated) |
| `refresh` | `id`, `sizeBytes`, `modifiedAtMs` | — | — | Mark track present with new metadata |
| `markMissing` | `id` | — | — | Mark track as missing (ENOENT) |
| `findBySourcePath` | `sourcePath` | — | — | Find single track by source path |

### ipodPlaylistsDb

| Action | Required Params | Optional Params | HTTP | Description |
|---|---|---|---|---|
| `createNamed` | `name` | — | `POST /playlists` | Create with normalised unique name |
| `addTrack` | `id`, `trackId` | — | `POST /playlists/:id/tracks/:trackId` | Append track (idempotent) |
| `addTracks` | `id`, `trackIds` (string[]) | — | `POST /playlists/:id/tracks` | Batch append (deduped) |
| `insertTracks` | `id`, `trackIds`, `position` | — | `POST /playlists/:id/insert` | Insert at position (-1=append) |
| `removeTrack` | `id`, `trackId` | — | `DELETE /playlists/:id/tracks/:trackId` | Remove track |
| `rename` | `id`, `name` | — | `PATCH /playlists/:id` | Rename (normalised, unique) |
| `removeWithAssignments` | `id` | — | `DELETE /playlists/:id` | Delete + clear device assignments |
| `setOrder` | `orderedIds` | — | `POST /playlists/order` | Reorder playlist list |
| `setTrackOrder` | `id`, `trackIds` | — | `POST /playlists/:id/order` | Rewrite track order |
| `clone` | `id` | `name`, `groupId` | `POST /playlists/:id/clone` | Deep-copy into independent playlist |
| `alias` | `sourceId` | `groupId`, `name` | `POST /playlists/:id/alias` | Create alias (mirrors source) |
| `moveToGroup` | `id` | `groupId` | `PATCH /playlists/:id/group` | Move to group (null=ungrouped) |
| `resolveSource` | `id` | — | — | Follow alias chain to ultimate source |
| `listByGroup` | `groupId` | — | — | Playlists in a group (sorted by position) |
| `findByName` | `name` | — | — | Case-insensitive name lookup |
| `resolveByIds` | `ids` | — | — | Resolve playlists by IDs |

### ipodPlaylistGroupsDb

| Action | Required Params | HTTP | Description |
|---|---|---|---|
| `createNamed` | `name` | `POST /groups` | Create group |
| `rename` | `id`, `name` | `PATCH /groups/:id` | Rename group |
| `removeGroup` | `id` | `DELETE /groups/:id` | Delete + unassign members |
| `listOrdered` | — | `GET /groups` | List groups by position |
| `setOrder` | `orderedIds` | `POST /groups/order` | Reorder groups |
| `resolveByIds` | `ids` | — | Resolve groups by IDs |

### ipodDevicesDb

| Action | Required Params | HTTP | Description |
|---|---|---|---|
| `upsertFromDiscovery` | `discovered` (object) | — | Create/refresh device from engine discovery |
| `togglePlaylistAssignment` | `deviceId`, `playlistId` | `POST /devices/:id/playlists/:pid` | Toggle playlist sync assignment |
| `toggleGroupAssignment` | `deviceId`, `groupId` | `POST /devices/:id/groups/:gid` | Toggle group sync assignment |
| `setPlaylistOrder` | `deviceId`, `playlistIds` | `POST /devices/:id/order` | Set sync order |
| `recordSync` | `deviceId`, `manifest`, `syncedAt` | — | Persist sync result |
| `removeById` | `id` | — | Remove device record |
| `listAll` | — | — | All devices (unpaginated) |
| `findByVolumeUuid` | `volumeUuid` | — | Find by UUID |

### ipodLibraryRootsDb

| Action | Required Params | HTTP | Description |
|---|---|---|---|
| `add` | `path` | — | Add root (idempotent) |
| `listPaths` | — | — | Return root paths (strings) |
| `listAll` | — | — | Return full root documents |
| `removeByPath` | `path` | — | Remove root by path |

---

## Business Services

### ipodLibrary

| Action | Required Params | HTTP | Description |
|---|---|---|---|
| `addRoot` | `rootPath` | `POST /library/roots` | Register root + scan immediately |
| `listRoots` | — | `GET /library/roots` | List registered roots |
| `removeRoot` | `path` | `DELETE /library/roots` | Remove root |
| `rescan` | — | `POST /library/rescan` | Scan all roots for new audio |
| `revalidate` | — | `POST /library/revalidate` | Re-stat all tracks (mark missing) |
| `addTrack` | `sourcePath` | `POST /library/tracks` | Register single track |
| `addTracks` | `sourcePaths` (string[]) | `POST /library/tracks/batch` | Batch register tracks |
| `listTracks` | — | `GET /tracks` | List all tracks |

### ipodDevices

| Action | Required Params | HTTP | Description |
|---|---|---|---|
| `refresh` | — | `GET /devices` | Discover + upsert mounted devices |
| `register` | `mountPath` | `POST /devices/register` | Register manual mount |
| `isOnline` | `deviceId` | `GET /devices/:id/online` | Check if device is mounted |
| `remove` | `deviceId` | `DELETE /devices/:id` | Forget device |
| `wipe` | `deviceId` | `POST /devices/:id/wipe` | Erase all audio from device |
| `name` | `deviceId`, `name` | `POST /devices/:id/name` | Rename device (writes identity) |
| `state` | `deviceId` | `GET /devices/:id/state` | Complete device state (assignments, snapshot, diff) |

### ipodSync

| Action | Required Params | HTTP | Description |
|---|---|---|---|
| `resolve` | `deviceId` | `GET /sync/:id/resolve` | What would sync (track union) |
| `plan` | `deviceId` | `GET /sync/:id/plan` | Dry-run sync plan |
| `run` | `deviceId` | `POST /sync/:id` | Start async sync (returns immediately) |
| `status` | `deviceId` | `GET /sync/:id/status` | Poll sync progress |
| `cancel` | `deviceId` | `POST /sync/:id/cancel` | Abort running sync |

### ipodEngine

| Action | Required Params | HTTP | Description |
|---|---|---|---|
| `health` | — | `GET /engine/health` | Check Go engine liveness |
| `discover` | — | — | Scan /Volumes for iPods |
| `inspect` | `mountPath` | — | Inspect single mount |
| `syncPlan` | `mountPath`, `tracks`, `playlists` | — | Dry-run via engine |
| `sync` | `mountPath`, `tracks`, `playlists` | — | Execute sync (streaming NDJSON) |
| `setIdentity` | `mountPath`, `name`, `id` | — | Write identity file |
| `wipe` | `mountPath` | — | Erase device audio |

### ipodFs

| Action | Required Params | HTTP | Description |
|---|---|---|---|
| `list` | `dir` (default: root) | `GET /fs/list` | Browse directory |
| `expand` | `dir` | `POST /fs/expand` | Recursive audio file list |

---

## Moleculer Built-in Actions (from @moleculer/database mixin)

Every `*.db.service.js` automatically exposes:
- `list` — paginated list
- `find` — filtered query
- `get` — by ID
- `create` — new entity
- `update` — partial update
- `remove` — delete by ID
- `count` — total count

These are available via `broker.call("serviceName.method")` but most are NOT exposed via HTTP aliases (only via the explicit aliases listed above).
