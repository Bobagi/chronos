import { json } from '@sveltejs/kit';
import { callBackendAuthed, requireSessionToken } from '$lib/server/auth/accountActions';
import { setChronosSessionCookie } from '$lib/server/auth/cookies';
import type { AuthenticatedChronosUser } from '$lib/types/chronos';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	const token = requireSessionToken(locals);
	const body = await request.json().catch(() => ({}));
	const user = (await callBackendAuthed(token, '/auth/username', 'PATCH', {
		username: body?.username
	})) as AuthenticatedChronosUser;
	setChronosSessionCookie(cookies, { token, user });
	return json({ user });
};
