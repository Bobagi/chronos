import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DuelStage,
  FriendshipStatus,
  Card as PrismaCard,
  CardTemplate as PrismaCardTemplate,
  GameMode as PrismaGameMode,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ClassicGameService } from './classic-game.service';
import { DuelGameService } from './duel-game.service';
import { CardCatalogEntry } from './card.types';
import {
  BOT_ID,
  GameState,
  asCenter,
  drawRandomCardsFromDeck,
  jsonInputOrDbNull,
} from './game.types';
import {
  normalizeLocalizedTextContent,
  selectLocalizedText,
} from '../localization/localization.helpers';
import { SupportedLanguage } from '../localization/localization.types';

const DUEL_EXP_MS = 5 * 60 * 1000; // 5 min
const TURN_DURATION_MS = 10 * 1000;

const CARD_IMAGE_BASE_URL = (
  process.env.CARD_IMAGE_BASE_URL ?? 'https://bobagi.space'
).replace(/\/+$/, '');

function buildCompleteImageUrl(relativeImageUrl: string): string {
  if (!relativeImageUrl) {
    return relativeImageUrl;
  }
  return `${CARD_IMAGE_BASE_URL}${relativeImageUrl}`;
}

function mapPrismaCardToCatalogEntry(
  prismaCard: PrismaCard,
  language: SupportedLanguage,
): CardCatalogEntry {
  const localizedName = normalizeLocalizedTextContent(
    prismaCard.localizedName,
    prismaCard.code,
  );
  const localizedDescription = normalizeLocalizedTextContent(
    prismaCard.localizedDescription,
    '',
  );
  return {
    id: prismaCard.id,
    code: prismaCard.code,
    localizedName,
    localizedDescription,
    displayName: selectLocalizedText(localizedName, language),
    displayDescription: selectLocalizedText(localizedDescription, language),
    number: prismaCard.number,
    damage: prismaCard.damage ?? null,
    heal: prismaCard.heal ?? null,
    imageUrl: buildCompleteImageUrl(prismaCard.imageUrl),
    might: prismaCard.might,
    fire: prismaCard.fire,
    magic: prismaCard.magic,
    collectionId: prismaCard.collectionId,
    createdAt: prismaCard.createdAt,
    updatedAt: prismaCard.updatedAt,
  };
}

function shuffleStringArray(inputArray: string[]): string[] {
  const shuffledArray = [...inputArray];
  for (
    let currentIndex = shuffledArray.length - 1;
    currentIndex > 0;
    currentIndex -= 1
  ) {
    const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
    const currentValue = shuffledArray[currentIndex];
    shuffledArray[currentIndex] = shuffledArray[randomIndex];
    shuffledArray[randomIndex] = currentValue;
  }
  return shuffledArray;
}

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classic: ClassicGameService,
    private readonly duel: DuelGameService,
  ) {}

  /* ---------- Catalog ---------- */
  async getAllCards(
    language: SupportedLanguage = SupportedLanguage.English,
  ): Promise<CardCatalogEntry[]> {
    const cards = await this.prisma.card.findMany();
    return cards.map((card) => mapPrismaCardToCatalogEntry(card, language));
  }
  async getCardByCode(
    code: string,
    language: SupportedLanguage = SupportedLanguage.English,
  ): Promise<CardCatalogEntry | null> {
    const card = await this.prisma.card.findUnique({ where: { code } });
    if (!card) {
      return null;
    }
    return mapPrismaCardToCatalogEntry(card, language);
  }
  async getAllTemplates(): Promise<PrismaCardTemplate[]> {
    return this.prisma.cardTemplate.findMany();
  }

  /* ---------- Create Game ---------- */
  async createGame(
    playerAId: string,
    playerBId: string = BOT_ID,
    mode: PrismaGameMode = 'CLASSIC',
  ): Promise<{ gameId: string; state: GameState }> {
    const gameId = randomUUID();
    const placeholderHash = await bcrypt.hash(randomUUID(), 10);

    const allCards = await this.getAllCards(SupportedLanguage.English);
    const poolCodes = allCards.length
      ? Array.from(new Set(allCards.map((c) => c.code)))
      : ['fireball', 'lightning', 'heal'];

    const deckA = shuffleStringArray(poolCodes);
    const deckB = shuffleStringArray(poolCodes);
    const handA = drawRandomCardsFromDeck(deckA, 4);
    const handB = drawRandomCardsFromDeck(deckB, 4);

    const now = Date.now();
    const initialState: GameState = {
      players: [playerAId, playerBId],
      turn: 0,
      log: ['Game created'],
      hp: { [playerAId]: 20, [playerBId]: 20 },
      winner: null,
      hands: { [playerAId]: handA, [playerBId]: handB },
      decks: { [playerAId]: deckA, [playerBId]: deckB },
      lastActivity: now,
      turnDeadline: now + TURN_DURATION_MS,
      mode,
      duelStage: mode === 'ATTRIBUTE_DUEL' ? 'PICK_CARD' : null,
      duelCenter:
        mode === 'ATTRIBUTE_DUEL'
          ? { chooserId: playerAId, deadlineAt: now + TURN_DURATION_MS }
          : null,
      discardPiles:
        mode === 'ATTRIBUTE_DUEL' ? { [playerAId]: [], [playerBId]: [] } : null,
    };

    await this.prisma.game.create({
      data: {
        id: gameId,
        turn: initialState.turn,
        hp: initialState.hp,
        winner: initialState.winner,
        hands: initialState.hands,
        decks: initialState.decks,
        log: initialState.log,
        mode,
        duelStage: initialState.duelStage ?? null,
        duelCenter: jsonInputOrDbNull(initialState.duelCenter),
        discardPiles: jsonInputOrDbNull(initialState.discardPiles),
        playerA: {
          connectOrCreate: {
            where: { id: playerAId },
            create: {
              id: playerAId,
              username: playerAId,
              passwordHash: placeholderHash,
            } as Prisma.PlayerCreateWithoutGamesAsAInput,
          },
        },
        playerB: {
          connectOrCreate: {
            where: { id: playerBId },
            create: {
              id: playerBId,
              username: playerBId === BOT_ID ? 'Bot Opponent' : playerBId,
              passwordHash: placeholderHash,
            } as Prisma.PlayerCreateWithoutGamesAsBInput,
          },
        },
      },
      select: { id: true },
    });

    if (mode === 'CLASSIC') this.classic.setActiveState(gameId, initialState);
    return { gameId, state: initialState };
  }

  async createGameWithFriend(
    requesterId: string,
    friendId: string,
    mode: PrismaGameMode = 'CLASSIC',
  ) {
    if (requesterId === friendId)
      throw new Error('Cannot start a game against yourself.');
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        blockedById: null,
        OR: [
          { requesterId: requesterId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: requesterId },
        ],
      },
    });
    if (!friendship)
      throw new Error('Players must be friends before starting a match.');

    return this.createGame(requesterId, friendId, mode);
  }

  /* ---------- Classic actions ---------- */
  async playCard(gameId: string, actorId: string, cardCode: string) {
    return this.classic.playCard(gameId, actorId, cardCode);
  }
  async skipTurn(gameId: string, skipperId: string) {
    return this.classic.skipTurn(gameId, skipperId);
  }

  /* ---------- Duel actions ---------- */
  async chooseCardForDuel(
    gameId: string,
    dto: { playerId: string; cardCode: string },
  ) {
    return this.duel.chooseCardForDuel(gameId, dto);
  }
  async chooseAttributeForDuel(
    gameId: string,
    dto: { playerId: string; attribute: 'magic' | 'might' | 'fire' },
  ) {
    return this.duel.chooseAttributeForDuel(gameId, dto);
  }
  async advanceDuelRound(gameId: string) {
    return this.duel.advanceDuelRound(gameId);
  }

  /* ---------- State & Result ---------- */
  async getState(gameId: string): Promise<GameState | null> {
    const inMemoryState = this.classic.getActiveState(gameId);
    if (inMemoryState) return inMemoryState;

    const dbGame = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        turn: true,
        hp: true,
        winner: true,
        hands: true,
        decks: true,
        log: true,
        mode: true,
        duelStage: true,
        duelCenter: true,
        discardPiles: true,
        updatedAt: true,
        playerA: { select: { username: true } },
        playerB: { select: { username: true } },
      },
    });
    if (!dbGame) return null;

    const duelCenter =
      dbGame.duelCenter === null
        ? null
        : (asCenter(dbGame.duelCenter) as GameState['duelCenter']);

    const mappedState: GameState = {
      players: [dbGame.playerAId, dbGame.playerBId],
      turn: dbGame.turn,
      log: (dbGame.log as string[]) ?? [],
      hp: dbGame.hp as Record<string, number>,
      winner: dbGame.winner ?? null,
      hands: dbGame.hands as Record<string, string[]>,
      decks: dbGame.decks as Record<string, string[]>,
      lastActivity: new Date(dbGame.updatedAt).getTime(),
      turnDeadline:
        duelCenter && typeof duelCenter.deadlineAt === 'number'
          ? duelCenter.deadlineAt
          : null,
      mode: dbGame.mode,
      duelStage: dbGame.duelStage ?? null,
      duelCenter,
      discardPiles:
        (dbGame.discardPiles as Record<string, string[]> | null) ?? null,
      playerUsernames: {
        [dbGame.playerAId]: dbGame.playerA?.username ?? dbGame.playerAId,
        [dbGame.playerBId]: dbGame.playerB?.username ?? dbGame.playerBId,
      },
    };
    return mappedState;
  }

  async getResult(gameId: string) {
    const mem = this.classic.getActiveState(gameId);
    if (mem && mem.winner !== undefined)
      return { winner: mem.winner, log: mem.log };

    const db = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { winner: true, log: true },
    });
    if (!db) throw new Error('Game not found');
    return { winner: db.winner, log: db.log as string[] };
  }

  async surrenderGame(gameId: string, playerId: string) {
    const memState = this.classic.getActiveState(gameId);
    if (memState) {
      if (!memState.players.includes(playerId))
        throw new Error('Player is not part of this game.');
      const opponentId =
        memState.players.find((p) => p !== playerId) ?? memState.players[0];
      memState.winner = opponentId;
      memState.turnDeadline = null;
      memState.log.push(`Player ${playerId} surrendered.`);
      memState.lastActivity = Date.now();

      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          winner: opponentId,
          log: memState.log,
          hp: memState.hp,
          turn: memState.turn,
          hands: memState.hands,
          decks: memState.decks,
        },
        select: { id: true },
      });
      this.classic.removeActiveState(gameId);
      return { winner: opponentId };
    }

    const dbGame = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: {
        playerAId: true,
        playerBId: true,
        winner: true,
        log: true,
      },
    });
    if (!dbGame) throw new Error('Game not found');
    if (![dbGame.playerAId, dbGame.playerBId].includes(playerId))
      throw new Error('Player is not part of this game.');
    if (dbGame.winner)
      return { winner: dbGame.winner, log: dbGame.log as string[] };

    const opponentId =
      dbGame.playerAId === playerId ? dbGame.playerBId : dbGame.playerAId;
    const existingLog = (dbGame.log as string[]) ?? [];
    existingLog.push(`Player ${playerId} surrendered.`);
    const updated = await this.prisma.game.update({
      where: { id: gameId },
      data: { winner: opponentId, log: existingLog },
      select: { winner: true },
    });
    return { winner: updated.winner, log: existingLog };
  }

  /* ---------- Active list ---------- */
  private async listActiveDuelFromDb() {
    const rows = await this.prisma.game.findMany({
      where: {
        mode: 'ATTRIBUTE_DUEL',
        winner: null,
        duelStage: { not: 'RESOLVED' },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        mode: true,
        turn: true,
        updatedAt: true,
        winner: true,
      },
    });
    return rows.map((g) => ({
      gameId: g.id,
      players: [g.playerAId, g.playerBId],
      mode: g.mode,
      turn: g.turn,
      lastActivity: new Date(g.updatedAt).getTime(),
      winner: g.winner ?? null,
    }));
  }
  async listActiveGamesUnified() {
    const classic = this.classic.listActiveFromMemory();
    const duel = await this.listActiveDuelFromDb();
    return [...duel, ...classic];
  }

  /* ---------- Expire & Delete ---------- */
  async expireOldGames(): Promise<string[]> {
    const expiredClassic = this.classic.expireOldGames();
    const cutoff = new Date(Date.now() - DUEL_EXP_MS);
    await this.prisma.game.updateMany({
      where: {
        mode: 'ATTRIBUTE_DUEL',
        winner: null,
        duelStage: { not: 'RESOLVED' },
        updatedAt: { lt: cutoff },
      },
      data: { duelStage: 'RESOLVED' as DuelStage },
    });
    return expiredClassic;
  }

  async deleteGame(gameId: string) {
    const existedClassic = !!this.classic.getActiveState(gameId);
    this.classic.removeActiveState(gameId);
    const res = await this.prisma.game.updateMany({
      where: {
        id: gameId,
        mode: 'ATTRIBUTE_DUEL',
        duelStage: { not: 'RESOLVED' },
      },
      data: { duelStage: 'RESOLVED' as DuelStage },
    });
    return { removed: existedClassic || res.count > 0 };
  }

  async unchooseCardForDuel(gameId: string, dto: { playerId: string }) {
    return this.duel.unchooseCardForDuel(gameId, dto);
  }

  async listActiveForPlayer(playerId: string) {
    const classic = this.classic
      .listActiveFromMemory()
      .filter((g) => g.players?.includes(playerId));
    const rows = await this.prisma.game.findMany({
      where: {
        mode: 'ATTRIBUTE_DUEL',
        winner: null,
        duelStage: { not: 'RESOLVED' },
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        mode: true,
        turn: true,
        updatedAt: true,
        winner: true,
      },
    });
    const duel = rows.map((g) => ({
      gameId: g.id,
      players: [g.playerAId, g.playerBId],
      mode: g.mode,
      turn: g.turn,
      lastActivity: new Date(g.updatedAt).getTime(),
      winner: g.winner ?? null,
    }));
    return [...duel, ...classic];
  }

  /* ---------- Stats ---------- */
  async getUserStats(userId: string) {
    const gamesPlayed = await this.prisma.game.count({
      where: { OR: [{ playerAId: userId }, { playerBId: userId }] },
    });
    const gamesWon = await this.prisma.game.count({
      where: { winner: userId },
    });
    const gamesDrawn = await this.prisma.game.count({
      where: {
        winner: 'DRAW',
        OR: [{ playerAId: userId }, { playerBId: userId }],
      },
    });
    return { gamesPlayed, gamesWon, gamesDrawn };
  }
}
