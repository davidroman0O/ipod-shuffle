import { apiFetch } from './client';
import type { Device } from './types';

/** Assignment tree node from GET /devices/:id/state */
export interface AssignmentTreeNode {
	id: string | null;
	name: string;
	type: 'group' | 'ungrouped';
	assigned: boolean;
	playlists: Array<{
		id: string;
		name: string;
		aliasOf: string | null;
		trackCount: number;
		assigned: boolean;
		viaGroup: boolean;
		effective: boolean;
	}>;
}

export interface DeviceState {
	device: {
		id: string;
		name: string;
		online: boolean;
		totalBytes: number;
		freeBytes: number;
		lastSyncAt: string | null;
		lastKnownMountPath: string | null;
	};
	assignments: {
		tree: AssignmentTreeNode[];
		assignedPlaylistIds: string[];
		assignedGroupIds: string[];
	};
	onDevice: {
		syncedAt: string;
		totalTracks: number;
		playlists: Array<{
			id: string;
			name: string;
			tracks: Array<{ id: string; fileName: string; sourcePath: string; devicePath: string; sizeBytes: number }>;
		}>;
	} | null;
	diff: {
		status: 'in-sync' | 'out-of-sync' | 'no-snapshot';
		added: Array<{ id: string; fileName: string }>;
		removed: Array<{ id: string; fileName: string }>;
		unchangedCount: number;
	};
	resolve: {
		trackCount: number;
		playlistCount: number;
	};
}

export const stateApi = {
	getDeviceState: (deviceId: string) => apiFetch<DeviceState>(`/devices/${deviceId}/state`)
};
