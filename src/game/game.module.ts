import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({
  imports: [PrismaModule],
  providers: [GameService, GameGateway],
  controllers: [GameController],
})
export class GameModule {}
