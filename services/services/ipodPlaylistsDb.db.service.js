"use strict";

const { MoleculerError } = require("moleculer").Errors;

const DbMixin = require("../mixins/db.mixin");

/**
 * ipodPlaylistsDb
 * -----------------
 * Data-owner service for the `playlists` collection. Owns playlists and their
 * track memberships (stored as an ordered `trackIds` array, mirroring the
 * original model). Other services call these actions; none touch the playlist
 * collection directly.
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodPlaylistsDb",
	mixins: [DbMixin({ collection: "playlists" })],

	settings: {
		fields: {
			id: { type: "string", primaryKey: true, columnName: "_id" },
			name: { type: "string", required: true },
			trackIds: { type: "array", items: "string", default: [] },
			position: { type: "number", default: 0 },
			groupId: { type: "string", optional: true },
			aliasOf: { type: "string", optional: true },
			createdAt: "string",
			updatedAt: "string"
		}
	},

	actions: {
		// The db mixin provides: list, find, get, create, update, remove, count.

		/** Find a playlist by name (case-insensitive). Returns null if absent. */
		findByName: {
			params: { name: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const adapter = await this.getAdapter(ctx);
				return adapter.findOne({
					query: { name: new RegExp(`^${escapeRegex(ctx.params.name)}$`, "i") }
				});
			}
		},

		/** Create a playlist with a normalised, unique name. */
		createNamed: {
			params: { name: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const trimmed = ctx.params.name.trim().replace(/\s+/g, " ");
				if (!trimmed) throw new MoleculerError("Playlist name cannot be empty.", 422);
				const clash = await this.findEntity(ctx, {
					query: { name: new RegExp(`^${escapeRegex(trimmed)}$`, "i") }
				});
				if (clash) throw new MoleculerError(`Playlist "${trimmed}" already exists.`, 409);
				const position = await this.nextPosition(ctx);
				const now = this.now();
				return this.createEntity(ctx, {
					name: trimmed,
					trackIds: [],
					position,
					createdAt: now,
					updatedAt: now
				});
			}
		},

		/** Append a track to a playlist (idempotent; preserves order). */
		addTrack: {
			params: {
				id: { type: "string", required: true },
				trackId: { type: "string", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.addTrackToPlaylist(ctx, ctx.params.id, ctx.params.trackId);
			}
		},

		/** Append many tracks at once (idempotent; preserves given order). */
		addTracks: {
			params: {
				id: { type: "string", required: true },
				trackIds: { type: "array", items: "string" }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.addTracksToPlaylist(ctx, ctx.params.id, ctx.params.trackIds);
			}
		},

		/** Insert tracks at a specific position (shifts the rest down). position -1 = append. */
		insertTracks: {
			params: {
				id: { type: "string", required: true },
				trackIds: { type: "array", items: "string" },
				position: { type: "number", default: -1 }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.insertTracksIntoPlaylist(
					ctx,
					ctx.params.id,
					ctx.params.trackIds,
					ctx.params.position
				);
			}
		},

		/** Remove a track from a playlist. */
		removeTrack: {
			params: {
				id: { type: "string", required: true },
				trackId: { type: "string", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.removeTrackFromPlaylist(ctx, ctx.params.id, ctx.params.trackId);
			}
		},

		/**
		 * Resolve the full playlist documents (with trackIds) for a set of ids.
		 */
		resolveByIds: {
			params: { ids: { type: "array", items: "string" } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const ids = ctx.params.ids;
				if (!ids.length) return [];
				// Use findEntities so docs carry `id` (not raw `_id`).
				return this.findEntities(ctx, { query: { _id: { $in: ids } } });
			}
		},

		/**
		 * Clone a playlist: creates an independent copy with the same trackIds.
		 * The clone can be freely edited afterwards; changes to the source don't
		 * affect it.
		 */
		clone: {
			params: {
				id: { type: "string", required: true },
				name: { type: "string", optional: true },
				groupId: { type: "string", optional: true }
			},
			async handler(ctx) {
				return this.clonePlaylist(ctx, ctx.params.id, ctx.params.name, ctx.params.groupId);
			}
		},

		/**
		 * Create an alias: a lightweight reference that mirrors the source's
		 * tracks in real-time. Has no own trackIds; can be placed in a different
		 * group. At sync time, aliases resolve to their source.
		 */
		alias: {
			params: {
				sourceId: { type: "string", required: true },
				groupId: { type: "string", optional: true },
				name: { type: "string", optional: true }
			},
			async handler(ctx) {
				return this.createAlias(ctx, ctx.params.sourceId, ctx.params.groupId, ctx.params.name);
			}
		},

		/** Move a playlist to a group (or ungrouped if groupId is null). */
		moveToGroup: {
			params: {
				id: { type: "string", required: true },
				groupId: { type: "string", optional: true }
			},
			async handler(ctx) {
				return this.updateEntity(ctx, {
					id: ctx.params.id,
					groupId: ctx.params.groupId ?? null,
					updatedAt: this.now()
				});
			}
		},

		/** Clear a group from all member playlists (called on group deletion). */
		clearGroup: {
			params: { groupId: { type: "string", required: true } },
			async handler(ctx) {
				const docs = await this.findEntities(ctx, { query: { groupId: ctx.params.groupId } });
				const now = this.now();
				for (const doc of docs) {
					await this.updateEntity(ctx, { id: doc.id, groupId: null, updatedAt: now });
				}
				return { cleared: docs.length };
			}
		},

		/** Resolve an alias to its source playlist (returns the playlist itself if not an alias). */
		resolveSource: {
			params: { id: { type: "string", required: true } },
			async handler(ctx) {
				return this.resolveSourcePlaylist(ctx, ctx.params.id);
			}
		},

		/** Return all playlists belonging to a specific group. */
		listByGroup: {
			params: { groupId: { type: "string", required: true } },
			async handler(ctx) {
				return this.findEntities(ctx, { query: { groupId: ctx.params.groupId } });
			}
		},

		/**
		 * Return all playlists ordered by their list `position` (stable for the UI
		 * and for device sync ordering).
		 */
		listOrdered: {
			async handler(ctx) {
				const docs = await this.findEntities(ctx, {});
				return docs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
			}
		},

		/** Rename a playlist (normalised + unique). */
		rename: {
			params: {
				id: { type: "string", required: true },
				name: { type: "string", required: true }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				const trimmed = ctx.params.name.trim().replace(/\s+/g, " ");
				if (!trimmed) throw new MoleculerError("Playlist name cannot be empty.", 422);
				const clash = await this.findEntity(ctx, {
					query: { name: new RegExp(`^${escapeRegex(trimmed)}$`, "i") }
				});
				if (clash && clash.id !== ctx.params.id) {
					throw new MoleculerError(`Playlist "${trimmed}" already exists.`, 409);
				}
				return this.updateEntity(ctx, {
					id: ctx.params.id,
					name: trimmed,
					updatedAt: this.now()
				});
			}
		},

		/**
		 * Reorder the playlist list itself. `orderedIds` is the full playlist id
		 * list in the desired order; positions are rewritten as 0,1,2,… in one
		 * pass. Any id not in the list keeps its old position.
		 */
		setOrder: {
			params: { orderedIds: { type: "array", items: "string" } },
			/** @param {Context} ctx */
			async handler(ctx) {
				return this.applyOrder(ctx, ctx.params.orderedIds);
			}
		},

		/**
		 * Rewrite a playlist's track order. `trackIds` is the full, desired track
		 * id list for the playlist (replaces the stored array). Missing/extra ids
		 * are the caller's responsibility — pass the exact desired order.
		 */
		setTrackOrder: {
			params: {
				id: { type: "string", required: true },
				trackIds: { type: "array", items: "string" }
			},
			/** @param {Context} ctx */
			async handler(ctx) {
				const playlist = await this.findEntity(ctx, { query: { _id: ctx.params.id } });
				if (!playlist) throw new MoleculerError("Playlist not found.", 404);
				return this.updateEntity(ctx, {
					id: ctx.params.id,
					trackIds: ctx.params.trackIds,
					updatedAt: this.now()
				});
			}
		}
	},

	methods: {
		/** Clone: deep-copy trackIds into a new independent playlist. */
		async clonePlaylist(ctx, sourceId, name, groupId) {
			const source = await this.resolveSourcePlaylist(ctx, sourceId);
			const position = await this.nextPosition(ctx);
			const now = this.now();
			return this.createEntity(ctx, {
				name: name || `${source.name} (copy)`,
				trackIds: [...(source.trackIds || [])],
				position,
				groupId: groupId ?? null,
				aliasOf: null,
				createdAt: now,
				updatedAt: now
			});
		},

		/** Alias: a lightweight reference mirroring the source. No own trackIds. */
		async createAlias(ctx, sourceId, groupId, name) {
			const source = await this.resolveSourcePlaylist(ctx, sourceId);
			const position = await this.nextPosition(ctx);
			const now = this.now();
			return this.createEntity(ctx, {
				name: name || `${source.name} (alias)`,
				trackIds: [],
				position,
				groupId: groupId ?? null,
				aliasOf: source.id,
				createdAt: now,
				updatedAt: now
			});
		},

		/** Resolve an alias chain to its ultimate source playlist. */
		async resolveSourcePlaylist(ctx, playlistId) {
			const playlist = await this.findEntity(ctx, { query: { _id: playlistId } });
			if (!playlist) throw new MoleculerError("Playlist not found.", 404);
			if (playlist.aliasOf) {
				return this.resolveSourcePlaylist(ctx, playlist.aliasOf);
			}
			return playlist;
		},

		async addTrackToPlaylist(ctx, playlistId, trackId) {
			// Aliases don't own tracks — resolve to source.
			const source = await this.resolveSourcePlaylist(ctx, playlistId);
			playlistId = source.id;
			const playlist = await this.findEntity(ctx, { query: { _id: playlistId } });
			if (!playlist) throw new MoleculerError("Playlist not found.", 404);
			if (playlist.trackIds.includes(trackId)) return playlist;
			return this.updateEntity(ctx, {
				id: playlistId,
				trackIds: [...playlist.trackIds, trackId],
				updatedAt: this.now()
			});
		},

		/** Append multiple ids, deduping against existing membership. */
		async addTracksToPlaylist(ctx, playlistId, trackIds) {
			const playlist = await this.findEntity(ctx, { query: { _id: playlistId } });
			if (!playlist) throw new MoleculerError("Playlist not found.", 404);
			const existing = new Set(playlist.trackIds);
			const next = [...playlist.trackIds];
			for (const id of trackIds) {
				if (!existing.has(id)) {
					next.push(id);
					existing.add(id);
				}
			}
			return this.updateEntity(ctx, {
				id: playlistId,
				trackIds: next,
				updatedAt: this.now()
			});
		},

		/** Insert ids at a position (deduped; -1 = append). */
		async insertTracksIntoPlaylist(ctx, playlistId, trackIds, position) {
			const playlist = await this.findEntity(ctx, { query: { _id: playlistId } });
			if (!playlist) throw new MoleculerError("Playlist not found.", 404);
			// Dedupe: drop ids already present, then insert the rest at position.
			const existing = new Set(playlist.trackIds);
			const fresh = trackIds.filter(id => !existing.has(id));
			const next = [...playlist.trackIds];
			const at = position < 0 || position > next.length ? next.length : position;
			next.splice(at, 0, ...fresh);
			return this.updateEntity(ctx, {
				id: playlistId,
				trackIds: next,
				updatedAt: this.now()
			});
		},

		async removeTrackFromPlaylist(ctx, playlistId, trackId) {
			// Aliases don't own tracks — resolve to source.
			const source = await this.resolveSourcePlaylist(ctx, playlistId);
			playlistId = source.id;
			const playlist = await this.findEntity(ctx, { query: { _id: playlistId } });
			if (!playlist) throw new MoleculerError("Playlist not found.", 404);
			return this.updateEntity(ctx, {
				id: playlistId,
				trackIds: playlist.trackIds.filter(id => id !== trackId),
				updatedAt: this.now()
			});
		},

		/** Highest current position + 1, so new playlists sort last. */
		async nextPosition(ctx) {
			const docs = await this.findEntities(ctx, {});
			return docs.reduce((max, d) => Math.max(max, d.position ?? 0), -1) + 1;
		},

		/** Rewrite positions for the given ordered id list (0,1,2,…). */
		async applyOrder(ctx, orderedIds) {
			const now = this.now();
			for (let i = 0; i < orderedIds.length; i++) {
				await this.updateEntity(ctx, { id: orderedIds[i], position: i, updatedAt: now });
			}
			return { reordered: orderedIds.length };
		},

		now() {
			return new Date().toISOString();
		}
	}
};

function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
