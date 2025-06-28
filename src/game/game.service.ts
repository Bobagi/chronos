import { Injectable } from '@nestjs/common';

export interface GameState {
  players: string[];
  turn: number;
  log: string[];
  hp: Record<string, number>;
  winner: string | null;
  hands: Record<string, string[]>;
  decks: Record<string, string[]>;
}

const CARD_LIBRARY: Record<string, { damage?: number; heal?: number }> = {
  fireball: { damage: 5 },
  lightning: { damage: 3 },
  heal: { heal: 4 },
};

// Complete deck (multiple copies)
const FULL_DECK = [
  'fireball',
  'fireball',
  'fireball',
  'lightning',
  'lightning',
  'heal',
  'heal',
];

/**
 * Draws `count` cards from the `deck` array, removing them from it.
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
    // Create separate decks for each player
    const deckA = [...FULL_DECK];
    const deckB = [...FULL_DECK];

    // Draw 5 cards from deck to each hand
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

  playCard(player: string, card: string): GameState {
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
    const idx = hand.indexOf(card);
    if (idx === -1) {
      throw new Error(`Player ${player} does not have "${card}" in hand`);
    }

    // Apply effect
    const effect = CARD_LIBRARY[card];
    if (!effect) {
      throw new Error(`Card "${card}" does not exist`);
    }

    let actionLog = `${player} played ${card}`;

    if (effect.damage) {
      hp[opponent] -= effect.damage;
      actionLog += ` and dealt ${effect.damage} damage to ${opponent}`;
    }
    if (effect.heal) {
      hp[player] += effect.heal;
      actionLog += ` and healed ${effect.heal} HP`;
    }

    // Remove card from hand
    hand.splice(idx, 1);

    // HP clamping
    hp.A = Math.max(0, hp.A);
    hp.B = Math.max(0, hp.B);

    // Check victory condition
    if (hp[opponent] <= 0) {
      this.currentGame.winner = player;
      actionLog += ` — ${player} wins!`;
    }

    log.push(actionLog);
    this.currentGame.turn += 1;

    // Draw 1 card for next player if deck isn't empty and game hasn't ended
    const nextPlayer = players[this.currentGame.turn % 2];
    const nextDeck = decks[nextPlayer];
    if (nextDeck.length > 0 && !this.currentGame.winner) {
      const drawIdx = Math.floor(Math.random() * nextDeck.length);
      const drawn = nextDeck.splice(drawIdx, 1)[0];
      hands[nextPlayer].push(drawn);
      log.push(`${nextPlayer} draws a card`);
    }

    return this.currentGame;
  }

  getState(): GameState | null {
    return this.currentGame;
  }
}
