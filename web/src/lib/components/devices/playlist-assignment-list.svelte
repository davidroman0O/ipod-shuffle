<script lang="ts">
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { Device, Playlist, PlaylistGroup } from '$lib/api';
	import { devicesApi } from '$lib/api';
	import { reorder } from '$lib/utils/reorder';
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

	/** A playlist is synced if it's in playlistIds — period. No more groupIds. */
	function isAssigned(playlist: Playlist): boolean {
		return assignedIds.includes(playlist.id);
	}

	/** Group state: checked = all members assigned, indeterminate = some, unchecked = none. */
	function groupState(groupId: string): { checked: boolean; indeterminate: boolean } {
		const members = playlists.filter((p) => p.groupId === groupId);
		const assignedCount = members.filter((p) => assignedIds.includes(p.id)).length;
		if (assignedCount === members.length) return { checked: true, indeterminate: false };
		if (assignedCount === 0) return { checked: false, indeterminate: false };
		return { checked: false, indeterminate: true };
	}

	const tree = $derived.by(() => {
		const result: Array<{ group: PlaylistGroup | null; playlists: Playlist[] }> = [];
		for (const g of groups) {
			result.push({ group: g, playlists: playlists.filter((p) => p.groupId === g.id) });
		}
		const ungrouped = playlists.filter((p) => !p.groupId);
		if (ungrouped.length > 0) result.push({ group: null, playlists: ungrouped });
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

	/** Toggling a group = bulk-add or bulk-remove ALL its member playlists. */
	async function toggleGroup(group: PlaylistGroup) {
		const members = playlists.filter((p) => p.groupId === group.id);
		const state = groupState(group.id);
		try {
			if (state.checked) {
				// All assigned → remove all.
				for (const p of members) {
					if (assignedIds.includes(p.id)) await devicesApi.assignPlaylist(device.id, p.id);
				}
			} else {
				// Some or none assigned → add all.
				for (const p of members) {
					if (!assignedIds.includes(p.id)) await devicesApi.assignPlaylist(device.id, p.id);
				}
			}
			onChanged?.();
		} catch (e) {
			toast.error('Toggle failed', { description: (e as Error).message });
		}
	}

	const assigned = $derived(
		assignedIds
			.map((id) => playlists.find((p) => p.id === id))
			.filter((p): p is Playlist => Boolean(p))
	);

	async function handleDrop(state: DragDropState<Playlist>) {
		const dragged = state.draggedItem;
		if (!dragged) return;
		const ids = assignedIds;
		const from = ids.indexOf(dragged.id);
		if (from === -1) return;
		let di = parseInt(state.targetContainer ?? '0');
		if (state.dropPosition === 'after') di += 1;
		const next = reorder(ids, from, from < di ? di - 1 : di);
		try {
			await devicesApi.setPlaylistOrder(device.id, next);
			onChanged?.();
		} catch (e) {
			toast.error('Reorder failed', { description: (e as Error).message });
		}
	}
</script>

<div class="space-y-2">
	<h3 class="text-sm font-medium">Sync assignments</h3>
	<div class="max-h-64 overflow-y-auto rounded-md border">
		<div class="divide-y">
			{#each tree as node (node.group?.id ?? 'ungrouped')}
				{#if node.group}
					{@const gs = groupState(node.group.id)}
					<div class={cn('flex items-center gap-2 px-3 py-2', gs.checked && 'bg-accent/30')}>
						<Checkbox
							checked={gs.checked}
							indeterminate={gs.indeterminate}
							onCheckedChange={() => toggleGroup(node.group!)}
						/>
						<Folder class="size-4 shrink-0 text-muted-foreground" />
						<span class="min-w-0 flex-1 truncate text-sm font-medium">{node.group.name}</span>
						<Badge variant="secondary" class="shrink-0 text-xs">{node.playlists.length}</Badge>
					</div>
				{:else}
					<div class="px-3 py-1 text-xs font-medium uppercase text-muted-foreground">Ungrouped</div>
				{/if}

				{#each node.playlists as playlist (playlist.id)}
					{@const checked = isAssigned(playlist)}
					{@const idx = assignedIds.indexOf(playlist.id)}
					<div
						class={cn(
							'flex items-center gap-2 py-2 pl-6 pr-3 hover:bg-accent/40',
							!checked && 'text-muted-foreground'
						)}
					>
						{#if idx >= 0}
							<span class="drag-handle cursor-grab text-muted-foreground opacity-0 hover:opacity-100 active:cursor-grabbing">
								<GripVertical class="size-3.5" />
							</span>
						{:else}
							<span class="w-3.5"></span>
						{/if}
						<Checkbox
							checked={checked}
							onCheckedChange={() => togglePlaylist(playlist)}
						/>
						{#if playlist.aliasOf}
							<Link class="size-3.5 shrink-0 text-muted-foreground" />
						{:else}
							<ListMusic class="size-3.5 shrink-0 text-muted-foreground" />
						{/if}
						<span class="min-w-0 flex-1 truncate text-sm">{playlist.name}</span>
						<span class="shrink-0 text-xs text-muted-foreground">{playlist.trackIds.length}</span>
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
	</div>
</div>
