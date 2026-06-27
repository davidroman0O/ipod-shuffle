"use strict";

const { MoleculerError } = require("moleculer").Errors;

/**
 * ipodSync
 * ---------
 * Async sync orchestration: resolves a device's playlists into a track union,
 * kicks the engine's streaming sync in a BACKGROUND TASK, and tracks progress
 * in an in-memory store that the UI polls. Owns no data.
 *
 * Why async: copying 75+ files over USB takes minutes. The synchronous call
 * chain (browser → node → engine) would time out at every layer. Instead, run()
 * starts the task and returns immediately; the UI polls status().
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

const ENGINE_URL = process.env.IPOD_ENGINE_URL || "http://127.0.0.1:8765";

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodSync",

	settings: {},

	actions: {
		resolve: {
			params: { deviceId: { type: "string", required: true } },
			async handler(ctx) {
				return this.resolveDevice(ctx, ctx.params.deviceId);
			}
		},

		plan: {
			params: { deviceId: { type: "string", required: true } },
			async handler(ctx) {
				const { device, tracks, playlists } = await this.resolveDevice(
					ctx,
					ctx.params.deviceId
				);
				return ctx.call("ipodEngine.syncPlan", {
					mountPath: device.lastKnownMountPath,
					tracks,
					playlists
				});
			}
		},

		/**
		 * Start an async sync. Returns immediately with {status:"running"}.
		 * The background task streams progress from the engine and updates the
		 * progress store. Poll status() for live progress.
		 */
		run: {
			params: { deviceId: { type: "string", required: true } },
			async handler(ctx) {
				const { device, tracks, playlists } = await this.resolveDevice(
					ctx,
					ctx.params.deviceId
				);
				if (!device.lastKnownMountPath) {
					throw new MoleculerError(
						`Device "${device.name}" is not currently mounted.`,
						409
					);
				}
				if (this.jobs.has(device.id) && this.jobs.get(device.id).status === "running") {
					throw new MoleculerError(`A sync is already running on "${device.name}".`, 409);
				}

				// Initialize the progress store entry.
				const job = {
					deviceId: device.id,
					status: "running",
					phase: "init",
					current: 0,
					total: tracks.length,
					totalCopies: 0,
					currentPath: "",
					error: null,
					result: null,
					startedAt: new Date().toISOString(),
					finishedAt: null
				};
				this.jobs.set(device.id, job);

				// Detach the background task — the handler returns immediately.
				this.runSyncTask(ctx, device, tracks, playlists).catch(err => {
					this.logger.error(`sync task crashed: ${err.message}`);
					job.status = "failed";
					job.error = err.message;
					job.finishedAt = new Date().toISOString();
				});

				await ctx.emit("ipod.sync.started", {
					deviceId: device.id,
					trackCount: tracks.length
				});
				return { deviceId: device.id, status: "running" };
			}
		},

		/** Poll the current sync status for a device. */
		status: {
			params: { deviceId: { type: "string", required: true } },
			async handler(ctx) {
				return (
					this.jobs.get(ctx.params.deviceId) ?? {
						deviceId: ctx.params.deviceId,
						status: "idle"
					}
				);
			}
		},

		/** Cancel a running sync (aborts the engine fetch; next sync heals). */
		cancel: {
			params: { deviceId: { type: "string", required: true } },
			async handler(ctx) {
				const controller = this.controllers.get(ctx.params.deviceId);
				if (controller) {
					controller.abort();
				}
				return { cancelled: !!controller };
			}
		}
	},

	methods: {
		/**
		 * Background task: calls the engine's streaming /v1/sync endpoint,
		 * reads NDJSON lines as they arrive, updates the progress store.
		 */
		async runSyncTask(ctx, device, tracks, playlists) {
			const job = this.jobs.get(device.id);
			const controller = new AbortController();
			this.controllers.set(device.id, controller);

			try {
				const res = await fetch(`${ENGINE_URL}/v1/sync`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mountPath: device.lastKnownMountPath,
						tracks,
						playlists
					}),
					signal: controller.signal
				});

				if (!res.ok) {
					const text = await res.text();
					throw new Error(`engine responded ${res.status}: ${text}`);
				}

				// Read the NDJSON stream line by line.
				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop(); // keep the partial last line
					for (const line of lines) {
						if (line.trim()) this.handleEngineEvent(ctx, device, job, JSON.parse(line));
					}
				}
				if (buffer.trim()) {
					this.handleEngineEvent(ctx, device, job, JSON.parse(buffer));
				}
			} catch (err) {
				if (err.name === "AbortError") {
					job.status = "cancelled";
				} else {
					job.status = "failed";
					job.error = err.message;
				}
				job.finishedAt = new Date().toISOString();
				await ctx.emit("ipod.sync.failed", {
					deviceId: device.id,
					error: job.error || "cancelled"
				});
			} finally {
				this.controllers.delete(device.id);
			}
		},

		/** Process one NDJSON event from the engine stream. */
		async handleEngineEvent(ctx, device, job, ev) {
			if (ev.type === "start") {
				job.totalCopies = ev.totalCopies || job.total;
			} else if (ev.type === "progress") {
				job.phase = ev.phase;
				job.current = ev.current ?? job.current;
				job.total = ev.total || job.total;
				job.currentPath = ev.path || "";
			} else if (ev.type === "done") {
				job.status = "completed";
				job.result = {
					writtenDatabaseBytes: ev.writtenDatabaseBytes,
					writtenStatsBytes: ev.writtenStatsBytes,
					manifest: ev.manifest || []
				};
				job.finishedAt = new Date().toISOString();
				// Persist the manifest.
				await ctx.call("ipodDevicesDb.recordSync", {
					deviceId: device.id,
					manifest: ev.manifest || [],
					syncedAt: ev.syncedAt
				});
				await ctx.emit("ipod.sync.completed", {
					deviceId: device.id,
					trackCount: (ev.manifest || []).length
				});
			} else if (ev.type === "error") {
				job.status = "failed";
				job.error = ev.error;
				job.finishedAt = new Date().toISOString();
				await ctx.emit("ipod.sync.failed", { deviceId: device.id, error: ev.error });
			}
		},

		async resolveDevice(ctx, deviceId) {
			const device = await ctx.call("ipodDevicesDb.get", { id: deviceId });
			if (!device) throw new MoleculerError(`Unknown device "${deviceId}".`, 404);

			// Gather all assigned playlist ids: individual picks + group expansions.
			const individualIds = device.playlistIds || [];
			const groupIds = device.groupIds || [];
			let allPlaylistIds = [...individualIds];

			// Expand groups into their member playlists.
			for (const groupId of groupIds) {
				const groupPlaylists = await ctx.call("ipodPlaylistsDb.listByGroup", { groupId });
				for (const gp of groupPlaylists) {
					if (!allPlaylistIds.includes(gp.id)) allPlaylistIds.push(gp.id);
				}
			}

			// Resolve aliases: each playlist may be an alias — resolve to source.
			const resolvedPlaylists = [];
			const seenIds = new Set();
			for (const pid of allPlaylistIds) {
				const source = await ctx.call("ipodPlaylistsDb.resolveSource", { id: pid });
				if (!seenIds.has(source.id)) {
					seenIds.add(source.id);
					resolvedPlaylists.push({ id: source.id, name: source.name, trackIds: source.trackIds || [] });
				}
			}

			// Build the deduped track union.
			const seen = new Set();
			const trackIds = [];
			for (const playlist of resolvedPlaylists) {
				for (const trackId of playlist.trackIds) {
					if (!seen.has(trackId)) {
						seen.add(trackId);
						trackIds.push(trackId);
					}
				}
			}

			const tracks = trackIds.length
				? await ctx.call("ipodTracksDb.resolveByIds", { ids: trackIds })
				: [];
			const trackExists = new Set(tracks.filter(t => t.exists).map(t => t.id));

			const engineTracks = tracks
				.filter(t => t.exists)
				.map(t => ({
					trackId: t.id,
					sourcePath: t.sourcePath,
					fileName: t.fileName,
					sizeBytes: t.sizeBytes
				}));

			const enginePlaylists = resolvedPlaylists.map(playlist => ({
				playlistId: playlist.id,
				name: playlist.name,
				trackIds: playlist.trackIds.filter(id => trackExists.has(id))
			}));

			return { device, tracks: engineTracks, playlists: enginePlaylists };
		}
	},

	/** In-memory job store + AbortControllers (ephemeral, per-process). */
	created() {
		this.jobs = new Map();
		this.controllers = new Map();
	}
};
