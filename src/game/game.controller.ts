import { Body, Controller, Get, Logger, Param, Post, Delete } from '@nestjs/common';
import { PlayCardDto } from './dto/play-card.dto';
import { BOT_ID, GameService, GameState } from './game.service';
@Controller('game')
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(private readonly gameService: GameService) {}

  /** Start a new game vs Bot: { playerAId } */
  @Post('start')
  async startGame(
    @Body('playerAId') playerAId: string,
  ): Promise<{ gameId: string; state: GameState }> {
    this.logger.log(`Starting new game: ${playerAId} vs Bot`);
    return this.gameService.createGame(playerAId, BOT_ID);
  }

  /** Play a card: { gameId, player, card } */
  @Post('play-card')
  async playCard(@Body() dto: PlayCardDto): Promise<GameState> {
    this.logger.log(
      `Game ${dto.gameId}: Player ${dto.player} plays ${dto.card}`,
    );
    return this.gameService.playCard(dto.gameId, dto.player, dto.card);
  }

  @Delete('end/:gameId')
  async deleteGame(@Param('gameId') gameId: string) {
    return this.gameService.deleteGame(gameId);
  }

  /** Get in-memory state for a game */
  @Get('state/:gameId')
  async getState(@Param('gameId') gameId: string): Promise<GameState | null> {
    return this.gameService.getState(gameId);
  }

  /** Get final result (persisted or just-finished) */
  @Get('result/:gameId')
  async getResult(@Param('gameId') gameId: string) {
    return this.gameService.getResult(gameId);
  }

  /** List active in-memory games */
  @Get('active')
  getActiveGames() {
    return this.gameService.listActiveGames();
  }

  /** Expire stale games */
  @Post('expire')
  expireGames() {
    return { expired: this.gameService.expireOldGames() };
  }

  /** Expose full card database to Kairos */
  @Get('cards')
  getCards() {
    return this.gameService.getAllCards();
  }

  /** Expose card-template database to Kairos */
  @Get('templates')
  getTemplates() {
    return this.gameService.getAllTemplates();
  }

  /** simple test endpoint */
  @Get('test')
  getHello(): string {
    return 'test returned!';
  }
}
