import type { GameMode } from '../game/game-enums';
import type { GameSummary } from '../game/game-summaries.types';

export interface ChronosGameStatistics {
  gamesPlayed: number;
  gamesWon: number;
  gamesDrawn: number;
}

export interface ChronosGameSummaryWithMetadata extends GameSummary {
  gameId: string;
  playerBId: string;
  players: string[];
  lastActivity: number;
  mode: GameMode;
}

export interface ChronosDashboardData {
  backendHealthMessage: string;
  myActiveChronosGames: ChronosGameSummaryWithMetadata[];
  allActiveChronosGames: ChronosGameSummaryWithMetadata[];
  statistics: ChronosGameStatistics;
}
