import { apiFetch, apiPost, apiDelete, apiPatch } from './client';
import type { Playlist } from './types';

export const playlistsApi = {
	/** Playlists ordered by their list `position`. */
	list: () => apiFetch<Playlist[]>('/playlists'),
	get: (id: string) => apiFetch<Playlist>(`/playlists/${id}`),
	create: (name: string) => apiPost<Playlist>('/playlists', { name }),
	/** Rename a playlist (normalised + unique). */
	rename: (id: string, name: string) =>
		apiPatch<Playlist>(`/playlists/${id}`, { name }),
	/** Delete a playlist and clear its assignment on every device. */
	remove: (id: string) => apiDelete<string | null>(`/playlists/${id}`),
	/** Reorder the playlist list itself (full ordered id list). */
	setOrder: (orderedIds: string[]) => apiPost('/playlists/order', { orderedIds }),
	/** Reorder tracks within a playlist (full desired track id list). */
	setTrackOrder: (id: string, trackIds: string[]) =>
		apiPost<Playlist>(`/playlists/${id}/order`, { trackIds }),
	/** Append many track ids to a playlist (deduped, order-preserving). */
	addTracks: (id: string, trackIds: string[]) =>
		apiPost<Playlist>(`/playlists/${id}/tracks`, { trackIds }),
	/** Insert many track ids at a position (-1 = append). */
	insertTracks: (id: string, trackIds: string[], position: number) =>
		apiPost<Playlist>(`/playlists/${id}/insert`, { trackIds, position }),
	addTrack: (id: string, trackId: string) => apiPost<Playlist>(`/playlists/${id}/tracks/${trackId}`),
	removeTrack: (id: string, trackId: string) => apiDelete<Playlist>(`/playlists/${id}/tracks/${trackId}`),
	/** Clone a playlist (deep-copy trackIds into an independent playlist). */
	clone: (id: string, name?: string, groupId?: string | null) =>
		apiPost<Playlist>(`/playlists/${id}/clone`, { name, groupId }),
	/** Create an alias (mirrors source, no own tracks). */
	alias: (sourceId: string, groupId?: string | null, name?: string) =>
		apiPost<Playlist>(`/playlists/${sourceId}/alias`, { groupId, name }),
	/** Move a playlist to a group (null = ungrouped). */
	moveToGroup: (id: string, groupId: string | null) =>
		apiPatch<Playlist>(`/playlists/${id}/group`, { groupId })
};
