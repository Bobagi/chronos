import type { Card, GameState } from '$lib/stores/game';

export type { Card, GameState };

export type GameMode = 'CLASSIC' | 'ATTRIBUTE_DUEL';

export interface GameSummary {
	id: string;
	playerAId: string;
	mode: GameMode | string;
	[key: string]: unknown;
}

export interface GameResult {
	winner: string | null;
	log: string[];
}

export interface ChronosPlayerSummary {
	id: string;
	username: string;
}

export interface ChronosFriendSummary {
	friendshipId: string;
	friend: ChronosPlayerSummary;
	status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
	blockedByMe: boolean;
}

export interface ChronosIncomingFriendRequest {
	friendshipId: string;
	requester: ChronosPlayerSummary;
	createdAt: string;
}

export interface ChronosFriendChatMessage {
	id: string;
	senderId: string;
	recipientId: string;
	body: string;
	createdAt: string;
}

export interface ChronosFriendChatHistory {
	friendshipId: string;
	messages: ChronosFriendChatMessage[];
}

export interface ChronosCardCatalogCollectionInfo {
	id?: string;
	slug?: string;
	name?: string;
	description?: string | null;
	manufacturer?: string | null;
	releaseDate?: string | null;
	totalCards?: number | null;
	imageUrl?: string | null;
}

export interface ChronosCardCatalogItem {
	code: string;
	name: string;
	description: string;
	image?: string;
	imageUrl?: string;
	might: number;
	fire: number;
	magic: number;
	number: number;
	collectionId?: string;
	collectionSlug?: string;
	collectionName?: string;
	collectionImageUrl?: string | null;
	collection?: ChronosCardCatalogCollectionInfo;
}

export interface ChronosCardCollection extends ChronosCardCatalogCollectionInfo {
	name: string;
	cards: ChronosCardCatalogItem[];
}
