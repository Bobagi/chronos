import { json } from '@sveltejs/kit';
import { callBackendAuthed, requireSessionToken } from '$lib/server/auth/accountActions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const token = requireSessionToken(locals);
	const body = await request.json().catch(() => ({}));
	await callBackendAuthed(token, '/auth/password', 'PATCH', {
		currentPassword: body?.currentPassword,
		newPassword: body?.newPassword
	});
	return json({ ok: true });
};
