"use strict";

const { ServiceBroker, ValidationError } = require("moleculer");
const { MoleculerError } = require("moleculer").Errors;

const PlaylistsDbService = require("../../../services/ipodPlaylistsDb.db.service");

describe("Test 'ipodPlaylistsDb' data-owner service", () => {
	let broker;

	beforeEach(async () => {
		broker = new ServiceBroker({ logger: false });
		broker.createService(PlaylistsDbService);
		await broker.start();
	});
	afterEach(() => broker.stop());

	it("should create a playlist with a normalised name", async () => {
		const pl = await broker.call("ipodPlaylistsDb.createNamed", { name: "  My   Playlist " });
		expect(pl.name).toBe("My Playlist");
		expect(pl.trackIds).toEqual([]);
	});

	it("should reject an empty name", async () => {
		await expect(broker.call("ipodPlaylistsDb.createNamed", { name: "   " })).rejects.toBeInstanceOf(MoleculerError);
	});

	it("should reject a duplicate name (case-insensitive)", async () => {
		await broker.call("ipodPlaylistsDb.createNamed", { name: "Rock" });
		await expect(broker.call("ipodPlaylistsDb.createNamed", { name: "rock" })).rejects.toBeInstanceOf(MoleculerError);
	});

	it("should add and remove tracks idempotently", async () => {
		const pl = await broker.call("ipodPlaylistsDb.createNamed", { name: "Mix" });
		await broker.call("ipodPlaylistsDb.addTrack", { id: pl.id, trackId: "t1" });
		await broker.call("ipodPlaylistsDb.addTrack", { id: pl.id, trackId: "t1" }); // idempotent
		await broker.call("ipodPlaylistsDb.addTrack", { id: pl.id, trackId: "t2" });

		let updated = await broker.call("ipodPlaylistsDb.get", { id: pl.id });
		expect(updated.trackIds).toEqual(["t1", "t2"]);

		await broker.call("ipodPlaylistsDb.removeTrack", { id: pl.id, trackId: "t1" });
		updated = await broker.call("ipodPlaylistsDb.get", { id: pl.id });
		expect(updated.trackIds).toEqual(["t2"]);
	});

	it("should find by name case-insensitively", async () => {
		await broker.call("ipodPlaylistsDb.createNamed", { name: "Rock" });
		const found = await broker.call("ipodPlaylistsDb.findByName", { name: "ROCK" });
		expect(found.name).toBe("Rock");
	});

	it("should resolve by ids", async () => {
		const a = await broker.call("ipodPlaylistsDb.createNamed", { name: "A" });
		const b = await broker.call("ipodPlaylistsDb.createNamed", { name: "B" });
		const resolved = await broker.call("ipodPlaylistsDb.resolveByIds", { ids: [a.id, b.id] });
		expect(resolved).toHaveLength(2);
	});

	it("should assign ascending positions on creation", async () => {
		const a = await broker.call("ipodPlaylistsDb.createNamed", { name: "A" });
		const b = await broker.call("ipodPlaylistsDb.createNamed", { name: "B" });
		const c = await broker.call("ipodPlaylistsDb.createNamed", { name: "C" });
		expect([a.position, b.position, c.position]).toEqual([0, 1, 2]);
	});

	it("listOrdered should return playlists sorted by position", async () => {
		const a = await broker.call("ipodPlaylistsDb.createNamed", { name: "A" });
		const b = await broker.call("ipodPlaylistsDb.createNamed", { name: "B" });
		const c = await broker.call("ipodPlaylistsDb.createNamed", { name: "C" });
		// Reverse the order via setOrder.
		await broker.call("ipodPlaylistsDb.setOrder", { orderedIds: [c.id, b.id, a.id] });
		const ordered = await broker.call("ipodPlaylistsDb.listOrdered");
		expect(ordered.map((p) => p.name)).toEqual(["C", "B", "A"]);
	});

	it("setOrder should rewrite positions 0..n", async () => {
		const a = await broker.call("ipodPlaylistsDb.createNamed", { name: "A" });
		const b = await broker.call("ipodPlaylistsDb.createNamed", { name: "B" });
		const result = await broker.call("ipodPlaylistsDb.setOrder", { orderedIds: [b.id, a.id] });
		expect(result.reordered).toBe(2);
		const updated = await broker.call("ipodPlaylistsDb.get", { id: b.id });
		expect(updated.position).toBe(0);
	});

	it("setTrackOrder should replace a playlist's track order", async () => {
		const pl = await broker.call("ipodPlaylistsDb.createNamed", { name: "Mix" });
		await broker.call("ipodPlaylistsDb.addTrack", { id: pl.id, trackId: "t1" });
		await broker.call("ipodPlaylistsDb.addTrack", { id: pl.id, trackId: "t2" });
		await broker.call("ipodPlaylistsDb.addTrack", { id: pl.id, trackId: "t3" });

		await broker.call("ipodPlaylistsDb.setTrackOrder", { id: pl.id, trackIds: ["t3", "t1", "t2"] });
		const updated = await broker.call("ipodPlaylistsDb.get", { id: pl.id });
		expect(updated.trackIds).toEqual(["t3", "t1", "t2"]);
	});

	it("setTrackOrder should throw on unknown playlist", async () => {
		await expect(
			broker.call("ipodPlaylistsDb.setTrackOrder", { id: "nope", trackIds: [] })
		).rejects.toBeInstanceOf(MoleculerError);
	});

	it("addTracks should append many ids, deduped and order-preserving", async () => {
		const pl = await broker.call("ipodPlaylistsDb.createNamed", { name: "Batch" });
		await broker.call("ipodPlaylistsDb.addTrack", { id: pl.id, trackId: "t1" });
		// Includes a duplicate (t1) and a new one (t2); order preserved, no dup.
		const updated = await broker.call("ipodPlaylistsDb.addTracks", {
			id: pl.id,
			trackIds: ["t1", "t2", "t3"]
		});
		expect(updated.trackIds).toEqual(["t1", "t2", "t3"]);
	});

	it("insertTracks should insert fresh ids at a position", async () => {
		const pl = await broker.call("ipodPlaylistsDb.createNamed", { name: "Ins" });
		await broker.call("ipodPlaylistsDb.addTracks", { id: pl.id, trackIds: ["a", "c"] });
		const updated = await broker.call("ipodPlaylistsDb.insertTracks", {
			id: pl.id,
			trackIds: ["b"],
			position: 1
		});
		expect(updated.trackIds).toEqual(["a", "b", "c"]);
	});

	it("insertTracks with position -1 should append", async () => {
		const pl = await broker.call("ipodPlaylistsDb.createNamed", { name: "App" });
		await broker.call("ipodPlaylistsDb.addTracks", { id: pl.id, trackIds: ["a"] });
		const updated = await broker.call("ipodPlaylistsDb.insertTracks", {
			id: pl.id,
			trackIds: ["b"],
			position: -1
		});
		expect(updated.trackIds).toEqual(["a", "b"]);
	});

	it("rename should change the name (normalised, unique)", async () => {
		const pl = await broker.call("ipodPlaylistsDb.createNamed", { name: "Old" });
		const renamed = await broker.call("ipodPlaylistsDb.rename", { id: pl.id, name: "  New  Name " });
		expect(renamed.name).toBe("New Name");
	});

	it("rename should reject a duplicate name", async () => {
		await broker.call("ipodPlaylistsDb.createNamed", { name: "A" });
		const b = await broker.call("ipodPlaylistsDb.createNamed", { name: "B" });
		await expect(
			broker.call("ipodPlaylistsDb.rename", { id: b.id, name: "a" })
		).rejects.toBeInstanceOf(MoleculerError);
	});

	it("removeWithAssignments should delete the playlist and clear device assignments", async () => {
		const pl = await broker.call("ipodPlaylistsDb.createNamed", { name: "Gone" });
		// Simulate a device assignment by toggling via devicesDb.
		const DevicesDbService = require("../../../services/ipodDevicesDb.db.service");
		await broker.createService(DevicesDbService);
		await broker.waitForServices(["ipodDevicesDb"], 1000);
		const { device } = await broker.call("ipodDevicesDb.upsertFromDiscovery", {
			discovered: { id: "UUID1", name: "Pod", mountPath: "/Volumes/Pod", volumeUuid: "UUID1" }
		});
		await broker.call("ipodDevicesDb.togglePlaylistAssignment", { deviceId: device.id, playlistId: pl.id });
		let stored = await broker.call("ipodDevicesDb.get", { id: device.id });
		expect(stored.playlistIds).toContain(pl.id);

		await broker.call("ipodPlaylistsDb.removeWithAssignments", { id: pl.id });

		await expect(broker.call("ipodPlaylistsDb.get", { id: pl.id })).rejects.toThrow();
		stored = await broker.call("ipodDevicesDb.get", { id: device.id });
		expect(stored.playlistIds).not.toContain(pl.id);
	});
});
