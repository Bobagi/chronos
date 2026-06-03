import type { PageServerLoad } from './$types';
import {
	checkChronosHealthStatus,
	fetchMyChronosGameStatistics,
	listAllActiveChronosGames,
	listAuthenticatedChronosPlayerActiveGames
} from '$lib/server/chronos/client';
import { loadChronosDashboardDataForUser } from '$lib/services/chronosDashboardDataService';

export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.chronosSession;

	const dashboard = await loadChronosDashboardDataForUser(
		session?.token ?? null,
		session?.user ?? null,
		{
			checkChronosHealthStatus,
			listAllActiveChronosGames,
			listAuthenticatedChronosPlayerActiveGames,
			fetchMyChronosGameStatistics
		}
	);

	return {
		authUser: session?.user ?? null,
		dashboard
	};
};
