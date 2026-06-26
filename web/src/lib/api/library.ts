import { apiFetch, apiPost } from './client';
import type { LibraryRoot } from './types';

export const libraryApi = {
	listRoots: () => apiFetch<LibraryRoot[]>('/library/roots'),
	addRoot: (path: string) =>
		apiPost<{ root: string; scanned: number; created: number }>('/library/roots', { rootPath: path }),
	removeRoot: (path: string) =>
		apiFetch<{ removed: string | null }>(`/library/roots?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
	rescan: () =>
		apiPost<Array<{ root: string; scanned: number; created: number }>>('/library/rescan'),
	revalidate: () => apiPost<{ checked: number; changed: number }>('/library/revalidate'),
	/** Register a single track by its absolute path (stats the file on the host). */
	addTrack: (sourcePath: string) =>
		apiPost<{ track: import('./types').Track; created: boolean }>('/library/tracks', { sourcePath }),
	/** Batch-register many tracks by absolute path. Returns the upserted tracks. */
	addTracks: (sourcePaths: string[]) =>
		apiPost<{ tracks: import('./types').Track[] }>('/library/tracks/batch', { sourcePaths })
};;
