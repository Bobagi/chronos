import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

type PlayerRole = UserRole;

const DEFAULT_PLAYER_ROLE: PlayerRole = UserRole.USER;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(
    username: string,
    password: string,
    role: PlayerRole = DEFAULT_PLAYER_ROLE,
  ) {
    const exists = await this.prisma.player.findUnique({ where: { username } });
    if (exists) throw new BadRequestException('Username already taken');

    const passwordHash = await bcrypt.hash(password, 10);
    const playerData: Prisma.PlayerCreateInput = {
      username,
      passwordHash,
      role,
    };
    const createdPlayer = await this.prisma.player.create({
      data: playerData,
    });
    const token = await this.sign(
      createdPlayer.id,
      createdPlayer.username,
      createdPlayer.role,
    );
    return {
      accessToken: token,
      user: {
        id: createdPlayer.id,
        username: createdPlayer.username,
        role: createdPlayer.role,
      },
    };
  }

  async login(username: string, password: string) {
    const playerRecord = await this.prisma.player.findUnique({
      where: { username },
    });
    if (!playerRecord)
      throw new UnauthorizedException('Invalid credentials');
    const passwordMatches = await bcrypt.compare(
      password,
      playerRecord.passwordHash,
    );
    if (!passwordMatches) throw new UnauthorizedException('Invalid credentials');
    const token = await this.sign(
      playerRecord.id,
      playerRecord.username,
      playerRecord.role,
    );
    return {
      accessToken: token,
      user: {
        id: playerRecord.id,
        username: playerRecord.username,
        role: playerRecord.role,
      },
    };
  }

  private async sign(sub: string, username: string, role: PlayerRole) {
    return this.jwt.signAsync({ sub, username, role });
  }

  async me(userId: string) {
    const playerRecord = await this.prisma.player.findUnique({
      where: { id: userId },
    });
    if (!playerRecord) throw new UnauthorizedException();
    return {
      id: playerRecord.id,
      username: playerRecord.username,
      role: playerRecord.role,
    };
  }
}
