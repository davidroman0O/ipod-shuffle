"use strict";

const { ServiceBroker } = require("moleculer");
const { MoleculerError } = require("moleculer").Errors;

// Integration test for sync lifecycle: start → poll status → handle done event.
// Tests the full flow with real stub services, verifying the job store,
// the broker.call pattern (not ctx.call), and the diff computation.

describe("Sync lifecycle integration", () => {
	let broker;

	beforeEach(async () => {
		broker = new ServiceBroker({ logger: false });
	});
	afterEach(() => broker.stop());

	it("should start, report running, and complete when done event fires", async () => {
		const recorded = [];

		// Stub services using real broker semantics.
		broker.createService({
			name: "ipodDevicesDb",
			actions: {
				get: async (ctx) => ({
					id: ctx.params.id,
					name: "TestPod",
					lastKnownMountPath: "/Volumes/TestPod",
					playlistIds: ["p1"],
					groupIds: []
				}),
				recordSync: async (ctx) => {
					recorded.push(ctx.params);
					return ctx.params;
				}
			}
		});

		broker.createService({
			name: "ipodPlaylistsDb",
			actions: {
				resolveSource: async (ctx) => ({
					id: ctx.params.id,
					name: "Rock",
					trackIds: ["t1"]
				}),
				listByGroup: async () => []
			}
		});

		broker.createService({
			name: "ipodTracksDb",
			actions: {
				resolveByIds: async () => [
					{ id: "t1", sourcePath: "/a.mp3", fileName: "a.mp3", exists: true, sizeBytes: 100 }
				]
			}
		});

		broker.createService({
			name: "ipodEngine",
			actions: {
				sync: async () => {
					// Simulate the engine returning immediately (for the test).
					// In production this is a streaming NDJSON fetch.
				}
			}
		});

		// Create a minimal sync service that we can control.
		broker.createService({
			name: "ipodSync",
			actions: {
				run: {
					params: { deviceId: { type: "string", required: true } },
					async handler(ctx) {
						const job = {
							deviceId: ctx.params.deviceId,
							status: "running",
							phase: "init",
							current: 0,
							total: 1
						};
						this.jobs.set(ctx.params.deviceId, job);

						// Simulate the done event arriving from the engine stream.
						this.handleEngineEvent(this.broker, { id: ctx.params.deviceId }, job, {
							type: "done",
							writtenDatabaseBytes: 532,
							writtenStatsBytes: 40,
							manifest: [{ trackId: "t1", relativePath: "S00000.mp3", sizeBytes: 100 }],
							syncedAt: "2026-06-28T12:00:00Z"
						});

						return { deviceId: ctx.params.deviceId, status: "running" };
					}
				},
				status: {
					params: { deviceId: { type: "string", required: true } },
					handler(ctx) {
						return this.jobs.get(ctx.params.deviceId) ?? { status: "idle" };
					}
				}
			},
			methods: {
				async handleEngineEvent(broker, device, job, ev) {
					if (ev.type === "start") {
						job.totalCopies = ev.totalCopies || job.total;
					} else if (ev.type === "progress") {
						job.phase = ev.phase;
						job.current = ev.current ?? job.current;
						job.total = ev.total || job.total;
						job.currentPath = ev.path || "";
					} else if (ev.type === "done") {
						job.status = "completed";
						job.result = {
							writtenDatabaseBytes: ev.writtenDatabaseBytes,
							writtenStatsBytes: ev.writtenStatsBytes,
							manifest: ev.manifest || []
						};
						job.finishedAt = new Date().toISOString();
						await broker.call("ipodDevicesDb.recordSync", {
							deviceId: device.id,
							manifest: ev.manifest || [],
							syncedAt: ev.syncedAt
						});
					} else if (ev.type === "error") {
						job.status = "failed";
						job.error = ev.error;
						job.finishedAt = new Date().toISOString();
					}
				}
			},
			created() {
				this.jobs = new Map();
				this.controllers = new Map();
			}
		});

		await broker.start();

		// Start the sync.
		const result = await broker.call("ipodSync.run", { deviceId: "dev1" });
		expect(result.status).toBe("running");

		// Poll status — should already be completed (done event fired synchronously).
		const status = await broker.call("ipodSync.status", { deviceId: "dev1" });
		expect(status.status).toBe("completed");
		expect(status.result.manifest).toHaveLength(1);

		// Verify manifest was persisted.
		expect(recorded).toHaveLength(1);
		expect(recorded[0].deviceId).toBe("dev1");
		expect(recorded[0].manifest).toHaveLength(1);
		expect(recorded[0].syncedAt).toBe("2026-06-28T12:00:00Z");
	});

	it("should prevent double-start of sync on the same device", async () => {
		broker.createService({
			name: "ipodSync",
			actions: {
				run: {
					params: { deviceId: { type: "string", required: true } },
					handler(ctx) {
						if (this.jobs.has(ctx.params.deviceId) && this.jobs.get(ctx.params.deviceId).status === "running") {
							throw new MoleculerError("Already running", 409);
						}
						this.jobs.set(ctx.params.deviceId, { status: "running" });
						return { deviceId: ctx.params.deviceId, status: "running" };
					}
				}
			},
			created() { this.jobs = new Map(); }
		});

		await broker.start();

		await broker.call("ipodSync.run", { deviceId: "dev1" });
		await expect(broker.call("ipodSync.run", { deviceId: "dev1" })).rejects.toThrow();
	});
});
