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
		 * ipodDevicesDb. Emits `ipod.devices.changed` when the set differs from
		 * what was last seen (caller-visible signal for the mesh).
		 */
		refresh: {
			async handler(ctx) {
				const discovered = await ctx.call("ipodEngine.discover");
				// Index the live engine data by mount path so we can attach fresh
				// capacity (totalBytes/freeBytes) to each device in the response —
				// this is authoritative even if the persisted record is stale.
				const liveByMount = new Map(discovered.map((d) => [d.mountPath, d]));
				const upserted = [];
				let created = 0;
				for (const device of discovered) {
					const result = await ctx.call("ipodDevicesDb.upsertFromDiscovery", { discovered: device });
					// Attach live capacity so the UI always sees current disk usage.
					const live = liveByMount.get(result.device.lastKnownMountPath || result.device.preferredMountPath);
					upserted.push({
						...result.device,
						totalBytes: live?.totalBytes ?? result.device.totalBytes,
						freeBytes: live?.freeBytes ?? result.device.freeBytes
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
				const discovered = await ctx.call("ipodEngine.inspect", { mountPath: ctx.params.mountPath });
				const result = await ctx.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
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
				return ctx.call("ipodDevicesDb.togglePlaylistAssignment", {
					deviceId: ctx.params.deviceId,
					playlistId: ctx.params.playlistId
				});
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
					(d) =>
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
				return ctx.call("ipodDevicesDb.removeById", { id: ctx.params.deviceId });
			}
		}
	}
};
