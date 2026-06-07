// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Locale } from '$lib/i18n/config';
import type { ChronosSession } from '$lib/server/auth/session';
import type { AuthenticatedChronosUser, ChronosDashboardData } from '$lib/types/chronos';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			chronosSession: ChronosSession | null;
			locale: Locale;
		}
		interface PageData {
			authUser: AuthenticatedChronosUser | null;
			dashboard?: ChronosDashboardData;
			locale?: Locale;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
