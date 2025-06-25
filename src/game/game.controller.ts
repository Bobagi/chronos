import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { PlayCardDto } from './dto/play-card.dto';
import { GameService, GameState } from './game.service';

@Controller('game')
export class GameController {
  private readonly logger = new Logger(GameController.name);
  constructor(private readonly gameService: GameService) {}

  @Post('start')
  startGame(): GameState {
    this.logger.log('Starting a new game');
    return this.gameService.startGame();
  }

  @Post('play-card')
  playCard(@Body() dto: PlayCardDto): GameState {
    this.logger.log(`Player ${dto.player} is playing card ${dto.card}`);
    return this.gameService.playCard(dto.player, dto.card);
  }

  @Get('state')
  getState(): GameState | null {
    return this.gameService.getState();
  }

  @Get('test')
  getHello(): string {
    return 'test returned!';
  }
}
