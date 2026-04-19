import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => ({
	authUser: locals.chronosSession?.user ?? null
});
