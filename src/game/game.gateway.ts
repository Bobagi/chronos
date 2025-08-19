import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { GameService } from './game.service';
import { BOT_ID, GameState } from './game.types';

@WebSocketGateway({ namespace: 'game', cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) {}

  afterInit() {}
  handleConnection() {}
  handleDisconnect() {}

  /**
   * WebSocket: start a new game vs Bot.
   * Expects message body: { playerAId: string }
   */
  @SubscribeMessage('start')
  async handleStart(
    @MessageBody() data: { playerAId: string },
  ): Promise<{ gameId: string; state: GameState }> {
    const res = await this.gameService.createGame(data.playerAId, BOT_ID);
    this.server.emit('state', { gameId: res.gameId, state: res.state });
    return res;
  }

  /**
   * WebSocket: play a card.
   * Expects: { gameId, player, card }
   */
  @SubscribeMessage('play')
  async handlePlay(
    @MessageBody() data: { gameId: string; player: string; card: string },
  ): Promise<GameState> {
    const state = await this.gameService.playCard(
      data.gameId,
      data.player,
      data.card,
    );
    this.server.emit('state', { gameId: data.gameId, state });
    return state;
  }

  /** WebSocket: fetch current state for a game */
  @SubscribeMessage('state')
  async handleState(
    @MessageBody() data: { gameId: string },
  ): Promise<GameState | null> {
    return this.gameService.getState(data.gameId);
  }
}
