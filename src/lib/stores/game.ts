import type { AttributeKey, ChronosCard, DuelStage, GameMode } from '../../../shared';
import { writable } from 'svelte/store';

export type Card = ChronosCard;

export interface AttributeDuelCenterView {
  aCardCode?: string;
  bCardCode?: string;
  chosenAttribute?: AttributeKey;
  revealed?: boolean;
  chooserId?: string;
  deadlineAt?: number | null;
  aVal?: number;
  bVal?: number;
  roundWinner?: string | null;
}

export interface GameState {
  gameId?: string;
  players: string[];
  playerUsernames?: Record<string, string>;
  turn: number;
  lastActivity: number;
  turnDeadline?: number | null;
  winner: string | null;
  hp: Record<string, number>;
  hands: Record<string, string[]>;
  decks: Record<string, string[]>;
  log?: string[];
  mode: GameMode;
  duelStage?: DuelStage | null;
  duelCenter?: AttributeDuelCenterView | null;
  discardPiles?: Record<string, string[]> | null;
}

export const game = writable<GameState | null>(null);
