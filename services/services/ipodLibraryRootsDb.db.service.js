"use strict";

const DbMixin = require("../mixins/db.mixin");

/**
 * ipodLibraryRootsDb
 * ---------------------
 * Data-owner service for the `library-roots` collection — the filesystem roots
 * the library service scans for audio. Pure data: no walking/scanning logic
 * (that lives in `ipodLibrary`, which calls this to read the roots list).
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodLibraryRootsDb",
	mixins: [DbMixin({ collection: "library-roots" })],

	settings: {
		fields: {
			id: { type: "string", primaryKey: true, columnName: "_id" },
			path: { type: "string", required: true },
			addedAt: "string"
		}
	},

	actions: {
		// The db mixin provides: list, find, get, create, update, remove, count.

		/** Add a library root (idempotent by path). */
		add: {
			params: { path: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const existing = await this.findEntity(ctx, { query: { path: ctx.params.path } });
				if (existing) return existing;
				return this.createEntity(ctx, { path: ctx.params.path, addedAt: this.now() });
			}
		},

		/** Return all registered root paths (legacy: strings only). */
		listPaths: {
			async handler(ctx) {
				const docs = await this.findEntities(ctx, {});
				return docs.map(d => d.path);
			}
		},

		/** Return all registered roots as full documents ({id, path, addedAt}).
		 * Use this from the UI so it has stable ids for keys and removal. */
		listAll: {
			async handler(ctx) {
				return this.findEntities(ctx, {});
			}
		},

		/** Remove a library root by id. Returns the removed id, or null if absent. */
		removeByPath: {
			params: { path: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const existing = await this.findEntity(ctx, { query: { path: ctx.params.path } });
				if (!existing) return null;
				await this.removeEntity(ctx, { id: existing.id });
				return existing.id;
			}
		}
	},

	methods: {
		now() {
			return new Date().toISOString();
		}
	}
};
