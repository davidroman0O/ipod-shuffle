<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { fsApi, type FsEntry, type Playlist } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import BreadcrumbBar from './breadcrumb-bar.svelte';
	import FileRow from './file-row.svelte';

	let {
		path = null,
		playlists = [],
		onAddToPlaylist
	}: {
		path?: string | null;
		playlists?: Playlist[];
		onAddToPlaylist?: (absolutePath: string, playlist: Playlist) => void;
	} = $props();

	let dir = $state<string>('/');
	let entries = $state<FsEntry[]>([]);
	let loading = $state(false);

	// When the selected bookmark changes, navigate to it. Empty/'' = show nothing.
	$effect(() => {
		if (path) load(path);
		else entries = [];
	});

	async function load(target: string) {
		loading = true;
		try {
			const res = await fsApi.list(target);
			dir = res.path;
			entries = res.entries;
		} catch (e) {
			toast.error('Browse failed', { description: (e as Error).message });
		} finally {
			loading = false;
		}
	}

	function navigate(target: string) {
		load(target);
	}

	function fullPath(name: string): string {
		return dir === '/' ? '/' + name : dir + '/' + name;
	}
</script>

<div class="space-y-2">
	<BreadcrumbBar {dir} onNavigate={navigate} />
	<ScrollArea class="h-[calc(100vh-16rem)] rounded-md border">
		{#if loading}
			<div class="space-y-2 p-3">
				{#each Array(6) as _}
					<Skeleton class="h-7 w-full" />
				{/each}
			</div>
		{:else}
			<div class="divide-y">
				{#each entries as entry (entry.name)}
					<FileRow
						name={entry.name}
						absolutePath={fullPath(entry.name)}
						isDir={entry.isDir}
						{playlists}
						onOpenDir={navigate}
						onAddToPlaylist={(pl) => onAddToPlaylist?.(fullPath(entry.name), pl)}
					/>
				{:else}
					<p class="px-3 py-8 text-center text-sm text-muted-foreground">This folder is empty.</p>
				{/each}
			</div>
		{/if}
	</ScrollArea>
</div>
