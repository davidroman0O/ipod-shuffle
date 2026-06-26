import { apiFetch, apiPost } from './client';

export interface FsEntry {
	name: string;
	isDir: boolean;
}

export interface FsListing {
	path: string;
	entries: FsEntry[];
}

export const fsApi = {
	list: (dir?: string) =>
		apiFetch<FsListing>(`/fs/list${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`),
	/** Recursively expand a directory into all its audio file paths. */
	expand: (dir: string) => apiPost<{ dir: string; paths: string[] }>('/fs/expand', { dir })
};
