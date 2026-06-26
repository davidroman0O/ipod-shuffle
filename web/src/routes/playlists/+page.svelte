<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		playlistsApi,
		tracksApi,
		libraryApi,
		fsApi,
		type Playlist,
		type Track,
		type LibraryRoot
	} from '$lib/api';
	import { isFilesPayload, isFolderPayload, type DragPayload } from '$lib/utils/drag';
	import SortablePlaylistList from '$lib/components/playlists/sortable-playlist-list.svelte';
	import SortableTrackList from '$lib/components/playlists/sortable-track-list.svelte';
	import CreatePlaylistDialog from '$lib/components/playlists/create-playlist-dialog.svelte';
	import LibraryPanel from '$lib/components/playlists/library-panel.svelte';

	let playlists = $state<Playlist[]>([]);
	let allTracks = $state<Track[]>([]);
	let roots = $state<LibraryRoot[]>([]);
	let selectedId = $state<string | null>(null);
	let loading = $state(true);

	onMount(load);

	async function load() {
		loading = true;
		try {
			[playlists, allTracks, roots] = await Promise.all([
				playlistsApi.list(),
				tracksApi.list(),
				libraryApi.listRoots()
			]);
			if (!selectedId && playlists.length) selectedId = playlists[0]!.id;
		} catch (e) {
			toast.error('Load failed', { description: (e as Error).message });
		} finally {
			loading = false;
		}
	}

	const selected = $derived(playlists.find((p) => p.id === selectedId) ?? null);
	const selectedTracks = $derived(selected ? tracksForPlaylist(selected, allTracks) : []);

	function tracksForPlaylist(playlist: Playlist, tracks: Track[]): Track[] {
		const byId = new Map(tracks.map((t) => [t.id, t]));
		return playlist.trackIds.map((id) => byId.get(id)).filter((t): t is Track => Boolean(t));
	}

	async function handlePlaylistReorder(orderedIds: string[]) {
		const previous = playlists;
		const order = new Map(orderedIds.map((id, i) => [id, i]));
		playlists = [...playlists].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
		try {
			await playlistsApi.setOrder(orderedIds);
		} catch (e) {
			playlists = previous;
			toast.error('Reorder failed', { description: (e as Error).message });
		}
	}

	async function handleTrackReorder(trackIds: string[]) {
		if (!selected) return;
		const prev = selected.trackIds;
		selected.trackIds = trackIds; // optimistic
		try {
			await playlistsApi.setTrackOrder(selected.id, trackIds);
		} catch (e) {
			if (selected) selected.trackIds = prev;
			toast.error('Reorder failed', { description: (e as Error).message });
		}
	}

	async function handleRemoveTrack(trackId: string) {
		if (!selected) return;
		try {
			const updated = await playlistsApi.removeTrack(selected.id, trackId);
			applyPlaylistUpdate(updated);
		} catch (e) {
			toast.error('Remove failed', { description: (e as Error).message });
		}
	}

	async function handleRemovePlaylist(id: string) {
		const pl = playlists.find((p) => p.id === id);
		if (!pl) return;
		if (!confirm(`Delete playlist "${pl.name}"? It will be removed from all devices.`)) return;
		try {
			await playlistsApi.remove(id);
			toast.success('Playlist deleted', { description: pl.name });
			if (selectedId === id) selectedId = null;
			await load();
		} catch (e) {
			toast.error('Delete failed', { description: (e as Error).message });
		}
	}

	function applyPlaylistUpdate(updated: Playlist) {
		const idx = playlists.findIndex((p) => p.id === updated.id);
		if (idx !== -1) playlists[idx] = updated;
	}

	/** Resolve a drag payload into a list of absolute file paths (expanding folders via the backend). */
	async function payloadToPaths(payload: DragPayload): Promise<string[]> {
		if (isFilesPayload(payload)) return payload.paths;
		if (isFolderPayload(payload)) {
			const expanded = await fsApi.expand(payload.absolutePath);
			return expanded.paths;
		}
		return [];
	}

	/** Batch add: register tracks by path, then add/insert into a playlist. */
	async function addPathsToPlaylist(
		playlistId: string,
		paths: string[],
		position: number
	): Promise<number> {
		if (!paths.length) return 0;
		const { tracks: upserted } = await libraryApi.addTracks(paths);
		if (!upserted.length) return 0;
		// Merge into the local track cache.
		const byId = new Map(allTracks.map((t) => [t.id, t]));
		for (const t of upserted) byId.set(t.id, t);
		allTracks = [...byId.values()];
		const trackIds = upserted.map((t) => t.id);
		const updated =
			position < 0
				? await playlistsApi.addTracks(playlistId, trackIds)
				: await playlistsApi.insertTracks(playlistId, trackIds, position);
		applyPlaylistUpdate(updated);
		return upserted.length;
	}

	/** Library payload dropped onto a playlist NAME → append all. */
	async function handleDropOnPlaylist(playlistId: string, payload: DragPayload) {
		try {
			const paths = await payloadToPaths(payload);
			const count = await addPathsToPlaylist(playlistId, paths, -1);
			const name = playlists.find((p) => p.id === playlistId)?.name ?? 'playlist';
			toast.success(`Added ${count} to “${name}”`);
		} catch (e) {
			toast.error('Add failed', { description: (e as Error).message });
		}
	}

	/** Library payload dropped onto the open track LIST → insert at position (-1 = append). */
	async function handleDropOnTrackList(payload: DragPayload, position: number) {
		if (!selected) return;
		try {
			const paths = await payloadToPaths(payload);
			const count = await addPathsToPlaylist(selected.id, paths, position);
			toast.success(`${count === 1 ? 'Track' : count + ' tracks'} added to “${selected.name}”`);
		} catch (e) {
			toast.error('Add failed', { description: (e as Error).message });
		}
	}
</script>

<svelte:head><title>Playlists · ipod</title></svelte:head>

{#if loading}
	<p class="text-sm text-muted-foreground">Loading…</p>
{:else}
	<!-- 3 columns: playlists (narrow) | selected tracks | library (widest). Each
	     column scrolls independently; the page fills the viewport and never scrolls. -->
	<div class="grid h-[calc(100vh-7rem)] grid-cols-[15rem_minmax(0,1fr)_minmax(0,1.4fr)] gap-4 overflow-hidden">
		<!-- Col 1: playlists -->
		<aside class="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
			<div class="flex shrink-0 items-center justify-between">
				<h2 class="text-sm font-medium">Playlists</h2>
				<CreatePlaylistDialog onCreated={load} />
			</div>
			<div class="min-h-0 flex-1 overflow-hidden">
				<SortablePlaylistList
					{playlists}
					{selectedId}
					onSelect={(id) => (selectedId = id)}
					onReorder={handlePlaylistReorder}
					onRenamed={load}
					onRemoved={handleRemovePlaylist}
					onDropFile={handleDropOnPlaylist}
				/>
			</div>
		</aside>

		<!-- Col 2: selected playlist tracks -->
		<section class="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden border-l pl-4">
			<div class="flex shrink-0 items-center justify-between">
				<h2 class="text-sm font-medium">
					{selected ? selected.name : 'Tracks'}
				</h2>
				{#if selected}
					<span class="text-xs text-muted-foreground">{selectedTracks.length}</span>
				{/if}
			</div>
			<div class="min-h-0 flex-1 overflow-hidden">
				{#if selected}
					<SortableTrackList
						playlist={selected}
						tracks={selectedTracks}
						onReorder={handleTrackReorder}
						onRemoveTrack={handleRemoveTrack}
						onDropFile={handleDropOnTrackList}
					/>
				{:else}
					<p class="px-3 py-8 text-center text-sm text-muted-foreground">
						Select a playlist, or create one.
					</p>
				{/if}
			</div>
		</section>

		<!-- Col 3: library (bookmark nav + folder items) -->
		<section class="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden border-l pl-4">
			<h2 class="shrink-0 text-sm font-medium">Library</h2>
			<div class="min-h-0 flex-1 overflow-hidden">
				<LibraryPanel {roots} />
			</div>
		</section>
	</div>
{/if}
