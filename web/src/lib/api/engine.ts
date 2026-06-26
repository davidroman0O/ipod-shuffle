import { apiFetch } from './client';
import type { EngineHealth } from './types';

export const engineApi = {
	health: () => apiFetch<EngineHealth>('/engine/health')
};
