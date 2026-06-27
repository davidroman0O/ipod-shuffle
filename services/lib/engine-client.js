"use strict";

/**
 * Stateless HTTP client for the local Go device engine. This is the ONLY place
 * the product layer talks HTTP to the engine; everything else goes through the
 * `ipodEngine` moleculer service so the mesh can route it.
 *
 * The fetch implementation is injectable so the service (and its tests) never
 * need a running Go server.
 */

const DEFAULT_TIMEOUT_MS = 30 * 1000;

class EngineClientError extends Error {
	constructor(message, status, body) {
		super(message);
		this.name = "EngineClientError";
		this.status = status;
		this.body = body;
	}
}

class EngineClient {
	/**
	 * @param {string} baseUrl e.g. "http://127.0.0.1:8765"
	 * @param {object} [opts]
	 * @param {typeof fetch} [opts.fetch] injectable fetch (defaults to global fetch)
	 * @param {number} [opts.timeoutMs]
	 */
	constructor(baseUrl, opts = {}) {
		this.baseUrl = baseUrl.replace(/\/+$/, "");
		this.fetch = opts.fetch || globalThis.fetch.bind(globalThis);
		this.timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
	}

	/** GET /v1/health */
	async health() {
		return this.#getJson("/v1/health");
	}

	/** GET /v1/discover */
	async discover() {
		return this.#getJson("/v1/discover");
	}

	/** GET /v1/devices/inspect?mount= */
	async inspect(mountPath) {
		const qs = new URLSearchParams({ mount: mountPath }).toString();
		return this.#getJson(`/v1/devices/inspect?${qs}`);
	}

	/** POST /v1/sync/plan (dry-run) */
	async syncPlan(body) {
		return this.#postJson("/v1/sync/plan", body);
	}

	/** POST /v1/sync (execute) */
	async sync(body) {
		return this.#postJson("/v1/sync", body);
	}

	/** POST /v1/devices/identity — write the on-device identity file. */
	async setIdentity(mountPath, name, id) {
		return this.#postJson("/v1/devices/identity", { mountPath, name, id });
	}

	/** POST /v1/devices/wipe — erase all audio from the device. */
	async wipe(mountPath) {
		return this.#postJson("/v1/devices/wipe", { mountPath });
	}

	async #getJson(path) {
		const res = await this.#do(path, "GET");
		return this.#parse(res);
	}

	async #postJson(path, body) {
		const res = await this.#do(path, "POST", JSON.stringify(body));
		return this.#parse(res);
	}

	async #do(path, method, body) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			return await this.fetch(this.baseUrl + path, {
				method,
				body,
				headers: body ? { "Content-Type": "application/json" } : undefined,
				signal: controller.signal
			});
		} finally {
			clearTimeout(timer);
		}
	}

	async #parse(res) {
		const text = await res.text();
		let json = null;
		if (text) {
			try {
				json = JSON.parse(text);
			} catch {
				json = null;
			}
		}
		if (!res.ok) {
			const msg = (json && json.error) || `engine responded ${res.status}`;
			throw new EngineClientError(msg, res.status, json);
		}
		return json;
	}
}

module.exports = { EngineClient, EngineClientError };
