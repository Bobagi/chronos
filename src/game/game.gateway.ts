import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService, GameState } from './game.service';

@WebSocketGateway({ namespace: 'game', cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(private readonly gameService: GameService) {}

  afterInit(server: Server) {
    // Called once after gateway is initialized
  }

  handleConnection(client: Socket) {
    // New client connected
  }

  handleDisconnect(client: Socket) {
    // Client disconnected
  }

  /** start a new game vs Bot */
  @SubscribeMessage('start')
  handleStart(): { gameId: string; state: GameState } {
    const { gameId, state } = this.gameService.createGame();
    // broadcast the new state along with the gameId
    this.server.emit('state', { gameId, state });
    return { gameId, state };
  }

  /** human plays a card – expects { gameId, player, card } */
  @SubscribeMessage('play')
  handlePlay(
    @MessageBody()
    data: {
      gameId: string;
      player: string;
      card: string;
    },
  ): GameState {
    const state = this.gameService.playCard(
      data.gameId,
      data.player,
      data.card,
    );
    // broadcast updated state to all clients
    this.server.emit('state', { gameId: data.gameId, state });
    return state;
  }

  /** fetch current state of a given gameId */
  @SubscribeMessage('state')
  handleState(@MessageBody() data: { gameId: string }): GameState | null {
    return this.gameService.getState(data.gameId);
  }
}
