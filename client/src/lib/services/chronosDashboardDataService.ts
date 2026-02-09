import type { GameSummary } from '$lib/api/chronosTypes';
import type {
	AuthenticatedChronosUser,
	ChronosDashboardData,
	ChronosGameStatistics,
	ChronosGameSummaryWithMetadata
} from '../types/chronos';
import { determineIfGameBelongsToPlayer } from './chronosGameSummaryUtils';

export interface ChronosDashboardServiceDependencies {
	checkChronosHealthStatus: () => Promise<string>;
	listAllActiveChronosGames: (token: string) => Promise<GameSummary[]>;
	listAuthenticatedChronosPlayerActiveGames: (token: string) => Promise<GameSummary[]>;
	fetchMyChronosGameStatistics: (token: string) => Promise<Partial<ChronosGameStatistics>>;
}

export async function loadChronosDashboardDataForUser(
	token: string | null,
	authenticatedUser: AuthenticatedChronosUser | null,
	dependencies: ChronosDashboardServiceDependencies
): Promise<ChronosDashboardData> {
	const { backendHealthMessage } = await resolveBackendHealthStatus(dependencies);

	if (!token || !authenticatedUser) {
		return createEmptyChronosDashboardData(backendHealthMessage);
	}

	try {
		const { allActiveChronosGames, myActiveChronosGames } = await resolveActiveGameLists(
			token,
			authenticatedUser,
			dependencies
		);
		const statistics = await resolveChronosStatistics(token, dependencies);

		return {
			backendHealthMessage,
			myActiveChronosGames,
			allActiveChronosGames,
			statistics
		};
	} catch (error) {
		console.error('[Chronos] Failed to load dashboard data', error);
		return createEmptyChronosDashboardData(backendHealthMessage);
	}
}

async function resolveBackendHealthStatus(
	dependencies: ChronosDashboardServiceDependencies
): Promise<{ backendHealthMessage: string }> {
	try {
		const backendHealthMessage = await dependencies.checkChronosHealthStatus();
		return { backendHealthMessage };
	} catch (error) {
		console.error('[Chronos] Backend health check failed', error);
		return { backendHealthMessage: (error as Error).message };
	}
}

type RawGameSummary = Record<string, unknown>;

function toTimestampMillis(value: unknown): number {
	if (value instanceof Date) return value.getTime();
	if (typeof value === 'number') return value;
	if (typeof value === 'string') {
		const parsed = new Date(value).getTime();
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function toOptionalString(value: unknown): string | null {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	return null;
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const resolved: string[] = [];
	for (const item of value) {
		const stringValue = toOptionalString(item);
		if (stringValue) {
			resolved.push(stringValue);
		}
	}
	return resolved;
}

function convertApiGameSummaryToChronosMetadata(api: GameSummary): ChronosGameSummaryWithMetadata {
	const raw = api as RawGameSummary;

	const id =
		toOptionalString(raw.id) ??
		toOptionalString(raw.gameId) ??
		toOptionalString((raw as { gameIdentifier?: unknown }).gameIdentifier);
	if (!id) {
		throw new Error('Invalid GameSummary shape');
	}

	const playersFromPlayers = toStringArray(raw.players);
	const playersFromPlayerIds = toStringArray((raw as { playerIds?: unknown }).playerIds);

	const playerAId =
		toOptionalString(raw.playerAId) ?? playersFromPlayers[0] ?? playersFromPlayerIds[0];
	if (!playerAId) {
		throw new Error('Invalid GameSummary shape');
	}

	const playerBId =
		toOptionalString(raw.playerBId) ?? playersFromPlayers[1] ?? playersFromPlayerIds[1] ?? '';

	const combinedPlayers = [
		...playersFromPlayers,
		...playersFromPlayerIds,
		playerAId,
		playerBId
	].filter(Boolean);
	const players = Array.from(new Set(combinedPlayers));

	const lastActivityCandidate =
		raw.lastActivity ??
		(raw as { updatedAt?: unknown }).updatedAt ??
		(raw as { lastUpdate?: unknown }).lastUpdate ??
		(raw as { lastActivityAt?: unknown }).lastActivityAt ??
		(raw as { createdAt?: unknown }).createdAt;

	const mode = toOptionalString(raw.mode) ?? 'UNKNOWN';

	const gameId =
		toOptionalString(raw.gameId) ??
		toOptionalString((raw as { gameIdentifier?: unknown }).gameIdentifier) ??
		id;

	return {
		id,
		gameId,
		playerAId,
		playerBId,
		players,
		lastActivity: toTimestampMillis(lastActivityCandidate),
		mode
	};
}

async function resolveActiveGameLists(
	token: string,
	authenticatedUser: AuthenticatedChronosUser,
	dependencies: ChronosDashboardServiceDependencies
): Promise<{
	myActiveChronosGames: ChronosGameSummaryWithMetadata[];
	allActiveChronosGames: ChronosGameSummaryWithMetadata[];
}> {
	const isAdmin = authenticatedUser.role === 'ADMIN';
	if (!isAdmin) {
		const myApiGames = await dependencies.listAuthenticatedChronosPlayerActiveGames(token);
		const myActiveChronosGames = myApiGames.map(convertApiGameSummaryToChronosMetadata);
		return { myActiveChronosGames, allActiveChronosGames: [] };
	}

	const allApiGames = await dependencies.listAllActiveChronosGames(token);
	const allActiveChronosGames = allApiGames.map(convertApiGameSummaryToChronosMetadata);
	const myActiveChronosGames = allActiveChronosGames.filter((gameSummary) =>
		determineIfGameBelongsToPlayer(gameSummary, authenticatedUser.id)
	);
	return { myActiveChronosGames, allActiveChronosGames };
}

async function resolveChronosStatistics(
	token: string,
	dependencies: ChronosDashboardServiceDependencies
): Promise<ChronosGameStatistics> {
	const statisticsResponse = await dependencies.fetchMyChronosGameStatistics(token);
	return {
		gamesPlayed: statisticsResponse.gamesPlayed ?? 0,
		gamesWon: statisticsResponse.gamesWon ?? 0,
		gamesDrawn: statisticsResponse.gamesDrawn ?? 0
	};
}

function createEmptyChronosDashboardData(backendHealthMessage: string): ChronosDashboardData {
	return {
		backendHealthMessage,
		myActiveChronosGames: [],
		allActiveChronosGames: [],
		statistics: {
			gamesPlayed: 0,
			gamesWon: 0,
			gamesDrawn: 0
		}
	};
}
