import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Start of the Google OAuth 2.0 flow (scaffold).
 *
 * When GOOGLE_CLIENT_ID is configured we redirect to Google's consent screen;
 * otherwise we report that sign-in isn't configured yet. The callback
 * (./callback) still needs the token exchange + Player/session wiring before
 * this is fully functional — see CLAUDE.md ("Google sign-in").
 */
export const GET: RequestHandler = ({ url }) => {
	const clientId = env.GOOGLE_CLIENT_ID;
	if (!clientId) {
		throw error(503, 'Google sign-in is not configured yet.');
	}

	const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${url.origin}/auth/google/callback`;
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		access_type: 'offline',
		include_granted_scopes: 'true',
		prompt: 'select_account'
		// TODO: add a random, signed `state` value (stored in a short-lived cookie)
		// and verify it in the callback to protect against CSRF.
	});

	throw redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};
