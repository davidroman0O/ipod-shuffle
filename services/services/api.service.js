"use strict";

const ApiGateway = require("moleculer-web");

/**
 * Local-dev REST gateway over the ipod services.
 *
 * Single JSON route; each alias is a one-line delegate to a mesh action. No
 * business logic here. In the federated mesh the central gateway (another repo)
 * is the production HTTP entry point and calls the same ipod* actions.
 *
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "api",
	mixins: [ApiGateway],

	settings: {
		// Exposed port — unique (3280) to avoid colliding with common dev tools.
		port: process.env.PORT || 3280,
		ip: "0.0.0.0",
		use: [],
		routes: [
			{
				path: "/api",
				whitelist: ["ipod**"],
				mergeParams: true,
				authentication: false,
				authorization: false,
				autoAliases: true,
				aliases: {
					// Devices — discovery & assignment.
					"GET /devices": "ipodDevices.refresh",
					"POST /devices/register": "ipodDevices.register",
					"POST /devices/:deviceId/playlists/:playlistId": "ipodDevices.assignPlaylist",
					"POST /devices/:deviceId/order": "ipodDevicesDb.setPlaylistOrder",
					"GET /devices/:deviceId/online": "ipodDevices.isOnline",
					"DELETE /devices/:deviceId": "ipodDevices.remove",

					// Library — roots & tracks.
					"GET /library/roots": "ipodLibrary.listRoots",
					"POST /library/roots": "ipodLibrary.addRoot",
					"DELETE /library/roots": "ipodLibrary.removeRoot",
					"POST /library/rescan": "ipodLibrary.rescan",
					"POST /library/revalidate": "ipodLibrary.revalidate",
					"POST /library/tracks": "ipodLibrary.addTrack",
					"POST /library/tracks/batch": "ipodLibrary.addTracks",
					"GET /tracks": "ipodTracksDb.find",

					// Filesystem browsing (server-side directory picker for the UI).
					"GET /fs/list": "ipodFs.list",
					"POST /fs/expand": "ipodFs.expand",

					// Playlists.
					"GET /playlists": "ipodPlaylistsDb.listOrdered",
					"POST /playlists": "ipodPlaylistsDb.createNamed",
					"GET /playlists/:id": "ipodPlaylistsDb.get",
					"PATCH /playlists/:id": "ipodPlaylistsDb.rename",
					"DELETE /playlists/:id": "ipodPlaylistsDb.removeWithAssignments",
					"POST /playlists/order": "ipodPlaylistsDb.setOrder",
					"POST /playlists/:id/order": "ipodPlaylistsDb.setTrackOrder",
					"POST /playlists/:id/tracks": "ipodPlaylistsDb.addTracks",
					"POST /playlists/:id/insert": "ipodPlaylistsDb.insertTracks",
					"POST /playlists/:id/tracks/:trackId": "ipodPlaylistsDb.addTrack",
					"DELETE /playlists/:id/tracks/:trackId": "ipodPlaylistsDb.removeTrack",

					// Sync.
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
				mappingPolicy: "all",
				logging: true
			}
		],
		log4XXResponses: false,
		logRequestParams: null,
		logResponseData: null,
		assets: { folder: "public", options: {} }
	}
};
