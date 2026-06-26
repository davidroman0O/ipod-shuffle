<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import type { Device } from '$lib/api';
	import { timeAgo, formatBytes } from '$lib/utils/format';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		device,
		online,
		onRemove
	}: { device: Device; online: boolean; onRemove?: () => void } = $props();

	const total = $derived(device.totalBytes ?? 0);
	const free = $derived(device.freeBytes ?? 0);
	const used = $derived(total > 0 ? total - free : 0);
	const usedPct = $derived(total > 0 ? Math.round((used / total) * 100) : null);
</script>

<Card class="w-72 transition-colors hover:bg-accent/40">
	<CardHeader>
		<div class="flex items-center justify-between gap-2">
			<CardTitle class="text-base">{device.name}</CardTitle>
			<div class="flex items-center gap-1">
				<Badge variant={online ? 'default' : 'secondary'} class="gap-1.5">
					<span
						class="size-1.5 rounded-full {online
							? 'bg-emerald-500'
							: 'bg-muted-foreground'}"
					></span>
					{online ? 'online' : 'offline'}
				</Badge>
				{#if onRemove}
					<Button
						variant="ghost"
						size="icon"
						class="size-7 text-muted-foreground hover:text-destructive"
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onRemove();
						}}
						aria-label="Forget device"
					>
						<Trash2 class="size-3.5" />
					</Button>
				{/if}
			</div>
		</div>
	</CardHeader>
	<CardContent class="space-y-2 text-sm text-muted-foreground">
		{#if total > 0}
			<div class="space-y-1">
				<div class="flex justify-between text-xs">
					<span>{formatBytes(used)} used</span>
					<span>{formatBytes(free)} free</span>
				</div>
				<Progress value={usedPct ?? 0} class="h-1.5" />
				<p class="text-center text-xs text-muted-foreground">
					{usedPct}% of {formatBytes(total)}
				</p>
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

		{#if device.lastSyncAt}
			<p>Last synced {timeAgo(device.lastSyncAt)}</p>
		{:else}
			<p>Never synced</p>
		{/if}
	</CardContent>
</Card>
