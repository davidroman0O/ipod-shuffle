"use strict";

const path = require("node:path");

const { isSupportedAudioPath, normalizeAudioExtension } = require("../lib/audio");
const { collectAudioFiles, statAudio } = require("../lib/fs-scan");

/**
 * ipodLibrary
 * ------------
 * Business service for the music library: scanning filesystem roots, upserting
 * tracks, and revalidating existence. Holds NO data of its own — it persists
 * through the `ipodTracksDb` and `ipodLibraryRootsDb` data-owner services.
 *
 * All filesystem I/O flows through an injectable `fs` seam (defaults to
 * node:fs/promises) so the service is unit-testable without a real disk.
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodLibrary",

	settings: {},

	actions: {
		/** Register a library root and immediately scan it for audio. */
		addRoot: {
			params: { rootPath: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const fs = this.fs;
				const stats = await fs.stat(ctx.params.rootPath);
				if (!stats.isDirectory()) {
					throw new MoleculerError(`Expected a directory: ${ctx.params.rootPath}`, 422);
				}
				await ctx.call("ipodLibraryRootsDb.add", { path: ctx.params.rootPath });
				return this.scanRoot(ctx, ctx.params.rootPath);
			}
		},

		/** List registered library roots (full documents: {id, path, addedAt}). */
		listRoots: {
			async handler(ctx) {
				return ctx.call("ipodLibraryRootsDb.listAll");
			}
		},

		/** List tracked library files, sorted for UI consumption. */
		listTracks: {
			async handler(ctx) {
				const tracks = await ctx.call("ipodTracksDb.listAll");
				return tracks.sort((a, b) => {
					const left = a.fileName || a.sourcePath || "";
					const right = b.fileName || b.sourcePath || "";
					return left.localeCompare(right);
				});
			}
		},

		/** Remove a library root by path. Does NOT delete imported tracks. */
		removeRoot: {
			params: { path: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const removed = await ctx.call("ipodLibraryRootsDb.removeByPath", {
					path: ctx.params.path
				});
				return { removed };
			}
		},

		/** Re-scan all registered roots for new/changed audio. */
		rescan: {
			async handler(ctx) {
				const roots = await ctx.call("ipodLibraryRootsDb.listPaths");
				const results = [];
				for (const root of roots) {
					results.push({ root, ...(await this.scanRoot(ctx, root)) });
				}
				return results;
			}
		},

		/** Re-stat every tracked file, marking missing ones via ipodTracksDb. */
		revalidate: {
			async handler(ctx) {
				const fs = this.fs;
				const tracks = await ctx.call("ipodTracksDb.listAll");
				let changed = 0;
				for (const track of tracks) {
					try {
						const stats = await statAudio(track.sourcePath, fs);
						if (
							!stats.isFile ||
							stats.size !== track.sizeBytes ||
							stats.mtimeMs !== track.modifiedAtMs ||
							!track.exists
						) {
							await ctx.call("ipodTracksDb.refresh", {
								id: track.id,
								sizeBytes: stats.size,
								modifiedAtMs: stats.mtimeMs
							});
							changed++;
						}
					} catch {
						if (track.exists) {
							await ctx.call("ipodTracksDb.markMissing", { id: track.id });
							changed++;
						}
					}
				}
				return { checked: tracks.length, changed };
			}
		},

		/** Upsert a single track from a source path (stats the file). */
		addTrack: {
			params: { sourcePath: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const fs = this.fs;
				if (!isSupportedAudioPath(ctx.params.sourcePath)) {
					throw new MoleculerError(
						`Unsupported audio file: ${ctx.params.sourcePath}`,
						422
					);
				}
				const stats = await statAudio(ctx.params.sourcePath, fs);
				if (!stats.isFile)
					throw new MoleculerError(`Not a file: ${ctx.params.sourcePath}`, 422);
				return ctx.call("ipodTracksDb.upsertRecord", {
					sourcePath: ctx.params.sourcePath,
					fileName: path.basename(ctx.params.sourcePath),
					extension: normalizeAudioExtension(ctx.params.sourcePath),
					sizeBytes: stats.size,
					modifiedAtMs: stats.mtimeMs
				});
			}
		},

		/**
		 * Batch upsert: register many tracks by absolute path in one call (stats
		 * each, skips unsupported/non-files). Returns the created/refreshed tracks.
		 */
		addTracks: {
			params: { sourcePaths: { type: "array", items: "string" } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const fs = this.fs;
				const tracks = [];
				for (const sourcePath of ctx.params.sourcePaths) {
					if (!isSupportedAudioPath(sourcePath)) continue;
					try {
						const stats = await statAudio(sourcePath, fs);
						if (!stats.isFile) continue;
						const result = await ctx.call("ipodTracksDb.upsertRecord", {
							sourcePath,
							fileName: path.basename(sourcePath),
							extension: normalizeAudioExtension(sourcePath),
							sizeBytes: stats.size,
							modifiedAtMs: stats.mtimeMs
						});
						tracks.push(result.track);
					} catch {
						// Missing file in a batch drop is non-fatal; skip it.
					}
				}
				return { tracks };
			}
		}
	},

	methods: {
		/** Walk a root, upserting every audio file via ipodTracksDb. */
		async scanRoot(ctx, rootPath) {
			const fs = this.fs;
			const files = await collectAudioFiles(rootPath, fs);
			let created = 0;
			for (const file of files) {
				const stats = await statAudio(file, fs);
				const result = await ctx.call("ipodTracksDb.upsertRecord", {
					sourcePath: file,
					fileName: path.basename(file),
					extension: normalizeAudioExtension(file),
					sizeBytes: stats.size,
					modifiedAtMs: stats.mtimeMs
				});
				if (result.created) created++;
			}
			return { scanned: files.length, created };
		}
	},

	/** Inject the fs seam; tests override `service.fs`. */
	created() {
		this.fs = require("node:fs/promises");
	}
};

const { MoleculerError } = require("moleculer").Errors;
