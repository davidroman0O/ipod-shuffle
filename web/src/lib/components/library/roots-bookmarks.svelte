<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import FolderPickerDialog from '$lib/components/common/folder-picker-dialog.svelte';
	import { libraryApi, type LibraryRoot } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		roots,
		selectedPath,
		onSelect,
		onChanged
	}: {
		roots: LibraryRoot[];
		selectedPath: string | null;
		onSelect: (path: string) => void;
		onChanged?: () => void;
	} = $props();

	let pickerOpen = $state(false);
	let busy = $state(false);

	async function addRoot(path: string) {
		busy = true;
		try {
			await libraryApi.addRoot(path);
			toast.success('Library root added', { description: path });
			onSelect(path);
			onChanged?.();
		} catch (e) {
			toast.error('Add failed', { description: (e as Error).message });
		} finally {
			busy = false;
		}
	}

	async function removeRoot(root: LibraryRoot, e: MouseEvent) {
		e.stopPropagation();
		try {
			await libraryApi.removeRoot(root.path);
			toast.success('Library root removed', { description: root.path });
			if (selectedPath === root.path) onSelect('');
			onChanged?.();
		} catch (err) {
			toast.error('Remove failed', { description: (err as Error).message });
		}
	}

	/** Split a path into (parentDirs, leaf) for emphasis. */
	function splitPath(p: string): { parent: string; leaf: string } {
		const parts = p.split('/').filter(Boolean);
		if (parts.length <= 1) return { parent: '', leaf: p };
		return { parent: '/' + parts.slice(0, -1).join('/') + '/', leaf: parts[parts.length - 1]! };
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-medium">Bookmarks</h2>
		<button class={buttonVariants({ variant: 'outline', size: 'sm' })} onclick={() => (pickerOpen = true)}>
			<FolderPlus class="size-4" /> Add
		</button>
	</div>

	<FolderPickerDialog bind:open={pickerOpen} title="Add a library root" onChoose={addRoot} />

	<ScrollArea class="max-h-60 rounded-md border">
		<div class="divide-y">
			{#each roots as root (root.id)}
				<button
					class={cn(
						'group flex w-full items-start gap-2 border-l-2 px-3 py-2 text-left transition-colors',
						selectedPath === root.path
							? 'border-primary bg-accent font-medium'
							: 'border-transparent hover:bg-accent/40'
					)}
					onclick={() => onSelect(root.path)}
				>
					<Bookmark class={cn('mt-0.5 size-4 shrink-0', selectedPath === root.path ? 'text-primary fill-primary/20' : 'text-muted-foreground')} />
					<span class="min-w-0 flex-1 break-all text-sm leading-tight">
						{#if splitPath(root.path).parent}
							<span class="text-muted-foreground">{splitPath(root.path).parent}</span><span class="font-medium text-foreground">{splitPath(root.path).leaf}</span>
						{:else}
							<span class="font-medium text-foreground">{root.path}</span>
						{/if}
					</span>
					{#if selectedPath === root.path}
						<span class="mt-0.5 size-2 shrink-0 rounded-full bg-primary"></span>
					{/if}
					<Button
						variant="ghost"
						size="icon"
						class="size-7 opacity-0 group-hover:opacity-100"
						onclick={(e) => removeRoot(root, e)}
					>
						<Trash2 class="size-3.5" />
					</Button>
				</button>
			{:else}
				<p class="px-3 py-4 text-sm text-muted-foreground">No bookmarks yet. Click “Add”.</p>
			{/each}
		</div>
	</ScrollArea>
</div>
