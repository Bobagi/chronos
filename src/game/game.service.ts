/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import {
  DuelStage,
  Card as PrismaCard,
  CardTemplate as PrismaCardTemplate,
  Game as PrismaGame,
  GameMode as PrismaGameMode,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ClassicGameService } from './classic-game.service';
import { DuelGameService } from './duel-game.service';
import {
  BOT_ID,
  GameState,
  drawRandomCardsFromDeck,
  jsonInputOrDbNull,
} from './game.types';

const DUEL_EXP_MS = 5 * 60 * 1000; // 5 min

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classic: ClassicGameService,
    private readonly duel: DuelGameService,
  ) {}

  /* ---------- Catalog ---------- */
  async getAllCards(): Promise<PrismaCard[]> {
    return this.prisma.card.findMany();
  }
  async getCardByCode(code: string): Promise<PrismaCard | null> {
    return this.prisma.card.findUnique({ where: { code } });
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

    const allCards = await this.getAllCards();
    const poolCodes = allCards.length
      ? Array.from(new Set(allCards.map((c) => c.code)))
      : ['fireball', 'lightning', 'heal'];

    function shuffleArray<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    const deckA = shuffleArray(poolCodes);
    const deckB = shuffleArray(poolCodes);
    const handA = drawRandomCardsFromDeck(deckA, 4);
    const handB = drawRandomCardsFromDeck(deckB, 4);

    const initialState: GameState = {
      players: [playerAId, playerBId],
      turn: 0,
      log: ['Game created'],
      hp: { [playerAId]: 20, [playerBId]: 20 },
      winner: null,
      hands: { [playerAId]: handA, [playerBId]: handB },
      decks: { [playerAId]: deckA, [playerBId]: deckB },
      lastActivity: Date.now(),
      mode,
      duelStage: mode === 'ATTRIBUTE_DUEL' ? 'PICK_CARD' : null,
      duelCenter: mode === 'ATTRIBUTE_DUEL' ? { chooserId: playerAId } : null,
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
            },
          },
        },
        playerB: {
          connectOrCreate: {
            where: { id: playerBId },
            create: {
              id: playerBId,
              username: playerBId === BOT_ID ? 'Bot Opponent' : playerBId,
              passwordHash: placeholderHash,
            },
          },
        },
      },
    });

    if (mode === 'CLASSIC') this.classic.setActiveState(gameId, initialState);
    return { gameId, state: initialState };
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
      include: {
        playerA: { select: { username: true } },
        playerB: { select: { username: true } },
      },
    });
    if (!dbGame) return null;

    const mappedState: GameState = {
      players: [dbGame.playerAId, dbGame.playerBId],
      turn: dbGame.turn,
      log: (dbGame.log as string[]) ?? [],
      hp: dbGame.hp as Record<string, number>,
      winner: dbGame.winner ?? null,
      hands: dbGame.hands as Record<string, string[]>,
      decks: dbGame.decks as Record<string, string[]>,
      lastActivity: new Date(dbGame.updatedAt).getTime(),
      mode: dbGame.mode,
      duelStage: dbGame.duelStage ?? null,
      duelCenter:
        (dbGame.duelCenter as Record<string, string[]> | null) ?? null,
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

    const db = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!db) throw new Error('Game not found');
    return { winner: db.winner, log: db.log as string[] };
  }

  /* ---------- Active list ---------- */
  private async listActiveDuelFromDb() {
    const rows: PrismaGame[] = await this.prisma.game.findMany({
      where: {
        mode: 'ATTRIBUTE_DUEL',
        winner: null,
        duelStage: { not: 'RESOLVED' },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
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
