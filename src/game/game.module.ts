import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CardRepository } from './card.repository';
import { ClassicGameService } from './classic-game.service';
import { DuelGameService } from './duel-game.service';
import { GameCollectionRepository } from './game-collection.repository';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    GameService,
    GameGateway,
    ClassicGameService,
    DuelGameService,
    GameCollectionRepository,
    CardRepository,
  ],
  controllers: [GameController],
  exports: [GameService],
})
export class GameModule {}
