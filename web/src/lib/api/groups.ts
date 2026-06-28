import { apiFetch, apiPost, apiDelete, apiPatch } from './client';
import type { PlaylistGroup } from './types';

export const groupsApi = {
	list: () => apiFetch<PlaylistGroup[]>('/groups'),
	create: (name: string) => apiPost<PlaylistGroup>('/groups', { name }),
	rename: (id: string, name: string) => apiPatch<PlaylistGroup>(`/groups/${id}`, { name }),
	remove: (id: string) => apiDelete<string | null>(`/groups/${id}`),
	setOrder: (orderedIds: string[]) => apiPost('/groups/order', { orderedIds })
};
