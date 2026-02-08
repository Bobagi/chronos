import type { AttributeKey, DuelStage, GameMode } from './game-enums';

export type PlayerCardCollection = Record<string, string[]>;

export type PlayerHealthCollection = Record<string, number>;

export type PlayerUsernameCollection = Record<string, string>;

export interface DuelCenterState {
  playerACardCode: string | null;
  playerBCardCode: string | null;
  chosenAttribute: AttributeKey | null;
  isRevealed: boolean;
  chooserId: string | null;
  playerAAttributeValue: number | null;
  playerBAttributeValue: number | null;
  roundWinnerId: string | null;
  deadlineAt: number | null;
}

export interface GameStateSnapshot {
  players: [string, string];
  playerUsernames: PlayerUsernameCollection;
  turn: number;
  log: string[];
  hp: PlayerHealthCollection;
  winner: string | null;
  hands: PlayerCardCollection;
  decks: PlayerCardCollection;
  lastActivity: number;
  turnDeadline: number | null;
  mode: GameMode;
  duelStage: DuelStage | null;
  duelCenter: DuelCenterState | null;
  discardPiles: PlayerCardCollection | null;
}
