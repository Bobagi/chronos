import type {
	ChronosFriendChatHistory,
	ChronosFriendChatMessage,
	ChronosFriendSummary,
	ChronosIncomingFriendRequest,
	ChronosPlayerSummary,
	GameMode,
	GameSummary
} from '$lib/api/chronosClientFactory';
import { createChronosClient } from '$lib/api/chronosClientFactory';
import {
	ChronosApiError,
	ensureJsonContentType,
	normalizeHeadersInitToObject
} from '$lib/api/chronosCommon';
export { ChronosApiError } from '$lib/api/chronosCommon';

interface ChronosRuntimeEnvironment extends ImportMetaEnv {
	VITE_API_BASE_URL?: string;
}

const runtimeEnvironmentVariables = import.meta.env as ChronosRuntimeEnvironment;
const DEFAULT_CHRONOS_BASE_URL = 'http://localhost:3053';

function resolveChronosBaseUrl(): string {
	const configuredChronosBaseUrl = runtimeEnvironmentVariables.VITE_API_BASE_URL;
	if (typeof configuredChronosBaseUrl === 'string' && configuredChronosBaseUrl.trim().length > 0) {
		return configuredChronosBaseUrl.trim().replace(/\/+$/, '');
	}
	return DEFAULT_CHRONOS_BASE_URL;
}

const resolvedChronosBaseUrl = resolveChronosBaseUrl();

export function getChronosBaseUrl(): string {
	return resolvedChronosBaseUrl;
}

function buildChronosApiUrl(path: string): string {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `${resolvedChronosBaseUrl}${normalizedPath}`;
}

async function performChronosApiRequest(
	path: string,
	init: RequestInit = {},
	token?: string
): Promise<Response> {
	const url = buildChronosApiUrl(path);
	const combinedHeaders = normalizeHeadersInitToObject(init.headers);
	if (token) {
		combinedHeaders.Authorization = `Bearer ${token}`;
	}
	const method = String(init.method ?? 'GET').toUpperCase();
	ensureJsonContentType(combinedHeaders, init.body);
	return fetch(url, { ...init, headers: combinedHeaders, method });
}

async function performChronosApiRequestReturningJson<T = unknown>(
	path: string,
	init: RequestInit = {},
	token?: string
): Promise<T> {
	const response = await performChronosApiRequest(path, init, token);

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
		rawFetch: performChronosApiRequest,
		requestJson: performChronosApiRequestReturningJson
	},
	{
		friendGamePath: '/game/start-with-friend',
		respondFriendRequest: (friendshipId, accept) => {
			const action = accept ? 'accept' : 'reject';
			return {
				path: `/friends/request/${encodeURIComponent(friendshipId)}/${action}`,
				init: { method: 'POST' }
			};
		},
		removeFriend: (friendshipId) => ({
			path: `/friends/${encodeURIComponent(friendshipId)}`,
			init: { method: 'DELETE' }
		})
	}
);

const {
	registerChronosUserAccount,
	fetchAuthenticatedChronosUserProfile: baseFetchAuthenticatedChronosUserProfile,
	startClassicChronosGameForPlayer,
	startAttributeDuelChronosGameForPlayer,
	startChronosGameWithAutomaticModeSelection,
	endChronosGameSessionOnServer,
	startChronosGameWithFriend: baseStartChronosGameWithFriend,
	surrenderChronosGame: baseSurrenderChronosGame,
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
	listAuthenticatedChronosPlayerActiveGames: baseListAuthenticatedChronosPlayerActiveGames,
	listAllActiveChronosGames,
	expireInactiveChronosGames,
	fetchMyChronosGameStatistics: baseFetchMyChronosGameStatistics,
	fetchChronosCardCatalog,
	checkChronosHealthStatus: baseCheckChronosHealthStatus,
	searchChronosPlayers: baseSearchChronosPlayers,
	listChronosFriends: baseListChronosFriends,
	listChronosFriendRequests: baseListChronosFriendRequests,
	sendChronosFriendRequest: baseSendChronosFriendRequest,
	respondChronosFriendRequest: baseRespondChronosFriendRequest,
	removeChronosFriend: baseRemoveChronosFriend,
	blockChronosPlayer: baseBlockChronosPlayer,
	fetchChronosFriendChat: baseFetchChronosFriendChat,
	sendChronosFriendMessage: baseSendChronosFriendMessage
} = chronosClient;

export function checkChronosHealthStatus(): Promise<string> {
	return baseCheckChronosHealthStatus();
}

export {
	registerChronosUserAccount,
	startClassicChronosGameForPlayer,
	startAttributeDuelChronosGameForPlayer,
	startChronosGameWithAutomaticModeSelection,
	endChronosGameSessionOnServer,
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
	listAllActiveChronosGames,
	expireInactiveChronosGames,
	fetchChronosCardCatalog
};

export async function loginChronosUserAccount(
	username: string,
	password: string
): Promise<{
	accessToken: string;
	user: { id: string; username: string; role: 'USER' | 'ADMIN' };
}> {
	return performChronosApiRequestReturningJson('/auth/login', {
		method: 'POST',
		body: JSON.stringify({ username, password })
	});
}

export function fetchAuthenticatedChronosUserProfile(
	token: string
): Promise<{ id: string; username: string; role: 'USER' | 'ADMIN' }> {
	return baseFetchAuthenticatedChronosUserProfile(token);
}

export function startChronosGameWithFriend(
	friendIdentifier: string,
	mode: GameMode,
	token: string
): Promise<{ gameId: string }> {
	return baseStartChronosGameWithFriend(friendIdentifier, mode, token);
}

export function surrenderChronosGame(gameIdentifier: string, token: string): Promise<unknown> {
	return baseSurrenderChronosGame(gameIdentifier, token);
}

export function listAuthenticatedChronosPlayerActiveGames(token: string): Promise<GameSummary[]> {
	return baseListAuthenticatedChronosPlayerActiveGames(token);
}

export function fetchMyChronosGameStatistics(
	token: string
): Promise<{ gamesPlayed: number; gamesWon: number; gamesDrawn: number }> {
	return baseFetchMyChronosGameStatistics(token);
}

export function searchChronosPlayers(
	query: string,
	token: string
): Promise<ChronosPlayerSummary[]> {
	return baseSearchChronosPlayers(query, token);
}

export function listChronosFriends(token: string): Promise<ChronosFriendSummary[]> {
	return baseListChronosFriends(token);
}

export function listChronosFriendRequests(token: string): Promise<ChronosIncomingFriendRequest[]> {
	return baseListChronosFriendRequests(token);
}

export function sendChronosFriendRequest(targetId: string, token: string): Promise<unknown> {
	return baseSendChronosFriendRequest(targetId, token);
}

export function respondChronosFriendRequest(
	friendshipId: string,
	accept: boolean,
	token: string
): Promise<unknown> {
	return baseRespondChronosFriendRequest(friendshipId, accept, token);
}

export function removeChronosFriend(friendshipId: string, token: string): Promise<unknown> {
	return baseRemoveChronosFriend(friendshipId, token);
}

export function blockChronosPlayer(targetId: string, token: string): Promise<unknown> {
	return baseBlockChronosPlayer(targetId, token);
}

export function fetchChronosFriendChat(
	friendId: string,
	token: string
): Promise<ChronosFriendChatHistory> {
	return baseFetchChronosFriendChat(friendId, token);
}

export function sendChronosFriendMessage(
	friendId: string,
	message: string,
	token: string
): Promise<ChronosFriendChatMessage> {
	return baseSendChronosFriendMessage(friendId, message, token);
}
