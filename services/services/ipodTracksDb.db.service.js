"use strict";

const DbMixin = require("../mixins/db.mixin");

/**
 * ipodTracksDb
 * --------------
 * Data-owner service for the `tracks` collection. This is the ONLY service that
 * touches track storage; every other service reads/writes tracks by calling
 * these actions via the broker.
 *
 * This service is a pure data layer: it holds no filesystem logic (the
 * `ipodLibrary` business service owns scanning/revalidation and calls these
 * actions to persist results).
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodTracksDb",
	mixins: [DbMixin({ collection: "tracks" })],

	settings: {
		fields: {
			id: { type: "string", primaryKey: true, columnName: "_id" },
			sourcePath: { type: "string", required: true },
			fileName: { type: "string", required: true },
			extension: { type: "string", required: true },
			sizeBytes: { type: "number" },
			modifiedAtMs: { type: "number" },
			exists: { type: "boolean", default: true },
			addedAt: "string",
			updatedAt: "string"
		}
	},

	actions: {
		// The db mixin provides: list, find, get, create, update, remove, count.

		/** Find a single track by its source path (returns null if absent). */
		findBySourcePath: {
			params: { sourcePath: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.findEntity(ctx, { query: { sourcePath: ctx.params.sourcePath } });
			}
		},

		/**
		 * Resolve track documents for a list of ids, preserving order and dropping
		 * missing ids. Used by the sync orchestrator.
		 */
		resolveByIds: {
			params: { ids: { type: "array", items: "string" } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const ids = ctx.params.ids;
				if (!ids.length) return [];
				// Use findEntities (not adapter.find) so docs are field-transformed
				// (raw adapter output has _id, not id — which would break the Map below).
				const docs = await this.findEntities(ctx, { query: { _id: { $in: ids } } });
				const byId = new Map(docs.map(d => [d.id, d]));
				return ids.map(id => byId.get(id)).filter(Boolean);
			}
		},

		/**
		 * Return every track document, unpaginated. Used by bulk operations
		 * (revalidation) that must scan the whole collection.
		 */
		listAll: {
			async handler(ctx) {
				return this.findEntities(ctx, {});
			}
		},

		/**
		 * Insert or update a track record by source path. Pure data — no FS stat.
		 * The caller supplies size/mtime; `ipodLibrary` computes them.
		 */
		upsertRecord: {
			params: {
				sourcePath: { type: "string", required: true },
				fileName: { type: "string", required: true },
				extension: { type: "string", required: true },
				sizeBytes: { type: "number", required: true },
				modifiedAtMs: { type: "number", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.upsertByPath(ctx, ctx.params);
			}
		},

		/** Mark a track as missing (file gone from disk). */
		markMissing: {
			params: { id: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.updateEntity(ctx, {
					id: ctx.params.id,
					exists: false,
					updatedAt: this.now()
				});
			}
		},

		/** Mark a track as present with refreshed metadata. */
		refresh: {
			params: {
				id: { type: "string", required: true },
				sizeBytes: { type: "number", required: true },
				modifiedAtMs: { type: "number", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.updateEntity(ctx, {
					id: ctx.params.id,
					sizeBytes: ctx.params.sizeBytes,
					modifiedAtMs: ctx.params.modifiedAtMs,
					exists: true,
					updatedAt: this.now()
				});
			}
		}
	},

	methods: {
		/** Core upsert keyed on sourcePath. */
		async upsertByPath(ctx, params) {
			const existing = await this.findEntity(ctx, {
				query: { sourcePath: params.sourcePath }
			});
			const now = this.now();
			if (!existing) {
				return {
					track: await this.createEntity(ctx, {
						...params,
						exists: true,
						addedAt: now,
						updatedAt: now
					}),
					created: true
				};
			}
			return {
				track: await this.updateEntity(ctx, {
					id: existing.id,
					...params,
					exists: true,
					updatedAt: now
				}),
				created: false
			};
		},

		now() {
			return new Date().toISOString();
		}
	}
};
