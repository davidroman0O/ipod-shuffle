/**
 * Pure reorder helpers shared by every drag-and-drop surface. Keeping the index
 * math out of components makes the DnD handlers tiny and unit-testable.
 */

/**
 * Move an item within a list from `from` to `to` (the target slot after the
 * drop, already adjusted by the caller for before/after).
 */
export function reorder<T>(list: T[], from: number, to: number): T[] {
	if (from === to || from < 0 || from >= list.length) return list;
	const next = [...list];
	const [item] = next.splice(from, 1);
	const adjusted = from < to ? to - 1 : to;
	next.splice(adjusted, 0, item);
	return next;
}

/**
 * Compute the destination index for a drop given the source index and the
 * before/after position reported by sveltednd.
 */
export function dropIndex(draggedIndex: number, dropPosition: 'before' | 'after'): number {
	return dropPosition === 'after' ? draggedIndex + 1 : draggedIndex;
}
