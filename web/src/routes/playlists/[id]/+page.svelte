<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		playlistsApi,
		groupsApi,
		tracksApi,
		libraryApi,
		type Playlist,
		type PlaylistGroup,
		type Track,
		type LibraryRoot
	} from '$lib/api';
	import { isFilesPayload, isFolderPayload, type DragPayload } from '$lib/utils/drag';
	import SortableTrackList from '$lib/components/playlists/sortable-track-list.svelte';
	import LibraryPanel from '$lib/components/playlists/library-panel.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Link from '@lucide/svelte/icons/link';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { cn } from '$lib/utils';

	let playlists = $state<Playlist[]>([]);
	let groups = $state<PlaylistGroup[]>([]);
	let allTracks = $state<Track[]>([]);
	let roots = $state<LibraryRoot[]>([]);
	let loading = $state(true);

	const playlistId = $derived(page.params.id);

	onMount(load);

	async function load() {
		loading = true;
		try {
			[playlists, groups, allTracks, roots] = await Promise.all([
				playlistsApi.list(),
				groupsApi.list(),
				tracksApi.list(),
				libraryApi.listRoots()
			]);
		} catch (e) {
			toast.error('Load failed', { description: (e as Error).message });
		} finally {
			loading = false;
		}
	}

	const selected = $derived(playlists.find((p) => p.id === playlistId) ?? null);

	const grouped = $derived.by(() => {
		const byGroup = new Map<string | null, Playlist[]>();
		for (const g of groups) byGroup.set(g.id, []);
		byGroup.set(null, []);
		for (const p of playlists) {
			const key = p.groupId ?? null;
			if (!byGroup.has(key)) byGroup.set(key, []);
			byGroup.get(key)!.push(p);
		}
		return byGroup;
	});

	function tracksForPlaylist(playlist: Playlist, tracks: Track[]): Track[] {
		const byId = new Map(tracks.map((t) => [t.id, t]));
		return playlist.trackIds.map((id) => byId.get(id)).filter((t): t is Track => Boolean(t));
	}

	const selectedTracks = $derived(selected ? tracksForPlaylist(selected, allTracks) : []);

	const ungrouped = $derived(grouped.get(null) ?? []);

	/** Update a single playlist in the local state without reloading everything. */
	function patchPlaylist(updated: Playlist) {
		const idx = playlists.findIndex((p) => p.id === updated.id);
		if (idx !== -1) {
			playlists = [...playlists.slice(0, idx), updated, ...playlists.slice(idx + 1)];
		}
	}

	/** Merge new tracks into the local cache without a full reload. */
	function mergeTracks(newTracks: Track[]) {
		const byId = new Map(allTracks.map((t) => [t.id, t]));
		for (const t of newTracks) byId.set(t.id, t);
		allTracks = [...byId.values()];
	}

	async function handleTrackReorder(trackIds: string[]) {
		if (!selected) return;
		const prev = selected.trackIds;
		// Optimistic: update local state immediately for instant feedback.
		patchPlaylist({ ...selected, trackIds });
		try {
			await playlistsApi.setTrackOrder(selected.id, trackIds);
		} catch (e) {
			// Roll back on failure.
			patchPlaylist({ ...selected, trackIds: prev });
			toast.error('Reorder failed', { description: (e as Error).message });
		}
	}

	async function handleRemoveTrack(trackId: string) {
		if (!selected) return;
		const prev = selected.trackIds;
		const next = prev.filter((id) => id !== trackId);
		patchPlaylist({ ...selected, trackIds: next });
		try {
			await playlistsApi.removeTrack(selected.id, trackId);
		} catch (e) {
			patchPlaylist({ ...selected, trackIds: prev });
			toast.error('Remove failed', { description: (e as Error).message });
		}
	}

	async function payloadToPaths(payload: DragPayload): Promise<string[]> {
		if (isFilesPayload(payload)) return payload.paths;
		if (isFolderPayload(payload)) {
			const { fsApi } = await import('$lib/api');
			const expanded = await fsApi.expand(payload.absolutePath);
			return expanded.paths;
		}
		return [];
	}

	async function handleDropOnTrackList(payload: DragPayload, position: number) {
		if (!selected) return;
		try {
			const paths = await payloadToPaths(payload);
			if (!paths.length) return;
			const { libraryApi } = await import('$lib/api');
			const { tracks: upserted } = await libraryApi.addTracks(paths);
			mergeTracks(upserted);
			const trackIds = upserted.map((t) => t.id);
			const prev = selected.trackIds;
			// Compute the new trackIds locally for instant feedback.
			let next: string[];
			if (position < 0) {
				next = [...prev, ...trackIds.filter((id) => !prev.includes(id))];
			} else {
				next = [...prev];
				next.splice(position, 0, ...trackIds.filter((id) => !prev.includes(id)));
			}
			patchPlaylist({ ...selected, trackIds: next });
			// Persist.
			const updated = position < 0
				? await playlistsApi.addTracks(selected.id, trackIds)
				: await playlistsApi.insertTracks(selected.id, trackIds, position);
			patchPlaylist(updated);
			toast.success(`${upserted.length} added to ${selected.name}`);
		} catch (e) {
			toast.error('Add failed', { description: (e as Error).message });
			// Best-effort: reload to ensure consistency.
			await load();
		}
	}
</script>

<svelte:head><title>{selected?.name ?? 'Playlist'} · ipod</title></svelte:head>

{#if loading}
	<p class="text-sm text-muted-foreground">Loading…</p>
{:else}
	<div class="grid h-[calc(100vh-7rem)] grid-cols-[15rem_minmax(0,1fr)_minmax(0,1.4fr)] gap-4 overflow-hidden">
		<!-- Col 1: group tree sidebar -->
		<aside class="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
			<div class="flex shrink-0 items-center justify-between">
				<button class="text-sm font-medium text-muted-foreground hover:text-foreground" onclick={() => goto('/playlists')}>
					← All playlists
				</button>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto">
				{#each groups as group (group.id)}
					<div class="mb-1">
						<p class="px-1 py-0.5 text-xs font-medium uppercase text-muted-foreground">{group.name}</p>
						{#each grouped.get(group.id) ?? [] as p (p.id)}
							<button
								class={cn(
									'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
									p.id === playlistId ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
								)}
								onclick={() => goto(`/playlists/${p.id}`)}
							>
								{#if p.aliasOf}
									<Link class="size-3.5 shrink-0 text-muted-foreground" />
								{:else}
									<ListMusic class="size-3.5 shrink-0 text-muted-foreground" />
								{/if}
								<span class="min-w-0 flex-1 truncate">{p.name}</span>
								<span class="text-xs text-muted-foreground">{p.trackIds.length}</span>
							</button>
						{/each}
					</div>
				{/each}
					{#if ungrouped.length > 0}
					<p class="px-1 py-0.5 text-xs font-medium uppercase text-muted-foreground">Ungrouped</p>
					{#each ungrouped as p (p.id)}
						<button
							class={cn(
								'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
								p.id === playlistId ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
							)}
							onclick={() => goto(`/playlists/${p.id}`)}
						>
							{#if p.aliasOf}
								<Link class="size-3.5 shrink-0 text-muted-foreground" />
							{:else}
								<ListMusic class="size-3.5 shrink-0 text-muted-foreground" />
							{/if}
							<span class="min-w-0 flex-1 truncate">{p.name}</span>
							<span class="text-xs text-muted-foreground">{p.trackIds.length}</span>
						</button>
					{/each}
				{/if}
			</div>
		</aside>

		<!-- Col 2: selected playlist tracks -->
		<section class="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden border-l pl-4">
			<div class="flex shrink-0 items-center justify-between">
				<h2 class="text-sm font-medium">
					{#if selected}
						{selected.name}
						{#if selected.aliasOf}<Badge variant="outline" class="ml-2 text-xs">alias</Badge>{/if}
					{:else}
						Select a playlist
					{/if}
				</h2>
				{#if selected}<span class="text-xs text-muted-foreground">{selectedTracks.length}</span>{/if}
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
					<p class="px-3 py-8 text-center text-sm text-muted-foreground">Select a playlist from the left.</p>
				{/if}
			</div>
		</section>

		<!-- Col 3: library -->
		<section class="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden border-l pl-4">
			<h2 class="shrink-0 text-sm font-medium">Library</h2>
			<div class="min-h-0 flex-1 overflow-hidden">
				<LibraryPanel {roots} />
			</div>
		</section>
	</div>
{/if}

