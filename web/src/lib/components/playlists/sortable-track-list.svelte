<script lang="ts">
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import TrackRow from './track-row.svelte';
	import { reorder, reorderMany, dropIndex } from '$lib/utils/reorder';
	import {
		isFilesPayload,
		isFolderPayload,
		isLibraryPayload,
		type DragPayload
	} from '$lib/utils/drag';
	import type { Playlist, Track } from '$lib/api';

	let {
		playlist,
		tracks,
		onReorder,
		onRemoveTrack,
		onDropFile
	}: {
		playlist: Playlist;
		tracks: Track[];
		onReorder: (trackIds: string[]) => void;
		onRemoveTrack: (trackId: string) => void;
		onDropFile?: (payload: DragPayload, position: number) => void;
	} = $props();

	const TRACK_ITEM = 'track-item-';

	// Selection state — a Set of track IDs.
	let selection = $state<Set<string>>(new Set());
	let anchor = $state<number | null>(null);

	function handleClick(trackId: string, index: number, e: MouseEvent) {
		const next = new Set(selection);
		if (e.shiftKey && anchor !== null) {
			// Range select: from anchor to this index.
			next.clear();
			const from = Math.min(anchor, index);
			const to = Math.max(anchor, index);
			for (let i = from; i <= to; i++) next.add(tracks[i]!.id);
		} else if (e.metaKey || e.ctrlKey) {
			// Toggle individual.
			if (next.has(trackId)) next.delete(trackId);
			else next.add(trackId);
			anchor = index;
		} else {
			// Single select.
			next.clear();
			next.add(trackId);
			anchor = index;
		}
		selection = next;
	}

	function selectAll() {
		selection = new Set(tracks.map((t) => t.id));
		anchor = null;
	}

	function clearSelection() {
		selection = new Set();
		anchor = null;
	}

	const allSelected = $derived(selection.size === tracks.length && tracks.length > 0);

	function toggleSelectAll() {
		if (allSelected) clearSelection();
		else selectAll();
	}

	/** Build the drag payload: if this track is in the selection and >1 selected, drag all. */
	function dragPayload(track: Track): DragPayload {
		if (selection.has(track.id) && selection.size > 1) {
			// Return the selected IDs in their playlist order (not selection order).
			const ids = tracks.map((t) => t.id).filter((id) => selection.has(id));
			return { kind: 'tracks', trackIds: ids };
		}
		return { kind: 'track', trackId: track.id };
	}

	function handleDrop(state: DragDropState<Track>) {
		const dragged = state.draggedItem as unknown;
		if (!dragged) return;

		// Library payload → insert files.
		if (isFilesPayload(dragged) || isFolderPayload(dragged)) {
			onDropFile?.(dragged, resolvePosition(state));
			return;
		}

		const ids = tracks.map((t) => t.id);

		// Multi-track drag → move the whole block.
		if (dragged && typeof dragged === 'object' && (dragged as DragPayload).kind === 'tracks') {
			const trackIds = (dragged as { trackIds: string[] }).trackIds;
			const indices = trackIds.map((id) => ids.indexOf(id)).filter((i) => i !== -1);
			const targetIdx = resolveDropIndex(state);
			if (targetIdx === -1 || indices.length === 0) return;
			const insertAt = dropIndex(targetIdx, state.dropPosition ?? 'before');
			onReorder(reorderMany(ids, indices, insertAt).filter((id): id is string => Boolean(id)));
			return;
		}

		// Single track drag → standard reorder.
		const track = dragged as Track;
		const from = ids.indexOf(track.id);
		if (from === -1) return;
		const targetIdx = resolveDropIndex(state);
		const to = targetIdx === -1 ? ids.length : dropIndex(targetIdx, state.dropPosition ?? 'before');
		onReorder(reorder(ids, from, to));
	}

	function resolveDropIndex(state: DragDropState<unknown>): number {
		if (state.targetContainer?.startsWith(TRACK_ITEM)) {
			return parseInt(state.targetContainer.slice(TRACK_ITEM.length), 10);
		}
		return -1;
	}

	function resolvePosition(state: DragDropState<unknown>): number {
		if (state.targetContainer?.startsWith(TRACK_ITEM)) {
			const idx = parseInt(state.targetContainer.slice(TRACK_ITEM.length), 10);
			if (Number.isNaN(idx)) return -1;
			return dropIndex(idx, state.dropPosition ?? 'before');
		}
		return -1;
	}

	function handleEmptyClick() {
		clearSelection();
	}

	// Clear selection when the playlist changes.
	let lastPlaylistId = $state(playlist.id);
	$effect(() => {
		if (playlist.id !== lastPlaylistId) {
			selection = new Set();
			anchor = null;
			lastPlaylistId = playlist.id;
		}
	});
</script>

<div class="flex h-full flex-col gap-2">
	{#if tracks.length > 0}
		<div class="flex items-center justify-end text-xs text-muted-foreground">
			<Button
				variant="ghost"
				size="sm"
				class="h-7 px-2"
				onclick={toggleSelectAll}
			>
				{allSelected ? 'Deselect all' : 'Select all'}
			</Button>
			{#if selection.size > 0}
				<Badge variant="secondary" class="ml-2">{selection.size} selected</Badge>
			{/if}
		</div>
	{/if}

	<ScrollArea class="flex-1 rounded-md border">
		<div class="divide-y min-h-full" onclick={handleEmptyClick}>
			{#each tracks as track, i (track.id)}
				<div
					use:draggable={{ container: TRACK_ITEM + i, dragData: dragPayload(track) }}
					use:droppable={{ container: TRACK_ITEM + i, callbacks: { onDrop: handleDrop } }}
				>
					<TrackRow
						{track}
						position={i}
						selected={selection.has(track.id)}
						onClick={(e) => { e.stopPropagation(); handleClick(track.id, i, e); }}
						onRemove={() => onRemoveTrack(track.id)}
					/>
				</div>
			{:else}
				<div
					class="flex min-h-[6rem] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
					use:droppable={{ container: 'empty-list', callbacks: { onDrop: (s: DragDropState<unknown>) => {
						const dragged = s.draggedItem as unknown;
						if (isFilesPayload(dragged) || isFolderPayload(dragged)) {
							onDropFile?.(dragged, -1);
						}
					} } }}
				>
					This playlist is empty. Drag audio from the library.
				</div>
			{/each}
		</div>
	</ScrollArea>
</div>
