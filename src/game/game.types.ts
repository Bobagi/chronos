import {
  Prisma,
  DuelStage as PrismaDuelStage,
  GameMode as PrismaGameMode,
} from '@prisma/client';

export const BOT_ID = 'BOT';

export type AttributeKey = 'magic' | 'might' | 'fire';

export interface PlayerCardCollection {
  [playerId: string]: string[];
}

export interface PlayerHealthCollection {
  [playerId: string]: number;
}

export interface PlayerUsernameCollection {
  [playerId: string]: string;
}

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

export interface GameState {
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
  mode: PrismaGameMode;
  duelStage: PrismaDuelStage | null;
  duelCenter: DuelCenterState | null;
  discardPiles: PlayerCardCollection | null;
}

export function initializeDuelCenterState(): DuelCenterState {
  return {
    playerACardCode: null,
    playerBCardCode: null,
    chosenAttribute: null,
    isRevealed: false,
    chooserId: null,
    playerAAttributeValue: null,
    playerBAttributeValue: null,
    roundWinnerId: null,
    deadlineAt: null,
  };
}

export function drawRandomCardsFromDeck(
  deckCardCodes: string[],
  cardsToDraw: number,
): string[] {
  const drawnCardCodes: string[] = [];
  for (
    let drawIndex = 0;
    drawIndex < cardsToDraw && deckCardCodes.length > 0;
    drawIndex += 1
  ) {
    const randomIndex = Math.floor(Math.random() * deckCardCodes.length);
    const [selectedCardCode] = deckCardCodes.splice(randomIndex, 1);
    drawnCardCodes.push(selectedCardCode);
  }
  return drawnCardCodes;
}

export function takeOneRandomCardFromDeck(deckCardCodes: string[]): string | null {
  if (deckCardCodes.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * deckCardCodes.length);
  const [selectedCardCode] = deckCardCodes.splice(randomIndex, 1);
  return selectedCardCode ?? null;
}

export function removeCardFromHand(
  playerHands: PlayerCardCollection,
  playerId: string,
  cardCode: string,
): boolean {
  const playerHand = playerHands[playerId];
  if (!playerHand) return false;
  const cardIndex = playerHand.indexOf(cardCode);
  if (cardIndex === -1) return false;
  playerHand.splice(cardIndex, 1);
  return true;
}

export function deserializeDuelCenter(
  value: Prisma.JsonValue | null | undefined,
): DuelCenterState {
  const baseState = initializeDuelCenterState();
  if (value === null || value === undefined) return baseState;
  if (typeof value !== 'object' || Array.isArray(value)) return baseState;

  const jsonObject = value as Prisma.JsonObject;

  const extractString = (key: string): string | null => {
    const fieldValue = jsonObject[key];
    return typeof fieldValue === 'string' && fieldValue.length > 0
      ? fieldValue
      : null;
  };

  const extractNumber = (key: string): number | null => {
    const fieldValue = jsonObject[key];
    return typeof fieldValue === 'number' ? fieldValue : null;
  };

  const extractBoolean = (key: string): boolean => {
    const fieldValue = jsonObject[key];
    return typeof fieldValue === 'boolean' ? fieldValue : false;
  };

  const candidateAttribute =
    extractString('chosenAttribute') ??
    extractString('attribute') ??
    extractString('attr');

  const candidateRoundWinner = extractString('roundWinner');

  return {
    playerACardCode:
      extractString('playerACardCode') ?? extractString('aCardCode'),
    playerBCardCode:
      extractString('playerBCardCode') ?? extractString('bCardCode'),
    chosenAttribute:
      candidateAttribute === null
        ? null
        : (candidateAttribute as AttributeKey),
    isRevealed:
      extractBoolean('isRevealed') || extractBoolean('revealed'),
    chooserId: extractString('chooserId'),
    playerAAttributeValue:
      extractNumber('playerAAttributeValue') ?? extractNumber('aVal'),
    playerBAttributeValue:
      extractNumber('playerBAttributeValue') ?? extractNumber('bVal'),
    roundWinnerId: candidateRoundWinner,
    deadlineAt: extractNumber('deadlineAt'),
  };
}

export function serializeDuelCenter(
  duelCenter: DuelCenterState | null,
): Prisma.InputJsonObject | null {
  if (duelCenter === null) return null;
  return {
    playerACardCode: duelCenter.playerACardCode,
    playerBCardCode: duelCenter.playerBCardCode,
    chosenAttribute: duelCenter.chosenAttribute,
    isRevealed: duelCenter.isRevealed,
    chooserId: duelCenter.chooserId,
    playerAAttributeValue: duelCenter.playerAAttributeValue,
    playerBAttributeValue: duelCenter.playerBAttributeValue,
    roundWinnerId: duelCenter.roundWinnerId,
    deadlineAt: duelCenter.deadlineAt,
  } satisfies Prisma.InputJsonObject;
}

export function convertCardCollectionToPrismaInput(
  collection: PlayerCardCollection | null,
): Prisma.InputJsonObject | null {
  if (collection === null) return null;
  const playerEntries: [string, Prisma.InputJsonValue][] = Object.entries(collection).map(
    ([playerId, cardCodes]) => [playerId, cardCodes as Prisma.InputJsonValue],
  );
  return Object.fromEntries(playerEntries) as Prisma.InputJsonObject;
}

export function prepareNullableJsonField(
  value: Prisma.InputJsonObject | null,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonObject {
  return value === null ? Prisma.DbNull : value;
}
