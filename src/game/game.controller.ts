import { Body, Controller, Delete, Get, Logger, Param, Post } from '@nestjs/common';
import { PlayCardDto } from './dto/play-card.dto';
import { BOT_ID, GameService, GameState } from './game.service';

@Controller('game')
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(private readonly gameService: GameService) {}

  /** Start a new game vs BOT: { playerAId } */
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
    this.logger.log(`Game ${dto.gameId}: Player ${dto.player} plays ${dto.card}`);
    return this.gameService.playCard(dto.gameId, dto.player, dto.card);
  }

  /** Skip the player's turn: { gameId, player } */
  @Post('skip-turn')
  async skipTurn(@Body() body: { gameId: string; player: string }) {
    const { gameId, player } = body;
    this.logger.log(`Game ${gameId}: Player ${player} skips turn`);
    return this.gameService.skipTurn(gameId, player);
  }

  /** End a running in‑memory game (does not delete DB record) */
  @Delete('end/:gameId')
  async endGame(@Param('gameId') gameId: string) {
    return this.gameService.deleteGame(gameId);
  }

  /** Get in‑memory state (null if finished) */
  @Get('state/:gameId')
  async getState(@Param('gameId') gameId: string): Promise<GameState | null> {
    return this.gameService.getState(gameId);
  }

  /** Get final result from memory or DB */
  @Get('result/:gameId')
  async getResult(@Param('gameId') gameId: string) {
    return this.gameService.getResult(gameId);
  }

  /** List active in‑memory games */
  @Get('active')
  getActiveGames() {
    return this.gameService.listActiveGames();
  }

  /** Expire idle games */
  @Post('expire')
  expireGames() {
    return { expired: this.gameService.expireOldGames() };
  }

  /** Card and template catalogs (for Kairos) */
  @Get('cards')
  getCards() {
    return this.gameService.getAllCards();
  }

  @Get('templates')
  getTemplates() {
    return this.gameService.getAllTemplates();
  }

  /** Healthcheck */
  @Get('test')
  getHello(): string {
    return 'test returned!';
  }
}
