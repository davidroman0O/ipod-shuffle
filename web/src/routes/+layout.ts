// Disable SSR: this is a local-dev tool talking to a local gateway.
// Keeps the dev loop simple (no SSR fetch; the browser uses the Vite proxy).
export const ssr = false;
export const prerender = false;
