// src/lib/stores/fx.ts
import { writable } from 'svelte/store';

export type FxKind = 'damage' | 'heal';

export type FxItem = {
	id: string;
	fromRect: DOMRect;
	targetRect: DOMRect;
	imgUrl: string;
	frameUrl: string | null;
	kind: FxKind;
	amount: number;
	// total duration in milliseconds (spawn + travel + fade)
	duration?: number;
};

function makeId() {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createFxStore() {
	const { subscribe, update, set } = writable<FxItem[]>([]);

	return {
		subscribe,
		start(input: Omit<FxItem, 'id'>) {
			const id = makeId();
			const item: FxItem = { ...input, id, duration: input.duration ?? 900 };
			update((arr) => [...arr, item]);
			return id;
		},
		finish(id: string) {
			update((arr) => arr.filter((x) => x.id !== id));
		},
		clear() {
			set([]);
		}
	};
}

export const fx = createFxStore();
