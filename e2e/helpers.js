"use strict";

/**
 * Shared helpers for E2E hardware tests.
 * Provides: HTTP client to the Moleculer node, filesystem assertions on the
 * device, sync polling, and cleanup utilities.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const API_HOST = process.env.E2E_HOST || "127.0.0.1";
const API_PORT = process.env.E2E_PORT || 3280;
const DEVICE_MOUNT = process.env.E2E_DEVICE_MOUNT || "/Volumes/IPOD";
const AUDIO_DIR = process.env.E2E_AUDIO_DIR || "/tmp/e2e-audio";

/** Make an HTTP request to the API gateway. Returns {status, body}. */
function api(method, urlPath, body) {
	return new Promise((resolve, reject) => {
		const data = body ? JSON.stringify(body) : null;
		const req = http.request(
			{
				hostname: API_HOST,
				port: API_PORT,
				path: urlPath,
				method,
				headers: {
					"Content-Type": "application/json",
					...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
				},
			},
			(res) => {
				let buf = "";
				res.on("data", (c) => (buf += c));
				res.on("end", () => {
					let parsed = null;
					try { parsed = JSON.parse(buf); } catch {}
					resolve({ status: res.statusCode, body: parsed ?? buf, raw: buf, headers: res.headers });
				});
			}
		);
		req.on("error", reject);
		if (data) req.write(data);
		req.end();
	});
}

/** Count audio files (excluding dotfiles/macOS resource forks) on the device. */
function countDeviceAudioFiles() {
	const musicDir = path.join(DEVICE_MOUNT, "iPod_Control", "Music");
	if (!fs.existsSync(musicDir)) return 0;
	let count = 0;
	function walk(dir) {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.name.startsWith(".")) continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.isFile() && /\.(mp3|m4a|m4b|m4p|aa|wav)$/i.test(entry.name)) count++;
		}
	}
	walk(musicDir);
	return count;
}

/** Get the iTunesSD file size on the device. */
function getITunesSDSize() {
	const p = path.join(DEVICE_MOUNT, "iPod_Control", "iTunes", "iTunesSD");
	try { return fs.statSync(p).size; } catch { return 0; }
}

/** Read the identity file from the device. */
function getIdentity() {
	const p = path.join(DEVICE_MOUNT, "iPod_Control", ".ipod-shuffle-identity.json");
	try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

/** Poll sync status until terminal, with timeout. */
async function waitForSync(deviceId, timeoutMs = 120000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const res = await api("GET", `/api/sync/${deviceId}/status`);
		if (res.status !== 200) throw new Error(`status poll failed: ${res.status}`);
		const job = res.body;
		if (job.status === "completed") return job;
		if (job.status === "failed") throw new Error(`sync failed: ${job.error}`);
		if (job.status === "cancelled") throw new Error("sync was cancelled");
		await sleep(1000);
	}
	throw new Error("sync timed out");
}

/** Wipe the device via the API. */
async function wipeDevice(deviceId) {
	const res = await api("POST", `/api/devices/${deviceId}/wipe`);
	if (res.status !== 200) throw new Error(`wipe failed: ${res.status} ${res.raw}`);
	return res.body;
}

/** Assert condition with context. */
function assert(condition, message) {
	if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

/** Sleep helper. */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = {
	api,
	countDeviceAudioFiles,
	getITunesSDSize,
	getIdentity,
	waitForSync,
	wipeDevice,
	assert,
	sleep,
	DEVICE_MOUNT,
	AUDIO_DIR,
};
