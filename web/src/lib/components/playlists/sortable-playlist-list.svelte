<script lang="ts">
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';
	import { cn } from '$lib/utils';
	import { reorder, dropIndex } from '$lib/utils/reorder';
	import { isFilesPayload, isFolderPayload, type DragPayload } from '$lib/utils/drag';
	import { Button } from '$lib/components/ui/button/index.js';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import RenamePlaylistDialog from './rename-playlist-dialog.svelte';
	import type { Playlist } from '$lib/api';

	let {
		playlists,
		selectedId,
		onSelect,
		onReorder,
		onRenamed,
		onRemoved,
		onDropFile
	}: {
		playlists: Playlist[];
		selectedId: string | null;
		onSelect: (id: string) => void;
		onReorder: (orderedIds: string[]) => void;
		onRenamed?: () => void;
		onRemoved?: (id: string) => void;
		/** Library payload dropped onto a playlist name → append (files or folder-expand). */
		onDropFile?: (playlistId: string, payload: DragPayload) => void;
	} = $props();

	const container = 'playlists';
	const FILE_DROP_PREFIX = 'playlist-file-';

	function handleDrop(state: DragDropState<Playlist>) {
		const dragged = state.draggedItem;
		if (!dragged) return;
		const ids = playlists.map((p) => p.id);
		const from = ids.indexOf(dragged.id);
		const targetIdx = playlists.findIndex((p) => p.id === dragged.id);
		if (from === -1) return;
		onReorder(reorder(ids, from, dropIndex(targetIdx, state.dropPosition ?? 'before')));
	}

	/** Per-row droppable: a library payload dropped here appends to THIS playlist. */
	function handleFileDrop(playlistId: string, state: DragDropState<unknown>) {
		const p = state.draggedItem as DragPayload | undefined;
		if (isFilesPayload(p) || isFolderPayload(p)) onDropFile?.(playlistId, p);
	}
</script>

<div use:droppable={{ container, callbacks: { onDrop: handleDrop } }} class="space-y-1">
	{#each playlists as playlist, i (playlist.id)}
		<div
			use:draggable={{ container, dragData: playlist, handle: '.drag-handle' }}
			use:droppable={{ container: FILE_DROP_PREFIX + playlist.id, callbacks: { onDrop: (s) => handleFileDrop(playlist.id, s) } }}
		>
			<div
				class={cn(
					'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
					playlist.id === selectedId
						? 'bg-accent text-accent-foreground'
						: 'hover:bg-accent/50'
				)}
			>
				<span
					class="drag-handle cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing"
					role="button"
					tabindex="-1"
					aria-label="Drag to reorder"
				>
					<GripVertical class="size-4" />
				</span>
				<button class="flex min-w-0 flex-1 items-center gap-2 text-left" onclick={() => onSelect(playlist.id)}>
					<ListMusic class="size-4 shrink-0 text-muted-foreground" />
					<span class="flex-1 truncate">{playlist.name}</span>
					<span class="text-xs text-muted-foreground">{playlist.trackIds.length}</span>
				</button>
				<RenamePlaylistDialog {playlist} onRenamed={onRenamed} />
				<Button
					variant="ghost"
					size="icon"
					class="size-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
					onclick={() => onRemoved?.(playlist.id)}
					aria-label="Delete playlist"
				>
					<Trash2 class="size-3.5" />
				</Button>
			</div>
		</div>
	{:else}
		<p class="px-2 py-4 text-center text-sm text-muted-foreground">No playlists yet.</p>
	{/each}
</div>
