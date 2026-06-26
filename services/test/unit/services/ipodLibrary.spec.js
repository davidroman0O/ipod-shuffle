"use strict";

const { ServiceBroker } = require("moleculer");
const { MoleculerError } = require("moleculer").Errors;

const LibraryService = require("../../../services/ipodLibrary.service");
const TracksDbService = require("../../../services/ipodTracksDb.db.service");
const RootsDbService = require("../../../services/ipodLibraryRootsDb.db.service");

// Flat-path in-memory filesystem. Files are path→content; directories are
// derived from the paths. This avoids nested-object path-resolution bugs.
function fakeFs(files) {
	// files: { "/music/a.mp3": "AAAA", "/music/sub/b.m4a": "BBBB" }
	const dirs = new Set();
	for (const p of Object.keys(files)) {
		const parts = p.split("/").filter(Boolean);
		for (let i = 1; i <= parts.length; i++) {
			dirs.add("/" + parts.slice(0, i).join("/"));
		}
	}
	return {
		async readdir(dir, opts) {
			const norm = dir.replace(/\/+$/, "") || "/";
			if (!dirs.has(norm)) throw notFound(norm);
			const prefix = norm === "/" ? "/" : norm + "/";
			const seen = new Set();
			const entries = [];
			for (const p of Object.keys(files)) {
				if (!p.startsWith(prefix)) continue;
				const rest = p.slice(prefix.length);
				const slash = rest.indexOf("/");
				if (slash === -1) {
					if (!seen.has(rest)) { seen.add(rest); entries.push({ name: rest, isFile: true }); }
				} else {
					const child = rest.slice(0, slash);
					if (!seen.has(child)) { seen.add(child); entries.push({ name: child, isFile: false }); }
				}
			}
			if (opts && opts.withFileTypes) {
				return entries.map((e) => ({
					name: e.name,
					isDirectory: () => !e.isFile,
					isFile: () => e.isFile
				}));
			}
			return entries.map((e) => e.name);
		},
		async stat(p) {
			const norm = p.replace(/\/+$/, "") || "/";
			if (files[norm] !== undefined) {
				return { isDirectory: () => false, isFile: () => true, size: files[norm].length, mtimeMs: 1000 };
			}
			if (dirs.has(norm)) {
				return { isDirectory: () => true, isFile: () => false, size: 0, mtimeMs: 1000 };
			}
			throw notFound(norm);
		}
	};
}

function notFound(p) {
	const err = new Error(`ENOENT: ${p}`);
	err.code = "ENOENT";
	return err;
}

describe("Test 'ipodLibrary' business service", () => {
	let broker;
	let svc;

	beforeEach(async () => {
		broker = new ServiceBroker({ logger: false });
		broker.createService(TracksDbService);
		broker.createService(RootsDbService);
		svc = broker.createService(LibraryService);
		svc.fs = fakeFs({
			"/music/a.mp3": "AAAA",
			"/music/b.m4a": "BBBB",
			"/music/readme.txt": "skip me",
			"/music/sub/c.wav": "CCCCCCCC"
		});
		await broker.start();
	});
	afterEach(() => broker.stop());

	it("should scan a root and upsert supported audio only", async () => {
		const result = await broker.call("ipodLibrary.addRoot", { rootPath: "/music" });
		expect(result.scanned).toBe(3);
		expect(result.created).toBe(3);

		const tracks = await broker.call("ipodTracksDb.find", { sort: "sourcePath" });
		expect(tracks.map((t) => t.sourcePath)).toEqual([
			"/music/a.mp3",
			"/music/b.m4a",
			"/music/sub/c.wav"
		]);
	});

	it("should reject an unsupported audio path", async () => {
		await expect(broker.call("ipodLibrary.addTrack", { sourcePath: "/music/readme.txt" })).rejects.toBeInstanceOf(MoleculerError);
	});

	it("should reject a non-directory root", async () => {
		await expect(broker.call("ipodLibrary.addRoot", { rootPath: "/music/a.mp3" })).rejects.toBeInstanceOf(MoleculerError);
	});

	it("should upsert a single track", async () => {
		const result = await broker.call("ipodLibrary.addTrack", { sourcePath: "/music/a.mp3" });
		expect(result.created).toBe(true);
		expect(result.track.fileName).toBe("a.mp3");
		expect(result.track.extension).toBe(".mp3");
	});

	it("should be idempotent on re-scan", async () => {
		await broker.call("ipodLibrary.addRoot", { rootPath: "/music" });
		const result = await broker.call("ipodLibrary.rescan");
		expect(result[0].created).toBe(0);
	});

	it("should list registered roots", async () => {
		await broker.call("ipodLibrary.addRoot", { rootPath: "/music" });
		const roots = await broker.call("ipodLibrary.listRoots");
		expect(roots).toHaveLength(1);
		expect(roots[0].path).toBe("/music");
		expect(roots[0].id).toEqual(expect.any(String));
	});

	it("should revalidate and mark missing tracks", async () => {
		await broker.call("ipodLibrary.addRoot", { rootPath: "/music" });
		// Simulate a.mp3 vanishing.
		svc.fs = fakeFs({
			"/music/b.m4a": "BBBB",
			"/music/sub/c.wav": "CCCCCCCC"
		});
		const result = await broker.call("ipodLibrary.revalidate");
		expect(result.changed).toBeGreaterThanOrEqual(1);
		const tracks = await broker.call("ipodTracksDb.find", { query: { sourcePath: "/music/a.mp3" } });
		expect(tracks[0].exists).toBe(false);
	});
});
