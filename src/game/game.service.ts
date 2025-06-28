/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const BOT_ID = 'BOT';

export interface Card {
  id: string;
  name: string;
  description: string;
  damage?: number;
  heal?: number;
}

export interface GameState {
  players: string[]; // [playerAId, playerBId]
  turn: number;
  log: string[];
  hp: Record<string, number>;
  winner: string | null;
  hands: Record<string, string[]>;
  decks: Record<string, string[]>;
  lastActivity: number; // timestamp in ms
}

// full deck composition
const FULL_DECK: string[] = [
  'fireball',
  'fireball',
  'fireball',
  'lightning',
  'lightning',
  'heal',
  'heal',
];

// card definitions
const CARD_LIBRARY: Record<string, Card> = {
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    description: 'Deal 5 damage to the opponent',
    damage: 5,
  },
  lightning: {
    id: 'lightning',
    name: 'Lightning Bolt',
    description: 'Deal 3 damage to the opponent',
    damage: 3,
  },
  heal: {
    id: 'heal',
    name: 'Heal',
    description: 'Restore 4 HP to yourself',
    heal: 4,
  },
};

/** draw `count` random cards from `deck`, mutating it */
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
  // active games kept in memory
  private activeGames: Record<string, GameState> = {};

  // expire after 5 minutes of inactivity
  private static readonly EXPIRATION_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Start a new game vs Bot: stored in memory until it finishes.
   */
  async createGame(
    playerAId: string,
    playerBId: string = BOT_ID,
  ): Promise<{ gameId: string; state: GameState }> {
    const gameId = randomUUID();
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

    this.activeGames[gameId] = state;
    return { gameId, state };
  }

  /**
   * Apply one play and update logs, HP, hands, decks.
   */
  private applyPlay(
    state: GameState,
    playerId: string,
    cardId: string,
    actorName: string,
  ) {
    const [playerAId, playerBId] = state.players;
    const opponentId = playerAId === playerId ? playerBId : playerAId;
    const hand = state.hands[playerId];
    const idx = hand.indexOf(cardId);
    if (idx < 0) throw new Error(`${actorName} does not have "${cardId}"`);
    const card = CARD_LIBRARY[cardId];
    if (!card) throw new Error(`Card "${cardId}" not found`);

    let entry = `${actorName} played ${card.name} (${card.description})`;
    if (card.damage) {
      state.hp[opponentId] -= card.damage;
      entry += ` → ${card.damage} damage to ${opponentId}`;
    }
    if (card.heal) {
      state.hp[playerId] += card.heal;
      entry += ` → ${card.heal} HP healed`;
    }

    // remove card from hand
    hand.splice(idx, 1);

    // clamp HP ≥ 0
    state.hp[playerAId] = Math.max(0, state.hp[playerAId]);
    state.hp[playerBId] = Math.max(0, state.hp[playerBId]);

    // check victory
    if (state.hp[opponentId] <= 0 && !state.winner) {
      state.winner = playerId;
      entry += ` — ${actorName} wins!`;
    }

    state.log.push(entry);
    state.turn++;

    // next player draws
    const nextPlayerId = state.players[state.turn % 2];
    const nextDeck = state.decks[nextPlayerId];
    if (nextDeck.length > 0 && !state.winner) {
      const drawIdx = Math.floor(Math.random() * nextDeck.length);
      const drawn = nextDeck.splice(drawIdx, 1)[0];
      state.hands[nextPlayerId].push(drawn);
      state.log.push(
        `${nextPlayerId} draws a card (${CARD_LIBRARY[drawn].name})`,
      );
    }
    state.lastActivity = Date.now();
  }

  /**
   * Play a card in an active game. If the game ends, persist to DB and remove from memory.
   */
  async playCard(
    gameId: string,
    playerId: string,
    cardId: string,
  ): Promise<GameState> {
    const state = this.activeGames[gameId];
    if (!state) throw new Error('Game not found or already finished');

    // human move
    this.applyPlay(state, playerId, cardId, `Player ${playerId}`);

    // bot move if it's next and no winner
    const nextId = state.players[state.turn % 2];
    if (nextId === BOT_ID && !state.winner) {
      const botHand = state.hands[BOT_ID];
      if (botHand.length > 0) {
        const choice = botHand[Math.floor(Math.random() * botHand.length)];
        this.applyPlay(state, BOT_ID, choice, 'Bot');
      }
    }

    // on finish, persist and clear memory
    if (state.winner) {
      await this.prisma.game.create({
        data: {
          id: gameId,
          playerA: {
            connectOrCreate: {
              where: { id: state.players[0] },
              create: { id: state.players[0], username: state.players[0] },
            },
          },
          playerB: {
            connectOrCreate: {
              where: { id: state.players[1] },
              create: { id: state.players[1], username: 'Bot Opponent' },
            },
          },
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

  /** Get live state of an active game */
  async getState(gameId: string): Promise<GameState | null> {
    return this.activeGames[gameId] ?? null;
  }

  /**
   * Get result summary.
   * If still in memory and finished, return that; otherwise load from DB.
   */
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

  listActiveGames(): Array<{
    gameId: string;
    players: string[];
    turn: number;
    lastActivity: number;
    winner: string | null;
  }> {
    return Object.entries(this.activeGames).map(([gameId, s]) => ({
      gameId,
      players: s.players,
      turn: s.turn,
      lastActivity: s.lastActivity,
      winner: s.winner,
    }));
  }

  /** Expire and remove any games idle for longer than EXPIRATION_MS */
  expireOldGames(): string[] {
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
}
