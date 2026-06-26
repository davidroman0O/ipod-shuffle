<script lang="ts">
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import TrackRow from './track-row.svelte';
	import { reorder, dropIndex } from '$lib/utils/reorder';
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
		/** Tracks in playlist order (must align with playlist.trackIds). */
		tracks: Track[];
		onReorder: (trackIds: string[]) => void;
		onRemoveTrack: (trackId: string) => void;
		/** Library payload dropped → insert at a position (-1 = append). */
		onDropFile?: (payload: DragPayload, position: number) => void;
	} = $props();

	const container = `playlist-${playlist.id}`;
	const TRACK_ITEM = 'track-item-';
	// The whole list is a drop zone; a drop on empty area lands here = append.
	const APPEND_ZONE = `playlist-append-${playlist.id}`;

	function handleDrop(state: DragDropState<Track>) {
		const dragged = state.draggedItem as unknown;
		if (!dragged) return;

		// Library payload (files/folder) → insert at position or append.
		if (isFilesPayload(dragged) || isFolderPayload(dragged)) {
			onDropFile?.(dragged, resolvePosition(state));
			return;
		}

		// Existing track → reorder.
		const track = dragged as Track;
		const ids = tracks.map((t) => t.id);
		const from = ids.indexOf(track.id);
		if (from === -1) return;
		const targetIdx = state.targetContainer?.startsWith(TRACK_ITEM)
			? parseInt(state.targetContainer.slice(TRACK_ITEM.length), 10)
			: -1;
		const to = targetIdx === -1 ? ids.length : dropIndex(targetIdx, state.dropPosition ?? 'before');
		onReorder(reorder(ids, from, to));
	}

	/** Work out the insertion index from the drop state; -1 = append at end. */
	function resolvePosition(state: DragDropState<unknown>): number {
		if (state.targetContainer === APPEND_ZONE) return -1;
		if (state.targetContainer?.startsWith(TRACK_ITEM)) {
			const idx = parseInt(state.targetContainer.slice(TRACK_ITEM.length), 10);
			if (Number.isNaN(idx)) return -1;
			return dropIndex(idx, state.dropPosition ?? 'before');
		}
		return -1;
	}
</script>

<ScrollArea class="h-full rounded-md border">
	<div
		use:droppable={{ container: APPEND_ZONE, callbacks: { onDrop: handleDrop } }}
		class="divide-y min-h-full"
	>
		{#each tracks as track, i (track.id)}
			<div
				use:draggable={{ container, dragData: track, handle: '.drag-handle' }}
				use:droppable={{ container: TRACK_ITEM + i, callbacks: { onDrop: handleDrop } }}
			>
				<TrackRow {track} position={i} onRemove={() => onRemoveTrack(track.id)} />
			</div>
		{:else}
			<p class="px-3 py-8 text-center text-sm text-muted-foreground">
				This playlist is empty. Drag audio from the library on the right.
			</p>
		{/each}
	</div>
</ScrollArea>
