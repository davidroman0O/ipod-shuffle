<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { isSupportedAudioPath, type Playlist } from '$lib/api';
	import Folder from '@lucide/svelte/icons/folder';
	import Music from '@lucide/svelte/icons/music';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Plus from '@lucide/svelte/icons/plus';

	let {
		name,
		absolutePath,
		isDir,
		playlists = [],
		onOpenDir,
		onAddToPlaylist
	}: {
		name: string;
		absolutePath: string;
		isDir: boolean;
		playlists?: Playlist[];
		onOpenDir?: (dir: string) => void;
		onAddToPlaylist?: (playlist: Playlist) => void;
	} = $props();

	const isAudio = $derived(!isDir && isSupportedAudioPath(name));

	function ext(n: string): string {
		const i = n.lastIndexOf('.');
		return i === -1 ? '' : n.slice(i + 1);
	}
	function truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}
</script>

<div class="group flex items-center gap-2 px-3 py-1.5 hover:bg-accent/40">
	{#if isDir}
		<Folder class="size-4 shrink-0 text-muted-foreground" />
		<button class="min-w-0 flex-1 truncate text-left text-sm" onclick={() => onOpenDir?.(absolutePath)}>
			{name}
		</button>
		<ChevronRight class="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
	{:else if isAudio}
		<Music class="size-4 shrink-0 text-muted-foreground" />
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm">{name}</p>
			<p class="truncate text-xs text-muted-foreground" title={absolutePath}>{absolutePath}</p>
		</div>
		<Badge variant="outline" class="shrink-0 uppercase">{ext(name)}</Badge>
		{#if onAddToPlaylist && playlists.length}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-accent">
					<Plus class="size-4" />
					<span class="sr-only">Add to playlist</span>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content>
					<DropdownMenu.Group>
						<DropdownMenu.Label>Add “{truncate(name, 20)}” to</DropdownMenu.Label>
						{#each playlists as playlist (playlist.id)}
							<DropdownMenu.Item onclick={() => onAddToPlaylist?.(playlist)}>
								{playlist.name}
								<span class="ml-auto text-xs text-muted-foreground">{playlist.trackIds.length}</span>
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	{:else}
		<span class="size-4 shrink-0"></span>
		<span class="min-w-0 flex-1 truncate text-sm text-muted-foreground/60">{name}</span>
	{/if}
</div>
