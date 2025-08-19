import { Injectable } from '@nestjs/common';
import {
  Card as PrismaCard,
  CardTemplate as PrismaCardTemplate,
  Game as PrismaGame,
  GameMode as PrismaGameMode,
} from '@prisma/client';
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

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classic: ClassicGameService,
    private readonly duel: DuelGameService,
  ) {}

  async getAllCards(): Promise<PrismaCard[]> {
    return this.prisma.card.findMany();
  }

  async getCardByCode(code: string): Promise<PrismaCard | null> {
    return this.prisma.card.findUnique({ where: { code } });
  }

  async getAllTemplates(): Promise<PrismaCardTemplate[]> {
    return this.prisma.cardTemplate.findMany();
  }

  async createGame(
    playerAId: string,
    playerBId: string = BOT_ID,
    mode: PrismaGameMode = 'CLASSIC',
  ): Promise<{ gameId: string; state: GameState }> {
    const gameId = randomUUID();

    const cards = await this.getAllCards();
    const pool = cards.length
      ? cards.map((c) => c.code)
      : ['fireball', 'lightning', 'heal'];

    const buildDeck = (codes: string[], size: number) =>
      Array.from(
        { length: size },
        () => codes[Math.floor(Math.random() * codes.length)],
      );

    const deckA = buildDeck(pool, 15);
    const deckB = buildDeck(pool, 15);
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
            create: { id: playerAId, username: playerAId },
          },
        },
        playerB: {
          connectOrCreate: {
            where: { id: playerBId },
            create: {
              id: playerBId,
              username: playerBId === BOT_ID ? 'Bot Opponent' : playerBId,
            },
          },
        },
      },
    });

    if (mode === 'CLASSIC') this.classic.setActiveState(gameId, initialState);
    return { gameId, state: initialState };
  }

  async playCard(gameId: string, actorId: string, cardCode: string) {
    return this.classic.playCard(gameId, actorId, cardCode);
  }

  async skipTurn(gameId: string, skipperId: string) {
    return this.classic.skipTurn(gameId, skipperId);
  }

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

  async getState(gameId: string): Promise<GameState | null> {
    const mem = this.classic.getActiveState(gameId);
    if (mem) return mem;
    const db = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!db) return null;
    const mapped: GameState = {
      players: [db.playerAId, db.playerBId],
      turn: db.turn,
      log: (db.log as string[]) ?? [],
      hp: db.hp as Record<string, number>,
      winner: db.winner ?? null,
      hands: db.hands as Record<string, string[]>,
      decks: db.decks as Record<string, string[]>,
      lastActivity: new Date(db.updatedAt).getTime(),
      mode: db.mode,
      duelStage: db.duelStage ?? null,
      duelCenter: (db.duelCenter as any) ?? null,
      discardPiles: (db.discardPiles as any) ?? null,
    };
    return mapped;
  }

  async getResult(gameId: string) {
    const mem = this.classic.getActiveState(gameId);
    if (mem && mem.winner !== undefined)
      return { winner: mem.winner, log: mem.log };
    const db = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!db) throw new Error('Game not found');
    return { winner: db.winner, log: db.log as string[] };
  }

  private async listActiveDuelFromDb() {
    const rows: PrismaGame[] = await this.prisma.game.findMany({
      where: {
        mode: 'ATTRIBUTE_DUEL',
        OR: [{ winner: null }, { duelStage: { not: 'RESOLVED' } }],
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

  expireOldGames() {
    return this.classic.expireOldGames();
  }

  async deleteGame(gameId: string) {
    const existed = !!this.classic.getActiveState(gameId);
    this.classic.removeActiveState(gameId);
    return { removed: existed };
  }
}
