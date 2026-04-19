import type { AuthenticatedChronosUser } from '$lib/types/chronos';
import { writable } from 'svelte/store';

export const authUser = writable<AuthenticatedChronosUser | null>(null);

export function setAuthState(user: AuthenticatedChronosUser | null) {
	authUser.set(user);
}

export function clearAuthState() {
	setAuthState(null);
}
