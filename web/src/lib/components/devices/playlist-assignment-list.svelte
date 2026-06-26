<script lang="ts">
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Device, Playlist } from '$lib/api';
	import { devicesApi } from '$lib/api';
	import { reorder, dropIndex } from '$lib/utils/reorder';
	import { cn } from '$lib/utils';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import { toast } from 'svelte-sonner';

	/**
	 * Reorderable checklist of playlists assigned to a device. Checking adds to
	 * the sync set; dragging rows reorders the sync order (device.playlistIds).
	 * Unassigned playlists are listed greyed-out at the bottom (check to assign).
	 */
	let {
		device,
		playlists,
		onChanged
	}: {
		device: Device;
		playlists: Playlist[];
		onChanged?: () => void;
	} = $props();

	const assignedIds = $derived(device.playlistIds);
	const assigned = $derived(
		assignedIds
			.map((id) => playlists.find((p) => p.id === id))
			.filter((p): p is Playlist => Boolean(p))
	);
	const unassigned = $derived(playlists.filter((p) => !assignedIds.includes(p.id)));

	const container = `device-${device.id}`;

	async function toggle(playlist: Playlist, checked: boolean) {
		try {
			// assignPlaylist is a server-side toggle: calling it flips membership.
			await devicesApi.assignPlaylist(device.id, playlist.id);
			onChanged?.();
		} catch (e) {
			toast.error('Toggle failed', { description: (e as Error).message });
		}
		void checked;
	}

	async function handleDrop(state: DragDropState<Playlist>) {
		const dragged = state.draggedItem;
		if (!dragged) return;
		const ids = assigned.map((p) => p.id);
		const from = ids.indexOf(dragged.id);
		const targetIdx = assigned.findIndex((p) => p.id === dragged.id);
		if (from === -1) return;
		const next = reorder(ids, from, dropIndex(targetIdx, state.dropPosition ?? 'before'));
		try {
			await devicesApi.setPlaylistOrder(device.id, next);
			onChanged?.();
		} catch (e) {
			toast.error('Reorder failed', { description: (e as Error).message });
		}
	}
</script>

<div class="space-y-2">
	<h3 class="text-sm font-medium">Sync order</h3>
	<ScrollArea class="h-56 rounded-md border">
		<div class="divide-y">
			{#each assigned as playlist, i (playlist.id)}
				<div
					class="group flex items-center gap-2 px-3 py-2 hover:bg-accent/40"
					use:draggable={{ container, dragData: playlist, handle: '.drag-handle' }}
					use:droppable={{ container: String(i), callbacks: { onDrop: handleDrop } }}
				>
					<span
						class="drag-handle cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing"
						role="button"
						tabindex="-1"
						aria-label="Drag to reorder sync order"
					>
						<GripVertical class="size-4" />
					</span>
					<span class="w-4 text-right text-xs text-muted-foreground">{i + 1}</span>
					<Checkbox checked={true} onCheckedChange={(c) => toggle(playlist, c)} />
					<span class="min-w-0 flex-1 truncate text-sm">{playlist.name}</span>
					<span class="text-xs text-muted-foreground">{playlist.trackIds.length}</span>
				</div>
			{/each}
			{#if unassigned.length > 0}
				<div class="px-3 py-1 text-xs font-medium uppercase text-muted-foreground">Available</div>
				{#each unassigned as playlist (playlist.id)}
					<div class={cn('flex items-center gap-2 px-3 py-2 pl-9 hover:bg-accent/40')}>
						<Checkbox checked={false} onCheckedChange={(c) => toggle(playlist, c)} />
						<span class="min-w-0 flex-1 truncate text-sm text-muted-foreground">{playlist.name}</span>
						<span class="text-xs text-muted-foreground">{playlist.trackIds.length}</span>
					</div>
				{/each}
			{/if}
			{#if assigned.length === 0 && unassigned.length === 0}
				<p class="px-3 py-4 text-sm text-muted-foreground">No playlists yet.</p>
			{/if}
		</div>
	</ScrollArea>
</div>
