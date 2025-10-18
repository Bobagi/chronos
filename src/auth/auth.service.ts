import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

type PlayerRole = 'USER' | 'ADMIN';

interface StoredPlayer {
  id: string;
  username: string;
  passwordHash?: string | null;
  role?: PlayerRole | null;
}

const DEFAULT_PLAYER_ROLE: PlayerRole = 'USER';

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
    const user = (await this.prisma.player.create({
      data: { username, passwordHash, role } as unknown as Prisma.PlayerCreateInput,
    })) as StoredPlayer;
    const roleForToken = user.role ?? DEFAULT_PLAYER_ROLE;
    const token = await this.sign(user.id, user.username, roleForToken);
    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        role: roleForToken,
      },
    };
  }

  async login(username: string, password: string) {
    const user = (await this.prisma.player.findUnique({
      where: { username },
    })) as StoredPlayer | null;
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const role = user.role ?? DEFAULT_PLAYER_ROLE;
    const token = await this.sign(user.id, user.username, role);
    return {
      accessToken: token,
      user: { id: user.id, username: user.username, role },
    };
  }

  private async sign(sub: string, username: string, role: PlayerRole) {
    return this.jwt.signAsync({ sub, username, role });
  }

  async me(userId: string) {
    const u = (await this.prisma.player.findUnique({
      where: { id: userId },
    })) as StoredPlayer | null;
    if (!u) throw new UnauthorizedException();
    return {
      id: u.id,
      username: u.username,
      role: u.role ?? DEFAULT_PLAYER_ROLE,
    };
  }
}
