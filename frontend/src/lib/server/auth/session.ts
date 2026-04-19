import type { AuthenticatedChronosUser } from '$lib/types/chronos';

export interface ChronosSession {
	token: string;
	user: AuthenticatedChronosUser;
}
