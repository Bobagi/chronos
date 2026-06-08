import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.chronosSession?.user;
	if (!user) throw redirect(302, '/');
	return { user };
};
