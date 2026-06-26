import { apiFetch, apiPost } from './client';
import type { Track } from './types';

export const tracksApi = {
	list: () => apiFetch<Track[]>('/tracks'),
	addTrack: (sourcePath: string) =>
		apiPost<{ track: Track; created: boolean }>('/library/tracks', { sourcePath })
};
