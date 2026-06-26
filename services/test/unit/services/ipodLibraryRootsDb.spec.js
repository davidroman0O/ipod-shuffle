"use strict";

const { ServiceBroker } = require("moleculer");

const RootsDbService = require("../../../services/ipodLibraryRootsDb.db.service");

describe("Test 'ipodLibraryRootsDb' data-owner service", () => {
	let broker;

	beforeEach(async () => {
		broker = new ServiceBroker({ logger: false });
		broker.createService(RootsDbService);
		await broker.start();
	});
	afterEach(() => broker.stop());

	it("should add a root idempotently by path", async () => {
		const first = await broker.call("ipodLibraryRootsDb.add", { path: "/music" });
		const second = await broker.call("ipodLibraryRootsDb.add", { path: "/music" });
		expect(second.id).toBe(first.id);
		const paths = await broker.call("ipodLibraryRootsDb.listPaths");
		expect(paths).toEqual(["/music"]);
	});

	it("should list root paths", async () => {
		await broker.call("ipodLibraryRootsDb.add", { path: "/a" });
		await broker.call("ipodLibraryRootsDb.add", { path: "/b" });
		const paths = await broker.call("ipodLibraryRootsDb.listPaths");
		expect(paths).toHaveLength(2);
		expect(paths).toContain("/a");
		expect(paths).toContain("/b");
	});

	it("listAll should return full documents with stable ids", async () => {
		await broker.call("ipodLibraryRootsDb.add", { path: "/music" });
		const all = await broker.call("ipodLibraryRootsDb.listAll");
		expect(all).toHaveLength(1);
		expect(all[0].id).toEqual(expect.any(String));
		expect(all[0].path).toBe("/music");
		expect(all[0].addedAt).toEqual(expect.any(String));
	});

	it("should remove a root by path and return its id", async () => {
		await broker.call("ipodLibraryRootsDb.add", { path: "/gone" });
		const removed = await broker.call("ipodLibraryRootsDb.removeByPath", { path: "/gone" });
		expect(removed).toEqual(expect.any(String));
		const paths = await broker.call("ipodLibraryRootsDb.listPaths");
		expect(paths).toEqual([]);
	});

	it("should return null when removing an unknown path", async () => {
		const removed = await broker.call("ipodLibraryRootsDb.removeByPath", { path: "/nope" });
		expect(removed).toBeNull();
	});
});
