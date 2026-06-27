"use strict";

const { ServiceBroker } = require("moleculer");
const { MoleculerError } = require("moleculer").Errors;

const GroupsDbService = require("../../../services/ipodPlaylistGroupsDb.db.service");
const PlaylistsDbService = require("../../../services/ipodPlaylistsDb.db.service");

describe("Test 'ipodPlaylistGroupsDb' data-owner service", () => {
	let broker;

	beforeEach(async () => {
		broker = new ServiceBroker({ logger: false });
		broker.createService(PlaylistsDbService);
		broker.createService(GroupsDbService);
		await broker.start();
	});
	afterEach(() => broker.stop());

	it("should create a group with ascending position", async () => {
		const a = await broker.call("ipodPlaylistGroupsDb.createNamed", { name: "Road Trip" });
		const b = await broker.call("ipodPlaylistGroupsDb.createNamed", { name: "Chill" });
		expect([a.position, b.position]).toEqual([0, 1]);
	});

	it("should reject an empty name", async () => {
		await expect(
			broker.call("ipodPlaylistGroupsDb.createNamed", { name: "   " })
		).rejects.toBeInstanceOf(MoleculerError);
	});

	it("should list groups ordered by position", async () => {
		const a = await broker.call("ipodPlaylistGroupsDb.createNamed", { name: "A" });
		const b = await broker.call("ipodPlaylistGroupsDb.createNamed", { name: "B" });
		await broker.call("ipodPlaylistGroupsDb.setOrder", { orderedIds: [b.id, a.id] });
		const ordered = await broker.call("ipodPlaylistGroupsDb.listOrdered");
		expect(ordered.map((g) => g.name)).toEqual(["B", "A"]);
	});

	it("should rename a group", async () => {
		const g = await broker.call("ipodPlaylistGroupsDb.createNamed", { name: "Old" });
		const renamed = await broker.call("ipodPlaylistGroupsDb.rename", { id: g.id, name: "New" });
		expect(renamed.name).toBe("New");
	});

	it("should delete a group and unassign member playlists", async () => {
		const g = await broker.call("ipodPlaylistGroupsDb.createNamed", { name: "Gone" });
		const pl = await broker.call("ipodPlaylistsDb.createNamed", { name: "PL" });
		await broker.call("ipodPlaylistsDb.moveToGroup", { id: pl.id, groupId: g.id });

		let stored = await broker.call("ipodPlaylistsDb.get", { id: pl.id });
		expect(stored.groupId).toBe(g.id);

		await broker.call("ipodPlaylistGroupsDb.removeGroup", { id: g.id });

		stored = await broker.call("ipodPlaylistsDb.get", { id: pl.id });
		expect(stored.groupId).toBeNull();
	});
});
