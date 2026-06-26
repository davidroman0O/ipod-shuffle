import { apiFetch, apiPost } from './client';
import type { EnginePlaylistInput, EngineTrackInput, SyncPlan, SyncResult, SyncJobStatus } from './types';

export type { SyncJobStatus };

/** Resolved device contents (the union that would sync) — no writes. */
export interface ResolvedDevice {
	device: { id: string; name: string };
	tracks: EngineTrackInput[];
	playlists: EnginePlaylistInput[];
}

export const syncApi = {
	resolve: (deviceId: string) => apiFetch<ResolvedDevice>(`/sync/${deviceId}/resolve`),
	plan: (deviceId: string) => apiFetch<SyncPlan>(`/sync/${deviceId}/plan`),
	run: (deviceId: string) =>
		apiFetch<{ deviceId: string; status: string }>(`/sync/${deviceId}`, { method: 'POST' }),
	status: (deviceId: string) => apiFetch<SyncJobStatus>(`/sync/${deviceId}/status`),
	cancel: (deviceId: string) => apiPost<{ cancelled: boolean }>(`/sync/${deviceId}/cancel`)
};
