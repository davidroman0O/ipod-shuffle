<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Alert, AlertTitle, AlertDescription } from '$lib/components/ui/alert/index.js';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import type { DeviceIdentity, Playlist, Track } from '$lib/api';

	/**
	 * Compares the device's last-sync snapshot (from the identity file — what's
	 * physically on the device) against the current resolved playlists (what
	 * WOULD sync) to surface differences: added, removed, unchanged.
	 */
	let {
		identity,
		playlists,
		tracks
	}: {
		identity?: DeviceIdentity | null;
		/** Current resolved playlists (what would sync now). */
		playlists: Playlist[];
		/** All tracks (for path lookup). */
		tracks: Track[];
	} = $props();

	const snap = $derived(identity?.snapshot ?? null);

	// Build the snapshot's track-id set (what's on the device).
	const snapTrackIds = $derived(new Set(snap?.playlists?.flatMap((p) => p.tracks.map((t) => t.id)) ?? []));

	// Build the current resolve's track-id set (what would sync now).
	const currentTrackIds = $derived(new Set(playlists.flatMap((p) => p.trackIds)));

	// Compute the diff.
	const diff = $derived.by(() => {
		if (!snap) return null;
		const onDevice = snapTrackIds;
		const current = currentTrackIds;
		const added: string[] = [];
		const removed: string[] = [];
		const unchanged: string[] = [];
		for (const id of current) {
			if (onDevice.has(id)) unchanged.push(id);
			else added.push(id);
		}
		for (const id of onDevice) {
			if (!current.has(id)) removed.push(id);
		}
		return { added, removed, unchanged: unchanged.length, isClean: added.length === 0 && removed.length === 0 };
	});

	const trackName = $derived(new Map(tracks.map((t) => [t.id, t.fileName])));
</script>

{#if diff}
	{#if diff.isClean}
		<Alert>
			<CheckCircle class="size-4" />
			<AlertTitle>In sync</AlertTitle>
			<AlertDescription>The device matches the current playlists exactly.</AlertDescription>
		</Alert>
	{:else}
		<Alert variant="destructive">
			<TriangleAlert class="size-4" />
			<AlertTitle>Out of sync</AlertTitle>
			<AlertDescription>
				<div class="flex flex-wrap gap-2 pt-2">
					{#if diff.added.length > 0}
						<Badge variant="default">+{diff.added.length} to add</Badge>
					{/if}
					{#if diff.removed.length > 0}
						<Badge variant="destructive">-{diff.removed.length} to remove</Badge>
					{/if}
					<Badge variant="secondary">{diff.unchanged} unchanged</Badge>
				</div>
			</AlertDescription>
		</Alert>

		{#if diff.added.length > 0}
			<ScrollArea class="max-h-32 rounded-md border">
				<div class="divide-y">
					{#each diff.added.slice(0, 20) as id (id)}
						<div class="flex items-center gap-2 px-3 py-1 text-xs">
							<Badge variant="default" class="shrink-0">+</Badge>
							<span class="min-w-0 flex-1 truncate">{trackName.get(id) ?? id}</span>
						</div>
					{/each}
					{#if diff.added.length > 20}
						<p class="px-3 py-1 text-xs text-muted-foreground">… and {diff.added.length - 20} more</p>
					{/if}
				</div>
			</ScrollArea>
		{/if}

		{#if diff.removed.length > 0}
			<ScrollArea class="max-h-32 rounded-md border">
				<div class="divide-y">
					{#each diff.removed.slice(0, 20) as id (id)}
						<div class="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
							<Badge variant="destructive" class="shrink-0">-</Badge>
							<span class="min-w-0 flex-1 truncate">{trackName.get(id) ?? id}</span>
						</div>
					{/each}
					{#if diff.removed.length > 20}
						<p class="px-3 py-1 text-xs text-muted-foreground">… and {diff.removed.length - 20} more</p>
					{/if}
				</div>
			</ScrollArea>
		{/if}
	{/if}
{:else}
	<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
		No sync snapshot yet. Sync the device first to enable diff.
	</div>
{/if}
