/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable } from '@nestjs/common';
import type {
  Card as PrismaCard,
  CardTemplate as PrismaCardTemplate,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const BOT_ID = 'BOT';

/** Represents the in-memory state of a running game */
export interface GameState {
  players: string[];         // [playerAId, playerBId]
  turn: number;              // 0 = playerA, 1 = playerB, etc.
  log: string[];             // history of plays and draws
  hp: Record<string, number>;
  winner: string | null;
  hands: Record<string, string[]>; // card codes per player
  decks: Record<string, string[]>; // remaining card codes per player
  lastActivity: number;      // timestamp for expiration
}

/**
 * Draws `count` random cards from `deck`, removing them from the deck.
 */
function drawCards(deck: string[], count: number): string[] {
  const hand: string[] = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    hand.push(deck.splice(idx, 1)[0]);
  }
  return hand;
}

@Injectable()
export class GameService {
  private activeGames: Record<string, GameState> = {};
  private static readonly EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  /** Load all cards from the database */
  async getAllCards(): Promise<PrismaCard[]> {
    return this.prisma.card.findMany();
  }

  /** Load all card templates from the database */
  async getAllTemplates(): Promise<PrismaCardTemplate[]> {
    return this.prisma.cardTemplate.findMany();
  }

  /**
   * Start a new game, deal initial hands, persist in DB and register in memory.
   */
  async createGame(
    playerAId: string,
    playerBId: string = BOT_ID,
  ): Promise<{ gameId: string; state: GameState }> {
    const gameId = randomUUID();

    // Build full deck from DB or default
    const dbCards = await this.getAllCards();
    const FULL_DECK = dbCards.length
      ? dbCards.map((c) => c.code)
      : [
          'fireball',
          'fireball',
          'fireball',
          'lightning',
          'lightning',
          'heal',
          'heal',
        ];

    // Shuffle and draw hands
    const deckA = [...FULL_DECK];
    const deckB = [...FULL_DECK];
    const handA = drawCards(deckA, 5);
    const handB = drawCards(deckB, 5);

    const state: GameState = {
      players: [playerAId, playerBId],
      turn: 0,
      log: ['Game started, hands drawn'],
      hp: { [playerAId]: 20, [playerBId]: 20 },
      winner: null,
      hands: { [playerAId]: handA, [playerBId]: handB },
      decks: { [playerAId]: deckA, [playerBId]: deckB },
      lastActivity: Date.now(),
    };

    // Persist initial state to DB
    await this.prisma.game.create({
      data: {
        id: gameId,
        turn: state.turn,
        hp: state.hp,
        winner: state.winner,
        hands: state.hands,
        decks: state.decks,
        log: state.log,
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

    // Register in memory
    this.activeGames[gameId] = state;
    return { gameId, state };
  }

  /**
   * Internal helper: apply a single play (damage/heal),
   * update turn, draw next card, update log.
   */
  private async applyPlay(
    state: GameState,
    playerId: string,
    cardCode: string,
    actorName: string,
  ) {
    const card = await this.prisma.card.findUnique({ where: { code: cardCode } });
    if (!card) throw new Error(`Card "${cardCode}" not found in DB`);

    const [pA, pB] = state.players;
    const opponent = pA === playerId ? pB : pA;
    const hand = state.hands[playerId];
    const idx = hand.indexOf(cardCode);
    if (idx < 0) throw new Error(`${actorName} does not have "${cardCode}"`);

    // Apply effects
    let entry = `${actorName} played ${card.name} (${card.description})`;
    if (card.damage) {
      state.hp[opponent] -= card.damage;
      entry += ` → ${card.damage} damage to ${opponent}`;
    }
    if (card.heal) {
      state.hp[playerId] += card.heal;
      entry += ` → ${card.heal} HP healed`;
    }

    // Remove card from hand
    hand.splice(idx, 1);

    // Clamp HP to ≥ 0
    state.hp[pA] = Math.max(0, state.hp[pA]);
    state.hp[pB] = Math.max(0, state.hp[pB]);

    // Check for win
    if (state.hp[opponent] <= 0 && !state.winner) {
      state.winner = playerId;
      entry += ` — ${actorName} wins!`;
    }

    state.log.push(entry);
    state.turn++;
    state.lastActivity = Date.now();

    // If game still on, draw one card for next player
    const next = state.players[state.turn % 2];
    if (!state.winner) {
      const drawn = drawCards(state.decks[next], 1)[0];
      state.hands[next].push(drawn);
      state.log.push(`${next} draws a card (${drawn})`);
      state.lastActivity = Date.now();
    }
  }

  /**
   * Player plays a card; then BOT plays if it's their turn;
   * persist final state on game end.
   */
  async playCard(
    gameId: string,
    playerId: string,
    cardCode: string,
  ): Promise<GameState> {
    const state = this.activeGames[gameId];
    if (!state) throw new Error('Game not found or already finished');

    await this.applyPlay(state, playerId, cardCode, `Player ${playerId}`);

    // BOT turn
    const next = state.players[state.turn % 2];
    if (next === BOT_ID && !state.winner) {
      const botHand = state.hands[BOT_ID];
      if (botHand.length) {
        const choice = botHand[Math.floor(Math.random() * botHand.length)];
        await this.applyPlay(state, BOT_ID, choice, 'Bot');
      }
    }

    // Persist when game ends
    if (state.winner) {
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          turn: state.turn,
          hp: state.hp,
          winner: state.winner,
          hands: state.hands,
          decks: state.decks,
          log: state.log,
        },
      });
      delete this.activeGames[gameId];
    }

    return state;
  }

  /** Return in-memory state or null if not running */
  async getState(gameId: string): Promise<GameState | null> {
    return this.activeGames[gameId] ?? null;
  }

  /** Return final result, preferring memory then DB */
  async getResult(
    gameId: string,
  ): Promise<{ winner: string | null; log: string[] }> {
    const mem = this.activeGames[gameId];
    if (mem && mem.winner) {
      return { winner: mem.winner, log: mem.log };
    }
    const rec = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!rec) throw new Error('Game not found');
    return { winner: rec.winner, log: rec.log as string[] };
  }

  /** List all active games in memory */
  listActiveGames() {
    return Object.entries(this.activeGames).map(([gameId, s]) => ({
      gameId,
      players: s.players,
      turn: s.turn,
      lastActivity: s.lastActivity,
      winner: s.winner,
    }));
  }

  /** Expire games not used for a while */
  expireOldGames() {
    const now = Date.now();
    const expired: string[] = [];
    for (const [gameId, s] of Object.entries(this.activeGames)) {
      if (now - s.lastActivity > GameService.EXPIRATION_MS) {
        expired.push(gameId);
        delete this.activeGames[gameId];
      }
    }
    return expired;
  }

  async deleteGame(gameId: string): Promise<{ removed: boolean }> {
    const exists = !!this.activeGames[gameId];
    delete this.activeGames[gameId];
    return { removed: exists };
  }
}
