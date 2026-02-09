// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { ChronosSession } from '$lib/server/auth/session';
import type { AuthenticatedChronosUser, ChronosDashboardData } from '$lib/types/chronos';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			chronosSession: ChronosSession | null;
		}
		interface PageData {
			authUser: AuthenticatedChronosUser | null;
			dashboard?: ChronosDashboardData;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
