"use strict";

const { resolveSelectedPlaylist, tracksForPlaylist } = require("../lib/view-models");

/**
 * ipodPlaylists
 * -------------
 * Public playlist workflow service. It owns no durable state; `ipodPlaylistsDb`
 * owns persistence. UI/API callers use this service so playlist changes can emit
 * mesh events and cross-service workflows stay out of gateways.
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodPlaylists",

	actions: {
		list: {
			async handler(ctx) {
				return ctx.call("ipodPlaylistsDb.listOrdered");
			}
		},

		get: {
			params: { id: { type: "string", required: true } },
			async handler(ctx) {
				return ctx.call("ipodPlaylistsDb.get", { id: ctx.params.id });
			}
		},

		create: {
			params: { name: { type: "string", required: true } },
			async handler(ctx) {
				const playlist = await ctx.call("ipodPlaylistsDb.createNamed", {
					name: ctx.params.name
				});
				await ctx.emit("ipod.playlists.created", { playlistId: playlist.id });
				return playlist;
			}
		},

		rename: {
			params: {
				id: { type: "string", required: true },
				name: { type: "string", required: true }
			},
			async handler(ctx) {
				const playlist = await ctx.call("ipodPlaylistsDb.rename", ctx.params);
				await ctx.emit("ipod.playlists.renamed", { playlistId: playlist.id });
				return playlist;
			}
		},

		remove: {
			params: { id: { type: "string", required: true } },
			async handler(ctx) {
				await ctx.call("ipodDevices.unassignPlaylistEverywhere", {
					playlistId: ctx.params.id
				});
				const removed = await ctx.call("ipodPlaylistsDb.remove", { id: ctx.params.id });
				await ctx.emit("ipod.playlists.removed", { playlistId: ctx.params.id });
				return removed;
			}
		},

		resolveByIds: {
			params: { ids: { type: "array", items: "string" } },
			async handler(ctx) {
				return ctx.call("ipodPlaylistsDb.resolveByIds", { ids: ctx.params.ids });
			}
		},

		setOrder: {
			params: { orderedIds: { type: "array", items: "string" } },
			async handler(ctx) {
				const result = await ctx.call("ipodPlaylistsDb.setOrder", ctx.params);
				await ctx.emit("ipod.playlists.reordered", { orderedIds: ctx.params.orderedIds });
				return result;
			}
		},

		setTrackOrder: {
			params: {
				id: { type: "string", required: true },
				trackIds: { type: "array", items: "string" }
			},
			async handler(ctx) {
				const playlist = await ctx.call("ipodPlaylistsDb.setTrackOrder", ctx.params);
				await ctx.emit("ipod.playlists.tracks.reordered", { playlistId: playlist.id });
				return playlist;
			}
		},

		addTrack: {
			params: {
				id: { type: "string", required: true },
				trackId: { type: "string", required: true }
			},
			async handler(ctx) {
				const playlist = await ctx.call("ipodPlaylistsDb.addTrack", ctx.params);
				await ctx.emit("ipod.playlists.tracks.changed", { playlistId: playlist.id });
				return playlist;
			}
		},

		addTracks: {
			params: {
				id: { type: "string", required: true },
				trackIds: { type: "array", items: "string" }
			},
			async handler(ctx) {
				const playlist = await ctx.call("ipodPlaylistsDb.addTracks", ctx.params);
				await ctx.emit("ipod.playlists.tracks.changed", { playlistId: playlist.id });
				return playlist;
			}
		},

		insertTracks: {
			params: {
				id: { type: "string", required: true },
				trackIds: { type: "array", items: "string" },
				position: { type: "number", default: -1 }
			},
			async handler(ctx) {
				const playlist = await ctx.call("ipodPlaylistsDb.insertTracks", ctx.params);
				await ctx.emit("ipod.playlists.tracks.changed", { playlistId: playlist.id });
				return playlist;
			}
		},

		removeTrack: {
			params: {
				id: { type: "string", required: true },
				trackId: { type: "string", required: true }
			},
			async handler(ctx) {
				const playlist = await ctx.call("ipodPlaylistsDb.removeTrack", ctx.params);
				await ctx.emit("ipod.playlists.tracks.changed", { playlistId: playlist.id });
				return playlist;
			}
		},

		workbench: {
			params: { selectedId: { type: "string", optional: true } },
			async handler(ctx) {
				const [playlists, tracks, roots] = await Promise.all([
					ctx.call("ipodPlaylists.list"),
					ctx.call("ipodLibrary.listTracks").catch(() => []),
					ctx.call("ipodLibrary.listRoots").catch(() => [])
				]);
				const selected = resolveSelectedPlaylist(playlists, ctx.params.selectedId);
				return {
					playlists,
					tracks,
					roots,
					selected,
					selectedId: selected ? selected.id : null,
					selectedTracks: tracksForPlaylist(selected, tracks)
				};
			}
		}
	}
};
