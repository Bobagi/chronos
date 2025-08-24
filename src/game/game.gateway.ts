import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
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

  @SubscribeMessage('start')
  async handleStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    data: { playerAId: string; mode?: 'CLASSIC' | 'ATTRIBUTE_DUEL' },
  ): Promise<{ gameId: string; state: GameState }> {
    const mode = data.mode ?? 'CLASSIC';
    const result = await this.gameService.createGame(
      data.playerAId,
      BOT_ID,
      mode,
    );
    const room = `game:${result.gameId}`;
    socket.join(room);
    this.server
      .to(room)
      .emit('state', { gameId: result.gameId, state: result.state });
    return result;
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { gameId: string },
  ): Promise<{ joined: string }> {
    const room = `game:${data.gameId}`;
    socket.join(room);
    const state = await this.gameService.getState(data.gameId);
    if (state) socket.emit('state', { gameId: data.gameId, state });
    return { joined: data.gameId };
  }

  @SubscribeMessage('play')
  async handlePlay(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { gameId: string; playerId: string; cardCode: string },
  ): Promise<GameState> {
    const state = await this.gameService.playCard(
      data.gameId,
      data.playerId,
      data.cardCode,
    );
    const room = `game:${data.gameId}`;
    this.server.to(room).emit('state', { gameId: data.gameId, state });
    return state;
  }

  @SubscribeMessage('skip')
  async handleSkip(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { gameId: string; playerId: string },
  ): Promise<GameState> {
    const state = await this.gameService.skipTurn(data.gameId, data.playerId);
    const room = `game:${data.gameId}`;
    this.server.to(room).emit('state', { gameId: data.gameId, state });
    return state;
  }

  @SubscribeMessage('duel:choose-card')
  async handleDuelChooseCard(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { gameId: string; playerId: string; cardCode: string },
  ) {
    const game = await this.gameService.chooseCardForDuel(data.gameId, {
      playerId: data.playerId,
      cardCode: data.cardCode,
    });
    const room = `game:${data.gameId}`;
    this.server.to(room).emit('state', {
      gameId: data.gameId,
      state: await this.gameService.getState(data.gameId),
    });
    return game;
  }

  @SubscribeMessage('duel:choose-attribute')
  async handleDuelChooseAttribute(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    data: {
      gameId: string;
      playerId: string;
      attribute: 'magic' | 'might' | 'fire';
    },
  ) {
    const game = await this.gameService.chooseAttributeForDuel(data.gameId, {
      playerId: data.playerId,
      attribute: data.attribute,
    });
    const room = `game:${data.gameId}`;
    this.server.to(room).emit('state', {
      gameId: data.gameId,
      state: await this.gameService.getState(data.gameId),
    });
    return game;
  }

  @SubscribeMessage('duel:advance')
  async handleDuelAdvance(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    const game = await this.gameService.advanceDuelRound(data.gameId);
    const room = `game:${data.gameId}`;
    this.server.to(room).emit('state', {
      gameId: data.gameId,
      state: await this.gameService.getState(data.gameId),
    });
    return game;
  }

  @SubscribeMessage('get-state')
  async handleGetState(
    @MessageBody() data: { gameId: string },
  ): Promise<GameState | null> {
    return this.gameService.getState(data.gameId);
  }

  @SubscribeMessage('duel:unchoose-card')
  async handleDuelUnchoose(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { gameId: string; playerId: string },
  ) {
    const game = await this.gameService.unchooseCardForDuel(data.gameId, {
      playerId: data.playerId,
    });
    const room = `game:${data.gameId}`;
    this.server.to(room).emit('state', {
      gameId: data.gameId,
      state: await this.gameService.getState(data.gameId),
    });
    return game;
  }
}
