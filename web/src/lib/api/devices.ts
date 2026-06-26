import { apiFetch, apiPost } from './client';
import type { Device } from './types';

export const devicesApi = {
	/** Discover + upsert mounted iPods. */
	refresh: () => apiFetch<{ devices: Device[]; created: number }>('/devices'),
	/** Manually register a mount path. */
	register: (mountPath: string) =>
		apiPost<Device>('/devices/register', { mountPath }),
	/** Toggle a playlist assignment on a device. */
	assignPlaylist: (deviceId: string, playlistId: string) =>
		apiPost<Device>(`/devices/${deviceId}/playlists/${playlistId}`),
	/** Is the device currently mounted? */
	isOnline: (deviceId: string) => apiFetch<boolean>(`/devices/${deviceId}/online`),
	/** Forget a device record. */
	remove: (deviceId: string) => apiFetch<string | null>(`/devices/${deviceId}`, { method: 'DELETE' }),
	/** Set the ordered list of playlists assigned to a device (= sync order). */
	setPlaylistOrder: (deviceId: string, playlistIds: string[]) =>
		apiPost<Device>(`/devices/${deviceId}/order`, { playlistIds })
};
