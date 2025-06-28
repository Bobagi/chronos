import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { PlayCardDto } from './dto/play-card.dto';
import { BOT_ID, GameService, GameState } from './game.service';

@Controller('game')
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(private readonly gameService: GameService) {}

  /**
   * Start a new game vs Bot.
   * Expects body: { "playerAId": "<yourPlayerId>" }
   */
  @Post('start')
  async startGame(
    @Body('playerAId') playerAId: string,
  ): Promise<{ gameId: string; state: GameState }> {
    this.logger.log(`Starting new game: ${playerAId} vs Bot`);
    return this.gameService.createGame(playerAId, BOT_ID);
  }

  @Post('play-card')
  async playCard(@Body() dto: PlayCardDto): Promise<GameState> {
    this.logger.log(
      `Game ${dto.gameId}: Player ${dto.player} plays ${dto.card}`,
    );
    return this.gameService.playCard(dto.gameId, dto.player, dto.card);
  }

  @Get('state/:gameId')
  async getState(@Param('gameId') gameId: string): Promise<GameState | null> {
    return this.gameService.getState(gameId);
  }

  @Get('result/:gameId')
  async getResult(@Param('gameId') gameId: string) {
    return this.gameService.getResult(gameId);
  }

  @Get('test')
  getHello(): string {
    return 'test returned!';
  }

  /** List active games still in memory */
  @Get('active')
  getActiveGames() {
    return this.gameService.listActiveGames();
  }

  /** Expire any old games and return their IDs */
  @Post('expire')
  expireGames() {
    return { expired: this.gameService.expireOldGames() };
  }
}
