import { Injectable } from '@nestjs/common';

export interface GameState {
  players: string[];
  turn: number;
  log: string[];
  hp: Record<string, number>;
  winner: string | null;
}

const CARD_LIBRARY: Record<string, { damage?: number; heal?: number }> = {
  fireball: { damage: 5 },
  lightning: { damage: 3 },
  heal: { heal: 4 },
};

@Injectable()
export class GameService {
  private currentGame: GameState | null = null;

  startGame(): GameState {
    this.currentGame = {
      players: ['A', 'B'],
      turn: 0,
      log: [],
      hp: { A: 20, B: 20 },
      winner: null,
    };
    return this.currentGame;
  }

  playCard(player: string, card: string): GameState {
    if (!this.currentGame) throw new Error('No game in progress');
    if (this.currentGame.winner) throw new Error('Game is already over');

    const currentPlayer = this.currentGame.players[this.currentGame.turn % 2];
    const opponent = this.currentGame.players.find((p) => p !== player);

    if (player !== currentPlayer) {
      throw new Error(`It's not player ${player}'s turn`);
    }

    const effect = CARD_LIBRARY[card];
    if (!effect) {
      throw new Error(`Card "${card}" does not exist`);
    }

    let actionLog = `${player} played ${card}`;

    if (effect.damage && opponent) {
      this.currentGame.hp[opponent] -= effect.damage;
      actionLog += ` and dealt ${effect.damage} damage to ${opponent}`;
    }

    if (effect.heal) {
      this.currentGame.hp[player] += effect.heal;
      actionLog += ` and healed ${effect.heal} HP`;
    }

    // Clamp HP to min 0
    this.currentGame.hp.A = Math.max(0, this.currentGame.hp.A);
    this.currentGame.hp.B = Math.max(0, this.currentGame.hp.B);

    // Check win condition
    if (this.currentGame.hp[opponent!] <= 0) {
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
