import { createChronosClient } from '$lib/api/chronosClientFactory';
import {
	ChronosApiError,
	ensureJsonContentType,
	normalizeHeadersInitToObject
} from '$lib/api/chronosCommon';

export type {
	Card,
	ChronosCardCatalogItem,
	ChronosCardCollection,
	ChronosFriendChatHistory,
	ChronosFriendChatMessage,
	ChronosFriendSummary,
	ChronosIncomingFriendRequest,
	ChronosPlayerSummary,
	GameMode,
	GameResult,
	GameSummary,
	GameState,
	ChronosRawCardPayload as ChronosRawCard
} from '$lib/api/chronosClientFactory';
export { ChronosApiError } from '$lib/api/chronosCommon';

const KAIROS_CHRONOS_PROXY_BASE_PATH = '/api/chronos';

function buildChronosProxyUrl(path: string): string {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `${KAIROS_CHRONOS_PROXY_BASE_PATH}${normalizedPath}`;
}

async function performKairosApiRequest(
	path: string,
	init: RequestInit = {},
	_token?: string
): Promise<Response> {
	const url = buildChronosProxyUrl(path);
	const combinedHeaders = normalizeHeadersInitToObject(init.headers);
	const method = String(init.method ?? 'GET').toUpperCase();
	ensureJsonContentType(combinedHeaders, init.body);
	return fetch(url, { ...init, headers: combinedHeaders, method });
}

async function performKairosApiRequestReturningJson<T = unknown>(
	path: string,
	init: RequestInit = {},
	token?: string
): Promise<T> {
	const response = await performKairosApiRequest(path, init, token);

	if (!response.ok) {
		let bodyText = '';
		try {
			bodyText = await response.text();
		} catch {
			bodyText = '';
		}

		let bodyJson: unknown | undefined;
		if (bodyText) {
			try {
				bodyJson = JSON.parse(bodyText);
			} catch {
				bodyJson = undefined;
			}
		}

		const method = String(init.method ?? 'GET').toUpperCase();

		throw new ChronosApiError({
			status: response.status,
			method,
			path,
			bodyText,
			bodyJson
		});
	}

	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		return (await response.json()) as T;
	}
	return null as unknown as T;
}

const chronosClient = createChronosClient(
	{
		rawFetch: performKairosApiRequest,
		requestJson: performKairosApiRequestReturningJson
	},
	{ friendGamePath: '/friends/start' }
);

const {
	checkChronosHealthStatus,
	registerChronosUserAccount,
	fetchAuthenticatedChronosUserProfile,
	startClassicChronosGameForPlayer,
	startAttributeDuelChronosGameForPlayer,
	startChronosGameWithAutomaticModeSelection,
	endChronosGameSessionOnServer,
	startChronosGameWithFriend,
	surrenderChronosGame,
	fetchChronosGameStateById,
	fetchChronosGameResult,
	playCardInChronosGame,
	skipChronosGameTurn,
	chooseChronosDuelCard,
	chooseChronosDuelAttribute,
	unchooseChronosDuelCard,
	advanceChronosDuel,
	fetchChronosCardMetadata,
	fetchMultipleChronosCardMetadata,
	listAuthenticatedChronosPlayerActiveGames,
	listAllActiveChronosGames,
	expireInactiveChronosGames,
	fetchMyChronosGameStatistics,
	fetchChronosCardCatalog,
	searchChronosPlayers,
	listChronosFriends,
	listChronosFriendRequests,
	sendChronosFriendRequest,
	respondChronosFriendRequest,
	removeChronosFriend,
	blockChronosPlayer,
	fetchChronosFriendChat,
	sendChronosFriendMessage
} = chronosClient;

export {
	checkChronosHealthStatus,
	registerChronosUserAccount,
	fetchAuthenticatedChronosUserProfile,
	startClassicChronosGameForPlayer,
	startAttributeDuelChronosGameForPlayer,
	startChronosGameWithAutomaticModeSelection,
	endChronosGameSessionOnServer,
	startChronosGameWithFriend,
	surrenderChronosGame,
	fetchChronosGameStateById,
	fetchChronosGameResult,
	playCardInChronosGame,
	skipChronosGameTurn,
	chooseChronosDuelCard,
	chooseChronosDuelAttribute,
	unchooseChronosDuelCard,
	advanceChronosDuel,
	fetchChronosCardMetadata,
	fetchMultipleChronosCardMetadata,
	listAuthenticatedChronosPlayerActiveGames,
	listAllActiveChronosGames,
	expireInactiveChronosGames,
	fetchMyChronosGameStatistics,
	fetchChronosCardCatalog,
	searchChronosPlayers,
	listChronosFriends,
	listChronosFriendRequests,
	sendChronosFriendRequest,
	respondChronosFriendRequest,
	removeChronosFriend,
	blockChronosPlayer,
	fetchChronosFriendChat,
	sendChronosFriendMessage
};

export async function loginChronosUserAccount(
	username: string,
	password: string
): Promise<{ user: { id: string; username: string; role: 'USER' | 'ADMIN' } }> {
	const response = await fetch('/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});

	if (!response.ok) {
		let message = 'Authentication failed.';
		try {
			const body = await response.json();
			if (typeof body?.message === 'string' && body.message.trim()) {
				message = body.message.trim();
			}
		} catch {
			// ignore JSON parse errors
		}
		throw new ChronosApiError({
			status: response.status,
			method: 'POST',
			path: '/api/auth/login',
			bodyText: message,
			bodyJson: undefined
		});
	}

	return (await response.json()) as {
		user: { id: string; username: string; role: 'USER' | 'ADMIN' };
	};
}

export async function fetchChronosProxy(path: string, init?: RequestInit): Promise<Response> {
	return fetch(buildChronosProxyUrl(path), init);
}
