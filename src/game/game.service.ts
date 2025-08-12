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
  players: string[];
  turn: number;
  log: string[];
  hp: Record<string, number>;
  winner: string | null;
  hands: Record<string, string[]>;
  decks: Record<string, string[]>;
  lastActivity: number;
}

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
  private static readonly EXPIRATION_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async getAllCards(): Promise<PrismaCard[]> {
    return this.prisma.card.findMany();
  }

  async getAllTemplates(): Promise<PrismaCardTemplate[]> {
    return this.prisma.cardTemplate.findMany();
  }

  async createGame(
    playerAId: string,
    playerBId: string = BOT_ID,
  ): Promise<{ gameId: string; state: GameState }> {
    const gameId = randomUUID();

    const dbCards = await this.getAllCards();
    const pool = dbCards.length ? dbCards.map((c) => c.code) : ['fireball', 'lightning', 'heal'];

    const buildRandomReplicatedDeck = (codes: string[], size: number): string[] => {
      const deck: string[] = [];
      for (let i = 0; i < size; i++) {
        const pick = codes[Math.floor(Math.random() * codes.length)];
        deck.push(pick);
      }
      return deck;
    };

    const deckA = buildRandomReplicatedDeck(pool, 15);
    const deckB = buildRandomReplicatedDeck(pool, 15);
    const initialHandA = drawCards(deckA, 4);
    const initialHandB = drawCards(deckB, 4);

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

    hand.splice(handIdx, 1);

    state.hp[idA] = Math.max(0, state.hp[idA]);
    state.hp[idB] = Math.max(0, state.hp[idB]);

    if (state.hp[opponentId] <= 0 && !state.winner) {
      state.winner = actorId;
      logEntry += ` — ${actorLabel} wins!`;
    }

    state.log.push(logEntry);
    state.turn++;
    state.lastActivity = Date.now();

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

  async skipTurn(gameId: string, skipperId: string): Promise<GameState> {
    const state = this.activeGames[gameId];
    if (!state) throw new Error('Game not found or already finished');

    const skipperHand = state.hands[skipperId] ?? [];

    state.log.push(
      skipperHand.length > 0
        ? `Player ${skipperId} skips turn (had ${skipperHand.length} card(s))`
        : `Player ${skipperId} has no cards, skipping turn`,
    );

    state.turn++;
    state.lastActivity = Date.now();

    const currentId = state.players[state.turn % 2];
    const drawn = drawCards(state.decks[currentId] ?? [], 1)[0];
    if (drawn) {
      (state.hands[currentId] ??= []).push(drawn);
      state.log.push(`${currentId} draws a card (${drawn})`);
    } else {
      state.log.push(`${currentId} could not draw (deck empty)`);
    }

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
          winner: state.winner,
          hands: state.hands,
          decks: state.decks,
          log: state.log,
        },
      });

      delete this.activeGames[gameId];
      return state;
    }

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

  async getState(gameId: string): Promise<GameState | null> {
    return this.activeGames[gameId] ?? null;
  }

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

  listActiveGames() {
    return Object.entries(this.activeGames).map(([gameId, s]) => ({
      gameId,
      players: s.players,
      turn: s.turn,
      lastActivity: s.lastActivity,
      winner: s.winner,
    }));
  }

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
    const existed = !!this.activeGames[gameId];
    delete this.activeGames[gameId];
    return { removed: existed };
  }
}
