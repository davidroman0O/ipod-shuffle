<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { toast } from 'svelte-sonner';
	import { type Device, type Playlist, type PlaylistGroup, type SyncPlan, type SyncJobStatus, syncApi, devicesApi } from '$lib/api';
	import PlaylistAssignmentList from './playlist-assignment-list.svelte';
	import SyncPlanSummary from './sync-plan-summary.svelte';
	import DeviceSnapshot from './device-snapshot.svelte';
	import Play from '@lucide/svelte/icons/play';
	import X from '@lucide/svelte/icons/x';

	let {
		device,
		playlists,
		groups,
		onAssignmentChanged
	}: {
		device: Device;
		playlists: Playlist[];
		groups?: PlaylistGroup[];
		onAssignmentChanged?: () => void;
	} = $props();

	let plan = $state<SyncPlan | null>(null);
	let loading = $state(false);
	let job = $state<SyncJobStatus | null>(null);
	let pollTimer = $state<ReturnType<typeof setInterval> | null>(null);

	const isRunning = $derived(job?.status === 'running');
	const pct = $derived(
		job && (job.total ?? 0) > 0 ? Math.round(((job.current ?? 0) / (job.total ?? 1)) * 100) : 0
	);

	async function preview() {
		loading = true;
		try {
			plan = await syncApi.plan(device.id);
		} catch (e) {
			toast.error('Preview failed', { description: (e as Error).message });
		} finally {
			loading = false;
		}
	}

	async function startSync() {
		try {
			await syncApi.run(device.id);
			plan = null;
			startPolling();
			toast.info('Sync started');
		} catch (e) {
			toast.error('Sync failed to start', { description: (e as Error).message });
		}
	}

	async function cancelSync() {
		try {
			await syncApi.cancel(device.id);
			toast.info('Sync cancelled');
		} catch (e) {
			toast.error('Cancel failed', { description: (e as Error).message });
		}
	}

	function startPolling() {
		stopPolling();
		pollTimer = setInterval(pollStatus, 1000);
	}

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	async function pollStatus() {
		try {
			const status = await syncApi.status(device.id);
			job = status;
			if (status.status === 'completed') {
				stopPolling();
				toast.success(`Sync complete`, {
					description: `${status.result?.manifest.length ?? 0} tracks written`
				});
			} else if (status.status === 'failed') {
				stopPolling();
				toast.error('Sync failed', { description: status.error ?? 'Unknown error' });
			} else if (status.status === 'cancelled') {
				stopPolling();
			}
		} catch {
			// transient; keep polling
		}
	}

	function handleChanged() {
		onAssignmentChanged?.();
		plan = null;
	}

	let wiping = $state(false);

	async function handleWipe() {
		wiping = true;
		try {
			const result = await devicesApi.wipe(device.id);
			toast.success('Device wiped', { description: `${result.deletedFiles} files deleted` });
			onAssignmentChanged?.();
		} catch (e) {
			toast.error('Wipe failed', { description: (e as Error).message });
		} finally {
			wiping = false;
		}
	}
</script>

<div class="space-y-4">
	<PlaylistAssignmentList {device} {playlists} groups={groups ?? []} onChanged={handleChanged} />

	{#if isRunning}
		<!-- Live progress -->
		<div class="space-y-2">
			<div class="flex items-center justify-between text-sm">
				<span class="font-medium capitalize">{job?.phase ?? 'working'}…</span>
				<span class="text-muted-foreground">{job?.current ?? 0} / {job?.total ?? 0}</span>
			</div>
			<Progress value={pct} class="h-2" />
			{#if job?.currentPath}
				<p class="truncate text-xs text-muted-foreground" title={job.currentPath}>
					{job.currentPath}
				</p>
			{/if}
			<Button variant="outline" size="sm" onclick={cancelSync}>
				<X class="size-4" /> Cancel sync
			</Button>
		</div>
	{:else}
		<!-- Controls -->
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={preview} disabled={loading}>
				{loading ? 'Previewing…' : 'Preview'}
			</Button>
			<Button size="sm" onclick={startSync} disabled={!device.playlistIds.length}>
				<Play class="size-4" /> Sync now
			</Button>
		</div>
	{/if}

	{#if plan}
		<SyncPlanSummary {plan} />
	{/if}

	{#if !isRunning}
		<DeviceSnapshot identity={device.identity} />
	{/if}

	<!-- Wipe — destructive, confirmed -->
	{#if !isRunning}
		<div class="flex justify-end border-t pt-3">
			<Button
				variant="ghost"
				size="sm"
				class="text-destructive hover:bg-destructive/10 hover:text-destructive"
				onclick={() => {
					if (confirm(`Wipe ALL music from "${device.name}"? This permanently deletes every track and playlist on the device. This cannot be undone.`)) {
						handleWipe();
					}
				}}
			>
				Wipe device
			</Button>
		</div>
	{/if}
</div>
