/**
 * Domain types mirroring the Moleculer gateway's responses.
 * The `exists` flag on Track is the missing-file signal: revalidation flips it
 * to false when the source file is no longer on disk.
 */

export interface Track {
	id: string;
	sourcePath: string;
	fileName: string;
	extension: string;
	sizeBytes: number;
	modifiedAtMs: number;
	/** True when the source file is present on disk. False after revalidation
	 * marks it missing (ENOENT or not a file). */
	exists: boolean;
	addedAt: string;
	updatedAt: string;
}

export interface Playlist {
	id: string;
	name: string;
	trackIds: string[];
	/** List display/sync ordering; lower sorts first. */
	position: number;
	/** Group this playlist belongs to (null = ungrouped). */
	groupId: string | null;
	/** If set, this is an alias mirroring another playlist's tracks. */
	aliasOf: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface PlaylistGroup {
	id: string;
	name: string;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface LibraryRoot {
	id: string;
	path: string;
	addedAt: string;
}

export interface Device {
	id: string;
	name: string;
	playlistIds: string[];
	preferredMountPath?: string;
	lastKnownMountPath?: string;
	volumeUuid?: string;
	deviceNode?: string;
	totalBytes?: number;
	freeBytes?: number;
	lastSeenAt?: string;
	lastSyncAt?: string;
	manifest?: ManifestEntry[];
	/** On-device identity (from iPod_Control/.ipod-shuffle-identity.json). */
	identity?: DeviceIdentity;
}

export interface ManifestEntry {
	trackId: string;
	relativePath: string;
	sizeBytes: number;
}

/** On-device identity with the last-sync snapshot. */
export interface DeviceIdentity {
	id: string;
	name: string;
	snapshot?: DeviceSnapshot;
}

export interface DeviceSnapshot {
	syncedAt: string;
	totalTracks: number;
	playlists: DeviceSnapshotPlaylist[];
}

export interface DeviceSnapshotPlaylist {
	id: string;
	name: string;
	tracks: DeviceSnapshotTrack[];
}

export interface DeviceSnapshotTrack {
	id: string;
	fileName: string;
	sourcePath: string;
	devicePath: string;
	sizeBytes: number;
}

export interface EngineHealth {
	ok: boolean;
}

/** Sync preview (dry-run) returned by GET /sync/:id/plan. */
export interface SyncPlan {
	mountPath: string;
	trackCount: number;
	copies: Array<{ relativePath: string; reason: string }>;
	skips: number;
	deletes: string[];
	warnings: string[];
}

/** Sync execution result returned by POST /sync/:id (legacy — streaming
 * syncs now return via status polling). */
export interface SyncResult {
	syncedAt: string;
	writtenDatabaseBytes: number;
	writtenStatsBytes: number;
	manifest: ManifestEntry[];
	warnings: string[];
}

/** Live sync job status (polled by the UI every ~1s while running). */
export interface SyncJobStatus {
	deviceId: string;
	status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
	phase?: string;
	current?: number;
	total?: number;
	totalCopies?: number;
	currentPath?: string;
	error?: string | null;
	result?: { writtenDatabaseBytes: number; writtenStatsBytes: number; manifest: ManifestEntry[] } | null;
	startedAt?: string;
	finishedAt?: string | null;
}

/** A track resolved into the shape the sync engine consumes. */
export interface EngineTrackInput {
	trackId: string;
	sourcePath: string;
	fileName: string;
	sizeBytes: number;
}

/** A playlist resolved into the shape the sync engine consumes. */
export interface EnginePlaylistInput {
	playlistId: string;
	name: string;
	trackIds: string[];
}
