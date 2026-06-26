"use strict";

const path = require("node:path");

const { isSupportedAudioPath } = require("./audio");

/**
 * Filesystem scanning helpers for the library layer. All I/O goes through an
 * injected `fs` interface (node:fs/promises shape) so the logic is unit-testable
 * against an in-memory fake filesystem.
 */

/**
 * Walk `dir` recursively and return absolute paths of supported audio files.
 * Dotfiles and their contents are skipped, mirroring the TS reference.
 *
 * @param {string} dir
 * @param {{readdir: function, stat?: function}} fs
 * @returns {Promise<string[]>}
 */
async function collectAudioFiles(dir, fs) {
	const out = [];

	async function walk(current) {
		const entries = await fs.readdir(current, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name.startsWith(".")) continue;
			const entryPath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(entryPath);
				continue;
			}
			if (entry.isFile() && isSupportedAudioPath(entryPath)) {
				out.push(entryPath);
			}
		}
	}

	try {
		await walk(dir);
	} catch (err) {
		// Missing roots are non-fatal — they simply contribute no tracks.
		if (!isNotFound(err)) throw err;
		return [];
	}
	return out;
}

/**
 * Resolve the canonical audio metadata for a path via fs.stat.
 * @returns {Promise<{size:number, mtimeMs:number, isFile:boolean}>}
 */
async function statAudio(pathStr, fs) {
	const stats = await fs.stat(pathStr);
	return { size: stats.size, mtimeMs: stats.mtimeMs, isFile: stats.isFile() };
}

function isNotFound(err) {
	return Boolean(err && typeof err === "object" && "code" in err && err.code === "ENOENT");
}

module.exports = { collectAudioFiles, statAudio, isNotFound };
