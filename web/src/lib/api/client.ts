/**
 * Low-level fetch helper for the Moleculer gateway. Every API module goes
 * through here so error handling + base URL are centralised.
 *
 * The gateway URL defaults to the local-dev api service; override with
 * VITE_API_BASE_URL when the node runs elsewhere.
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
		public body?: unknown
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
	if (!res.ok) {
		const message =
			(typeof body === 'object' && body && 'message' in body
				? String((body as { message: unknown }).message)
				: `request failed: ${res.status}`) ?? `request failed: ${res.status}`;
		throw new ApiError(res.status, message, body);
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
