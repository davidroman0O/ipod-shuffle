/**
 * Single entrypoint re-exporting the per-domain API modules. Components import
 * from '$lib/api' so the surface stays stable while modules evolve.
 */
export { API_BASE_URL, ApiError } from './client';
export { engineApi } from './engine';
export { devicesApi } from './devices';
export { libraryApi } from './library';
export { tracksApi } from './tracks';
export { playlistsApi } from './playlists';
export { syncApi } from './sync';
export { fsApi } from './fs';
export { isSupportedAudioPath, normalizeAudioExtension } from './audio';
export type { FsEntry, FsListing } from './fs';
export type { ResolvedDevice } from './sync';
export type * from './types';
