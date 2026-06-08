import { json } from '@sveltejs/kit';
import { callBackendAuthed, requireSessionToken } from '$lib/server/auth/accountActions';
import { clearChronosSessionCookie } from '$lib/server/auth/cookies';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	const token = requireSessionToken(locals);
	await callBackendAuthed(token, '/auth/me', 'DELETE');
	clearChronosSessionCookie(cookies);
	return json({ ok: true });
};
