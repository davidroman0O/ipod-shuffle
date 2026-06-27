<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import type { Device } from '$lib/api';
	import { devicesApi } from '$lib/api';
	import { timeAgo, formatBytes } from '$lib/utils/format';
	import { toast } from 'svelte-sonner';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Settings from '@lucide/svelte/icons/settings';

	let {
		device,
		online,
		onManage,
		onRemove,
		onRenamed
	}: {
		device: Device;
		online: boolean;
		onManage?: () => void;
		onRemove?: () => void;
		onRenamed?: () => void;
	} = $props();

	const total = $derived(device.totalBytes ?? 0);
	const free = $derived(device.freeBytes ?? 0);
	const used = $derived(total > 0 ? total - free : 0);
	const usedPct = $derived(total > 0 ? Math.round((used / total) * 100) : null);

	let editing = $state(false);
	let editName = $state('');
	let busy = $state(false);

	function startEdit() {
		editName = device.name;
		editing = true;
	}

	async function saveName() {
		const trimmed = editName.trim();
		if (!trimmed || trimmed === device.name) {
			editing = false;
			return;
		}
		busy = true;
		try {
			await devicesApi.name(device.id, trimmed);
			toast.success('Device renamed', { description: trimmed });
			editing = false;
			onRenamed?.();
		} catch (e) {
			toast.error('Rename failed', { description: (e as Error).message });
		} finally {
			busy = false;
		}
	}

	function cancelEdit() {
		editing = false;
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter') saveName();
		if (e.key === 'Escape') cancelEdit();
	}
</script>

<Card class="flex w-72 flex-col transition-colors hover:bg-accent/40">
	<CardHeader>
		<div class="flex items-center justify-between gap-2">
			{#if editing}
				<Input
					bind:value={editName}
					onkeydown={handleKey}
					class="h-7 text-base"
					autofocus
				/>
			{:else}
				<CardTitle class="group/name flex items-center gap-1 text-base">
					<span class="cursor-text" onclick={startEdit} onkeydown={(e) => e.key === 'Enter' && startEdit()} role="button" tabindex="0">{device.name}</span>
					<button onclick={startEdit} class="text-muted-foreground opacity-0 group-hover/name:opacity-100 hover:text-foreground" aria-label="Rename">
						<Pencil class="size-3" />
					</button>
				</CardTitle>
			{/if}
			<div class="flex items-center gap-1">
				{#if editing}
					<Button variant="ghost" size="icon" class="size-7" onclick={saveName} disabled={busy} aria-label="Save name">
						<Check class="size-3.5" />
					</Button>
					<Button variant="ghost" size="icon" class="size-7" onclick={cancelEdit} disabled={busy} aria-label="Cancel">
						<X class="size-3.5" />
					</Button>
				{:else}
					<Badge variant={online ? 'default' : 'secondary'} class="gap-1.5">
						<span class="size-1.5 rounded-full {online ? 'bg-emerald-500' : 'bg-muted-foreground'}"></span>
						{online ? 'online' : 'offline'}
					</Badge>
				{/if}
			</div>
		</div>
	</CardHeader>
	<CardContent class="flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
		{#if total > 0}
			<div class="space-y-1">
				<div class="flex justify-between text-xs">
					<span>{formatBytes(used)} used</span>
					<span>{formatBytes(free)} free</span>
				</div>
				<Progress value={usedPct ?? 0} class="h-1.5" />
				<p class="text-center text-xs text-muted-foreground">{usedPct}% of {formatBytes(total)}</p>
			</div>
		{/if}

		<div class="flex flex-wrap gap-x-4 gap-y-1">
			{#if device.playlistIds.length}
				<span>{device.playlistIds.length} playlists</span>
			{:else}
				<span class="italic">No playlists assigned</span>
			{/if}
			{#if device.manifest && device.manifest.length > 0}
				<span>{device.manifest.length} tracks on device</span>
			{/if}
		</div>

		<p>{#if device.lastSyncAt}Last synced {timeAgo(device.lastSyncAt)}{:else}Never synced{/if}</p>

		<!-- Actions at the bottom, outside any wrapping button -->
		<div class="mt-auto flex items-center gap-2 pt-2">
			{#if onManage}
				<button class={buttonVariants({ size: 'sm' })} onclick={onManage}>
					<Settings class="size-4" /> Manage & sync
				</button>
			{/if}
			{#if onRemove}
				<Button variant="ghost" size="icon" class="ml-auto size-8 text-muted-foreground hover:text-destructive" onclick={onRemove} aria-label="Forget device">
					<Trash2 class="size-4" />
				</Button>
			{/if}
		</div>
	</CardContent>
</Card>
