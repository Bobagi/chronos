import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { PlayCardDto } from './dto/play-card.dto';
import { GameService, GameState } from './game.service';

@Controller('game')
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(private readonly gameService: GameService) {}

  /** start a new game vs Bot */
  @Post('start')
  startGame(): { gameId: string; state: GameState } {
    this.logger.log('Creating new game vs Bot');
    return this.gameService.createGame();
  }

  /** play a card in a specific game */
  @Post('play-card')
  playCard(@Body() dto: PlayCardDto): GameState {
    this.logger.log(
      `Game ${dto.gameId}: Player ${dto.player} plays ${dto.card}`,
    );
    return this.gameService.playCard(dto.gameId, dto.player, dto.card);
  }

  /** get live state of a specific game */
  @Get('state/:gameId')
  getState(@Param('gameId') gameId: string): GameState | null {
    return this.gameService.getState(gameId);
  }

  /** get final result of a specific game */
  @Get('result/:gameId')
  getResult(@Param('gameId') gameId: string) {
    return this.gameService.getResult(gameId);
  }

  @Get('test')
  getHello(): string {
    return 'test returned!';
  }
}
