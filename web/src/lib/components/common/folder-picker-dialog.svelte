<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { fsApi, type FsEntry } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import Folder from '@lucide/svelte/icons/folder';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Loader from '@lucide/svelte/icons/loader-circle';

	let {
		open = $bindable(false),
		title = 'Choose a folder',
		onChoose
	}: {
		open?: boolean;
		title?: string;
		onChoose?: (path: string) => void;
	} = $props();

	let current = $state('/');
	let entries = $state<FsEntry[]>([]);
	let loading = $state(false);

	$effect(() => {
		if (open) load(current);
	});

	async function load(dir: string) {
		loading = true;
		try {
			const res = await fsApi.list(dir);
			current = res.path;
			entries = res.entries.filter((e) => e.isDir);
		} catch (e) {
			toast.error('Browse failed', { description: (e as Error).message });
		} finally {
			loading = false;
		}
	}

	function enter(entry: FsEntry) {
		const next = current.endsWith('/') ? current + entry.name : current + '/' + entry.name;
		load(next);
	}

	function up() {
		const idx = current.lastIndexOf('/');
		const parent = idx <= 0 ? '/' : current.slice(0, idx);
		load(parent);
	}

	function choose() {
		onChoose?.(current);
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>Pick a folder on disk.</Dialog.Description>
		</Dialog.Header>

		<div class="mb-2 flex items-center gap-2">
			<Button variant="outline" size="icon" class="size-7" onclick={up} aria-label="Up">
				<ChevronLeft class="size-4" />
			</Button>
			<code class="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{current}</code>
		</div>

		<ScrollArea class="h-64 rounded-md border">
			{#if loading}
				<div class="flex justify-center py-8">
					<Loader class="size-5 animate-spin text-muted-foreground" />
				</div>
			{:else}
				<div class="divide-y">
					{#each entries as entry (entry.name)}
						<button
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50"
							onclick={() => enter(entry)}
							ondblclick={choose}
						>
							<Folder class="size-4 text-muted-foreground" />
							<span class="flex-1 truncate">{entry.name}</span>
						</button>
					{:else}
						<p class="px-3 py-8 text-center text-sm text-muted-foreground">No subfolders.</p>
					{/each}
				</div>
			{/if}
		</ScrollArea>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={choose}>
				<FolderOpen class="size-4" />
				Select this folder
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
