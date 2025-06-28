/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

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
    // Called once after gateway initialization
  }

  handleConnection(client: Socket) {
    // New client connected
  }

  handleDisconnect(client: Socket) {
    // Client disconnected
  }

  // Start a new game via WebSocket
  @SubscribeMessage('start')
  handleStart(): GameState {
    const state = this.gameService.startGame();
    this.server.emit('state', state);
    return state;
  }

  // Play a card via WebSocket
  @SubscribeMessage('play')
  handlePlay(@MessageBody() data: { player: string; card: string }): GameState {
    const state = this.gameService.playCard(data.player, data.card);
    this.server.emit('state', state);
    return state;
  }

  // Fetch current state via WebSocket
  @SubscribeMessage('state')
  handleState(): GameState | null {
    return this.gameService.getState();
  }
}
