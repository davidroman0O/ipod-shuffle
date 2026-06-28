"use strict";

const ApiGateway = require("moleculer-web");
const crypto = require("node:crypto");

/**
 * API gateway over the ipod services.
 *
 * Applies HTTP API Guide best practices:
 * - mappingPolicy: "restrict" (only aliases work, no /service/action passthrough)
 * - Structured error responses (RFC 9457 Problem Details shape)
 * - X-Request-Id on every response for tracing
 * - Proper CORS with Vary header
 * - Thin aliases: one-line delegates, zero business logic
 *
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "api",
	mixins: [ApiGateway],

	settings: {
		port: process.env.PORT || 3280,
		ip: "0.0.0.0",
		use: [],

		// Global error handler — formats all errors as RFC 9457 Problem Details.
		onError(req, res, err) {
			// Generate or reuse request ID for correlation.
			const requestId = (res.getHeader("X-Request-Id") || crypto.randomUUID()).toString();
			res.setHeader("X-Request-Id", requestId);

			const status = err.code || 500;
			const type = err.type || err.name || "INTERNAL_ERROR";

			// RFC 9457 Problem Details shape.
			const body = {
				type: `https://errors.ipod-shuffle.dev/${type.toLowerCase()}`,
				title: err.name || "Error",
				status,
				detail: err.message || "An unexpected error occurred.",
				instance: req.url,
				requestId
			};

			// Include validation details if available.
			if (err.data) {
				body.errors = Array.isArray(err.data) ? err.data : [err.data];
			}

			res.setHeader("Content-Type", "application/problem+json");
			res.writeHead(status);
			res.end(JSON.stringify(body));
		},

		routes: [
			{
				path: "/api",

				// Only explicitly aliased routes work — no /service/action passthrough.
				// This prevents accidental exposure of internal actions like $node.*.
				mappingPolicy: "restrict",

				whitelist: ["ipod**"],
				mergeParams: true,
				authentication: false,
				authorization: false,
				autoAliases: false,

				// CORS: explicit origins only (no wildcard in production).
				cors: {
					origins: process.env.CORS_ORIGINS
						? process.env.CORS_ORIGINS.split(",")
						: ["http://localhost:5173", "http://localhost:4173"],
					methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
					credentials: true,
					exposedHeaders: ["X-Request-Id"]
				},

				aliases: {
					// Devices — discovery, assignment, state, sync control.
					"GET /devices": "ipodDevices.refresh",
					"POST /devices/register": "ipodDevices.register",
					"POST /devices/:deviceId/playlists/:playlistId": "ipodDevices.assignPlaylist",
					"POST /devices/:deviceId/groups/:groupId": "ipodDevicesDb.toggleGroupAssignment",
					"POST /devices/:deviceId/order": "ipodDevicesDb.setPlaylistOrder",
					"POST /devices/:deviceId/name": "ipodDevices.name",
					"GET /devices/:deviceId/online": "ipodDevices.isOnline",
					"GET /devices/:deviceId/state": "ipodDevices.state",
					"DELETE /devices/:deviceId": "ipodDevices.remove",
					"POST /devices/:deviceId/wipe": "ipodDevices.wipe",

					// Library — roots, tracks, scanning.
					"GET /library/roots": "ipodLibrary.listRoots",
					"POST /library/roots": "ipodLibrary.addRoot",
					"DELETE /library/roots": "ipodLibrary.removeRoot",
					"POST /library/rescan": "ipodLibrary.rescan",
					"POST /library/revalidate": "ipodLibrary.revalidate",
					"POST /library/tracks": "ipodLibrary.addTrack",
					"POST /library/tracks/batch": "ipodLibrary.addTracks",
					"GET /tracks": "ipodLibrary.listTracks",

					// Filesystem browsing (server-side directory picker).
					"GET /fs/list": "ipodFs.list",
					"POST /fs/expand": "ipodFs.expand",

					// Playlists — CRUD, ordering, clone, alias.
					"GET /playlists": "ipodPlaylists.list",
					"POST /playlists": "ipodPlaylists.create",
					"GET /playlists/:id": "ipodPlaylists.get",
					"PATCH /playlists/:id": "ipodPlaylists.rename",
					"DELETE /playlists/:id": "ipodPlaylists.remove",
					"POST /playlists/order": "ipodPlaylists.setOrder",
					"POST /playlists/:id/order": "ipodPlaylists.setTrackOrder",
					"POST /playlists/:id/tracks": "ipodPlaylists.addTracks",
					"POST /playlists/:id/insert": "ipodPlaylists.insertTracks",
					"POST /playlists/:id/tracks/:trackId": "ipodPlaylists.addTrack",
					"DELETE /playlists/:id/tracks/:trackId": "ipodPlaylists.removeTrack",
					"POST /playlists/:id/clone": "ipodPlaylistsDb.clone",
					"POST /playlists/:id/alias": "ipodPlaylistsDb.alias",
					"PATCH /playlists/:id/group": "ipodPlaylistsDb.moveToGroup",

					// Playlist groups.
					"GET /groups": "ipodPlaylistGroupsDb.listOrdered",
					"POST /groups": "ipodPlaylistGroupsDb.createNamed",
					"PATCH /groups/:id": "ipodPlaylistGroupsDb.rename",
					"DELETE /groups/:id": "ipodPlaylistGroupsDb.removeGroup",
					"POST /groups/order": "ipodPlaylistGroupsDb.setOrder",

					// Sync — async streaming with polling status.
					"GET /sync/:deviceId/resolve": "ipodSync.resolve",
					"GET /sync/:deviceId/plan": "ipodSync.plan",
					"POST /sync/:deviceId": "ipodSync.run",
					"GET /sync/:deviceId/status": "ipodSync.status",
					"POST /sync/:deviceId/cancel": "ipodSync.cancel",

					// Engine health.
					"GET /engine/health": "ipodEngine.health"
				},

				bodyParsers: {
					json: { strict: false, limit: "1MB" },
					urlencoded: { extended: true, limit: "1MB" }
				},

				// Called before each request — inject request ID.
				onBeforeCall(ctx, route, req, res) {
					const requestId = req.headers["x-request-id"] || crypto.randomUUID();
					ctx.meta.requestId = requestId;
					res.setHeader("X-Request-Id", requestId);
					res.setHeader("Vary", "Origin");
				},

				logging: true
			}
		],

		log4XXResponses: false,
		logRequestParams: null,
		logResponseData: null,

		assets: { folder: "public", options: {} }
	}
};
