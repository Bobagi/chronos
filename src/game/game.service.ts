import { Injectable } from '@nestjs/common';

export interface GameState {
  players: string[];
  turn: number;
  log: string[];
}

@Injectable()
export class GameService {
  private currentGame: GameState | null = null;

  startGame(): GameState {
    this.currentGame = {
      players: ['A', 'B'],
      turn: 0,
      log: [],
    };
    return this.currentGame;
  }

  playCard(player: string, card: string): GameState {
    if (!this.currentGame) throw new Error('No game in progress');
    const currentPlayer = this.currentGame.players[this.currentGame.turn % 2];

    if (player !== currentPlayer) {
      throw new Error(`It's not player ${player}'s turn`);
    }

    this.currentGame.log.push(`${player} played ${card}`);
    this.currentGame.turn += 1;
    return this.currentGame;
  }

  getState(): GameState | null {
    return this.currentGame;
  }
}
