<script lang="ts">
	import { Alert, AlertTitle, AlertDescription } from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { SyncPlan } from '$lib/api';

	let { plan }: { plan: SyncPlan } = $props();

	// Defensive: the Go engine guarantees non-nil arrays now, but old cached
	// responses or partial failures may still carry null/undefined.
	const copies = $derived(plan.copies ?? []);
	const deletes = $derived(plan.deletes ?? []);
	const warnings = $derived(plan.warnings ?? []);
</script>

<div class="space-y-3">
	<div class="flex flex-wrap gap-2">
		<Badge variant="secondary">{plan.trackCount ?? 0} tracks</Badge>
		<Badge variant="default">{copies.length} to copy</Badge>
		<Badge variant="outline">{plan.skips ?? 0} unchanged</Badge>
		<Badge variant="destructive">{deletes.length} to delete</Badge>
	</div>

	{#if warnings.length}
		<Alert variant="destructive">
			<TriangleAlert />
			<AlertTitle>{warnings.length} warning(s)</AlertTitle>
			<AlertDescription>
				<ul class="list-disc pl-4 text-sm">
					{#each warnings as w}
						<li>{w}</li>
					{/each}
				</ul>
			</AlertDescription>
		</Alert>
	{/if}
</div>
