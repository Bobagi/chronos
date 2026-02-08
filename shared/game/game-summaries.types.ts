import type { GameMode } from './game-enums';

export interface GameSummaryMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export interface GameSummary {
  id: string;
  playerAId: string;
  mode: GameMode;
  metadata?: GameSummaryMetadata;
}

export interface GameResult {
  winner: string | null;
  log: string[];
}
