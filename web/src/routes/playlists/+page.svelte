<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';
	import {
		playlistsApi,
		groupsApi,
		type Playlist,
		type PlaylistGroup
	} from '$lib/api';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils';
	import Plus from '@lucide/svelte/icons/plus';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Copy from '@lucide/svelte/icons/copy';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Link from '@lucide/svelte/icons/link';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';

	let playlists = $state<Playlist[]>([]);
	let groups = $state<PlaylistGroup[]>([]);
	let loading = $state(true);

	onMount(load);

	async function load() {
		loading = true;
		try {
			[playlists, groups] = await Promise.all([playlistsApi.list(), groupsApi.list()]);
		} catch (e) {
			toast.error('Load failed', { description: (e as Error).message });
		} finally {
			loading = false;
		}
	}

	const GROUPED_CONTAINER = 'groups';

	const grouped = $derived.by(() => {
		const byGroup = new Map<string | null, Playlist[]>();
		for (const g of groups) byGroup.set(g.id, []);
		byGroup.set(null, []);
		for (const p of playlists) {
			const key = p.groupId ?? null;
			if (!byGroup.has(key)) byGroup.set(key, []);
			byGroup.get(key)!.push(p);
		}
		return byGroup;
	});

	// --- Group actions ---
	let newGroupName = $state('');
	let newGroupOpen = $state(false);

	async function createGroup() {
		if (!newGroupName.trim()) return;
		try {
			await groupsApi.create(newGroupName.trim());
			toast.success('Group created', { description: newGroupName.trim() });
			newGroupName = '';
			newGroupOpen = false;
			await load();
		} catch (e) {
			toast.error('Failed', { description: (e as Error).message });
		}
	}

	async function renameGroup(g: PlaylistGroup) {
		const name = prompt('Rename group', g.name);
		if (name && name.trim() && name !== g.name) {
			await groupsApi.rename(g.id, name.trim());
			await load();
		}
	}

	async function deleteGroup(g: PlaylistGroup) {
		if (!confirm(`Delete group "${g.name}"? Its playlists move to ungrouped.`)) return;
		await groupsApi.remove(g.id);
		toast.success('Group deleted');
		await load();
	}

	// --- Playlist actions ---
	let newPlaylistName = $state('');
	let newPlaylistOpen = $state(false);

	async function createPlaylist() {
		if (!newPlaylistName.trim()) return;
		await playlistsApi.create(newPlaylistName.trim());
		newPlaylistName = '';
		newPlaylistOpen = false;
		await load();
	}

	async function clonePlaylist(p: Playlist) {
		await playlistsApi.clone(p.id);
		toast.success('Playlist cloned', { description: p.name });
		await load();
	}

	async function aliasPlaylist(p: Playlist) {
		await playlistsApi.alias(p.id);
		toast.success('Alias created', { description: p.name });
		await load();
	}

	async function deletePlaylist(p: Playlist) {
		if (!confirm(`Delete "${p.name}"?`)) return;
		await playlistsApi.remove(p.id);
		await load();
	}

	async function renamePlaylist(p: Playlist) {
		const name = prompt('Rename playlist', p.name);
		if (name && name.trim()) {
			await playlistsApi.rename(p.id, name.trim());
			await load();
		}
	}

	/** Handle a playlist drop: reorder within group OR move between groups. */
	async function handleDrop(targetGroupId: string | null, state: DragDropState<unknown>) {
		const dragged = state.draggedItem as Playlist;
		if (!dragged) return;
		const sameGroup = (dragged.groupId ?? null) === targetGroupId;

		if (!sameGroup) {
			// Moving between groups.
			try {
				await playlistsApi.moveToGroup(dragged.id, targetGroupId);
				await load();
			} catch (e) {
				toast.error('Move failed', { description: (e as Error).message });
			}
			return;
		}

		// Reorder within the group — follows the official sveltednd simple-list pattern.
		const groupPlaylists = grouped.get(targetGroupId) ?? [];
		const dragIndex = groupPlaylists.findIndex((p) => p.id === dragged.id);
		let dropIndex = parseInt(state.targetContainer ?? '0');
		if (state.dropPosition === 'after') dropIndex += 1;
		if (dragIndex === -1 || isNaN(dropIndex)) return;

		const ids = groupPlaylists.map((p) => p.id);
		const [id] = ids.splice(dragIndex, 1);
		const adjusted = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
		ids.splice(adjusted, 0, id);

		try {
			await playlistsApi.setOrder(ids);
			await load();
		} catch (e) {
			toast.error('Reorder failed', { description: (e as Error).message });
		}
	}

	function isAlias(p: Playlist): boolean {
		return !!p.aliasOf;
	}

	const ungrouped = $derived(grouped.get(null) ?? []);
</script>

<svelte:head><title>Playlists · ipod</title></svelte:head>

{#if loading}
	<p class="text-sm text-muted-foreground">Loading…</p>
{:else}
	<div class="flex items-center justify-between pb-4">
		<p class="text-sm text-muted-foreground">{playlists.length} playlists · {groups.length} groups</p>
		<div class="flex gap-2">
			<button class={buttonVariants({ variant: 'outline', size: 'sm' })} onclick={() => (newGroupOpen = true)}>
				<FolderPlus class="size-4" /> New group
			</button>
			<button class={buttonVariants({ size: 'sm' })} onclick={() => (newPlaylistOpen = true)}>
				<Plus class="size-4" /> New playlist
			</button>
		</div>
	</div>

	<div class="space-y-4">
		<!-- Groups: each is a droppable zone for playlists -->
		{#each groups as group (group.id)}
			{@const groupPlaylists = grouped.get(group.id) ?? []}
			<section
				class="rounded-lg border"
				use:droppable={{ container: `group-${group.id}`, callbacks: { onDrop: (s) => handleDrop(group.id, s) } }}
			>
				<div class="flex items-center justify-between border-b px-4 py-2">
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-medium">{group.name}</h3>
						<Badge variant="secondary">{groupPlaylists.length}</Badge>
					</div>
					<div class="flex gap-1">
						<Button variant="ghost" size="icon" class="size-7" onclick={() => renameGroup(group)} aria-label="Rename group">
							<Pencil class="size-3.5" />
						</Button>
						<Button variant="ghost" size="icon" class="size-7 hover:text-destructive" onclick={() => deleteGroup(group)} aria-label="Delete group">
							<Trash2 class="size-3.5" />
						</Button>
					</div>
				</div>
				<div class="divide-y min-h-[2rem]">
					{#each groupPlaylists as p, i (p.id)}
						{@render playlistRow(p, group.id, i)}
					{:else}
						<p class="px-4 py-2 text-xs text-muted-foreground/60">Drop playlists here</p>
					{/each}
				</div>
			</section>
		{/each}

		<!-- Ungrouped: also a droppable zone -->
		<section
			class="rounded-lg border"
			use:droppable={{ container: `group-ungrouped`, callbacks: { onDrop: (s) => handleDrop(null, s) } }}
		>
			<div class="flex items-center gap-2 border-b px-4 py-2">
				<h3 class="text-sm font-medium">Ungrouped</h3>
				<Badge variant="secondary">{ungrouped.length}</Badge>
			</div>
			<div class="divide-y min-h-[2rem]">
				{#each ungrouped as p, i (p.id)}
					{@render playlistRow(p, null, i)}
				{:else}
					<p class="px-4 py-2 text-xs text-muted-foreground/60">No ungrouped playlists</p>
				{/each}
			</div>
		</section>
	</div>
{/if}

{#snippet playlistRow(p: Playlist, groupId: string | null, index: number)}
	<div
		class="group flex items-center gap-2 px-4 py-2 hover:bg-accent/40"
		use:draggable={{ container: String(index), dragData: p }}
		use:droppable={{ container: String(index), callbacks: { onDrop: (s) => handleDrop(groupId, s) } }}
	>
		<span class="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing">
			<GripVertical class="size-4" />
		</span>
		<button class="flex min-w-0 flex-1 items-center gap-2 text-left" onclick={() => goto(`/playlists/${p.id}`)}>
			{#if isAlias(p)}
				<Link class="size-4 shrink-0 text-muted-foreground" />
			{:else}
				<ListMusic class="size-4 shrink-0 text-muted-foreground" />
			{/if}
			<span class="min-w-0 flex-1 truncate text-sm">{p.name}</span>
			{#if isAlias(p)}
				<Badge variant="outline" class="shrink-0 text-xs">alias</Badge>
			{/if}
			<span class="shrink-0 text-xs text-muted-foreground">{p.trackIds.length}</span>
		</button>
		<div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
			<Button variant="ghost" size="icon" class="size-7" onclick={() => clonePlaylist(p)} aria-label="Clone">
				<Copy class="size-3.5" />
			</Button>
			<Button variant="ghost" size="icon" class="size-7" onclick={() => renamePlaylist(p)} aria-label="Rename">
				<Pencil class="size-3.5" />
			</Button>
			<Button variant="ghost" size="icon" class="size-7" onclick={() => aliasPlaylist(p)} aria-label="Create alias">
				<Link class="size-3.5" />
			</Button>
			<Button variant="ghost" size="icon" class="size-7 hover:text-destructive" onclick={() => deletePlaylist(p)} aria-label="Delete">
				<Trash2 class="size-3.5" />
			</Button>
		</div>
	</div>
{/snippet}

<!-- New group dialog -->
<Dialog.Root bind:open={newGroupOpen}>
	<Dialog.Content>
		<Dialog.Header><Dialog.Title>New group</Dialog.Title></Dialog.Header>
		<div class="grid gap-2 py-2">
			<Label for="gn">Name</Label>
			<Input id="gn" bind:value={newGroupName} placeholder="Road Trip" />
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (newGroupOpen = false)}>Cancel</Button>
			<Button onclick={createGroup} disabled={!newGroupName.trim()}>Create</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- New playlist dialog -->
<Dialog.Root bind:open={newPlaylistOpen}>
	<Dialog.Content>
		<Dialog.Header><Dialog.Title>New playlist</Dialog.Title></Dialog.Header>
		<div class="grid gap-2 py-2">
			<Label for="pn">Name</Label>
			<Input id="pn" bind:value={newPlaylistName} placeholder="My Mix" />
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (newPlaylistOpen = false)}>Cancel</Button>
			<Button onclick={createPlaylist} disabled={!newPlaylistName.trim()}>Create</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
