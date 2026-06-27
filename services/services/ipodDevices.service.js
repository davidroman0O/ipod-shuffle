"use strict";

/**
 * ipodDevices
 * -----------
 * Business service for device discovery and assignment. Owns NO data — it asks
 * `ipodEngine` to discover mounted volumes, persists them via `ipodDevicesDb`,
 * and surfaces online status. This is the port of the controller's device
 * refresh/register/online operations.
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodDevices",

	settings: {},

	actions: {
		/**
		 * Discover mounted iPods via the engine and upsert each into
		 * ipodDevicesDb. Emits `ipod.devices.refreshed` as a mesh-visible signal.
		 */
		refresh: {
			async handler(ctx) {
				const discovered = await ctx.call("ipodEngine.discover");
				// Index the live engine data by mount path so we can attach fresh
				// capacity (totalBytes/freeBytes) to each device in the response —
				// this is authoritative even if the persisted record is stale.
				const liveByMount = new Map(discovered.map(d => [d.mountPath, d]));
				const upserted = [];
				let created = 0;
				for (const device of discovered) {
					const result = await ctx.call("ipodDevicesDb.upsertFromDiscovery", {
						discovered: device
					});
					// Attach live capacity so the UI always sees current disk usage.
					const live = liveByMount.get(
						result.device.lastKnownMountPath || result.device.preferredMountPath
					);
					upserted.push({
						...result.device,
						totalBytes: live?.totalBytes ?? result.device.totalBytes,
						freeBytes: live?.freeBytes ?? result.device.freeBytes,
						identity: live?.identity ?? result.device.identity
					});
					if (result.created) created++;
				}
				await ctx.emit("ipod.devices.refreshed", { total: discovered.length, created });
				return { devices: upserted, created };
			}
		},

		/**
		 * Manually register a device at a mount path (inspects it via the engine,
		 * then upserts). Used when auto-discovery misses a volume.
		 */
		register: {
			params: { mountPath: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const discovered = await ctx.call("ipodEngine.inspect", {
					mountPath: ctx.params.mountPath
				});
				const result = await ctx.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
				await ctx.emit("ipod.devices.registered", { deviceId: result.device.id });
				return result.device;
			}
		},

		/** Toggle a playlist assignment on a device. */
		assignPlaylist: {
			params: {
				deviceId: { type: "string", required: true },
				playlistId: { type: "string", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				const device = await ctx.call("ipodDevicesDb.togglePlaylistAssignment", {
					deviceId: ctx.params.deviceId,
					playlistId: ctx.params.playlistId
				});
				await ctx.emit("ipod.devices.playlists.changed", {
					deviceId: ctx.params.deviceId,
					playlistId: ctx.params.playlistId
				});
				return device;
			}
		},

		/** Set the full playlist sync order for a device. */
		setPlaylistOrder: {
			params: {
				deviceId: { type: "string", required: true },
				playlistIds: { type: "array", items: "string", default: [] }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				const device = await ctx.call("ipodDevicesDb.setPlaylistOrder", {
					deviceId: ctx.params.deviceId,
					playlistIds: ctx.params.playlistIds
				});
				await ctx.emit("ipod.devices.playlists.reordered", {
					deviceId: ctx.params.deviceId,
					playlistIds: ctx.params.playlistIds
				});
				return device;
			}
		},

		/** Remove one playlist from every device assignment list. */
		unassignPlaylistEverywhere: {
			params: { playlistId: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const devices = await ctx.call("ipodDevicesDb.listAll");
				const changed = [];
				for (const device of devices) {
					if (
						!Array.isArray(device.playlistIds) ||
						!device.playlistIds.includes(ctx.params.playlistId)
					) {
						continue;
					}
					const next = device.playlistIds.filter(id => id !== ctx.params.playlistId);
					const updated = await ctx.call("ipodDevicesDb.setPlaylistOrder", {
						deviceId: device.id,
						playlistIds: next
					});
					changed.push(updated.id);
				}
				if (changed.length) {
					await ctx.emit("ipod.devices.playlists.changed", {
						playlistId: ctx.params.playlistId,
						deviceIds: changed
					});
				}
				return { changed };
			}
		},

		/**
		 * Report whether a device is currently online (mounted & discovered).
		 */
		isOnline: {
			params: { deviceId: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const device = await ctx.call("ipodDevicesDb.get", { id: ctx.params.deviceId });
				if (!device) return false;
				const discovered = await ctx.call("ipodEngine.discover");
				return discovered.some(
					d =>
						(device.volumeUuid && d.volumeUuid === device.volumeUuid) ||
						(device.lastKnownMountPath && d.mountPath === device.lastKnownMountPath)
				);
			}
		},

		/** Forget a device record (does not unmount the volume). */
		remove: {
			params: { deviceId: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const removed = await ctx.call("ipodDevicesDb.removeById", {
					id: ctx.params.deviceId
				});
				await ctx.emit("ipod.devices.removed", { deviceId: ctx.params.deviceId });
				return removed;
			}
		},

		/** Wipe all audio from a device. */
		wipe: {
			params: { deviceId: { type: "string", required: true } },
			async handler(ctx) {
				const device = await ctx.call("ipodDevicesDb.get", { id: ctx.params.deviceId });
				if (!device) throw new MoleculerError("Device not found.", 404);
				if (!device.lastKnownMountPath) throw new MoleculerError("Device is not mounted.", 409);
				const result = await ctx.call("ipodEngine.wipe", { mountPath: device.lastKnownMountPath });
				// Clear the device record's manifest + lastSyncAt.
				await ctx.call("ipodDevicesDb.update", {
					id: ctx.params.deviceId,
					manifest: [],
					lastSyncAt: null
				});
				await ctx.emit("ipod.devices.wiped", { deviceId: ctx.params.deviceId });
				return result;
			}
		},

		/** Name a device: writes identity to the device + updates the DB name. */
		name: {
			params: {
				deviceId: { type: "string", required: true },
				name: { type: "string", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				const device = await ctx.call("ipodDevicesDb.get", { id: ctx.params.deviceId });
				if (!device) throw new MoleculerError("Device not found.", 404);
				if (!device.lastKnownMountPath) throw new MoleculerError("Device is not mounted.", 409);
				await ctx.call("ipodEngine.setIdentity", {
					mountPath: device.lastKnownMountPath,
					name: ctx.params.name,
					id: ctx.params.deviceId
				});
				return ctx.call("ipodDevicesDb.update", {
					id: ctx.params.deviceId,
					name: ctx.params.name
				});
			}
		},

		/**
		 * Return the complete device state in a single call — everything the modal
		 * needs: device info, assignment tree, on-device snapshot, and server-side
		 * diff. The frontend makes ONE call and renders.
		 */
		state: {
			params: { deviceId: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.getDeviceState(ctx, ctx.params.deviceId);
			}
		}
	},

	methods: {
		/**
		 * Assemble the full device state: device record, capacity, identity
		 * snapshot, assignment tree, and server-computed diff.
		 */
		async getDeviceState(ctx, deviceId) {
			const device = await ctx.call("ipodDevicesDb.get", { id: deviceId });
			if (!device) throw new MoleculerError("Device not found.", 404);

			// Fetch everything in parallel.
			const [allPlaylists, allGroups, resolved, online] = await Promise.all([
				ctx.call("ipodPlaylistsDb.listOrdered"),
				ctx.call("ipodPlaylistGroupsDb.listOrdered"),
				ctx.call("ipodSync.resolve", { deviceId }).catch(() => ({ tracks: [], playlists: [] })),
				ctx.call("ipodDevices.isOnline", { deviceId }).catch(() => false)
			]);

			// Build the assignment tree: groups with nested playlists.
			const assignedIds = device.playlistIds || [];
			const assignedGroups = device.groupIds || [];
			const tree = [];
			for (const g of allGroups) {
				tree.push({
					id: g.id,
					name: g.name,
					type: "group",
					assigned: assignedGroups.includes(g.id),
					playlists: allPlaylists
						.filter((p) => p.groupId === g.id)
						.map((p) => ({
							id: p.id,
							name: p.name,
							aliasOf: p.aliasOf || null,
							trackCount: (p.trackIds || []).length,
							assigned: assignedIds.includes(p.id),
							viaGroup: assignedGroups.includes(g.id),
							effective: assignedIds.includes(p.id) || assignedGroups.includes(g.id)
						}))
				});
			}
			const ungrouped = allPlaylists.filter((p) => !p.groupId);
			if (ungrouped.length > 0) {
				tree.push({
					id: null,
					name: "Ungrouped",
					type: "ungrouped",
					assigned: false,
					playlists: ungrouped.map((p) => ({
						id: p.id,
						name: p.name,
						aliasOf: p.aliasOf || null,
						trackCount: (p.trackIds || []).length,
						assigned: assignedIds.includes(p.id),
						viaGroup: false,
						effective: assignedIds.includes(p.id)
					}))
				});
			}

			// Read identity LIVE from the device (not from the DB record, which may
			// be stale after a wipe or a crashed sync).
			let liveIdentity = null;
			if (device.lastKnownMountPath) {
				try {
					const discovered = await ctx.call("ipodEngine.discover");
					const found = discovered.find((d) => d.mountPath === device.lastKnownMountPath);
					liveIdentity = found?.identity || null;
				} catch {}
			}

			// Build the on-device snapshot from the live identity.
			const onDevice = liveIdentity?.snapshot || null;

			// If the DB has no assignments but the identity snapshot has playlists,
			// derive effective assignments from the snapshot so the UI shows what's
			// on the device pre-selected. This handles wipe/re-mount scenarios.
			let effectiveAssignedIds = [...assignedIds];
			if (effectiveAssignedIds.length === 0 && onDevice && onDevice.playlists) {
				for (const snapPl of onDevice.playlists) {
					// Match snapshot playlist IDs to our playlist records.
					if (allPlaylists.find((p) => p.id === snapPl.id) && !effectiveAssignedIds.includes(snapPl.id)) {
						effectiveAssignedIds.push(snapPl.id);
					}
				}
			}

			// Rebuild the tree with effective assignments.
			const effectiveAssignedGroups = [];
			for (const g of allGroups) {
				const members = allPlaylists.filter((p) => p.groupId === g.id);
				const allAssigned = members.every((p) => effectiveAssignedIds.includes(p.id));
				if (allAssigned && members.length > 0) effectiveAssignedGroups.push(g.id);
			}
			// Rebuild tree with effective assignments.
			const effectiveTree = [];
			for (const g of allGroups) {
				effectiveTree.push({
					id: g.id,
					name: g.name,
					type: "group",
					assigned: effectiveAssignedGroups.includes(g.id),
					playlists: allPlaylists
						.filter((p) => p.groupId === g.id)
						.map((p) => ({
							id: p.id,
							name: p.name,
							aliasOf: p.aliasOf || null,
							trackCount: (p.trackIds || []).length,
							assigned: effectiveAssignedIds.includes(p.id),
							viaGroup: effectiveAssignedGroups.includes(g.id),
							effective: effectiveAssignedIds.includes(p.id) || effectiveAssignedGroups.includes(g.id)
						}))
				});
			}
			const effUngrouped = allPlaylists.filter((p) => !p.groupId);
			if (effUngrouped.length > 0) {
				effectiveTree.push({
					id: null,
					name: "Ungrouped",
					type: "ungrouped",
					assigned: false,
					playlists: effUngrouped.map((p) => ({
						id: p.id,
						name: p.name,
						aliasOf: p.aliasOf || null,
						trackCount: (p.trackIds || []).length,
						assigned: effectiveAssignedIds.includes(p.id),
						viaGroup: false,
						effective: effectiveAssignedIds.includes(p.id)
					}))
				});
			}

			// Compute the diff server-side.
			const { computeDiff } = require("../lib/diff");
			const diff = computeDiff(onDevice, resolved);

			return {
				device: {
					id: device.id,
					name: device.name,
					online,
					totalBytes: device.totalBytes || 0,
					freeBytes: device.freeBytes || 0,
					lastSyncAt: device.lastSyncAt || null,
					lastKnownMountPath: device.lastKnownMountPath || null
				},
				assignments: {
					tree: effectiveTree.length > 0 ? effectiveTree : tree,
					assignedPlaylistIds: effectiveAssignedIds,
					assignedGroupIds: effectiveAssignedGroups
				},
				onDevice,
				diff,
				resolve: {
					trackCount: (resolved.tracks || []).length,
					playlistCount: (resolved.playlists || []).length
				}
			};
		}
	}
};
