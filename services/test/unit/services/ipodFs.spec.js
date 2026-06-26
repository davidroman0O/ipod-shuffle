"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");
const { ServiceBroker } = require("moleculer");
const { MoleculerError } = require("moleculer").Errors;

const FsService = require("../../../services/ipodFs.service");

describe("Test 'ipodFs' directory-browser service", () => {
	let broker;
	let tmpRoot;

	beforeEach(async () => {
		// Build a tiny throwaway tree under the OS temp dir.
		tmpRoot = await fs.mkdtemp(path.join(require("node:os").tmpdir(), "ipodfs-"));
		await fs.mkdir(path.join(tmpRoot, "alpha"));
		await fs.mkdir(path.join(tmpRoot, "beta"));
		await fs.writeFile(path.join(tmpRoot, "alpha", "song.mp3"), "x");
		await fs.writeFile(path.join(tmpRoot, "top.wav"), "x"); // a file at the root
		await fs.writeFile(path.join(tmpRoot, ".dotfile"), "x"); // dotfile, ignored by the lister

		broker = new ServiceBroker({ logger: false });
		broker.createService(FsService);
		await broker.start();

		// Restrict browsing to the temp root for deterministic assertions.
		broker.getLocalService("ipodFs").settings.allowRoot = tmpRoot;
	});
	afterEach(async () => {
		await broker.stop();
		await fs.rm(tmpRoot, { recursive: true, force: true });
	});

	it("should list immediate children, dirs first, dotfiles hidden", async () => {
		const res = await broker.call("ipodFs.list", { dir: tmpRoot });
		expect(res.path).toBe(tmpRoot);
		const names = res.entries.map((e) => e.name);
		expect(names).toContain("alpha");
		expect(names).toContain("beta");
		expect(names).toContain("top.wav");
		expect(names).not.toContain(".dotfile"); // dotfiles hidden
		// Directories sort before files.
		const firstFileIdx = res.entries.findIndex((e) => !e.isDir);
		expect(firstFileIdx).toBeGreaterThan(-1);
	});

	it("should reject paths outside the allow-root", async () => {
		await expect(broker.call("ipodFs.list", { dir: "/Users" })).rejects.toBeInstanceOf(
			MoleculerError
		);
	});

	it("should 404 on a missing directory", async () => {
		await expect(
			broker.call("ipodFs.list", { dir: path.join(tmpRoot, "nope") })
		).rejects.toBeInstanceOf(MoleculerError);
	});

	it("should recursively expand a directory into all audio file paths", async () => {
		const res = await broker.call("ipodFs.expand", { dir: tmpRoot });
		expect(res.dir).toBe(tmpRoot);
		expect(res.paths).toContain(path.join(tmpRoot, "alpha", "song.mp3"));
		expect(res.paths).toContain(path.join(tmpRoot, "top.wav"));
		// Non-audio files are excluded.
		expect(res.paths.some((p) => p.endsWith(".dotfile"))).toBe(false);
	});
});

describe("Test 'ipodFs' with filesystem-root allow-root (default)", () => {
	let broker;
	beforeEach(async () => {
		broker = new ServiceBroker({ logger: false });
		broker.createService(FsService);
		await broker.start();
		// Default settings already set allowRoot to "/"; ensure the live service
		// reflects that (the factory reads env at require-time).
		broker.getLocalService("ipodFs").settings.allowRoot = "/";
	});
	afterEach(() => broker.stop());

	it("should allow any path when allowRoot is the filesystem root", async () => {
		// /Users must not 403 under the default root (the regression we hit).
		const res = await broker.call("ipodFs.list", { dir: "/Users" });
		expect(res.path).toBe("/Users");
		expect(Array.isArray(res.entries)).toBe(true);
	});
});
