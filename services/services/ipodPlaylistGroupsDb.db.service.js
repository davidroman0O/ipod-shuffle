"use strict";

const DbMixin = require("../mixins/db.mixin");
const { MoleculerError } = require("moleculer").Errors;

/**
 * ipodPlaylistGroupsDb
 * --------------------
 * Data-owner for the `playlist-groups` collection. Groups are flat (no nesting)
 * containers that organize playlists for display + sync assignment. A device
 * can be assigned a whole group, which expands to all its member playlists at
 * sync time.
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodPlaylistGroupsDb",
	mixins: [DbMixin({ collection: "playlist-groups" })],

	settings: {
		fields: {
			id: { type: "string", primaryKey: true, columnName: "_id" },
			name: { type: "string", required: true },
			position: { type: "number", default: 0 },
			createdAt: "string",
			updatedAt: "string"
		}
	},

	actions: {
		/** Create a group with a normalised, unique name. */
		createNamed: {
			params: { name: { type: "string", required: true } },
			async handler(ctx) {
				const trimmed = ctx.params.name.trim().replace(/\s+/g, " ");
				if (!trimmed) throw new MoleculerError("Group name cannot be empty.", 422);
				const position = await this.nextPosition(ctx);
				const now = this.now();
				return this.createEntity(ctx, { name: trimmed, position, createdAt: now, updatedAt: now });
			}
		},

		/** Rename a group (normalised, unique). */
		rename: {
			params: { id: { type: "string", required: true }, name: { type: "string", required: true } },
			async handler(ctx) {
				const trimmed = ctx.params.name.trim().replace(/\s+/g, " ");
				if (!trimmed) throw new MoleculerError("Group name cannot be empty.", 422);
				return this.updateEntity(ctx, { id: ctx.params.id, name: trimmed, updatedAt: this.now() });
			}
		},

		/** Return groups ordered by position. */
		listOrdered: {
			async handler(ctx) {
				const docs = await this.findEntities(ctx, {});
				return docs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
			}
		},

		/** Reorder groups (full ordered id list). */
		setOrder: {
			params: { orderedIds: { type: "array", items: "string" } },
			async handler(ctx) {
				const now = this.now();
				for (let i = 0; i < ctx.params.orderedIds.length; i++) {
					await this.updateEntity(ctx, { id: ctx.params.orderedIds[i], position: i, updatedAt: now });
				}
				return { reordered: ctx.params.orderedIds.length };
			}
		},

		/** Delete a group — member playlists fall back to ungrouped (groupId = null). */
		removeGroup: {
			params: { id: { type: "string", required: true } },
			async handler(ctx) {
				// Clear groupId on all member playlists.
				await ctx.call("ipodPlaylistsDb.clearGroup", { groupId: ctx.params.id });
				const existing = await this.findEntity(ctx, { query: { _id: ctx.params.id } });
				if (!existing) return null;
				await this.removeEntity(ctx, { id: ctx.params.id });
				return ctx.params.id;
			}
		},

		/** Resolve the full group documents for a set of ids. */
		resolveByIds: {
			params: { ids: { type: "array", items: "string" } },
			async handler(ctx) {
				const ids = ctx.params.ids;
				if (!ids.length) return [];
				return this.findEntities(ctx, { query: { _id: { $in: ids } } });
			}
		}
	},

	methods: {
		async nextPosition(ctx) {
			const docs = await this.findEntities(ctx, {});
			return docs.reduce((max, d) => Math.max(max, d.position ?? 0), -1) + 1;
		},
		now() {
			return new Date().toISOString();
		}
	}
};
