import { getChronosBaseUrl } from '$lib/server/chronos/client';
import type { RequestEvent, RequestHandler } from './$types';

async function proxyChronosRequest(event: RequestEvent): Promise<Response> {
	const baseUrl = getChronosBaseUrl();
	const rawPath = event.params.chronosPath ?? '';
	const normalizedPath = rawPath ? rawPath.replace(/^\/+/, '') : '';
	const targetUrl = normalizedPath ? `${baseUrl}/${normalizedPath}` : `${baseUrl}/`;
	const finalUrl = event.url.search ? `${targetUrl}${event.url.search}` : targetUrl;

	const headers = new Headers(event.request.headers);
	headers.delete('host');
	headers.delete('content-length');
	headers.delete('connection');
	headers.delete('Connection');
	headers.delete('upgrade');
	headers.delete('Upgrade');
	headers.delete('keep-alive');
	headers.delete('Keep-Alive');
	headers.delete('proxy-connection');
	headers.delete('Proxy-Connection');
	headers.delete('transfer-encoding');
	headers.delete('Transfer-Encoding');

	const token = event.locals.chronosSession?.token;
	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	} else {
		headers.delete('Authorization');
	}

	// Forward the visitor's chosen language so the backend can localize card
	// content (the gallery catalog). Resolved in hooks from the locale cookie.
	if (event.locals.locale) {
		headers.set('x-chronos-locale', event.locals.locale);
	}

	const method = event.request.method.toUpperCase();
	const init: RequestInit = { method, headers };

	if (method !== 'GET' && method !== 'HEAD') {
		const bodyBuffer = await event.request.arrayBuffer();
		init.body = bodyBuffer;
	}

	let chronosResponse: Response;
	try {
		chronosResponse = await fetch(finalUrl, init);
	} catch (error) {
		console.error(`[@chronos-proxy] ${method} ${finalUrl} failed`, error);
		throw error;
	}

	if (!chronosResponse.ok) {
		try {
			const errorBody = await chronosResponse.clone().text();
			if (errorBody) {
				console.error(`[@chronos-proxy] ${method} ${finalUrl} body ← ${errorBody}`);
			}
		} catch (bodyError) {
			console.error(`[@chronos-proxy] ${method} ${finalUrl} unable to read body`, bodyError);
		}
	}

	const responseHeaders = new Headers(chronosResponse.headers);
	responseHeaders.delete('set-cookie');

	return new Response(chronosResponse.body, {
		status: chronosResponse.status,
		headers: responseHeaders
	});
}

const handler: RequestHandler = (event) => proxyChronosRequest(event);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
