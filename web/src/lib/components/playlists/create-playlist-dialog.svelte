<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { playlistsApi } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import Plus from '@lucide/svelte/icons/plus';

	let open = $state(false);
	let name = $state('');
	let busy = $state(false);
	let { onCreated }: { onCreated?: () => void } = $props();

	async function submit() {
		busy = true;
		try {
			await playlistsApi.create(name.trim());
			toast.success('Playlist created', { description: name.trim() });
			name = '';
			open = false;
			onCreated?.();
		} catch (e) {
			toast.error('Create failed', { description: (e as Error).message });
		} finally {
			busy = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={buttonVariants({ size: 'sm' })}>
		<Plus class="size-4" /> New playlist
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>New playlist</Dialog.Title>
		</Dialog.Header>
		<div class="grid gap-2 py-2">
			<Label for="name">Name</Label>
			<Input id="name" bind:value={name} placeholder="Rock" />
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} disabled={busy}>Cancel</Button>
			<Button onclick={submit} disabled={busy || !name.trim()}>
				{busy ? 'Creating…' : 'Create'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
