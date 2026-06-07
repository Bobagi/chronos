import type { Handle } from '@sveltejs/kit';
import { LOCALE_COOKIE, resolveLocale } from '$lib/i18n/config';
import { CHRONOS_SESSION_COOKIE, decodeChronosSession } from '$lib/server/auth/cookies';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionCookie = event.cookies.get(CHRONOS_SESSION_COOKIE);
	event.locals.chronosSession = decodeChronosSession(sessionCookie);

	const locale = resolveLocale(
		event.cookies.get(LOCALE_COOKIE),
		event.request.headers.get('accept-language')
	);
	event.locals.locale = locale;

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', locale)
	});
};
