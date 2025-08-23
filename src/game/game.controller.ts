import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChooseAttributeDto } from './dto/choose-attribute.dto';
import { ChooseCardDto } from './dto/choose-card.dto';
import { PlayCardDto } from './dto/play-card.dto';
import { GameService } from './game.service';
import { BOT_ID, GameState } from './game.types';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('game')
export class GameController {
  private readonly logger = new Logger(GameController.name);
  constructor(private readonly gameService: GameService) {}

  /** Start CLASSIC */
  @Post('start-classic')
  async startClassic(
    @Body('playerAId') playerAId: string,
  ): Promise<{ gameId: string; state: GameState }> {
    this.logger.log(`Starting CLASSIC for ${playerAId} vs BOT`);
    return this.gameService.createGame(playerAId, BOT_ID, 'CLASSIC');
  }

  /** Start DUEL */
  @Post('start-duel')
  async startDuel(
    @Body('playerAId') playerAId: string,
  ): Promise<{ gameId: string; state: GameState }> {
    this.logger.log(`Starting ATTRIBUTE_DUEL for ${playerAId} vs BOT`);
    return this.gameService.createGame(playerAId, BOT_ID, 'ATTRIBUTE_DUEL');
  }

  /** Legacy start (kept for compatibility) -> CLASSIC */
  @Post('start')
  async startLegacy(
    @Body('playerAId') playerAId: string,
  ): Promise<{ gameId: string; state: GameState }> {
    this.logger.log(`Starting legacy (CLASSIC) for ${playerAId} vs BOT`);
    return this.gameService.createGame(playerAId, BOT_ID, 'CLASSIC');
  }

  /** Classic actions */
  @Post('play-card')
  async playCard(@Body() dto: PlayCardDto) {
    return this.gameService.playCard(dto.gameId, dto.player, dto.card);
  }

  @Post('skip-turn')
  async skipTurn(@Body() body: { gameId: string; player: string }) {
    return this.gameService.skipTurn(body.gameId, body.player);
  }

  /** Duel actions */
  @Post(':id/duel/choose-card')
  chooseCard(@Param('id') id: string, @Body() dto: ChooseCardDto) {
    return this.gameService.chooseCardForDuel(id, dto);
  }

  @Post(':id/duel/choose-attribute')
  chooseAttribute(@Param('id') id: string, @Body() dto: ChooseAttributeDto) {
    return this.gameService.chooseAttributeForDuel(id, dto);
  }

  /** Commit a REVEAL and advance to next round (or finish) */
  @Post(':id/duel/advance')
  advance(@Param('id') id: string) {
    return this.gameService.advanceDuelRound(id);
  }

  /** State & result */
  @Get('state/:gameId')
  async getState(@Param('gameId') gameId: string): Promise<GameState | null> {
    return this.gameService.getState(gameId);
  }

  @Get('result/:gameId')
  async getResult(@Param('gameId') gameId: string) {
    return this.gameService.getResult(gameId);
  }

  /** Expire only in-memory games */
  @Post('expire')
  expire() {
    return { expired: this.gameService.expireOldGames() };
  }

  /** End in-memory game */
  @Delete('end/:gameId')
  async end(@Param('gameId') gameId: string) {
    return this.gameService.deleteGame(gameId);
  }

  /** Card catalog */
  @Get('cards')
  getCards() {
    return this.gameService.getAllCards();
  }

  /** Single card by code */
  @Get('cards/:code')
  getCardByCode(@Param('code') code: string) {
    return this.gameService.getCardByCode(code);
  }

  /** Health */
  @Get('test')
  test(): string {
    return 'test returned!';
  }

  @Post(':id/duel/unchoose-card')
  unchooseCard(@Param('id') id: string, @Body() body: { playerId: string }) {
    return this.gameService.unchooseCardForDuel(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('active')
  getActiveGames() {
    return this.gameService.listActiveGamesUnified();
  }

  @UseGuards(JwtAuthGuard)
  @Get('active/mine')
  getActiveGamesOfMine(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.gameService.listActiveForPlayer(userId);
  }
}
