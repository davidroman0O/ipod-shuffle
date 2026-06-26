/**
 * Discriminated drag payload for sveltednd. A single set of containers carries
 * either library items (one or many files, or a folder that expands on drop),
 * an existing track (reorder), or a playlist (reorder the list).
 *
 * Drop zones inspect `kind` to decide what to do.
 */
export type DragPayload =
	| { kind: 'files'; paths: string[] }
	| { kind: 'folder'; absolutePath: string; name: string }
	| { kind: 'track'; trackId: string }
	| { kind: 'playlist'; playlistId: string };

export function isFilesPayload(
	p: unknown
): p is { kind: 'files'; paths: string[] } {
	return !!p && typeof p === 'object' && (p as DragPayload).kind === 'files';
}

export function isFolderPayload(
	p: unknown
): p is { kind: 'folder'; absolutePath: string; name: string } {
	return !!p && typeof p === 'object' && (p as DragPayload).kind === 'folder';
}

/** True for any payload that originates from the library (files or folder). */
export function isLibraryPayload(p: unknown): boolean {
	if (!p || typeof p !== 'object') return false;
	const k = (p as DragPayload).kind;
	return k === 'files' || k === 'folder';
}
