import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(username: string, password: string, role: UserRole = 'USER') {
    const exists = await this.prisma.player.findUnique({ where: { username } });
    if (exists) throw new BadRequestException('Username already taken');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.player.create({
      data: { username, passwordHash, role },
    });
    const token = await this.sign(user.id, user.username, user.role);
    return {
      accessToken: token,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  async login(username: string, password: string) {
    const user = await this.prisma.player.findUnique({ where: { username } });
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const token = await this.sign(user.id, user.username, user.role);
    return {
      accessToken: token,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  private async sign(sub: string, username: string, role: UserRole) {
    return this.jwt.signAsync({ sub, username, role });
  }

  async me(userId: string) {
    const u = await this.prisma.player.findUnique({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    return { id: u.id, username: u.username, role: u.role };
  }
}
