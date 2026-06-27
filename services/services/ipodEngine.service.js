"use strict";

const { EngineClient } = require("../lib/engine-client");

/**
 * ipodEngine
 * -----------
 * The ONLY service that talks HTTP to the local Go device engine. Every other
 * service routes engine operations through here so the mesh can discover,
 * cache, and fail over uniformly.
 *
 * The client is constructed from settings.engineUrl (env: IPOD_ENGINE_URL) and
 * is overridable per-instance for tests (`service.engine = fakeEngine`).
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodEngine",

	settings: {
		engineUrl: process.env.IPOD_ENGINE_URL || "http://127.0.0.1:8765"
	},

	actions: {
		/** Check engine liveness. */
		health: {
			async handler() {
				return this.engine.health();
			}
		},

		/** Scan the volumes root for iPod Shuffle volumes. */
		discover: {
			async handler() {
				return this.engine.discover();
			}
		},

		/** Inspect a single mount path. */
		inspect: {
			params: { mountPath: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.engine.inspect(ctx.params.mountPath);
			}
		},

		/** Dry-run a sync: report copies/skips/deletes without writing. */
		syncPlan: {
			params: {
				mountPath: { type: "string", required: true },
				tracks: { type: "array", items: "object" },
				playlists: { type: "array", items: "object", optional: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.engine.syncPlan({
					mountPath: ctx.params.mountPath,
					tracks: ctx.params.tracks,
					playlists: ctx.params.playlists || []
				});
			}
		},

		/** Write/update the on-device identity file. */
		setIdentity: {
			params: {
				mountPath: { type: "string", required: true },
				name: { type: "string", required: true },
				id: { type: "string", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.engine.setIdentity(ctx.params.mountPath, ctx.params.name, ctx.params.id);
			}
		},

		/** Execute a sync against a device (writes iTunesSD/iTunesStats). */
		sync: {
			params: {
				mountPath: { type: "string", required: true },
				tracks: { type: "array", items: "object" },
				playlists: { type: "array", items: "object", optional: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.engine.sync({
					mountPath: ctx.params.mountPath,
					tracks: ctx.params.tracks,
					playlists: ctx.params.playlists || []
				});
			}
		}
	},

	/** Construct the engine client from settings; tests swap `service.engine`. */
	created() {
		this.engine = new EngineClient(this.settings.engineUrl);
	}
};
