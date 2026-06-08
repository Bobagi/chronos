import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Player, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PLAYER_ROLE: UserRole = UserRole.USER;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  /** Public, safe shape of a player returned to clients. */
  private toUserDto(player: Player) {
    return {
      id: player.id,
      username: player.username,
      role: player.role,
      avatarUrl: player.avatarUrl ?? null,
    };
  }

  async register(
    username: string,
    password: string,
    role: UserRole = DEFAULT_PLAYER_ROLE,
  ) {
    const existingPlayer = await this.prisma.player.findUnique({
      where: { username },
    });
    if (existingPlayer) throw new BadRequestException('Username already taken');

    const passwordHash = await bcrypt.hash(password, 10);
    const createdPlayer = await this.prisma.player.create({
      data: { username, passwordHash, role },
    });
    const token = await this.sign(
      createdPlayer.id,
      createdPlayer.username,
      createdPlayer.role,
    );
    return { accessToken: token, user: this.toUserDto(createdPlayer) };
  }

  async login(username: string, password: string) {
    const user = await this.prisma.player.findUnique({ where: { username } });
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const token = await this.sign(user.id, user.username, user.role);
    return { accessToken: token, user: this.toUserDto(user) };
  }

  private async sign(sub: string, username: string, role: UserRole) {
    return this.jwt.signAsync({ sub, username, role });
  }

  async me(userId: string) {
    const user = await this.prisma.player.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.toUserDto(user);
  }

  /** Choose a profile avatar (a relative path or http(s) URL, max 255 chars). */
  async updateAvatar(userId: string, avatarUrl: string) {
    const trimmed = (avatarUrl ?? '').trim();
    const isValid =
      trimmed.length > 0 &&
      trimmed.length <= 255 &&
      (trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed));
    if (!isValid) throw new BadRequestException('Invalid avatar URL');

    const updated = await this.prisma.player.update({
      where: { id: userId },
      data: { avatarUrl: trimmed },
    });
    return this.toUserDto(updated);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!newPassword || newPassword.length < 4)
      throw new BadRequestException('New password is too short');

    const user = await this.prisma.player.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword ?? '', user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.player.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  async changeUsername(userId: string, newUsername: string) {
    const username = (newUsername ?? '').trim();
    if (username.length < 3 || username.length > 50)
      throw new BadRequestException('Username must be 3–50 characters');

    const existing = await this.prisma.player.findUnique({
      where: { username },
    });
    if (existing && existing.id !== userId)
      throw new BadRequestException('Username already taken');

    const updated = await this.prisma.player.update({
      where: { id: userId },
      data: { username },
    });
    return this.toUserDto(updated);
  }

  /** Permanently delete the account and everything that references it. */
  async deleteAccount(userId: string) {
    await this.prisma.$transaction([
      this.prisma.friendChatMessage.deleteMany({
        where: { OR: [{ senderId: userId }, { recipientId: userId }] },
      }),
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: userId },
            { addresseeId: userId },
            { blockedById: userId },
          ],
        },
      }),
      this.prisma.game.deleteMany({
        where: { OR: [{ playerAId: userId }, { playerBId: userId }] },
      }),
      this.prisma.player.delete({ where: { id: userId } }),
    ]);
    return { ok: true };
  }
}
