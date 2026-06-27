"use strict";

/**
 * Pure diff algorithm: compares what's on the device (the identity snapshot)
 * against what would sync now (the resolved state). Returns added/removed/
 * unchanged track sets so the UI can show the user exactly what will change.
 *
 * Extracted as a pure module so it's unit-testable independently of any service.
 */

/**
 * @typedef {Object} SnapshotTrackRef
 * @property {string} id
 * @property {string} fileName
 */

/**
 * @typedef {Object} SnapshotPlaylistRef
 * @property {string} id
 * @property {string} name
 * @property {SnapshotTrackRef[]} tracks
 */

/**
 * @typedef {Object} ResolvedTrackRef
 * @property {string} trackId
 */

/**
 * @typedef {Object} ResolvedPlaylistRef
 * @property {string} playlistId
 * @property {string} name
 * @property {string[]} trackIds
 */

/**
 * Compute the diff between the on-device snapshot and the current resolve.
 *
 * @param {{
 *   playlists?: SnapshotPlaylistRef[]
 * }} snapshot - From the identity file (what's physically on the device).
 * @param {{
 *   tracks: ResolvedTrackRef[],
 *   playlists: ResolvedPlaylistRef[]
 * }} resolved - What would sync now.
 * @returns {{
 *   status: 'in-sync' | 'out-of-sync' | 'no-snapshot',
 *   added: Array<{id: string, fileName: string}>,
 *   removed: Array<{id: string, fileName: string}>,
 *   unchangedCount: number
 * }}
 */
function computeDiff(snapshot, resolved) {
	if (!snapshot || !snapshot.playlists) {
		return { status: "no-snapshot", added: [], removed: [], unchangedCount: 0 };
	}

	// Track IDs currently on the device (from the snapshot).
	const onDevice = new Map();
	for (const pl of snapshot.playlists) {
		for (const track of (pl.tracks || [])) {
			onDevice.set(track.id, track.fileName);
		}
	}

	// Track IDs that would sync now (from the resolve).
	const willSync = new Map();
	for (const t of (resolved.tracks || [])) {
		willSync.set(t.trackId, t.trackId);
	}
	// Also resolve track fileNames from the playlist track refs if available.
	for (const pl of (resolved.playlists || [])) {
		for (const trackId of (pl.trackIds || [])) {
			willSync.set(trackId, trackId);
		}
	}

	const added = [];
	const removed = [];
	let unchangedCount = 0;

	// Added: in resolve but not on device.
	for (const [id] of willSync) {
		if (onDevice.has(id)) {
			unchangedCount++;
		} else {
			added.push({ id, fileName: id });
		}
	}

	// Removed: on device but not in resolve.
	for (const [id, fileName] of onDevice) {
		if (!willSync.has(id)) {
			removed.push({ id, fileName });
		}
	}

	const isClean = added.length === 0 && removed.length === 0;
	return {
		status: isClean ? "in-sync" : "out-of-sync",
		added,
		removed,
		unchangedCount
	};
}

module.exports = { computeDiff };
