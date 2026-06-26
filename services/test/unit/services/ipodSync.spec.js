"use strict";

const { ServiceBroker } = require("moleculer");
const { MoleculerError } = require("moleculer").Errors;

const SyncService = require("../../../services/ipodSync.service");

/**
 * Tests for the ipodSync orchestrator. The real sync service runs; its
 * dependencies (ipodDevicesDb, ipodPlaylistsDb, ipodTracksDb, ipodEngine) are
 * replaced by tiny stub services that return canned data. Events are captured
 * via broker.on so we assert mesh-level side effects.
 */

// Build a stub service that maps action name → impl.
function stubService(name, actionImpls) {
	return {
		name,
		actions: Object.fromEntries(
			Object.entries(actionImpls).map(([action, impl]) => [
				action,
				{ handler: (ctx) => impl(ctx.params) }
			])
		)
	};
}

describe("Test 'ipodSync' orchestrator", () => {
	let broker;
	let emittedEvents;

	beforeEach(async () => {
		broker = new ServiceBroker({ logger: false });
		emittedEvents = [];
	});
	afterEach(() => broker.stop());

	async function startSync(stubs) {
		broker.createService(SyncService);
		broker.createService(stubService("ipodDevicesDb", stubs.ipodDevicesDb || {}));
		broker.createService(stubService("ipodPlaylistsDb", stubs.ipodPlaylistsDb || {}));
		broker.createService(stubService("ipodTracksDb", stubs.ipodTracksDb || {}));
		broker.createService(stubService("ipodEngine", stubs.ipodEngine || {}));
		// Event-catcher service: record emitted events so tests can assert them.
		const eventNames = ["ipod.sync.started", "ipod.sync.completed", "ipod.sync.failed"];
		broker.createService({
			name: "eventCatcher",
			events: Object.fromEntries(
				eventNames.map((n) => [n, (ctx) => emittedEvents.push({ name: n, payload: ctx.params })])
			)
		});
		await broker.start();
	}

	it("should resolve the deduped track union across assigned playlists", async () => {
		await startSync({
			ipodDevicesDb: {
				get: async () => ({ id: "dev1", name: "MyPod", lastKnownMountPath: "/Volumes/MyPod", playlistIds: ["p1", "p2"] })
			},
			ipodPlaylistsDb: {
				resolveByIds: async () => [
					{ id: "p1", name: "Rock", trackIds: ["t1", "t2"] },
					{ id: "p2", name: "Chill", trackIds: ["t2", "t3"] }
				]
			},
			ipodTracksDb: {
				resolveByIds: async () => [
					{ id: "t1", sourcePath: "/lib/a.mp3", fileName: "a.mp3", exists: true, sizeBytes: 100 },
					{ id: "t2", sourcePath: "/lib/b.mp3", fileName: "b.mp3", exists: true, sizeBytes: 200 },
					{ id: "t3", sourcePath: "/lib/c.mp3", fileName: "c.mp3", exists: false, sizeBytes: 300 }
				]
			}
		});

		const resolved = await broker.call("ipodSync.resolve", { deviceId: "dev1" });
		expect(resolved.tracks).toHaveLength(2); // t3 missing, t2 deduped
		expect(resolved.tracks.map((t) => t.trackId)).toEqual(["t1", "t2"]);
		expect(resolved.playlists).toEqual([
			{ playlistId: "p1", name: "Rock", trackIds: ["t1", "t2"] },
			{ playlistId: "p2", name: "Chill", trackIds: ["t2"] }
		]);
	});

	it("should throw when the device is unknown", async () => {
		await startSync({
			ipodDevicesDb: { get: async () => null }
		});
		await expect(broker.call("ipodSync.resolve", { deviceId: "nope" })).rejects.toBeInstanceOf(MoleculerError);
	});

	it("should start an async sync and return running immediately", async () => {
		await startSync({
			ipodDevicesDb: {
				get: async () => ({ id: "dev1", name: "MyPod", lastKnownMountPath: "/Volumes/MyPod", playlistIds: ["p1"] }),
				recordSync: async (params) => params
			},
			ipodPlaylistsDb: {
				resolveByIds: async () => [{ id: "p1", name: "Rock", trackIds: ["t1"] }]
			},
			ipodTracksDb: {
				resolveByIds: async () => [{ id: "t1", sourcePath: "/lib/a.mp3", fileName: "a.mp3", exists: true, sizeBytes: 100 }]
			}
		});

		const result = await broker.call("ipodSync.run", { deviceId: "dev1" });
		expect(result.status).toBe("running");
		const status = await broker.call("ipodSync.status", { deviceId: "dev1" });
		expect(status.deviceId).toBe("dev1");
	});

	it("handleEngineEvent done: persists manifest + marks completed", async () => {
		const recorded = [];
		await startSync({
			ipodDevicesDb: {
				get: async () => ({ id: "dev1", name: "MyPod", lastKnownMountPath: "/v", playlistIds: [] }),
				recordSync: async (params) => { recorded.push(params); return params; }
			}
		});
		const svc = broker.getLocalService("ipodSync");
		svc.jobs.set("dev1", { deviceId: "dev1", status: "running", phase: "copy", current: 0, total: 1 });
		await svc.handleEngineEvent({ call: async (n, p) => { if (n === "ipodDevicesDb.recordSync") recorded.push(p); return p; }, emit: async () => {} }, { id: "dev1" }, svc.jobs.get("dev1"), {
			type: "done", writtenDatabaseBytes: 532, writtenStatsBytes: 40, manifest: [{ trackId: "t1", relativePath: "x", sizeBytes: 100 }], syncedAt: "2026-06-25T12:00:00Z"
		});
		expect(svc.jobs.get("dev1").status).toBe("completed");
		expect(recorded[0].manifest).toHaveLength(1);
	});

	it("should throw on unmounted device and not call the engine", async () => {
		let engineCalled = false;
		await startSync({
			ipodDevicesDb: {
				get: async () => ({ id: "dev1", name: "MyPod", lastKnownMountPath: null, playlistIds: [] })
			},
			ipodPlaylistsDb: { resolveByIds: async () => [] },
			ipodTracksDb: { resolveByIds: async () => [] },
			ipodEngine: { sync: async () => { engineCalled = true; } }
		});
		await expect(broker.call("ipodSync.run", { deviceId: "dev1" })).rejects.toBeInstanceOf(MoleculerError);
		expect(engineCalled).toBe(false);
	});

	it("should reject double-start with 409", async () => {
		await startSync({
			ipodDevicesDb: {
				get: async () => ({ id: "dev1", name: "MyPod", lastKnownMountPath: "/v", playlistIds: [] }),
				recordSync: async () => {}
			},
			ipodPlaylistsDb: { resolveByIds: async () => [] },
			ipodTracksDb: { resolveByIds: async () => [] }
		});
		broker.getLocalService("ipodSync").jobs.set("dev1", { status: "running" });
		await expect(broker.call("ipodSync.run", { deviceId: "dev1" })).rejects.toBeInstanceOf(MoleculerError);
	});
});
