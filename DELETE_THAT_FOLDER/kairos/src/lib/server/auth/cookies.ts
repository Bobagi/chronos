import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { ChronosSession } from './session';

const CHRONOS_SESSION_COOKIE = 'chronos_session';
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

type MaybeChronosSession = ChronosSession | null;

function encodeChronosSession(session: ChronosSession): string {
	const json = JSON.stringify(session);
	return Buffer.from(json, 'utf8').toString('base64url');
}

function decodeChronosSession(serialized: string | undefined | null): MaybeChronosSession {
	if (!serialized) {
		return null;
	}
	try {
		const json = Buffer.from(serialized, 'base64url').toString('utf8');
		const parsed = JSON.parse(json) as ChronosSession;
		if (
			!parsed ||
			typeof parsed.token !== 'string' ||
			typeof parsed.user !== 'object' ||
			parsed.user === null
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function setChronosSessionCookie(cookies: Cookies, session: ChronosSession): void {
	cookies.set(CHRONOS_SESSION_COOKIE, encodeChronosSession(session), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: SESSION_COOKIE_MAX_AGE_SECONDS
	});
}

function clearChronosSessionCookie(cookies: Cookies): void {
	cookies.delete(CHRONOS_SESSION_COOKIE, { path: '/' });
}

export {
	CHRONOS_SESSION_COOKIE,
	clearChronosSessionCookie,
	decodeChronosSession,
	encodeChronosSession,
	setChronosSessionCookie
};
