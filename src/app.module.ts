import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FriendsModule } from './friends/friends.module';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'frontend', 'build', 'client'),
      exclude: ['/api', '/api/(.*)', '/auth', '/auth/(.*)', '/game', '/game/(.*)', '/health', '/health/(.*)', '/friends', '/friends/(.*)'],
    }),
    PrismaModule,
    GameModule,
    AuthModule,
    FriendsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
