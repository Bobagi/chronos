import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GameModule } from './game/game.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, GameModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
