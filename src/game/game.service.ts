import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto'; // Node 18+

export interface Card {
  id: string;
  name: string;
  description: string;
  damage?: number;
  heal?: number;
}

export interface GameState {
  players: string[];
  turn: number;
  log: string[];
  hp: Record<string, number>;
  winner: string | null;
  hands: Record<string, string[]>;
  decks: Record<string, string[]>;
}

// full deck definition (IDs only)
const FULL_DECK: string[] = [
  'fireball',
  'fireball',
  'fireball',
  'lightning',
  'lightning',
  'heal',
  'heal',
];

// rich card database
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

/** draw `count` cards from `deck`, mutating it */
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
  // store all games by ID
  private games: Record<string, GameState> = {};

  /** create a new game vs Bot, return its ID and initial state */
  createGame(): { gameId: string; state: GameState } {
    const gameId = randomUUID();
    const deckA = [...FULL_DECK];
    const deckB = [...FULL_DECK];
    const handA = drawCards(deckA, 5);
    const handB = drawCards(deckB, 5);

    const state: GameState = {
      players: ['A', 'B'],
      turn: 0,
      log: ['Game started, hands drawn'],
      hp: { A: 20, B: 20 },
      winner: null,
      hands: { A: handA, B: handB },
      decks: { A: deckA, B: deckB },
    };

    this.games[gameId] = state;
    return { gameId, state };
  }

  /** private helper: apply one play (human or bot) */
  private doPlay(
    state: GameState,
    player: string,
    cardId: string,
    actorName: string,
  ): void {
    const { players, hp, hands, decks, log } = state;
    const opponent = players.find((p) => p !== player)!;

    // validate
    const hand = hands[player];
    const idx = hand.indexOf(cardId);
    if (idx < 0) throw new Error(`${actorName} does not have "${cardId}"`);
    const card = CARD_LIBRARY[cardId];
    if (!card) throw new Error(`Card "${cardId}" does not exist`);

    // log entry
    let entry = `${actorName} played ${card.name} (${card.description})`;

    if (card.damage) {
      hp[opponent] -= card.damage;
      entry += ` → ${card.damage} damage to ${opponent}`;
    }
    if (card.heal) {
      hp[player] += card.heal;
      entry += ` → ${card.heal} HP healed`;
    }

    // remove card
    hand.splice(idx, 1);

    // clamp HP ≥ 0
    hp.A = Math.max(0, hp.A);
    hp.B = Math.max(0, hp.B);

    // check victory
    if (hp[opponent] <= 0 && !state.winner) {
      state.winner = player;
      entry += ` — ${actorName} wins!`;
    }

    log.push(entry);
    state.turn += 1;

    // next player draws
    const nextPlayer = players[state.turn % 2];
    const nextDeck = decks[nextPlayer];
    if (nextDeck.length > 0 && !state.winner) {
      const dIdx = Math.floor(Math.random() * nextDeck.length);
      const drawn = nextDeck.splice(dIdx, 1)[0];
      hands[nextPlayer].push(drawn);
      log.push(`${nextPlayer} draws a card (${CARD_LIBRARY[drawn].name})`);
    }
  }

  /** human plays, then Bot auto-plays if it's B’s turn */
  playCard(gameId: string, player: string, cardId: string): GameState {
    const state = this.games[gameId];
    if (!state) throw new Error('Game not found');
    if (state.winner) throw new Error('Game already over');

    // human move
    this.doPlay(state, player, cardId, `Player ${player}`);

    // bot move
    const next = state.players[state.turn % 2];
    if (next === 'B' && !state.winner) {
      const botHand = state.hands.B;
      if (botHand.length > 0) {
        const choice = botHand[Math.floor(Math.random() * botHand.length)];
        this.doPlay(state, 'B', choice, 'Bot B');
      }
    }

    return state;
  }

  /** get full state by gameId */
  getState(gameId: string): GameState | null {
    return this.games[gameId] ?? null;
  }

  /** get result summary by gameId */
  getResult(gameId: string): { winner: string | null; log: string[] } {
    const state = this.games[gameId];
    if (!state) throw new Error('Game not found');
    return { winner: state.winner, log: state.log };
  }
}
