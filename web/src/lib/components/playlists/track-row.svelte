<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import X from '@lucide/svelte/icons/x';
	import FileQuestion from '@lucide/svelte/icons/file-question';
	import Music from '@lucide/svelte/icons/music';
	import type { Track } from '$lib/api';

	let {
		track,
		position,
		onRemove
	}: {
		track: Track;
		position: number;
		onRemove?: () => void;
	} = $props();
</script>

<div
	class="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 {track.exists
		? ''
		: 'opacity-60'}"
>
	<span class="drag-handle cursor-grab text-muted-foreground active:cursor-grabbing">
		<GripVertical class="size-4" />
	</span>

	<span class="w-6 text-right text-xs text-muted-foreground">{position + 1}</span>

	{#if track.exists}
		<Music class="size-4 shrink-0 text-muted-foreground" />
	{:else}
		<FileQuestion class="size-4 shrink-0 text-destructive" />
	{/if}

	<div class="min-w-0 flex-1">
		<p class={cn('truncate text-sm', !track.exists && 'line-through')}>
			{track.fileName}
		</p>
		<p class="truncate text-xs text-muted-foreground" title={track.sourcePath}>
			{track.sourcePath}
		</p>
	</div>

	{#if !track.exists}
		<Badge variant="destructive" class="shrink-0">Missing</Badge>
	{:else}
		<Badge variant="outline" class="shrink-0 uppercase">{track.extension}</Badge>
	{/if}

	<Button variant="ghost" size="icon" class="size-7 shrink-0" onclick={onRemove}>
		<X class="size-3.5" />
	</Button>
</div>
