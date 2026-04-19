import type { ChronosRawCardPayload } from '$lib/api/chronosCommon';
import { convertChronosRawCardPayloadToCard } from '$lib/api/chronosCommon';
import type {
	Card,
	ChronosCardCatalogCollectionInfo,
	ChronosCardCatalogItem,
	ChronosCardCollection,
	ChronosFriendChatHistory,
	ChronosFriendChatMessage,
	ChronosFriendSummary,
	ChronosIncomingFriendRequest,
	ChronosPlayerSummary,
	GameMode,
	GameResult,
	GameState,
	GameSummary
} from '$lib/api/chronosTypes';

export interface ChronosClientAdapter {
	rawFetch: (path: string, init?: RequestInit, token?: string) => Promise<Response>;
	requestJson: <T>(path: string, init?: RequestInit, token?: string) => Promise<T>;
}

export interface ChronosClientOptions {
	friendGamePath?: string;
	respondFriendRequest?: (
		friendshipId: string,
		accept: boolean
	) => { path: string; init?: RequestInit };
	removeFriend?: (friendshipId: string) => { path: string; init?: RequestInit };
}

interface ChronosClientInternal extends ChronosClientAdapter {
	friendGamePath: string;
	respondFriendRequest: (
		friendshipId: string,
		accept: boolean
	) => { path: string; init?: RequestInit };
	removeFriend: (friendshipId: string) => { path: string; init?: RequestInit };
}

const defaultClientOptions: Pick<
	ChronosClientInternal,
	'friendGamePath' | 'respondFriendRequest' | 'removeFriend'
> = {
	friendGamePath: '/friends/start',
	respondFriendRequest: (friendshipId, accept) => ({
		path: '/friends/respond',
		init: {
			method: 'POST',
			body: JSON.stringify({ friendshipId, accept })
		}
	}),
	removeFriend: (friendshipId) => ({
		path: '/friends/remove',
		init: {
			method: 'POST',
			body: JSON.stringify({ friendshipId })
		}
	})
};

type ChronosCardCollectionPayload = Omit<ChronosCardCollection, 'name' | 'cards'> & {
	name?: string;
	cards?: ChronosCardCatalogItem[];
};

type ChronosCardCatalogApiResponse =
	| ChronosCardCollectionPayload[]
	| ChronosCardCatalogItem[]
	| {
			collections?: ChronosCardCollectionPayload[];
			cards?: ChronosCardCatalogItem[];
	  }
	| unknown;

type ChronosCardCollectionsApiResponse =
	| ChronosCardCollectionPayload[]
	| { collections?: ChronosCardCollectionPayload[] }
	| null
	| undefined;

function isChronosCardCatalogItem(candidate: unknown): candidate is ChronosCardCatalogItem {
	if (typeof candidate !== 'object' || candidate === null) {
		return false;
	}
	const maybeCard = candidate as Partial<ChronosCardCatalogItem>;
	return typeof maybeCard.code === 'string' && typeof maybeCard.name === 'string';
}

function normalizeChronosCardCatalogItem(card: ChronosCardCatalogItem): ChronosCardCatalogItem {
	const rawNumber = (card as { number?: number | string }).number;
	const normalizedNumber = Number(rawNumber ?? 0);
	return {
		...card,
		number: Number.isFinite(normalizedNumber) ? normalizedNumber : 0,
		imageUrl: card.image ?? card.imageUrl ?? ''
	};
}

function normalizeChronosCardCollectionPayload(
	collection: ChronosCardCollectionPayload,
	index: number
): ChronosCardCollection {
	const cards = Array.isArray(collection.cards) ? collection.cards : [];
	const normalizedCards = cards.map(normalizeChronosCardCatalogItem);
	const slug = collection.slug ?? collection.id ?? `collection-${index + 1}`;
	const name = collection.name ?? collection.slug ?? collection.id ?? `Collection ${index + 1}`;
	return {
		id: collection.id ?? slug,
		slug,
		name,
		description: collection.description ?? null,
		manufacturer: collection.manufacturer ?? null,
		releaseDate: collection.releaseDate ?? null,
		totalCards: collection.totalCards ?? normalizedCards.length,
		imageUrl: collection.imageUrl ?? null,
		cards: normalizedCards
	};
}

function groupChronosCardsIntoCollections(
	cards: ChronosCardCatalogItem[]
): ChronosCardCollection[] {
	if (!cards.length) {
		return [];
	}
	const groups = new Map<string, ChronosCardCollection>();
	cards.forEach((rawCard, index) => {
		const normalizedCard = normalizeChronosCardCatalogItem(rawCard);
		const fallbackKey = `collection-${index + 1}`;
		const collectionInfo = normalizedCard.collection ?? null;
		const key =
			collectionInfo?.slug ??
			normalizedCard.collectionSlug ??
			normalizedCard.collectionId ??
			collectionInfo?.name?.toLowerCase().replace(/\s+/g, '-') ??
			'card-catalog';
		const resolvedKey = key || fallbackKey;
		const existing = groups.get(resolvedKey);
		if (existing) {
			existing.cards = [...existing.cards, normalizedCard];
			return;
		}
		const resolvedName =
			collectionInfo?.name ??
			normalizedCard.collectionName ??
			normalizedCard.collectionSlug ??
			normalizedCard.collectionId ??
			'Card Catalog';
		groups.set(resolvedKey, {
			id: collectionInfo?.id ?? normalizedCard.collectionId ?? resolvedKey,
			slug: collectionInfo?.slug ?? normalizedCard.collectionSlug ?? resolvedKey,
			name: resolvedName,
			description: collectionInfo?.description ?? null,
			manufacturer: collectionInfo?.manufacturer ?? null,
			releaseDate: collectionInfo?.releaseDate ?? null,
			totalCards: collectionInfo?.totalCards ?? null,
			imageUrl: collectionInfo?.imageUrl ?? normalizedCard.collectionImageUrl ?? null,
			cards: [normalizedCard]
		});
	});
	return Array.from(groups.values()).map((collection, idx) => ({
		...collection,
		id: collection.id ?? collection.slug ?? `collection-${idx + 1}`,
		slug: collection.slug ?? collection.id ?? `collection-${idx + 1}`,
		name: collection.name || collection.slug || `Collection ${idx + 1}`,
		totalCards: collection.totalCards ?? collection.cards.length,
		cards: [...collection.cards]
	}));
}

function normalizeChronosCardCatalogResponse(
	data: ChronosCardCatalogApiResponse
): ChronosCardCollection[] {
	if (Array.isArray(data)) {
		if (data.every((entry) => typeof entry === 'object' && entry !== null && 'cards' in entry)) {
			return (data as ChronosCardCollectionPayload[]).map((entry, index) =>
				normalizeChronosCardCollectionPayload(entry, index)
			);
		}
		if (data.every(isChronosCardCatalogItem)) {
			return groupChronosCardsIntoCollections(data);
		}
	}
	if (typeof data === 'object' && data !== null) {
		const withCollections = data as { collections?: ChronosCardCollectionPayload[] };
		if (Array.isArray(withCollections.collections)) {
			return withCollections.collections.map((entry, index) =>
				normalizeChronosCardCollectionPayload(entry, index)
			);
		}
		const withCards = data as { cards?: ChronosCardCatalogItem[] };
		if (Array.isArray(withCards.cards) && withCards.cards.every(isChronosCardCatalogItem)) {
			return groupChronosCardsIntoCollections(withCards.cards);
		}
	}
	return [];
}

function normalizeChronosCardCollectionsListResponse(
	data: ChronosCardCollectionsApiResponse
): ChronosCardCollection[] {
	if (Array.isArray(data)) {
		return data.map((entry, index) => normalizeChronosCardCollectionPayload(entry, index));
	}
	if (typeof data === 'object' && data !== null) {
		const withCollections = data as { collections?: ChronosCardCollectionPayload[] };
		if (Array.isArray(withCollections.collections)) {
			return withCollections.collections.map((entry, index) =>
				normalizeChronosCardCollectionPayload(entry, index)
			);
		}
	}
	return [];
}

function buildCollectionInfoFromChronosCollection(
	collection: ChronosCardCollection
): ChronosCardCatalogCollectionInfo {
	return {
		id: collection.id,
		slug: collection.slug,
		name: collection.name,
		description: collection.description ?? null,
		manufacturer: collection.manufacturer ?? null,
		releaseDate: collection.releaseDate ?? null,
		totalCards: collection.totalCards ?? null,
		imageUrl: collection.imageUrl ?? null
	};
}

function attachCollectionInfoToChronosCard(
	card: ChronosCardCatalogItem,
	collection: ChronosCardCollection
): ChronosCardCatalogItem {
	const normalizedCard = normalizeChronosCardCatalogItem(card);
	const resolvedCollectionInfo =
		normalizedCard.collection ?? buildCollectionInfoFromChronosCollection(collection);
	return {
		...normalizedCard,
		collectionId: normalizedCard.collectionId ?? collection.id ?? undefined,
		collectionSlug: normalizedCard.collectionSlug ?? collection.slug ?? undefined,
		collectionName: normalizedCard.collectionName ?? collection.name,
		collectionImageUrl: normalizedCard.collectionImageUrl ?? collection.imageUrl ?? null,
		collection: resolvedCollectionInfo
	};
}

export interface ChronosClient {
	checkChronosHealthStatus: (token?: string) => Promise<string>;
	registerChronosUserAccount: (
		username: string,
		password: string,
		token?: string
	) => Promise<{
		accessToken: string;
		user: { id: string; username: string; role: 'USER' | 'ADMIN' };
	}>;
	fetchAuthenticatedChronosUserProfile: (
		token?: string
	) => Promise<{ id: string; username: string; role: 'USER' | 'ADMIN' }>;
	startClassicChronosGameForPlayer: (
		playerIdentifier: string,
		token?: string
	) => Promise<{ gameId: string }>;
	startAttributeDuelChronosGameForPlayer: (
		playerIdentifier: string,
		token?: string
	) => Promise<{ gameId: string }>;
	startChronosGameWithAutomaticModeSelection: (
		playerIdentifier: string,
		token?: string
	) => Promise<{ gameId: string }>;
	endChronosGameSessionOnServer: (gameIdentifier: string, token?: string) => Promise<unknown>;
	startChronosGameWithFriend: (
		friendId: string,
		mode: GameMode,
		token?: string
	) => Promise<{ gameId: string }>;
	surrenderChronosGame: (gameIdentifier: string, token?: string) => Promise<unknown>;
	fetchChronosGameStateById: (gameIdentifier: string, token?: string) => Promise<GameState | null>;
	fetchChronosGameResult: (gameIdentifier: string, token?: string) => Promise<GameResult>;
	playCardInChronosGame: (
		gameIdentifier: string,
		playerIdentifier: string,
		cardCode: string,
		token?: string
	) => Promise<unknown>;
	skipChronosGameTurn: (
		gameIdentifier: string,
		playerIdentifier: string,
		token?: string
	) => Promise<unknown>;
	chooseChronosDuelCard: (
		gameIdentifier: string,
		playerIdentifier: string,
		cardCode: string,
		token?: string
	) => Promise<unknown>;
	chooseChronosDuelAttribute: (
		gameIdentifier: string,
		playerIdentifier: string,
		attributeCode: string,
		token?: string
	) => Promise<unknown>;
	unchooseChronosDuelCard: (
		gameIdentifier: string,
		playerIdentifier: string,
		cardCode: string,
		token?: string
	) => Promise<unknown>;
	advanceChronosDuel: (gameIdentifier: string, token?: string) => Promise<unknown>;
	fetchChronosCardMetadata: (cardCode: string, token?: string) => Promise<Card>;
	fetchMultipleChronosCardMetadata: (cardCodes: string[], token?: string) => Promise<Card[]>;
	listAuthenticatedChronosPlayerActiveGames: (token?: string) => Promise<GameSummary[]>;
	listAllActiveChronosGames: (token?: string) => Promise<GameSummary[]>;
	expireInactiveChronosGames: (token?: string) => Promise<unknown>;
	fetchMyChronosGameStatistics: (
		token?: string
	) => Promise<{ gamesPlayed: number; gamesWon: number; gamesDrawn: number }>;
	fetchChronosCardCatalog: (token?: string) => Promise<ChronosCardCollection[]>;
	searchChronosPlayers: (query: string, token?: string) => Promise<ChronosPlayerSummary[]>;
	listChronosFriends: (token?: string) => Promise<ChronosFriendSummary[]>;
	listChronosFriendRequests: (token?: string) => Promise<ChronosIncomingFriendRequest[]>;
	sendChronosFriendRequest: (targetId: string, token?: string) => Promise<unknown>;
	respondChronosFriendRequest: (
		friendshipId: string,
		accept: boolean,
		token?: string
	) => Promise<unknown>;
	removeChronosFriend: (friendshipId: string, token?: string) => Promise<unknown>;
	blockChronosPlayer: (targetId: string, token?: string) => Promise<unknown>;
	fetchChronosFriendChat: (friendId: string, token?: string) => Promise<ChronosFriendChatHistory>;
	sendChronosFriendMessage: (
		friendId: string,
		message: string,
		token?: string
	) => Promise<ChronosFriendChatMessage>;
}

export function createChronosClient(
	adapter: ChronosClientAdapter,
	options?: ChronosClientOptions
): ChronosClient {
	const resolvedOptions: ChronosClientInternal = {
		rawFetch: adapter.rawFetch,
		requestJson: adapter.requestJson,
		friendGamePath: options?.friendGamePath ?? defaultClientOptions.friendGamePath,
		respondFriendRequest:
			options?.respondFriendRequest ?? defaultClientOptions.respondFriendRequest,
		removeFriend: options?.removeFriend ?? defaultClientOptions.removeFriend
	};
	const { rawFetch, requestJson, friendGamePath, respondFriendRequest, removeFriend } =
		resolvedOptions;
	const chronosCardMetadataCache = new Map<string, Card>();

	async function populateChronosCollectionCards(
		collection: ChronosCardCollection,
		token?: string
	): Promise<ChronosCardCollection> {
		const identifier = collection.slug ?? collection.id;
		if (!identifier) {
			return collection;
		}
		const cards = await requestJson<ChronosCardCatalogItem[]>(
			`/game/collections/${encodeURIComponent(identifier)}/cards`,
			undefined,
			token
		);
		const normalizedCards = cards.map((card) =>
			attachCollectionInfoToChronosCard(card, collection)
		);
		return {
			...collection,
			cards: normalizedCards,
			totalCards: collection.totalCards ?? normalizedCards.length
		};
	}

	async function fetchChronosCollectionsUsingNewEndpoint(
		token?: string
	): Promise<ChronosCardCollection[]> {
		try {
			const response = await requestJson<ChronosCardCollectionsApiResponse>(
				'/game/collections',
				undefined,
				token
			);
			const normalizedCollections = normalizeChronosCardCollectionsListResponse(response);
			if (!normalizedCollections.length) {
				return [];
			}
			const populationTasks = normalizedCollections.map((collection) =>
				populateChronosCollectionCards(collection, token).catch(() => collection)
			);
			return Promise.all(populationTasks);
		} catch {
			return [];
		}
	}

	async function fetchLegacyChronosCardCatalog(token?: string): Promise<ChronosCardCollection[]> {
		const response = await requestJson<ChronosCardCatalogApiResponse>(
			'/game/cards',
			undefined,
			token
		);
		return normalizeChronosCardCatalogResponse(response);
	}

	interface ChronosHealthStatusResponsePayload {
		status?: string;
		message?: string;
		timestamp?: string;
		uptimeInSeconds?: number;
	}

	function normalizeChronosHealthStatusText(status?: string): string | null {
		if (!status) {
			return null;
		}
		const normalizedStatus = status.trim().toLowerCase();
		return normalizedStatus || null;
	}

	function tryParseChronosHealthStatusPayload(
		bodyText: string
	): ChronosHealthStatusResponsePayload | null {
		try {
			const parsed = JSON.parse(bodyText) as ChronosHealthStatusResponsePayload;
			if (parsed && typeof parsed === 'object') {
				return parsed;
			}
			return null;
		} catch {
			return null;
		}
	}

	function buildChronosHealthStatusMessage(bodyText: string): string {
		const trimmedText = bodyText.trim();
		if (!trimmedText) {
			return 'Server status unknown';
		}
		const payload = tryParseChronosHealthStatusPayload(trimmedText);
		if (payload) {
			const normalizedStatus = normalizeChronosHealthStatusText(payload.status);
			if (normalizedStatus === 'ok' || normalizedStatus === 'online') {
				return 'online';
			}
			if (normalizedStatus === 'offline') {
				return 'offline';
			}
			if (normalizedStatus === 'degraded') {
				return 'partially online';
			}
			if (normalizedStatus) {
				return `Server status: ${normalizedStatus}`;
			}
			if (payload.message && payload.message.trim()) {
				return payload.message.trim();
			}
		}
		return trimmedText;
	}

	async function checkChronosHealthStatus(token?: string): Promise<string> {
		const response = await rawFetch('/health', undefined, token);
		const bodyText = await response.text();
		if (!response.ok) {
			throw new Error(`Health-check failed: ${response.status}`);
		}
		return buildChronosHealthStatusMessage(bodyText);
	}

	async function fetchChronosGameStateById(
		gameIdentifier: string,
		token?: string
	): Promise<GameState | null> {
		const response = await rawFetch(
			`/game/state/${encodeURIComponent(gameIdentifier)}`,
			undefined,
			token
		);
		if (!response.ok) {
			throw new Error(`Failed to fetch game state: ${response.status}`);
		}
		return (await response.json()) as GameState | null;
	}

	async function fetchChronosCardMetadata(cardCode: string, token?: string): Promise<Card> {
		const cachedCard = chronosCardMetadataCache.get(cardCode);
		if (cachedCard) {
			return cachedCard;
		}

		const normalizedCard = convertChronosRawCardPayloadToCard(
			await requestJson<ChronosRawCardPayload>(
				`/game/cards/${encodeURIComponent(cardCode)}`,
				undefined,
				token
			)
		);
		chronosCardMetadataCache.set(cardCode, normalizedCard);
		return normalizedCard;
	}

	async function fetchMultipleChronosCardMetadata(
		cardCodes: string[],
		token?: string
	): Promise<Card[]> {
		const cardCodesMissingFromCache = cardCodes.filter(
			(candidateCode) => !chronosCardMetadataCache.has(candidateCode)
		);
		if (cardCodesMissingFromCache.length > 0) {
			try {
				const rawCards = await requestJson<ChronosRawCardPayload[]>(
					`/game/cards?codes=${cardCodesMissingFromCache
						.map((code) => encodeURIComponent(code))
						.join(',')}`,
					undefined,
					token
				);
				for (const rawCard of rawCards) {
					if (rawCard && rawCard.code) {
						chronosCardMetadataCache.set(rawCard.code, convertChronosRawCardPayloadToCard(rawCard));
					}
				}
			} catch {
				const allCards = await requestJson<ChronosRawCardPayload[]>(
					'/game/cards',
					undefined,
					token
				);
				for (const missingCode of cardCodesMissingFromCache) {
					const fallbackCard = allCards.find((candidateCard) => candidateCard.code === missingCode);
					if (fallbackCard) {
						chronosCardMetadataCache.set(
							missingCode,
							convertChronosRawCardPayloadToCard(fallbackCard)
						);
					}
				}
			}
		}

		const resolvedCards: Card[] = [];
		for (const cardCode of cardCodes) {
			const cachedCard = chronosCardMetadataCache.get(cardCode);
			if (cachedCard) {
				resolvedCards.push(cachedCard);
			}
		}
		return resolvedCards;
	}

	async function listAuthenticatedChronosPlayerActiveGames(token?: string): Promise<GameSummary[]> {
		const response = await rawFetch('/game/active/mine', undefined, token);
		if (!response.ok) return [];
		return (await response.json()) as GameSummary[];
	}

	return {
		checkChronosHealthStatus,
		registerChronosUserAccount: (username, password, token) =>
			requestJson(
				'/auth/register',
				{
					method: 'POST',
					body: JSON.stringify({ username, password })
				},
				token
			),
		fetchAuthenticatedChronosUserProfile: (token) => requestJson('/auth/me', undefined, token),
		startClassicChronosGameForPlayer: (playerIdentifier, token) =>
			requestJson(
				'/game/start-classic',
				{
					method: 'POST',
					body: JSON.stringify({ playerAId: playerIdentifier })
				},
				token
			),
		startAttributeDuelChronosGameForPlayer: (playerIdentifier, token) =>
			requestJson(
				'/game/start-duel',
				{
					method: 'POST',
					body: JSON.stringify({ playerAId: playerIdentifier })
				},
				token
			),
		startChronosGameWithAutomaticModeSelection: (playerIdentifier, token) =>
			requestJson(
				'/game/start',
				{
					method: 'POST',
					body: JSON.stringify({ playerAId: playerIdentifier })
				},
				token
			),
		endChronosGameSessionOnServer: (gameIdentifier, token) =>
			requestJson(`/game/end/${encodeURIComponent(gameIdentifier)}`, { method: 'DELETE' }, token),
		startChronosGameWithFriend: (friendId, mode, token) =>
			requestJson(
				friendGamePath,
				{
					method: 'POST',
					body: JSON.stringify({ friendId, mode })
				},
				token
			),
		surrenderChronosGame: (gameIdentifier, token) =>
			requestJson(
				'/game/surrender',
				{
					method: 'POST',
					body: JSON.stringify({ gameId: gameIdentifier })
				},
				token
			),
		fetchChronosGameStateById,
		fetchChronosGameResult: (gameIdentifier, token) =>
			requestJson(`/game/result/${encodeURIComponent(gameIdentifier)}`, undefined, token),
		playCardInChronosGame: (gameIdentifier, playerIdentifier, cardCode, token) =>
			requestJson(
				'/game/play-card',
				{
					method: 'POST',
					body: JSON.stringify({
						gameId: gameIdentifier,
						player: playerIdentifier,
						card: cardCode
					})
				},
				token
			),
		skipChronosGameTurn: (gameIdentifier, playerIdentifier, token) =>
			requestJson(
				'/game/skip-turn',
				{
					method: 'POST',
					body: JSON.stringify({ gameId: gameIdentifier, player: playerIdentifier })
				},
				token
			),
		chooseChronosDuelCard: (gameIdentifier, playerIdentifier, cardCode, token) =>
			requestJson(
				`/game/${encodeURIComponent(gameIdentifier)}/duel/choose-card`,
				{
					method: 'POST',
					body: JSON.stringify({ playerId: playerIdentifier, cardCode })
				},
				token
			),
		chooseChronosDuelAttribute: (gameIdentifier, playerIdentifier, attributeCode, token) =>
			requestJson(
				`/game/${encodeURIComponent(gameIdentifier)}/duel/choose-attribute`,
				{
					method: 'POST',
					body: JSON.stringify({ playerId: playerIdentifier, attribute: attributeCode })
				},
				token
			),
		unchooseChronosDuelCard: (gameIdentifier, playerIdentifier, cardCode, token) =>
			requestJson(
				`/game/${encodeURIComponent(gameIdentifier)}/duel/unchoose-card`,
				{
					method: 'POST',
					body: JSON.stringify({ playerId: playerIdentifier, cardCode })
				},
				token
			),
		advanceChronosDuel: (gameIdentifier, token) =>
			requestJson(
				`/game/${encodeURIComponent(gameIdentifier)}/duel/advance`,
				{ method: 'POST' },
				token
			),
		fetchChronosCardMetadata,
		fetchMultipleChronosCardMetadata,
		listAuthenticatedChronosPlayerActiveGames,
		listAllActiveChronosGames: (token) => requestJson('/game/active', undefined, token),
		expireInactiveChronosGames: (token) => requestJson('/game/expire', { method: 'POST' }, token),
		fetchMyChronosGameStatistics: (token) => requestJson('/game/stats/me', undefined, token),
		fetchChronosCardCatalog: async (token) => {
			const collections = await fetchChronosCollectionsUsingNewEndpoint(token);
			if (collections.length > 0) {
				return collections;
			}
			return fetchLegacyChronosCardCatalog(token);
		},
		searchChronosPlayers: (query, token) => {
			const trimmed = query.trim();
			if (!trimmed) return Promise.resolve([]);
			return requestJson(`/friends/search?q=${encodeURIComponent(trimmed)}`, undefined, token);
		},
		listChronosFriends: (token) => requestJson('/friends', undefined, token),
		listChronosFriendRequests: (token) => requestJson('/friends/requests', undefined, token),
		sendChronosFriendRequest: (targetId, token) =>
			requestJson(
				'/friends/request',
				{ method: 'POST', body: JSON.stringify({ targetId }) },
				token
			),
		respondChronosFriendRequest: (friendshipId, accept, token) => {
			const { path, init } = respondFriendRequest(friendshipId, accept);
			return requestJson(path, init, token);
		},
		removeChronosFriend: (friendshipId, token) => {
			const { path, init } = removeFriend(friendshipId);
			return requestJson(path, init, token);
		},
		blockChronosPlayer: (targetId, token) =>
			requestJson(
				'/friends/block',
				{
					method: 'POST',
					body: JSON.stringify({ targetId })
				},
				token
			),
		fetchChronosFriendChat: (friendId, token) =>
			requestJson(`/friends/chat/${encodeURIComponent(friendId)}`, undefined, token),
		sendChronosFriendMessage: (friendId, message, token) =>
			requestJson(
				`/friends/chat/${encodeURIComponent(friendId)}`,
				{
					method: 'POST',
					body: JSON.stringify({ message })
				},
				token
			)
	};
}

export type {
	Card,
	ChronosCardCatalogItem,
	ChronosCardCollection,
	ChronosFriendChatHistory,
	ChronosFriendChatMessage,
	ChronosFriendSummary,
	ChronosIncomingFriendRequest,
	ChronosPlayerSummary,
	ChronosRawCardPayload,
	GameMode,
	GameResult,
	GameState,
	GameSummary
};
