import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setChronosSessionCookie } from '$lib/server/auth/cookies';
import {
	ChronosApiError,
	fetchAuthenticatedChronosUserProfile,
	loginChronosUserAccount
} from '$lib/server/chronos/client';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => null);
	const username = typeof body?.username === 'string' ? body.username.trim() : '';
	const password = typeof body?.password === 'string' ? body.password : '';

	if (!username || !password) {
		return json({ message: 'Username and password are required.' }, { status: 400 });
	}

	try {
		const { accessToken, user } = await loginChronosUserAccount(username, password);
		const resolvedUser = await fetchAuthenticatedChronosUserProfile(accessToken).catch(() => user);
		setChronosSessionCookie(cookies, { token: accessToken, user: resolvedUser });
		return json({ user: resolvedUser });
	} catch (error) {
		if (error instanceof ChronosApiError) {
			return json(
				{ message: error.bodyText || 'Authentication failed.' },
				{ status: error.status }
			);
		}
		return json({ message: 'Authentication failed.' }, { status: 500 });
	}
};
