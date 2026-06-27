<script lang="ts">
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { Device, Playlist, PlaylistGroup } from '$lib/api';
	import { devicesApi } from '$lib/api';
	import { reorder, dropIndex } from '$lib/utils/reorder';
	import { cn } from '$lib/utils';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Folder from '@lucide/svelte/icons/folder';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Link from '@lucide/svelte/icons/link';
	import { toast } from 'svelte-sonner';

	let {
		device,
		playlists,
		groups,
		onChanged
	}: {
		device: Device;
		playlists: Playlist[];
		groups: PlaylistGroup[];
		onChanged?: () => void;
	} = $props();

	const assignedIds = $derived(device.playlistIds);
	const assignedGroups = $derived(device.groupIds || []);

	// Playlists grouped by their groupId, in group order, then ungrouped last.
	const tree = $derived.by(() => {
		const result: Array<{ group: PlaylistGroup | null; playlists: Playlist[] }> = [];
		for (const g of groups) {
			result.push({
				group: g,
				playlists: playlists.filter((p) => p.groupId === g.id)
			});
		}
		const ungrouped = playlists.filter((p) => !p.groupId);
		if (ungrouped.length > 0) {
			result.push({ group: null, playlists: ungrouped });
		}
		return result;
	});

	async function togglePlaylist(playlist: Playlist) {
		try {
			await devicesApi.assignPlaylist(device.id, playlist.id);
			onChanged?.();
		} catch (e) {
			toast.error('Toggle failed', { description: (e as Error).message });
		}
	}

	async function toggleGroup(group: PlaylistGroup) {
		try {
			await devicesApi.toggleGroup(device.id, group.id);
			onChanged?.();
		} catch (e) {
			toast.error('Toggle failed', { description: (e as Error).message });
		}
	}

	async function handleDrop(state: DragDropState<Playlist>) {
		const dragged = state.draggedItem;
		if (!dragged) return;
		const ids = assignedIds;
		const from = ids.indexOf(dragged.id);
		if (from === -1) return;
		let dropIdx_ = parseInt(state.targetContainer ?? '0');
		if (state.dropPosition === 'after') dropIdx_ += 1;
		const next = reorder(ids, from, from < dropIdx_ ? dropIdx_ - 1 : dropIdx_);
		try {
			await devicesApi.setPlaylistOrder(device.id, next);
			onChanged?.();
		} catch (e) {
			toast.error('Reorder failed', { description: (e as Error).message });
		}
	}

	// Assigned playlists for reordering (only those individually assigned).
	const assigned = $derived(
		assignedIds
			.map((id) => playlists.find((p) => p.id === id))
			.filter((p): p is Playlist => Boolean(p))
	);
</script>

<div class="space-y-2">
	<h3 class="text-sm font-medium">Sync assignments</h3>
	<ScrollArea class="h-64 rounded-md border">
		<div class="divide-y">
			{#each tree as node (node.group?.id ?? 'ungrouped')}
				{#if node.group}
					<!-- Group header with group toggle -->
					<div class="flex items-center gap-2 px-3 py-2 bg-muted/30">
						<Checkbox
							checked={assignedGroups.includes(node.group.id)}
							onCheckedChange={() => toggleGroup(node.group!)}
						/>
						<Folder class="size-4 shrink-0 text-muted-foreground" />
						<span class="min-w-0 flex-1 truncate text-sm font-medium">{node.group.name}</span>
						<Badge variant="secondary" class="shrink-0 text-xs">{node.playlists.length}</Badge>
					</div>
				{:else}
					<div class="px-3 py-1 text-xs font-medium uppercase text-muted-foreground">Ungrouped</div>
				{/if}

				<!-- Member playlists (indented) -->
				{#each node.playlists as playlist (playlist.id)}
					{@const isChecked = assignedIds.includes(playlist.id)}
					{@const isAssigned = isChecked}
					<div
						class={cn(
							'flex items-center gap-2 py-2 hover:bg-accent/40',
							'px-3 pl-6',
							!isChecked && 'text-muted-foreground'
						)}
						use:draggable={{ container: String(assignedIds.indexOf(playlist.id)), dragData: playlist, handle: '.drag-handle' }}
						use:droppable={{ container: String(assignedIds.indexOf(playlist.id)), callbacks: { onDrop: handleDrop } }}
					>
						{#if isAssigned}
							<span class="drag-handle cursor-grab text-muted-foreground opacity-0 hover:opacity-100 active:cursor-grabbing">
								<GripVertical class="size-3.5" />
							</span>
						{:else}
							<span class="w-3.5"></span>
						{/if}
						<Checkbox checked={isChecked} onCheckedChange={() => togglePlaylist(playlist)} />
						{#if playlist.aliasOf}
							<Link class="size-3.5 shrink-0 text-muted-foreground" />
						{:else}
							<ListMusic class="size-3.5 shrink-0 text-muted-foreground" />
						{/if}
						<span class="min-w-0 flex-1 truncate text-sm">{playlist.name}</span>
						<span class="text-xs text-muted-foreground">{playlist.trackIds.length}</span>
					</div>
				{:else}
					{#if node.group}
						<p class="px-6 py-1.5 text-xs text-muted-foreground/60">Empty group</p>
					{/if}
				{/each}
			{:else}
				<p class="px-3 py-4 text-sm text-muted-foreground">No playlists or groups yet.</p>
			{/each}
		</div>
	</ScrollArea>
</div>
