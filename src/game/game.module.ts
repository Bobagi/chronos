import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClassicGameService } from './classic-game.service';
import { DuelGameService } from './duel-game.service';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [GameService, GameGateway, ClassicGameService, DuelGameService],
  controllers: [GameController],
  exports: [GameService],
})
export class GameModule {}
