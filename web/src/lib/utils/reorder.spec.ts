/**
 * Vitest tests for the pure reorder helpers — the trickiest part of DnD is the
 * index math, so it's worth covering independently of the UI.
 */
import { describe, it, expect } from 'vitest';
import { reorder, dropIndex } from '$lib/utils/reorder';

describe('reorder', () => {
	it('moves an item forward', () => {
		expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'a', 'c', 'd']);
	});

	it('moves an item backward', () => {
		expect(reorder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
	});

	it('is a no-op when from equals to', () => {
		expect(reorder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
	});

	it('is a no-op on out-of-range indices', () => {
		expect(reorder(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
		expect(reorder(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
	});
});

describe('dropIndex', () => {
	it('returns the index for a before drop', () => {
		expect(dropIndex(2, 'before')).toBe(2);
	});
	it('returns index+1 for an after drop', () => {
		expect(dropIndex(2, 'after')).toBe(3);
	});
});
