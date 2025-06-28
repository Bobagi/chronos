import { Injectable } from '@nestjs/common';

export interface GameState {
  players: string[];
  turn: number;
  log: string[];
  hp: Record<string, number>;
  winner: string | null;
  hands: Record<string, string[]>;
}

const CARD_LIBRARY: Record<string, { damage?: number; heal?: number }> = {
  fireball: { damage: 5 },
  lightning: { damage: 3 },
  heal: { heal: 4 },
};

// complete deck
const FULL_DECK = [
  'fireball',
  'fireball',
  'fireball',
  'lightning',
  'lightning',
  'heal',
  'heal',
];

function drawCards(deck: string[], count: number): string[] {
  const pool = [...deck];
  const hand: string[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    hand.push(pool.splice(idx, 1)[0]);
  }
  return hand;
}

@Injectable()
export class GameService {
  private currentGame: GameState | null = null;

  startGame(): GameState {
    const handA = drawCards(FULL_DECK, 5);
    const handB = drawCards(FULL_DECK, 5);

    this.currentGame = {
      players: ['A', 'B'],
      turn: 0,
      log: [],
      hp: { A: 20, B: 20 },
      winner: null,
      hands: { A: handA, B: handB },
    };
    return this.currentGame;
  }

  playCard(player: string, card: string): GameState {
    if (!this.currentGame) throw new Error('No game in progress');
    if (this.currentGame.winner) throw new Error('Game is already over');

    const currentPlayer = this.currentGame.players[this.currentGame.turn % 2];
    const opponent = this.currentGame.players.find((p) => p !== player)!;

    if (player !== currentPlayer) {
      throw new Error(`It's not player ${player}'s turn`);
    }

    const hand = this.currentGame.hands[player];
    const idx = hand.indexOf(card);
    if (idx === -1) {
      throw new Error(`Player ${player} does not have "${card}" in hand`);
    }

    const effect = CARD_LIBRARY[card];
    if (!effect) {
      throw new Error(`Card "${card}" does not exist`);
    }

    let actionLog = `${player} played ${card}`;

    // apply damage effect
    if (effect.damage) {
      this.currentGame.hp[opponent] -= effect.damage;
      actionLog += ` and dealt ${effect.damage} damage to ${opponent}`;
    }

    // apply healing effect
    if (effect.heal) {
      this.currentGame.hp[player] += effect.heal;
      actionLog += ` and healed ${effect.heal} HP`;
    }

    // pop card from hand
    hand.splice(idx, 1);

    // adjust minimum HP to 0
    this.currentGame.hp.A = Math.max(0, this.currentGame.hp.A);
    this.currentGame.hp.B = Math.max(0, this.currentGame.hp.B);

    // check victory
    if (this.currentGame.hp[opponent] <= 0) {
      this.currentGame.winner = player;
      actionLog += ` — ${player} wins!`;
    }

    this.currentGame.log.push(actionLog);
    this.currentGame.turn += 1;

    return this.currentGame;
  }

  getState(): GameState | null {
    return this.currentGame;
  }
}
