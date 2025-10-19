import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FriendsModule } from './friends/friends.module';
import { GameModule } from './game/game.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, GameModule, AuthModule, FriendsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
