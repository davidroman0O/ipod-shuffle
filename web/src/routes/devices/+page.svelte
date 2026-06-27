<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { devicesApi, playlistsApi, groupsApi, stateApi, type Device, type Playlist, type PlaylistGroup, type DeviceState } from '$lib/api';
	import DeviceCard from '$lib/components/devices/device-card.svelte';
	import RegisterMountDialog from '$lib/components/devices/register-mount-dialog.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import DeviceSyncPanel from '$lib/components/devices/device-sync-panel.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	let devices = $state<Device[]>([]);
	let playlists = $state<Playlist[]>([]);
	let groups = $state<PlaylistGroup[]>([]);
	let online = $state<Record<string, boolean>>({});
	let loading = $state(true);
	let refreshing = $state(false);
	let selectedId = $state<string | null>(null);
	let deviceState = $state<DeviceState | null>(null);

	// Derived from the live devices array so the modal always shows fresh data
	// (e.g. after toggling a playlist assignment inside the modal).
	const selected = $derived(devices.find((d) => d.id === selectedId) ?? null);

	onMount(load);

	async function load() {
		loading = true;
		try {
			const [pl, grps, devs] = await Promise.all([playlistsApi.list(), groupsApi.list(), fetchDevices()]);
			playlists = pl;
			groups = grps;
			devices = devs;
			await refreshOnline();
		} catch (e) {
			toast.error('Load failed', { description: (e as Error).message });
		} finally {
			loading = false;
		}
	}

	async function fetchDevices(): Promise<Device[]> {
		// Discovery + upsert; returns { devices, created }.
		const res = await devicesApi.refresh();
		return res.devices;
	}

	async function refreshOnline() {
		const entries = await Promise.all(
			devices.map(async (d) => [d.id, await devicesApi.isOnline(d.id)] as const)
		);
		online = Object.fromEntries(entries);
	}

	async function handleRefresh() {
		refreshing = true;
		try {
			await load();
			toast.success('Devices refreshed');
		} finally {
			refreshing = false;
		}
	}

	async function openDetail(device: Device) {
		selectedId = device.id;
		// ONE call — backend returns the complete modal state.
		try {
			deviceState = await stateApi.getDeviceState(device.id);
		} catch (e) {
			toast.error('Failed to load device state', { description: (e as Error).message });
			deviceState = null;
		}
	}

	function onAssignmentChanged() {
		// Re-fetch the single device state so the modal reflects changes.
		if (selectedId) {
			stateApi.getDeviceState(selectedId).then((s) => (deviceState = s)).catch(() => {});
		}
		void load();
	}

	async function handleRemoveDevice(device: Device) {
		if (!confirm(`Forget device "${device.name}"? This does not unmount the volume.`)) return;
		try {
			await devicesApi.remove(device.id);
			toast.success('Device removed');
			await load();
		} catch (e) {
			toast.error('Remove failed', { description: (e as Error).message });
		}
	}
</script>

<svelte:head><title>Devices · ipod</title></svelte:head>

<div class="flex items-center justify-between pb-4">
	<p class="text-sm text-muted-foreground">
		{devices.length} device{devices.length === 1 ? '' : 's'} discovered
	</p>
	<div class="flex gap-2">
		<RegisterMountDialog onRegistered={load} />
		<Button variant="outline" size="sm" onclick={handleRefresh} disabled={refreshing}>
			<RefreshCw class="size-4" />
			{refreshing ? 'Refreshing…' : 'Refresh'}
		</Button>
	</div>
</div>

{#if loading}
	<div class="flex flex-wrap gap-4">
		{#each Array(3) as _}
			<Skeleton class="h-40 w-72 rounded-lg" />
		{/each}
	</div>
{:else if devices.length === 0}
	<div
		class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center"
	>
		<p class="text-sm text-muted-foreground">No devices discovered.</p>
		<p class="mt-1 text-xs text-muted-foreground">
			Mount an iPod Shuffle or register a mount path manually.
		</p>
	</div>
{:else}
	<div class="flex flex-wrap gap-4">
		{#each devices as device (device.id)}
			<DeviceCard
				{device}
				online={online[device.id] ?? false}
				onManage={() => openDetail(device)}
				onRemove={() => handleRemoveDevice(device)}
				onRenamed={load}
			/>
		{/each}
	</div>
{/if}

{#if selected}
	<Dialog.Root open onOpenChange={(o) => !o && (selectedId = null)}>
		<Dialog.Content class="max-w-[96vw] sm:max-w-6xl max-h-[92vh] overflow-hidden p-0">
			{#if deviceState}
				<!-- Header -->
				<div class="border-b px-6 py-4">
					<div class="flex items-center justify-between">
						<h2 class="text-lg font-semibold">{deviceState.device.name}</h2>
						<Dialog.Close />
					</div>
					<div class="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
						{#if deviceState.device.totalBytes}
							<span>{((deviceState.device.totalBytes - deviceState.device.freeBytes) / 1048576).toFixed(1)} MB used</span>
							<span>·</span>
							<span>{(deviceState.device.freeBytes / 1048576).toFixed(0)} MB free</span>
						{/if}
						{#if deviceState.device.lastSyncAt}
							<span>·</span>
							<span>synced {deviceState.device.lastSyncAt.slice(0, 10)}</span>
						{/if}
					</div>
				</div>

				<!-- Two columns -->
				<div class="grid grid-cols-2 gap-0 max-h-[calc(92vh-5rem)]">
					<!-- LEFT: assignments + controls -->
					<div class="overflow-y-auto border-r px-6 py-4">
						<DeviceSyncPanel
							device={selected!}
							{playlists}
							{groups}
							onAssignmentChanged={onAssignmentChanged}
						/>
					</div>

					<!-- RIGHT: on-device snapshot + diff (pure render from backend state) -->
					<div class="overflow-y-auto px-6 py-4">
						<h3 class="mb-3 text-sm font-medium">On device</h3>
						{#if deviceState.onDevice}
							<div class="mb-2 flex items-center gap-2">
								<Badge variant="secondary">{deviceState.onDevice.totalTracks} tracks</Badge>
								<Badge variant="outline">{deviceState.onDevice.playlists.length} playlists</Badge>
							</div>
							<div class="max-h-48 overflow-y-auto rounded-md border">
								<div class="divide-y">
									{#each deviceState.onDevice.playlists as pl (pl.id)}
										<details>
											<summary class="cursor-pointer px-3 py-2 text-sm hover:bg-accent/40">
												{pl.name} <span class="text-xs text-muted-foreground">({pl.tracks.length})</span>
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
							</div>
						{:else}
							<p class="text-sm text-muted-foreground">No sync snapshot yet.</p>
						{/if}

						{#if deviceState.diff.status !== 'no-snapshot'}
							<div class="mt-4">
								<h3 class="mb-3 text-sm font-medium">Sync diff</h3>
								{#if deviceState.diff.status === 'in-sync'}
									<Badge variant="secondary">✓ In sync</Badge>
								{:else}
									<div class="flex flex-wrap gap-2">
										{#if deviceState.diff.added.length > 0}
											<Badge variant="default">+{deviceState.diff.added.length} to add</Badge>
										{/if}
										{#if deviceState.diff.removed.length > 0}
											<Badge variant="destructive">-{deviceState.diff.removed.length} to remove</Badge>
										{/if}
										<Badge variant="secondary">{deviceState.diff.unchangedCount} unchanged</Badge>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="px-6 py-8 text-center text-sm text-muted-foreground">Loading…</div>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}
