"use strict";

const { ServiceBroker } = require("moleculer");
const ApiGateway = require("moleculer-web");
const request = require("supertest");

const ApiService = require("../../services/api.service");
const TracksDbService = require("../../services/ipodTracksDb.db.service");
const PlaylistsDbService = require("../../services/ipodPlaylistsDb.db.service");
const LibraryRootsDbService = require("../../services/ipodLibraryRootsDb.db.service");
const LibraryService = require("../../services/ipodLibrary.service");
const EngineService = require("../../services/ipodEngine.service");

// Stub the engine so these tests never hit a real HTTP server.
function makeStubEngineService(responses) {
	return {
		name: "ipodEngine",
		actions: {
			health: { handler: () => responses.health || { ok: true } },
			discover: { handler: () => responses.discover || [] },
			inspect: { handler: (ctx) => responses.inspect ? responses.inspect(ctx.params) : { id: "stub" } },
			syncPlan: { handler: (ctx) => responses.syncPlan ? responses.syncPlan(ctx.params) : {} },
			sync: { handler: (ctx) => responses.sync ? responses.sync(ctx.params) : { syncedAt: "x", manifest: [] } }
		}
	};
}

describe("Test 'api' gateway over ipod services", () => {
	let broker;
	let server;

	beforeEach(async () => {
		broker = new ServiceBroker({ logger: false });
		broker.createService(TracksDbService);
		broker.createService(PlaylistsDbService);
		broker.createService(LibraryRootsDbService);
		broker.createService(LibraryService);
		broker.createService(makeStubEngineService({}));
		broker.createService(ApiService);
		// Bind an OS-assigned ephemeral port so the test never collides with a
		// running dev server on the default port (3280).
		broker.getLocalService("api").settings.port = 0;
		await broker.start();

		const apiService = broker.getLocalService("api");
		server = apiService.server;
	});
	afterEach(() => broker.stop());

	it("should return engine health", async () => {
		const res = await request(server).get("/api/engine/health");
		expect(res.statusCode).toBe(200);
		expect(res.body).toEqual({ ok: true });
	});

	it("should create and list playlists", async () => {
		const create = await request(server).post("/api/playlists").send({ name: "Rock" });
		expect(create.statusCode).toBe(200);
		expect(create.body.name).toBe("Rock");

		const list = await request(server).get("/api/playlists");
		expect(list.body.map((p) => p.name)).toContain("Rock");
	});

	it("should list library roots (empty initially)", async () => {
		const res = await request(server).get("/api/library/roots");
		expect(res.statusCode).toBe(200);
		expect(Array.isArray(res.body)).toBe(true);
	});
});
