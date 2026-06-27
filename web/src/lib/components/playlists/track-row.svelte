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
		selected,
		onClick,
		onRemove
	}: {
		track: Track;
		position: number;
		selected: boolean;
		onClick?: (e: MouseEvent) => void;
		onRemove?: () => void;
	} = $props();
</script>

<div
	class={cn(
		'flex items-center gap-2 px-3 py-2 border-l-2 transition-colors',
		selected
			? 'bg-accent border-primary'
			: 'hover:bg-accent/50 border-transparent',
		!track.exists && 'opacity-60'
	)}
	onclick={onClick}
>
	<span class="drag-handle cursor-grab text-muted-foreground active:cursor-grabbing">
		<GripVertical class="size-4" />
	</span>

	<span class="w-6 text-right text-xs text-muted-foreground">{position + 1}</span>

	{#if track.exists}
		<Music class={cn('size-4 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
	{:else}
		<FileQuestion class="size-4 shrink-0 text-destructive" />
	{/if}

	<div class="min-w-0 flex-1">
		<p class={cn('truncate text-sm', !track.exists && 'line-through', selected && 'font-bold text-primary')}>
			{track.fileName}
		</p>
		<p class={cn('truncate text-xs', selected ? 'text-primary/70' : 'text-muted-foreground')} title={track.sourcePath}>
			{track.sourcePath}
		</p>
	</div>

	{#if !track.exists}
		<Badge variant="destructive" class="shrink-0">Missing</Badge>
	{:else}
		<Badge variant={selected ? 'default' : 'outline'} class="shrink-0 uppercase">{track.extension}</Badge>
	{/if}

	<Button variant="ghost" size="icon" class="size-7 shrink-0" onclick={(e) => { e.stopPropagation(); onRemove?.(); }}>
		<X class="size-3.5" />
	</Button>
</div>
