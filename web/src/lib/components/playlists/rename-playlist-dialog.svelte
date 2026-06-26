<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Pencil from '@lucide/svelte/icons/pencil';
	import { toast } from 'svelte-sonner';
	import { playlistsApi, type Playlist } from '$lib/api';

	let {
		playlist,
		onRenamed
	}: { playlist: Playlist; onRenamed?: () => void } = $props();

	let open = $state(false);
	let name = $state('');
	let busy = $state(false);

	function openDialog() {
		name = playlist.name;
		open = true;
	}

	async function submit() {
		busy = true;
		try {
			await playlistsApi.rename(playlist.id, name);
			toast.success('Playlist renamed', { description: name });
			open = false;
			onRenamed?.();
		} catch (e) {
			toast.error('Rename failed', { description: (e as Error).message });
		} finally {
			busy = false;
		}
	}
</script>

<Button
	variant="ghost"
	size="icon"
	class="size-7 text-muted-foreground opacity-0 group-hover:opacity-100"
	onclick={openDialog}
	aria-label="Rename playlist"
>
	<Pencil class="size-3.5" />
</Button>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Rename playlist</Dialog.Title>
		</Dialog.Header>
		<div class="grid gap-2 py-2">
			<Label for="rename">Name</Label>
			<Input id="rename" bind:value={name} />
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} disabled={busy}>Cancel</Button>
			<Button onclick={submit} disabled={busy || !name.trim() || name.trim() === playlist.name}>
				{busy ? 'Saving…' : 'Save'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
