"use strict";

const { MoleculerError } = require("moleculer").Errors;

const DbMixin = require("../mixins/db.mixin");

/**
 * ipodDevicesDb
 * ---------------
 * Data-owner service for the `devices` collection — the iPod Shuffle devices
 * the product layer knows about, their playlist assignments, mount info, and
 * last-sync manifest. Pure data: no discovery/sync logic (those live in
 * `ipodDevices` and `ipodSync` business services, which call these actions).
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodDevicesDb",
	mixins: [DbMixin({ collection: "devices" })],

	settings: {
		fields: {
			id: { type: "string", primaryKey: true, columnName: "_id" },
			name: { type: "string", required: true },
			playlistIds: { type: "array", items: "string", default: [] },
			preferredMountPath: { type: "string", optional: true },
			lastKnownMountPath: { type: "string", optional: true },
			volumeUuid: { type: "string", optional: true },
			deviceNode: { type: "string", optional: true },
			totalBytes: { type: "number", optional: true },
			freeBytes: { type: "number", optional: true },
			lastSeenAt: { type: "string", optional: true },
			lastSyncAt: { type: "string", optional: true },
			manifest: { type: "array", items: "object", default: [] }
		}
	},

	actions: {
		// The db mixin provides: list, find, get, create, update, remove, count.

		/** Find a device by volume UUID (returns null if absent). */
		findByVolumeUuid: {
			params: { volumeUuid: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.findEntity(ctx, { query: { volumeUuid: ctx.params.volumeUuid } });
			}
		},

		/** Delete a device by id. Returns the removed id, or null if absent. */
		removeById: {
			params: { id: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const existing = await this.findEntity(ctx, { query: { _id: ctx.params.id } });
				if (!existing) return null;
				await this.removeEntity(ctx, { id: ctx.params.id });
				return ctx.params.id;
			}
		},

		/** Return every device document, unpaginated (for bulk operations). */
		listAll: {
			async handler(ctx) {
				return this.findEntities(ctx, {});
			}
		},

		/**
		 * Upsert a device from engine discovery data. Creates a new device or
		 * refreshes the mount/uuid info of an existing one (matched by UUID or
		 * mount path). Returns the stored device.
		 */
		upsertFromDiscovery: {
			params: {
				discovered: { type: "object", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.upsertDiscovered(ctx, ctx.params.discovered);
			}
		},

		/** Toggle whether a playlist is assigned to a device. */
		togglePlaylistAssignment: {
			params: {
				deviceId: { type: "string", required: true },
				playlistId: { type: "string", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				const device = await this.findEntity(ctx, { query: { _id: ctx.params.deviceId } });
				if (!device) throw new MoleculerError("Device not found.", 404);
				const has = device.playlistIds.includes(ctx.params.playlistId);
				const next = has
					? device.playlistIds.filter(id => id !== ctx.params.playlistId)
					: [...device.playlistIds, ctx.params.playlistId];
				return this.updateEntity(ctx, { id: ctx.params.deviceId, playlistIds: next });
			}
		},

		/** Reorder the playlist sync order for a device (full ordered id list). */
		setPlaylistOrder: {
			params: {
				deviceId: { type: "string", required: true },
				playlistIds: { type: "array", items: "string", default: [] }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.updateEntity(ctx, {
					id: ctx.params.deviceId,
					playlistIds: ctx.params.playlistIds
				});
			}
		},

		/** Record a completed sync: manifest + timestamp. */
		recordSync: {
			params: {
				deviceId: { type: "string", required: true },
				manifest: { type: "array", items: "object" },
				syncedAt: { type: "string", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.updateEntity(ctx, {
					id: ctx.params.deviceId,
					manifest: ctx.params.manifest,
					lastSyncAt: ctx.params.syncedAt
				});
			}
		}
	},

	methods: {
		async upsertDiscovered(ctx, discovered) {
			const now = this.now();
			const existing = await this.findExisting(ctx, discovered);
			// Stable, slash-free id: prefer the volume UUID; otherwise derive a short
			// hash from the mount path so it is safe to put in a URL path segment.
			const stableId = discovered.volumeUuid || stableIdFromMount(discovered.mountPath);
			if (!existing) {
				return {
					device: await this.createEntity(ctx, {
						id: stableId,
						name: discovered.name,
						playlistIds: [],
						preferredMountPath: discovered.mountPath,
						lastKnownMountPath: discovered.mountPath,
						volumeUuid: discovered.volumeUuid,
						deviceNode: discovered.deviceNode,
						totalBytes: discovered.totalBytes,
						freeBytes: discovered.freeBytes,
						lastSeenAt: now
					}),
					created: true
				};
			}
			return {
				device: await this.updateEntity(ctx, {
					id: existing.id,
					name: discovered.name,
					preferredMountPath: discovered.mountPath,
					lastKnownMountPath: discovered.mountPath,
					volumeUuid: discovered.volumeUuid || existing.volumeUuid,
					deviceNode: discovered.deviceNode || existing.deviceNode,
					totalBytes: discovered.totalBytes ?? existing.totalBytes,
					freeBytes: discovered.freeBytes ?? existing.freeBytes,
					lastSeenAt: now
				}),
				created: false
			};
		},

		/** Match an existing device by UUID, preferred, or last-known mount path. */
		async findExisting(ctx, discovered) {
			if (discovered.volumeUuid) {
				const byUuid = await this.findEntity(ctx, {
					query: { volumeUuid: discovered.volumeUuid }
				});
				if (byUuid) return byUuid;
			}
			const byMount = await this.findEntity(ctx, {
				query: {
					$or: [
						{ preferredMountPath: discovered.mountPath },
						{ lastKnownMountPath: discovered.mountPath }
					]
				}
			});
			return byMount;
		},

		now() {
			return new Date().toISOString();
		}
	}
};

const { createHash } = require("node:crypto");

/**
 * Derive a stable, slash-free id from a mount path (used when diskutil reports
 * no volume UUID). A short hex hash keeps device ids URL-safe as path params.
 */
function stableIdFromMount(mountPath) {
	return "mount-" + createHash("sha1").update(mountPath).digest("hex").slice(0, 12);
}
