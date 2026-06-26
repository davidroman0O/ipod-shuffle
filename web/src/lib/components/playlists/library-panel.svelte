<script lang="ts">
	import { draggable, type DragDropState } from '@thisux/sveltednd';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import {
		fsApi,
		isSupportedAudioPath,
		type FsEntry,
		type LibraryRoot
	} from '$lib/api';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils';
	import Folder from '@lucide/svelte/icons/folder';
	import Music from '@lucide/svelte/icons/music';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import CheckSquare from '@lucide/svelte/icons/check-square';
	import Square from '@lucide/svelte/icons/square';

	/**
	 * Library column for the Playlist page: bookmark selector + breadcrumb +
	 * folder contents. Audio files are selectable + draggable (single or batch);
	 * directories are click-to-navigate AND draggable (expands to all audio on
	 * drop).
	 */
	let { roots }: { roots: LibraryRoot[] } = $props();

	const FILE_CONTAINER = 'library-files';

	let selectedRoot = $state<LibraryRoot | null>(null);
	let dir = $state('');
	let entries = $state<FsEntry[]>([]);
	let loading = $state(false);
	let selection = $state<Set<string>>(new Set());
	let anchor = $state<number | null>(null);

	$effect(() => {
		if (!selectedRoot && roots.length) selectRoot(roots[0]!);
	});

	function selectRoot(root: LibraryRoot) {
		selectedRoot = root;
		selection = new Set();
		load(root.path);
	}

	async function load(target: string) {
		loading = true;
		anchor = null;
		selection = new Set();
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

	function navigate(name: string) {
		load(join(dir, name));
	}

	function join(base: string, name: string): string {
		return base === '/' ? '/' + name : base + '/' + name;
	}

	function breadcrumbSegments(): { label: string; path: string }[] {
		if (!selectedRoot) return [];
		const base = selectedRoot.path;
		const rel = dir.startsWith(base) ? dir.slice(base.length).replace(/^\/+/, '') : '';
		const segs: { label: string; path: string }[] = [
			{
				label: selectedRoot.path.split('/').filter(Boolean).pop() || selectedRoot.path,
				path: base
			}
		];
		let acc = base.replace(/\/+$/, '');
		for (const part of rel.split('/').filter(Boolean)) {
			acc += '/' + part;
			segs.push({ label: part, path: acc });
		}
		return segs;
	}

	// The audio files in the current view, in order — the selectable/draggable set.
	const audioEntries = $derived(
		entries.filter((e) => !e.isDir && isSupportedAudioPath(e.name))
	);

	function toggleSelect(path: string, index: number, shift: boolean) {
		const next = new Set(selection);
		if (shift && anchor !== null) {
			// Range: from anchor to this index across audioEntries.
			next.clear();
			const from = Math.min(anchor, index);
			const to = Math.max(anchor, index);
			for (let i = from; i <= to; i++) next.add(join(dir, audioEntries[i]!.name));
		} else {
			if (next.has(path)) next.delete(path);
			else next.add(path);
			anchor = index;
		}
		selection = next;
	}

	function selectAll() {
		selection = new Set(audioEntries.map((e) => join(dir, e.name)));
		anchor = null;
	}

	function clearSelection() {
		selection = new Set();
		anchor = null;
	}

	/** Build the drag payload for an audio row: the clicked file plus any others selected. */
	function fileDragPayload(path: string): { kind: 'files'; paths: string[] } {
		// If the dragged file isn't in the selection, drag just it; otherwise drag the whole selection.
		const paths = selection.has(path) && selection.size > 0 ? [...selection] : [path];
		paths.sort();
		return { kind: 'files', paths };
	}
</script>

<div class="flex h-full flex-col gap-2">
	<!-- Bookmark selector -->
	<div class="flex items-center gap-1 overflow-x-auto pb-1">
		{#each roots as root (root.id)}
			<button
				class={cn(
					'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ring-1 transition-all',
					selectedRoot?.id === root.id
						? 'bg-primary text-primary-foreground ring-primary'
						: 'bg-muted text-muted-foreground ring-transparent hover:bg-accent'
				)}
				onclick={() => selectRoot(root)}
			>
				<Bookmark class={cn('size-3 shrink-0', selectedRoot?.id === root.id && 'fill-current')} />
				<span class="break-all leading-tight">{root.path}</span>
				{#if selectedRoot?.id === root.id}<span class="size-1.5 shrink-0 rounded-full bg-primary-foreground"></span>{/if}
			</button>
		{:else}
			<span class="text-xs text-muted-foreground">No bookmarks — add one in Library.</span>
		{/each}
	</div>

	<!-- Breadcrumb (relative to the bookmark) -->
	{#if selectedRoot}
		<nav class="flex flex-wrap items-center gap-0.5 text-xs">
			{#each breadcrumbSegments() as seg, i (seg.path)}
				{#if i > 0}<ChevronRight class="size-3 text-muted-foreground" />{/if}
				<button
					class={cn(
						'max-w-[10rem] truncate rounded px-1 py-0.5',
						i === breadcrumbSegments().length - 1
							? 'font-medium text-foreground'
							: 'text-muted-foreground hover:bg-accent'
					)}
					onclick={() => load(seg.path)}
				>
					{seg.label}
				</button>
			{/each}
		</nav>
	{/if}

	<!-- Selection toolbar -->
	{#if audioEntries.length}
		<div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" class="h-7 gap-1 px-2" onclick={selectAll}>
					<CheckSquare class="size-3.5" /> All
				</Button>
				<Button variant="ghost" size="sm" class="h-7 gap-1 px-2" onclick={clearSelection} disabled={selection.size === 0}>
					<Square class="size-3.5" /> Clear
				</Button>
			</div>
			{#if selection.size > 0}
				<Badge variant="secondary">{selection.size} selected</Badge>
			{/if}
		</div>
	{/if}

	<!-- Folder contents -->
	<ScrollArea class="flex-1 rounded-md border">
		{#if loading}
			<div class="space-y-2 p-3">
				{#each Array(6) as _}<Skeleton class="h-7 w-full" />{/each}
			</div>
		{:else if !selectedRoot}
			<p class="px-3 py-8 text-center text-sm text-muted-foreground">Select a bookmark.</p>
		{:else}
			<div class="divide-y" id={FILE_CONTAINER}>
				{#each entries as entry (entry.name)}
					{@const path = join(dir, entry.name)}
					{@const isAudio = !entry.isDir && isSupportedAudioPath(entry.name)}
					{@const selected = selection.has(path)}
					{#if entry.isDir}
						<div
							class="group flex cursor-grab items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/40 active:cursor-grabbing"
							use:draggable={{ container: FILE_CONTAINER, dragData: { kind: 'folder', absolutePath: path, name: entry.name } }}
							title="Click to open · Drag to add all audio"
							onclick={() => navigate(entry.name)}
							onkeydown={(e) => e.key === 'Enter' && navigate(entry.name)}
						>
							<Folder class="size-4 shrink-0 text-muted-foreground" />
							<span class="min-w-0 flex-1 truncate">{entry.name}</span>
							<ChevronRight class="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
						</div>
					{:else if isAudio}
						<div
							class={cn(
								'flex cursor-grab items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/40 active:cursor-grabbing',
								selected && 'bg-primary/10 ring-1 ring-inset ring-primary/40'
							)}
							use:draggable={{ container: FILE_CONTAINER, dragData: fileDragPayload(path) }}
							onclick={(e) => toggleSelect(path, audioEntries.indexOf(entry), e.shiftKey)}
							title="Click to select · Drag to a playlist"
						>
							<span class="shrink-0 text-muted-foreground">
								{#if selected}<CheckSquare class="size-4 text-primary" />{:else}<Square class="size-4 opacity-40" />{/if}
							</span>
							<Music class="size-4 shrink-0 text-muted-foreground" />
							<span class="min-w-0 flex-1 truncate">{entry.name}</span>
						</div>
					{:else}
						<div class="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground/50">
							<span class="size-4 shrink-0"></span>
							<span class="min-w-0 flex-1 truncate">{entry.name}</span>
						</div>
					{/if}
				{:else}
					<p class="px-3 py-8 text-center text-sm text-muted-foreground">This folder has no audio.</p>
				{/each}
			</div>
		{/if}
	</ScrollArea>
</div>
