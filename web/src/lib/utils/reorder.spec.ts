import { describe, it, expect } from 'vitest';
import { reorder, reorderMany, dropIndex } from './reorder';

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
});

describe('reorderMany', () => {
	it('moves multiple items preserving order', () => {
		expect(reorderMany(['a', 'b', 'c', 'd', 'e'], [0, 2], 4)).toEqual(['b', 'd', 'a', 'c', 'e']);
	});
	it('handles single item', () => {
		expect(reorderMany(['a', 'b', 'c'], [1], 0)).toEqual(['b', 'a', 'c']);
	});
	it('handles empty indices', () => {
		expect(reorderMany(['a', 'b', 'c'], [], 1)).toEqual(['a', 'b', 'c']);
	});
});

describe('dropIndex', () => {
	it('returns index for before', () => {
		expect(dropIndex(2, 'before')).toBe(2);
	});
	it('returns index+1 for after', () => {
		expect(dropIndex(2, 'after')).toBe(3);
	});
});
