import {
  Prisma,
  DuelStage as PrismaDuelStage,
  GameMode as PrismaGameMode,
} from '@prisma/client';

export const BOT_ID = 'BOT';

export interface GameState {
  players: string[];
  turn: number;
  log: string[];
  hp: Record<string, number>;
  winner: string | null;
  hands: Record<string, string[]>;
  decks: Record<string, string[]>;
  lastActivity: number;
  mode: PrismaGameMode;
  duelStage?: PrismaDuelStage | null;
  duelCenter?: {
    aCardCode?: string;
    bCardCode?: string;
    chosenAttribute?: 'magic' | 'might' | 'fire';
    revealed?: boolean;
    chooserId?: string;
    aVal?: number;
    bVal?: number;
    roundWinner?: string | null;
  } | null;
  discardPiles?: Record<string, string[]> | null;
}

export function drawRandomCardsFromDeck(deck: string[], pullCount: number) {
  const drawnCards: string[] = [];
  for (let index = 0; index < pullCount && deck.length > 0; index++) {
    const randomIndex = Math.floor(Math.random() * deck.length);
    drawnCards.push(deck.splice(randomIndex, 1)[0]);
  }
  return drawnCards;
}

export function takeOneRandomFromDeck(
  deck: string[] | undefined,
): string | undefined {
  if (!deck || deck.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * deck.length);
  return deck.splice(randomIndex, 1)[0];
}

export function removeOneCardFromHand(
  handsByPlayerId: Record<string, string[]>,
  playerId: string,
  cardCode: string,
): boolean {
  const playerHand = [...(handsByPlayerId[playerId] ?? [])];
  const position = playerHand.indexOf(cardCode);
  if (position === -1) return false;
  playerHand.splice(position, 1);
  handsByPlayerId[playerId] = playerHand;
  return true;
}

export function asCenter(value: Prisma.JsonValue | null | undefined) {
  return (value ?? {}) as NonNullable<GameState['duelCenter']>;
}

export function jsonInputOrDbNull(
  value: unknown,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  return value === null || value === undefined
    ? Prisma.DbNull
    : (value as Prisma.InputJsonValue);
}
