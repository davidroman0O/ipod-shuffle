import { apiFetch, apiPost, apiDelete } from './client';
import type { PlaylistGroup } from './types';

export const groupsApi = {
	list: () => apiFetch<PlaylistGroup[]>('/groups'),
	create: (name: string) => apiPost<PlaylistGroup>('/groups', { name }),
	rename: (id: string, name: string) =>
		apiFetch<PlaylistGroup>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
	remove: (id: string) => apiDelete<string | null>(`/groups/${id}`),
	setOrder: (orderedIds: string[]) => apiPost('/groups/order', { orderedIds })
};
