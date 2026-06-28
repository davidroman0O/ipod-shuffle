/**
 * Low-level fetch helper for the Moleculer gateway. Every API module goes
 * through here so error handling + base URL are centralised.
 *
 * Handles RFC 9457 Problem Details error responses from the API gateway:
 * extracts `detail` as the human-readable error message, captures `requestId`
 * for tracing, and preserves the full body for inspection.
 */

/**
 * Base URL for the Moleculer gateway.
 *
 * In dev this is the relative '/api' — Vite proxies it to the node
 * (see vite.config.ts `server.proxy`), so there is no cross-origin request and
 * no CORS to configure. In production, set VITE_API_BASE_URL to the gateway's
 * absolute URL.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
		public body?: unknown,
		public requestId?: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
	});
	const text = await res.text();
	let body: unknown = undefined;
	if (text) {
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
	}

	// Capture request ID from response header (for tracing/debugging).
	const requestId = res.headers.get('X-Request-Id') ?? undefined;

	if (!res.ok) {
		// Extract human-readable message from RFC 9457 Problem Details.
		// Falls back to legacy `message` field or a generic status message.
		let message: string;
		if (typeof body === 'object' && body !== null) {
			const obj = body as Record<string, unknown>;
			// RFC 9457: `detail` is the human-readable explanation.
			if (typeof obj.detail === 'string') {
				message = obj.detail;
			}
			// Legacy moleculer-web: `message` field.
			else if (typeof obj.message === 'string') {
				message = obj.message;
			}
			// Fallback: just the status.
			else {
				message = `request failed: ${res.status}`;
			}
		} else {
			message = `request failed: ${res.status}`;
		}
		throw new ApiError(res.status, message, body, requestId);
	}

	return body as T;
}

export async function apiPost<T>(path: string, payload?: unknown): Promise<T> {
	return apiFetch<T>(path, {
		method: 'POST',
		body: payload === undefined ? undefined : JSON.stringify(payload)
	});
}

export async function apiDelete<T>(path: string): Promise<T> {
	return apiFetch<T>(path, { method: 'DELETE' });
}

/** PATCH helper — for partial updates. */
export async function apiPatch<T>(path: string, payload?: unknown): Promise<T> {
	return apiFetch<T>(path, {
		method: 'PATCH',
		body: payload === undefined ? undefined : JSON.stringify(payload)
	});
}
