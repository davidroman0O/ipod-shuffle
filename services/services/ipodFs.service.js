"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");

const { MoleculerError } = require("moleculer").Errors;

const { collectAudioFiles } = require("../lib/fs-scan");

/**
 * ipodFs
 * ------
 * A thin, stateless filesystem-browsing service so the web UI can pick real
 * on-disk folders (library roots, device mounts) via a tree picker — browsers
 * can't expose absolute paths to web apps, but this node runs on the host and
 * can. Owns NO data; it only reads directory listings.
 *
 * Browsing is constrained to a configurable allow-root to avoid exposing the
 * whole filesystem. Set IPOD_FS_ROOT to widen/narrow (default "/").
 *
 * @typedef {import('moleculer').Context} Context
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema
 */

const ALLOW_ROOT = process.env.IPOD_FS_ROOT || "/";

/** @type {ServiceSchema} */
module.exports = {
	name: "ipodFs",

	settings: {
		allowRoot: ALLOW_ROOT
	},

	actions: {
		/**
		 * List immediate children of a directory. Returns { path, entries: [{name,
		 * isDir}] }. Dotfiles are hidden. Paths outside the allow-root are rejected.
		 */
		list: {
			params: { dir: { type: "string", default: "" } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const dir = ctx.params.dir || this.settings.allowRoot;
				const abs = path.resolve(dir);
				this.assertWithinRoot(abs);
				let entries;
				try {
					entries = await fs.readdir(abs, { withFileTypes: true });
				} catch (err) {
					if (err.code === "ENOENT") throw new MoleculerError(`Not found: ${abs}`, 404);
					if (err.code === "EACCES") throw new MoleculerError(`No access: ${abs}`, 403);
					throw err;
				}
				const out = entries
					.filter((e) => !e.name.startsWith("."))
					.map((e) => ({ name: e.name, isDir: e.isDirectory() }))
					.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
				return { path: abs, entries: out };
			}
		},

		/**
		 * Recursively expand a directory into the absolute paths of every audio
		 * file beneath it (dotfiles skipped). Used when a folder is dropped onto
		 * a playlist: the whole folder's audio is added in one batch.
		 */
		expand: {
			params: { dir: { type: "string", required: true } },
			/** @param {Context} ctx */
			async handler(ctx) {
				const abs = path.resolve(ctx.params.dir);
				this.assertWithinRoot(abs);
				const files = await collectAudioFiles(abs, fs);
				return { dir: abs, paths: files };
			}
		}
	},

	methods: {
		/** Reject any resolved path that escapes the configured allow-root.
		 * `path.resolve` already neutralises `..`, so here we only enforce the
		 * prefix. A root of `/` permits everything. */
		assertWithinRoot(abs) {
			const root = path.resolve(this.settings.allowRoot).replace(/\/+$/, "") || "/";
			if (root === "/") return;
			if (abs === root || abs.startsWith(root + path.sep)) return;
			throw new MoleculerError("Path is outside the allowed root.", 403);
		}
	}
};
