<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { devicesApi, playlistsApi, type Device, type Playlist, type Track } from '$lib/api';
	import DeviceCard from '$lib/components/devices/device-card.svelte';
	import RegisterMountDialog from '$lib/components/devices/register-mount-dialog.svelte';
	import DeviceSyncPanel from '$lib/components/devices/device-sync-panel.svelte';
	import SyncDiff from '$lib/components/devices/sync-diff.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	let devices = $state<Device[]>([]);
	let playlists = $state<Playlist[]>([]);
	let online = $state<Record<string, boolean>>({});
	let loading = $state(true);
	let refreshing = $state(false);
	let selectedId = $state<string | null>(null);
	let resolvedTracks = $state<Track[]>([]);
	let resolvedPlaylists = $state<Playlist[]>([]);

	// Derived from the live devices array so the modal always shows fresh data
	// (e.g. after toggling a playlist assignment inside the modal).
	const selected = $derived(devices.find((d) => d.id === selectedId) ?? null);

	onMount(load);

	async function load() {
		loading = true;
		try {
			const [pl, devs] = await Promise.all([playlistsApi.list(), fetchDevices()]);
			playlists = pl;
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
		// Fetch what WOULD sync so the diff component can compare.
		try {
			const { syncApi, tracksApi } = await import('$lib/api');
			const resolved = await syncApi.resolve(device.id);
			// Resolve the track ids from the union into full docs.
			const trackIds = resolved.tracks.map((t: { trackId: string }) => t.trackId);
			if (trackIds.length) {
				resolvedTracks = await tracksApi.list();
				resolvedPlaylists = (resolved.playlists ?? []).map((p: { playlistId: string; name: string; trackIds: string[] }) => ({
					id: p.playlistId, name: p.name, trackIds: p.trackIds, position: 0,
					groupId: null, aliasOf: null, createdAt: '', updatedAt: ''
				})) as Playlist[];
			} else {
				resolvedTracks = [];
				resolvedPlaylists = [];
			}
		} catch {
			resolvedTracks = [];
			resolvedPlaylists = [];
		}
	}

	function onAssignmentChanged() {
		// Re-pull to reflect toggled assignments in the card counts.
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
		<Dialog.Content class="max-w-lg max-h-[85vh] overflow-y-auto">
			<Dialog.Header>
				<Dialog.Title>{selected.name}</Dialog.Title>
				<Dialog.Description>Manage playlists and sync this device.</Dialog.Description>
			</Dialog.Header>
			<DeviceSyncPanel
				device={selected}
				{playlists}
				onAssignmentChanged={onAssignmentChanged}
			/>
			{#if selected.identity?.snapshot}
				<div class="border-t pt-3">
					<SyncDiff
						identity={selected.identity}
						playlists={resolvedPlaylists}
						tracks={resolvedTracks}
					/>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}
