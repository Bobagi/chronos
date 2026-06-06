import type { PageServerLoad } from './$types';
import {
	checkChronosHealthStatus,
	fetchChronosCardCatalog,
	fetchMyChronosGameStatistics,
	listAllActiveChronosGames,
	listAuthenticatedChronosPlayerActiveGames
} from '$lib/server/chronos/client';
import { loadChronosDashboardDataForUser } from '$lib/services/chronosDashboardDataService';
import { selectFeaturedHeroCards, type FeaturedHeroCard } from '$lib/services/featuredHeroCards';

async function loadFeaturedHeroCardsSafely(): Promise<FeaturedHeroCard[]> {
	try {
		const collections = await fetchChronosCardCatalog();
		return selectFeaturedHeroCards(collections);
	} catch (error) {
		console.error('Failed to load featured hero cards', error);
		return [];
	}
}

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

	// Only the logged-out landing hero renders the featured cards, so skip the
	// extra catalog fetch entirely once a player is signed in.
	const featuredCards = session?.user ? [] : await loadFeaturedHeroCardsSafely();

	return {
		authUser: session?.user ?? null,
		dashboard,
		featuredCards
	};
};
