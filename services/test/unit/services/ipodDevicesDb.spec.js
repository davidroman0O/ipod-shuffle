"use strict";

const { ServiceBroker } = require("moleculer");

const DevicesDbService = require("../../../services/ipodDevicesDb.db.service");

describe("Test 'ipodDevicesDb' data-owner service", () => {
	let broker;

	beforeEach(async () => {
		broker = new ServiceBroker({ logger: false });
		broker.createService(DevicesDbService);
		await broker.start();
	});
	afterEach(() => broker.stop());

	const discovered = {
		id: "UUID1",
		name: "MyPod",
		mountPath: "/Volumes/MyPod",
		volumeUuid: "UUID1",
		deviceNode: "/dev/disk2"
	};

	it("should create a device from discovery", async () => {
		const { device, created } = await broker.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
		expect(created).toBe(true);
		expect(device.name).toBe("MyPod");
		expect(device.lastKnownMountPath).toBe("/Volumes/MyPod");
		expect(device.playlistIds).toEqual([]);
	});

	it("should upsert (refresh) an existing device by UUID", async () => {
		await broker.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
		const { device, created } = await broker.call("ipodDevicesDb.upsertFromDiscovery", {
			discovered: { ...discovered, name: "MyPod2", mountPath: "/Volumes/MyPod2" }
		});
		expect(created).toBe(false);
		expect(device.name).toBe("MyPod2");
		expect(device.lastKnownMountPath).toBe("/Volumes/MyPod2");
	});

	it("should match an existing device by mount path when UUID is absent", async () => {
		await broker.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
		const { created } = await broker.call("ipodDevicesDb.upsertFromDiscovery", {
			discovered: { id: "/Volumes/MyPod", name: "Pod", mountPath: "/Volumes/MyPod" }
		});
		expect(created).toBe(false);
	});

	it("should toggle playlist assignments", async () => {
		const { device } = await broker.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
		await broker.call("ipodDevicesDb.togglePlaylistAssignment", { deviceId: device.id, playlistId: "p1" });
		let updated = await broker.call("ipodDevicesDb.get", { id: device.id });
		expect(updated.playlistIds).toEqual(["p1"]);

		await broker.call("ipodDevicesDb.togglePlaylistAssignment", { deviceId: device.id, playlistId: "p1" });
		updated = await broker.call("ipodDevicesDb.get", { id: device.id });
		expect(updated.playlistIds).toEqual([]);
	});

	it("should toggle group assignments", async () => {
		const { device } = await broker.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
		await broker.call("ipodDevicesDb.toggleGroupAssignment", { deviceId: device.id, groupId: "g1" });
		let updated = await broker.call("ipodDevicesDb.get", { id: device.id });
		expect(updated.groupIds).toEqual(["g1"]);

		await broker.call("ipodDevicesDb.toggleGroupAssignment", { deviceId: device.id, groupId: "g1" });
		updated = await broker.call("ipodDevicesDb.get", { id: device.id });
		expect(updated.groupIds).toEqual([]);
	});

	it("should record a sync manifest", async () => {
		const { device } = await broker.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
		await broker.call("ipodDevicesDb.recordSync", {
			deviceId: device.id,
			manifest: [{ trackId: "t1", relativePath: "x", sizeBytes: 1 }],
			syncedAt: "2026-06-25T12:00:00Z"
		});
		const updated = await broker.call("ipodDevicesDb.get", { id: device.id });
		expect(updated.manifest).toHaveLength(1);
		expect(updated.lastSyncAt).toBe("2026-06-25T12:00:00Z");
	});

	it("should find by volume UUID", async () => {
		await broker.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
		const found = await broker.call("ipodDevicesDb.findByVolumeUuid", { volumeUuid: "UUID1" });
		expect(found.name).toBe("MyPod");
	});

	it("should derive a slash-free stable id when no volume UUID is present", async () => {
		const { device, created } = await broker.call("ipodDevicesDb.upsertFromDiscovery", {
			discovered: { id: "/Volumes/MyPod", name: "MyPod", mountPath: "/Volumes/MyPod" }
		});
		expect(created).toBe(true);
		expect(device.id).not.toContain("/");
		expect(device.id).toMatch(/^mount-[0-9a-f]+$/);
	});

	it("should keep a stable id across re-discovery of the same mount path", async () => {
		const first = await broker.call("ipodDevicesDb.upsertFromDiscovery", {
			discovered: { id: "/Volumes/MyPod", name: "MyPod", mountPath: "/Volumes/MyPod" }
		});
		const second = await broker.call("ipodDevicesDb.upsertFromDiscovery", {
			discovered: { id: "/Volumes/MyPod", name: "MyPod", mountPath: "/Volumes/MyPod" }
		});
		expect(second.created).toBe(false);
		expect(second.device.id).toBe(first.device.id);
	});

	it("should remove a device by id and return the id, or null if absent", async () => {
		const { device } = await broker.call("ipodDevicesDb.upsertFromDiscovery", { discovered });
		const removed = await broker.call("ipodDevicesDb.removeById", { id: device.id });
		expect(removed).toBe(device.id);
		const again = await broker.call("ipodDevicesDb.removeById", { id: device.id });
		expect(again).toBeNull();
	});
});
