<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import type { DeviceIdentity } from '$lib/api';

	/** Shows the last-sync snapshot from the device's identity file — exactly
	 * what's recorded on the device, grouped by playlist. */
	let { identity }: { identity?: DeviceIdentity | null } = $props();

	const snap = $derived(identity?.snapshot ?? null);
</script>

{#if snap}
	<div class="space-y-3">
		<div class="flex items-center gap-2">
			<h3 class="text-sm font-medium">On device</h3>
			<Badge variant="secondary">{snap.totalTracks} tracks</Badge>
			<Badge variant="outline">{snap.playlists.length} playlists</Badge>
			{#if snap.syncedAt}
				<span class="text-xs text-muted-foreground">synced {snap.syncedAt.slice(0, 10)}</span>
			{/if}
		</div>

		<ScrollArea class="max-h-64 rounded-md border">
			<div class="divide-y">
				{#each snap.playlists as pl (pl.id)}
					<details class="group">
						<summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent/40">
							<span class="font-medium">{pl.name}</span>
							<span class="text-xs text-muted-foreground">{pl.tracks.length} tracks</span>
						</summary>
						<div class="bg-muted/30">
							{#each pl.tracks as track (track.id)}
								<div class="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
									<span class="min-w-0 flex-1 truncate">{track.fileName}</span>
									<span class="shrink-0">{(track.sizeBytes / 1048576).toFixed(1)} MB</span>
								</div>
							{/each}
						</div>
					</details>
				{/each}
			</div>
		</ScrollArea>
	</div>
{:else}
	<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
		No sync snapshot on this device yet. It will appear after the first sync.
	</div>
{/if}
