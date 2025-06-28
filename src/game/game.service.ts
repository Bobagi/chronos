import { Injectable } from '@nestjs/common';

export interface Card {
  id: string;
  name: string;
  description: string;
  damage?: number;
  heal?: number;
  // future fields: cost, rarity, specialEffectFn, etc.
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

// Card database with unique effects described
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
  // Example of a future unique effect:
  // chain: {
  //   id: 'chain',
  //   name: 'Chain Lightning',
  //   description: 'Deal 2 damage to both players',
  //   damage: 2,
  //   special: 'both'
  // }
};

// Full deck representation by card ids
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
 * Draws `count` random cards from `deck`, removing them.
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
    // Initialize separate decks and hands
    const deckA = [...FULL_DECK];
    const deckB = [...FULL_DECK];
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

  playCard(player: string, cardId: string): GameState {
    if (!this.currentGame) throw new Error('No game in progress');
    if (this.currentGame.winner) throw new Error('Game is already over');

    const { players, turn, hp, hands, decks, log } = this.currentGame;
    const currentPlayer = players[turn % 2];
    const opponent = players.find((p) => p !== player)!;

    if (player !== currentPlayer) {
      throw new Error(`It's not player ${player}'s turn`);
    }

    // Validate card in hand
    const hand = hands[player];
    const idx = hand.indexOf(cardId);
    if (idx === -1) {
      throw new Error(`Player ${player} does not have "${cardId}" in hand`);
    }

    // Fetch card metadata
    const card = CARD_LIBRARY[cardId];
    if (!card) {
      throw new Error(`Card "${cardId}" does not exist`);
    }

    // Build log entry with name and description
    let entry = `${player} played ${card.name} (${card.description})`;

    // Apply damage
    if (card.damage) {
      hp[opponent] -= card.damage;
      entry += ` → ${card.damage} damage to ${opponent}`;
    }
    // Apply healing
    if (card.heal) {
      hp[player] += card.heal;
      entry += ` → ${card.heal} HP healed`;
    }

    // Remove the card from hand
    hand.splice(idx, 1);

    // Clamp HP to minimum 0
    hp.A = Math.max(0, hp.A);
    hp.B = Math.max(0, hp.B);

    // Check for victory
    if (hp[opponent] <= 0) {
      this.currentGame.winner = player;
      entry += ` — ${player} wins!`;
    }

    // Record action
    log.push(entry);

    // Advance turn
    this.currentGame.turn += 1;

    // Next player draws a card automatically (if any left and no winner)
    const next = players[this.currentGame.turn % 2];
    const nextDeck = decks[next];
    if (nextDeck.length > 0 && !this.currentGame.winner) {
      const drawIdx = Math.floor(Math.random() * nextDeck.length);
      const drawn = nextDeck.splice(drawIdx, 1)[0];
      hands[next].push(drawn);
      log.push(`${next} draws a card (${CARD_LIBRARY[drawn].name})`);
    }

    return this.currentGame;
  }

  getState(): GameState | null {
    return this.currentGame;
  }
}
