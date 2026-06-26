<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		libraryApi,
		playlistsApi,
		type LibraryRoot,
		type Playlist
	} from '$lib/api';
	import { Button } from '$lib/components/ui/button/index.js';
	import RootsBookmarks from '$lib/components/library/roots-bookmarks.svelte';
	import FolderBrowser from '$lib/components/library/folder-browser.svelte';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';

	let roots = $state<LibraryRoot[]>([]);
	let playlists = $state<Playlist[]>([]);
	let selectedBookmark = $state<string | null>(null);
	let busy = $state(false);

	onMount(load);

	async function load() {
		try {
			[roots, playlists] = await Promise.all([
				libraryApi.listRoots(),
				playlistsApi.list()
			]);
		} catch (e) {
			toast.error('Load failed', { description: (e as Error).message });
		}
	}

	/** Add a file (by its real path) to a playlist: register the track, then append. */
	async function handleAddToPlaylist(absolutePath: string, playlist: Playlist) {
		try {
			const upsert = await libraryApi.addTrack(absolutePath);
			await playlistsApi.addTrack(playlist.id, upsert.track.id);
			toast.success(`Added to “${playlist.name}”`, { description: upsert.track.fileName });
			await load();
		} catch (e) {
			toast.error('Add failed', { description: (e as Error).message });
		}
	}

	async function rescan() {
		busy = true;
		try {
			const results = await libraryApi.rescan();
			const created = results.reduce((sum, r) => sum + r.created, 0);
			toast.success('Rescan complete', { description: `${created} new track(s)` });
		} catch (e) {
			toast.error('Rescan failed', { description: (e as Error).message });
		} finally {
			busy = false;
		}
	}

	async function revalidate() {
		busy = true;
		try {
			const result = await libraryApi.revalidate();
			toast.success('Revalidation complete', {
				description: `${result.changed} of ${result.checked} updated`
			});
		} catch (e) {
			toast.error('Revalidate failed', { description: (e as Error).message });
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Library · ipod</title></svelte:head>

<div class="grid gap-6 lg:grid-cols-[260px_1fr]">
	<!-- Left: bookmarks + maintenance -->
	<aside class="space-y-6">
		<RootsBookmarks
			{roots}
			selectedPath={selectedBookmark}
			onSelect={(p) => (selectedBookmark = p || null)}
			onChanged={load}
		/>

		<div class="space-y-2">
			<h2 class="text-sm font-medium">Maintenance</h2>
			<div class="flex flex-col gap-2">
				<Button variant="outline" size="sm" onclick={revalidate} disabled={busy}>
					<ShieldCheck class="size-4" />
					Revalidate files
				</Button>
				<Button variant="outline" size="sm" onclick={rescan} disabled={busy}>
					<RefreshCw class="size-4" />
					Rescan roots
				</Button>
			</div>
		</div>
	</aside>

	<!-- Right: filesystem browser with add-to-playlist (empty until a bookmark is clicked) -->
	<section>
		{#if selectedBookmark}
			<FolderBrowser path={selectedBookmark} {playlists} onAddToPlaylist={handleAddToPlaylist} />
		{:else}
			<div
				class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center"
			>
				<p class="text-sm text-muted-foreground">Select a bookmark to browse its folder.</p>
			</div>
		{/if}
	</section>
</div>
