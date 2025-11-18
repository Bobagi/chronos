import type { Handle } from '@sveltejs/kit';
import { CHRONOS_SESSION_COOKIE, decodeChronosSession } from '$lib/server/auth/cookies';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionCookie = event.cookies.get(CHRONOS_SESSION_COOKIE);
	event.locals.chronosSession = decodeChronosSession(sessionCookie);
	return resolve(event);
};
