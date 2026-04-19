export type ChronosUserRole = 'USER' | 'ADMIN';

export interface AuthenticatedChronosUser {
	id: string;
	username: string;
	role: ChronosUserRole;
}

export interface ChronosGameStatistics {
	gamesPlayed: number;
	gamesWon: number;
	gamesDrawn: number;
}

export interface ChronosGameSummaryWithMetadata {
	id: string;
	gameId: string;
	playerAId: string;
	playerBId: string;
	players: string[];
	lastActivity: number;
	mode: string;
}

export interface ChronosDashboardData {
	backendHealthMessage: string;
	myActiveChronosGames: ChronosGameSummaryWithMetadata[];
	allActiveChronosGames: ChronosGameSummaryWithMetadata[];
	statistics: ChronosGameStatistics;
}
