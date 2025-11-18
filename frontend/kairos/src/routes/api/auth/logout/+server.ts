import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearChronosSessionCookie } from '$lib/server/auth/cookies';

export const POST: RequestHandler = async ({ cookies }) => {
	clearChronosSessionCookie(cookies);
	return json({ success: true });
};
