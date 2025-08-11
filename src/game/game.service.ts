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

export interface GameState {
  /** Players in order of turn rotation (index parity decides turn owner) */
  players: string[]; // [playerAId, playerBId]
  /** Global turn counter (0 = players[0], 1 = players[1], 2 = players[0], ...) */
  turn: number;
  /** Human‑readable history */
  log: string[];
  /** Hit points per playerId */
  hp: Record<string, number>;
  /** Winner id or null; null can also mean tie if logs say so */
  winner: string | null;
  /** Current hand per playerId (card codes) */
  hands: Record<string, string[]>;
  /** Remaining deck per playerId (card codes) */
  decks: Record<string, string[]>;
  /** Last activity timestamp (ms) for expiration */
  lastActivity: number;
}

/** Draw `count` random cards from a deck (mutates the deck). */
function drawCards(deck: string[], count: number): string[] {
  const drawn: string[] = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    drawn.push(deck.splice(idx, 1)[0]);
  }
  return drawn;
}

@Injectable()
export class GameService {
  private activeGames: Record<string, GameState> = {};
  private static readonly EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  /** Load whole Card table. */
  async getAllCards(): Promise<PrismaCard[]> {
    return this.prisma.card.findMany();
  }

  /** Load whole CardTemplate table. */
  async getAllTemplates(): Promise<PrismaCardTemplate[]> {
    return this.prisma.cardTemplate.findMany();
  }

  /** Create a new match vs BOT, persist initial state, keep it in memory. */
  async createGame(
    playerAId: string,
    playerBId: string = BOT_ID,
  ): Promise<{ gameId: string; state: GameState }> {
    const gameId = randomUUID();

    // Build a base deck from DB (codes) or default fallback.
    const dbCards = await this.getAllCards();
    const FULL_DECK = dbCards.length
      ? dbCards.map((c) => c.code)
      : ['fireball', 'fireball', 'fireball', 'lightning', 'lightning', 'heal', 'heal'];

    // Each player: 3 in hand, 3 in deck (small demo config)
    const deckA = [...FULL_DECK].slice(0, 6);
    const deckB = [...FULL_DECK].slice(0, 6);
    const initialHandA = drawCards(deckA, 3);
    const initialHandB = drawCards(deckB, 3);

    const initialState: GameState = {
      players: [playerAId, playerBId],
      turn: 0,
      log: ['Game started, hands drawn'],
      hp: { [playerAId]: 20, [playerBId]: 20 },
      winner: null,
      hands: { [playerAId]: initialHandA, [playerBId]: initialHandB },
      decks: { [playerAId]: deckA, [playerBId]: deckB },
      lastActivity: Date.now(),
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

    this.activeGames[gameId] = initialState;
    return { gameId, state: initialState };
  }

  /** Apply a single play, then increment turn and draw for the next player if applicable. */
  private async resolvePlay(
    state: GameState,
    actorId: string,
    cardCode: string,
    actorLabel: string,
  ) {
    const card = await this.prisma.card.findUnique({ where: { code: cardCode } });
    if (!card) throw new Error(`Card "${cardCode}" not found in DB`);

    const [idA, idB] = state.players;
    const opponentId = idA === actorId ? idB : idA;

    const hand = state.hands[actorId];
    const handIdx = hand.indexOf(cardCode);
    if (handIdx < 0) throw new Error(`${actorLabel} does not have "${cardCode}"`);

    let logEntry = `${actorLabel} played ${card.name} (${card.description})`;

    if (card.damage) {
      state.hp[opponentId] -= card.damage;
      logEntry += ` → ${card.damage} damage to ${opponentId}`;
    }
    if (card.heal) {
      state.hp[actorId] += card.heal;
      logEntry += ` → ${card.heal} HP healed`;
    }

    // Remove used card
    hand.splice(handIdx, 1);

    // Clamp HP
    state.hp[idA] = Math.max(0, state.hp[idA]);
    state.hp[idB] = Math.max(0, state.hp[idB]);

    // Victory?
    if (state.hp[opponentId] <= 0 && !state.winner) {
      state.winner = actorId;
      logEntry += ` — ${actorLabel} wins!`;
    }

    state.log.push(logEntry);
    state.turn++;
    state.lastActivity = Date.now();

    // Draw 1 for the next player when game not yet finished
    const nextPlayerId = state.players[state.turn % 2];
    if (!state.winner) {
      const drawn = drawCards(state.decks[nextPlayerId], 1)[0];
      if (drawn) {
        state.hands[nextPlayerId].push(drawn);
        state.log.push(`${nextPlayerId} draws a card (${drawn})`);
      } else {
        state.log.push(`${nextPlayerId} could not draw (deck empty)`);
      }
      state.lastActivity = Date.now();
    }
  }

  /** Player acts, BOT may react, persist on finish. */
  async playCard(gameId: string, actorId: string, cardCode: string): Promise<GameState> {
    const state = this.activeGames[gameId];
    if (!state) throw new Error('Game not found or already finished');

    await this.resolvePlay(state, actorId, cardCode, `Player ${actorId}`);

    const nextId = state.players[state.turn % 2];
    if (nextId === BOT_ID && !state.winner) {
      const botHand = state.hands[BOT_ID];
      if (botHand.length) {
        const botChoice = botHand[Math.floor(Math.random() * botHand.length)];
        await this.resolvePlay(state, BOT_ID, botChoice, 'Bot');
      }
    }

    if (state.winner !== null) {
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

  /** Skip the current player's turn. Never throws (safe for UI). Can end in a tie. */
  async skipTurn(gameId: string, skipperId: string): Promise<GameState> {
    const state = this.activeGames[gameId];
    if (!state) throw new Error('Game not found or already finished');

    const skipperHand = state.hands[skipperId] ?? [];

    // Log skip regardless of having cards (avoid client-side errors)
    state.log.push(
      skipperHand.length > 0
        ? `Player ${skipperId} skips turn (had ${skipperHand.length} card(s))`
        : `Player ${skipperId} has no cards, skipping turn`,
    );

    // Advance turn
    state.turn++;
    state.lastActivity = Date.now();

    // New current player draws 1 at start of their turn
    const currentId = state.players[state.turn % 2];
    const drawn = drawCards(state.decks[currentId] ?? [], 1)[0];
    if (drawn) {
      (state.hands[currentId] ??= []).push(drawn);
      state.log.push(`${currentId} draws a card (${drawn})`);
    } else {
      state.log.push(`${currentId} could not draw (deck empty)`);
    }

    // If both players end up with 0 in hand → tie
    const otherId = state.players[(state.turn + 1) % 2];
    const currentHas = (state.hands[currentId] ?? []).length;
    const otherHas = (state.hands[otherId] ?? []).length;

    if (currentHas === 0 && otherHas === 0) {
      state.log.push('Both players have no cards — tie game');
      state.winner = null;

      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          turn: state.turn,
          hp: state.hp,
          winner: state.winner, // null tie
          hands: state.hands,
          decks: state.decks,
          log: state.log,
        },
      });

      delete this.activeGames[gameId];
      return state;
    }

    // If BOT is current and has cards, auto‑play once
    if (currentId === BOT_ID && (state.hands[BOT_ID] ?? []).length > 0 && !state.winner) {
      const choice = state.hands[BOT_ID][Math.floor(Math.random() * state.hands[BOT_ID].length)];
      await this.resolvePlay(state, BOT_ID, choice, 'Bot');

      if (state.winner !== null) {
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
        return state;
      }
    }

    return state;
  }

  /** Read in‑memory state (returns null if finished). */
  async getState(gameId: string): Promise<GameState | null> {
    return this.activeGames[gameId] ?? null;
  }

  /** Read final result, from memory (if just ended) or DB. */
  async getResult(
    gameId: string,
  ): Promise<{ winner: string | null; log: string[] }> {
    const mem = this.activeGames[gameId];
    if (mem && mem.winner !== undefined) {
      return { winner: mem.winner, log: mem.log };
    }
    const db = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!db) throw new Error('Game not found');
    return { winner: db.winner, log: db.log as string[] };
  }

  /** List active in‑memory games */
  listActiveGames() {
    return Object.entries(this.activeGames).map(([gameId, s]) => ({
      gameId,
      players: s.players,
      turn: s.turn,
      lastActivity: s.lastActivity,
      winner: s.winner,
    }));
  }

  /** Expire idle games (drop from memory only) */
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

  /** Manually end a game (drop from memory only; DB record stays) */
  async deleteGame(gameId: string): Promise<{ removed: boolean }> {
    const existed = !!this.activeGames[gameId];
    delete this.activeGames[gameId];
    return { removed: existed };
  }
}
