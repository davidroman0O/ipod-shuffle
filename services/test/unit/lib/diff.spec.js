"use strict";

const { computeDiff } = require("../../../lib/diff");

describe("computeDiff", () => {
	it("returns no-snapshot when the snapshot is absent", () => {
		const result = computeDiff(null, { tracks: [], playlists: [] });
		expect(result.status).toBe("no-snapshot");
	});

	it("returns in-sync when snapshot and resolve match exactly", () => {
		const snapshot = {
			playlists: [
				{ id: "p1", name: "Rock", tracks: [{ id: "t1", fileName: "a.mp3" }, { id: "t2", fileName: "b.mp3" }] }
			]
		};
		const resolved = {
			tracks: [{ trackId: "t1" }, { trackId: "t2" }],
			playlists: [{ playlistId: "p1", name: "Rock", trackIds: ["t1", "t2"] }]
		};
		const result = computeDiff(snapshot, resolved);
		expect(result.status).toBe("in-sync");
		expect(result.added).toHaveLength(0);
		expect(result.removed).toHaveLength(0);
		expect(result.unchangedCount).toBe(2);
	});

	it("detects added tracks (in resolve but not on device)", () => {
		const snapshot = {
			playlists: [
				{ id: "p1", name: "Rock", tracks: [{ id: "t1", fileName: "a.mp3" }] }
			]
		};
		const resolved = {
			tracks: [{ trackId: "t1" }, { trackId: "t2" }],
			playlists: [{ playlistId: "p1", name: "Rock", trackIds: ["t1", "t2"] }]
		};
		const result = computeDiff(snapshot, resolved);
		expect(result.status).toBe("out-of-sync");
		expect(result.added).toHaveLength(1);
		expect(result.added[0].id).toBe("t2");
		expect(result.removed).toHaveLength(0);
		expect(result.unchangedCount).toBe(1);
	});

	it("detects removed tracks (on device but not in resolve)", () => {
		const snapshot = {
			playlists: [
				{ id: "p1", name: "Rock", tracks: [
					{ id: "t1", fileName: "a.mp3" },
					{ id: "t2", fileName: "b.mp3" },
					{ id: "t3", fileName: "c.mp3" }
				] }
			]
		};
		const resolved = {
			tracks: [{ trackId: "t1" }],
			playlists: [{ playlistId: "p1", name: "Rock", trackIds: ["t1"] }]
		};
		const result = computeDiff(snapshot, resolved);
		expect(result.status).toBe("out-of-sync");
		expect(result.added).toHaveLength(0);
		expect(result.removed).toHaveLength(2);
		expect(result.removed.map((r) => r.id)).toEqual(["t2", "t3"]);
		expect(result.removed.map((r) => r.fileName)).toEqual(["b.mp3", "c.mp3"]);
		expect(result.unchangedCount).toBe(1);
	});

	it("detects both added and removed simultaneously", () => {
		const snapshot = {
			playlists: [
				{ id: "p1", name: "Rock", tracks: [
					{ id: "t1", fileName: "keep.mp3" },
					{ id: "t2", fileName: "gone.mp3" }
				] }
			]
		};
		const resolved = {
			tracks: [{ trackId: "t1" }, { trackId: "t3" }],
			playlists: [{ playlistId: "p1", name: "Rock", trackIds: ["t1", "t3"] }]
		};
		const result = computeDiff(snapshot, resolved);
		expect(result.status).toBe("out-of-sync");
		expect(result.added).toHaveLength(1);
		expect(result.added[0].id).toBe("t3");
		expect(result.removed).toHaveLength(1);
		expect(result.removed[0].id).toBe("t2");
		expect(result.removed[0].fileName).toBe("gone.mp3");
		expect(result.unchangedCount).toBe(1);
	});

	it("handles empty snapshot (fresh device)", () => {
		const snapshot = { playlists: [] };
		const resolved = {
			tracks: [{ trackId: "t1" }, { trackId: "t2" }],
			playlists: [{ playlistId: "p1", name: "Rock", trackIds: ["t1", "t2"] }]
		};
		const result = computeDiff(snapshot, resolved);
		expect(result.status).toBe("out-of-sync");
		expect(result.added).toHaveLength(2);
		expect(result.removed).toHaveLength(0);
	});

	it("handles empty resolve (wiping)", () => {
		const snapshot = {
			playlists: [{ id: "p1", name: "Rock", tracks: [{ id: "t1", fileName: "a.mp3" }] }]
		};
		const resolved = { tracks: [], playlists: [] };
		const result = computeDiff(snapshot, resolved);
		expect(result.status).toBe("out-of-sync");
		expect(result.added).toHaveLength(0);
		expect(result.removed).toHaveLength(1);
	});
});
