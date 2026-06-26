"use strict";

const { EngineClient, EngineClientError } = require("../../../lib/engine-client");

// A fake fetch that returns canned responses per (method, path).
function fakeFetch(routes) {
	const calls = [];
	const fn = async (url, opts = {}) => {
		const method = opts.method || "GET";
		calls.push({ url, method, body: opts.body });
		const u = new URL(url);
		const key = `${method} ${u.pathname}`;
		const route = routes[key];
		if (!route) return { ok: false, status: 404, text: async () => "not found" };
		return {
			ok: route.ok !== false,
			status: route.status || 200,
			text: async () => (typeof route.body === "string" ? route.body : JSON.stringify(route.body))
		};
	};
	fn.calls = calls;
	return fn;
}

describe("EngineClient", () => {
	it("should GET /v1/health", async () => {
		const fetch = fakeFetch({ "GET /v1/health": { body: { ok: true } } });
		const client = new EngineClient("http://engine:8765/", { fetch });
		expect(await client.health()).toEqual({ ok: true });
		expect(fetch.calls[0].url).toBe("http://engine:8765/v1/health");
	});

	it("should GET /v1/discover", async () => {
		const fetch = fakeFetch({ "GET /v1/discover": { body: [{ id: "1", mountPath: "/x" }] } });
		const client = new EngineClient("http://engine:8765", { fetch });
		expect(await client.discover()).toEqual([{ id: "1", mountPath: "/x" }]);
	});

	it("should GET /v1/devices/inspect with mount query", async () => {
		const fetch = fakeFetch({ "GET /v1/devices/inspect": { body: { id: "1" } } });
		const client = new EngineClient("http://engine:8765", { fetch });
		await client.inspect("/Volumes/MyPod");
		expect(fetch.calls[0].url).toContain("mount=%2FVolumes%2FMyPod");
	});

	it("should POST sync plan with a JSON body", async () => {
		const fetch = fakeFetch({ "POST /v1/sync/plan": { body: { copies: [] } } });
		const client = new EngineClient("http://engine:8765", { fetch });
		const out = await client.syncPlan({ mountPath: "/x", tracks: [], playlists: [] });
		expect(out).toEqual({ copies: [] });
		expect(fetch.calls[0].method).toBe("POST");
		expect(fetch.calls[0].body).toBe(JSON.stringify({ mountPath: "/x", tracks: [], playlists: [] }));
	});

	it("should throw EngineClientError on non-2xx with error body", async () => {
		const fetch = fakeFetch({ "POST /v1/sync": { ok: false, status: 500, body: { error: "disk full" } } });
		const client = new EngineClient("http://engine:8765", { fetch });
		await expect(client.sync({ mountPath: "/x", tracks: [], playlists: [] })).rejects.toBeInstanceOf(EngineClientError);
		try {
			await client.sync({ mountPath: "/x", tracks: [], playlists: [] });
		} catch (err) {
			expect(err.message).toBe("disk full");
			expect(err.status).toBe(500);
		}
	});

	it("should strip trailing slashes from baseUrl", async () => {
		const fetch = fakeFetch({ "GET /v1/health": { body: { ok: true } } });
		const client = new EngineClient("http://engine:8765///", { fetch });
		await client.health();
		expect(fetch.calls[0].url).toBe("http://engine:8765/v1/health");
	});

	it("should POST /v1/sync", async () => {
		const fetch = fakeFetch({ "POST /v1/sync": { body: { syncedAt: "x" } } });
		const client = new EngineClient("http://engine:8765", { fetch });
		const out = await client.sync({ mountPath: "/x", tracks: [{ trackId: "t1" }], playlists: [] });
		expect(out.syncedAt).toBe("x");
	});
});
