import { Injectable } from '@nestjs/common';

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

// Card database
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

// Full deck copies
const FULL_DECK: string[] = [
  'fireball',
  'fireball',
  'fireball',
  'lightning',
  'lightning',
  'heal',
  'heal',
];

/**
 * Draws `count` cards from `deck`, removing them.
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
  private currentGame: GameState | null = null;

  startGame(): GameState {
    // initialize decks
    const deckA = [...FULL_DECK];
    const deckB = [...FULL_DECK];
    // initial hands
    const handA = drawCards(deckA, 5);
    const handB = drawCards(deckB, 5);

    this.currentGame = {
      players: ['A', 'B'],
      turn: 0,
      log: ['Game started, hands drawn'],
      hp: { A: 20, B: 20 },
      winner: null,
      hands: { A: handA, B: handB },
      decks: { A: deckA, B: deckB },
    };
    return this.currentGame;
  }

  /**
   * Core play logic: applies effects, logs, advances turn, and draws for next.
   * `initiator` is used for logging (“Player A” or “Bot B”).
   */
  private doPlay(player: string, cardId: string, initiator: string): void {
    const state = this.currentGame!;
    const { players, hp, hands, decks, log } = state;
    const opponent = players.find((p) => p !== player)!;

    // validate hand
    const hand = hands[player];
    const idx = hand.indexOf(cardId);
    if (idx === -1) {
      throw new Error(`${initiator} does not have "${cardId}" in hand`);
    }

    // fetch card metadata
    const card = CARD_LIBRARY[cardId];
    if (!card) {
      throw new Error(`Card "${cardId}" does not exist`);
    }

    // build log entry
    let entry = `${initiator} played ${card.name} (${card.description})`;

    // apply damage
    if (card.damage) {
      hp[opponent] -= card.damage;
      entry += ` → ${card.damage} damage to ${opponent}`;
    }
    // apply healing
    if (card.heal) {
      hp[player] += card.heal;
      entry += ` → ${card.heal} HP healed`;
    }

    // remove from hand
    hand.splice(idx, 1);

    // clamp HP ≥ 0
    hp.A = Math.max(0, hp.A);
    hp.B = Math.max(0, hp.B);

    // check victory
    if (hp[opponent] <= 0 && !state.winner) {
      state.winner = player;
      entry += ` — ${initiator} wins!`;
    }

    // record action and advance turn
    log.push(entry);
    state.turn += 1;

    // next player draws one card, if available and game not over
    const next = players[state.turn % 2];
    const nextDeck = decks[next];
    if (nextDeck.length > 0 && !state.winner) {
      const drawIdx = Math.floor(Math.random() * nextDeck.length);
      const drawn = nextDeck.splice(drawIdx, 1)[0];
      hands[next].push(drawn);
      log.push(`${next} draws a card (${CARD_LIBRARY[drawn].name})`);
    }
  }

  /**
   * Human plays a card, then Bot (player "B") auto-plays if it's its turn.
   */
  playCard(player: string, card: string): GameState {
    if (!this.currentGame) throw new Error('No game in progress');
    if (this.currentGame.winner) throw new Error('Game is already over');

    // human move
    this.doPlay(player, card, `Player ${player}`);

    // if next turn is Bot's and no winner, bot plays automatically
    const nextPlayer = this.currentGame.players[this.currentGame.turn % 2];
    if (nextPlayer === 'B' && !this.currentGame.winner) {
      const botHand = this.currentGame.hands.B;
      if (botHand.length > 0) {
        const botCard = botHand[Math.floor(Math.random() * botHand.length)];
        this.doPlay('B', botCard, 'Bot B');
      }
    }

    return this.currentGame;
  }

  getState(): GameState | null {
    return this.currentGame;
  }
}
