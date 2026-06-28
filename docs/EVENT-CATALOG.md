# Event Catalog

> Every event emitted by ipod-shuffle services. Events are past-tense facts
> (per Moleculer Guide §5). Built-in events are fire-and-forget; for durable
> delivery use @moleculer/channels.

---

## Device Events

| Event | Producer | Payload | Consumers | When |
|---|---|---|---|---|
| `ipod.devices.refreshed` | `ipodDevices` | `{ total, created }` | Mesh (future: auto-sync on mount) | After device discovery completes |
| `ipod.devices.registered` | `ipodDevices` | `{ deviceId, mountPath }` | None (yet) | After manual device registration |
| `ipod.devices.playlists.changed` | `ipodDevices` | `{ deviceId, playlistId }` | None (yet) | After playlist assignment toggled |
| `ipod.devices.playlists.reordered` | `ipodDevices` | `{ deviceId }` | None (yet) | After sync order changed |
| `ipod.devices.removed` | `ipodDevices` | `{ deviceId }` | None (yet) | After device forgotten |
| `ipod.devices.wiped` | `ipodDevices` | `{ deviceId }` | Mesh (future: UI refresh) | After device wiped |

## Sync Events

| Event | Producer | Payload | Consumers | When |
|---|---|---|---|---|
| `ipod.sync.started` | `ipodSync` | `{ deviceId, trackCount }` | Mesh (future: UI live update) | When async sync begins |
| `ipod.sync.completed` | `ipodSync` | `{ deviceId, trackCount }` | Mesh (UI re-fetches state) | When sync finishes successfully |
| `ipod.sync.failed` | `ipodSync` | `{ deviceId, error }` | Mesh (UI shows error) | When sync fails or is cancelled |

## Playlist Events

| Event | Producer | Payload | Consumers | When |
|---|---|---|---|---|
| `ipod.playlists.created` | `ipodPlaylists` | `{ playlistId, name }` | None (yet) | After playlist created |
| `ipod.playlists.renamed` | `ipodPlaylists` | `{ playlistId, name }` | None (yet) | After playlist renamed |
| `ipod.playlists.removed` | `ipodPlaylists` | `{ playlistId }` | None (yet) | After playlist deleted |
| `ipod.playlists.reordered` | `ipodPlaylists` | `{ orderedIds }` | None (yet) | After playlist list reordered |
| `ipod.playlists.tracks.reordered` | `ipodPlaylists` | `{ playlistId, trackIds }` | None (yet) | After tracks within playlist reordered |
| `ipod.playlists.tracks.changed` | `ipodPlaylists` | `{ playlistId, trackId }` | None (yet) | After track added/removed from playlist |

---

## Event Naming Convention

All events follow `ipod.<entity>.<past-tense-verb>`:
- `ipod.sync.completed` ✅ (past tense = fact)
- `ipod.sync.now` ❌ (imperative = command, use broker.call instead)

## Subscription Rules

1. Only subscribe if you don't need a response
2. Only subscribe if eventual consistency is acceptable
3. Built-in events are fire-and-forget — if the consumer is offline, the event is lost
4. For must-process workflows, use `@moleculer/channels` (durable, retryable, dead-letter)

## Future Consumers

In the federated AgentOS mesh, these events enable:
- **Auto-sync on mount**: subscribe to `ipod.devices.refreshed` → if device has pending changes → auto-trigger sync
- **Cross-repo composition**: another repo's service reacts to `ipod.sync.completed` → e.g., update a dashboard
- **Webhook relay**: a mesh node subscribes to all `ipod.*` events → relays to external webhooks
