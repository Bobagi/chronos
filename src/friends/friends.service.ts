import { Injectable } from '@nestjs/common';
import { FriendshipStatus, type Friendship, type Player } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface BasicPlayerSummary {
  id: string;
  username: string;
}

export interface FriendshipSummary {
  friendshipId: string;
  friend: BasicPlayerSummary;
  status: FriendshipStatus;
  blockedByMe: boolean;
}

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  private playerSummary(player: Pick<Player, 'id' | 'username'>): BasicPlayerSummary {
    return { id: player.id, username: player.username };
  }

  private async findFriendshipBetween(
    userAId: string,
    userBId: string,
  ): Promise<Friendship | null> {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userAId, addresseeId: userBId },
          { requesterId: userBId, addresseeId: userAId },
        ],
      },
    });
  }

  async searchPlayers(
    requesterId: string,
    query: string,
  ): Promise<BasicPlayerSummary[]> {
    if (!query.trim()) return [];
    const users = await this.prisma.player.findMany({
      where: {
        id: { not: requesterId },
        username: { contains: query, mode: 'insensitive' },
      },
      orderBy: { username: 'asc' },
      take: 20,
      select: { id: true, username: true },
    });
    return users.map((user) => this.playerSummary(user));
  }

  async listFriends(userId: string): Promise<FriendshipSummary[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: { in: [FriendshipStatus.ACCEPTED, FriendshipStatus.BLOCKED] },
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return friendships.map((friendship) => {
      const isRequester = friendship.requesterId === userId;
      const counterpart = isRequester
        ? friendship.addressee
        : friendship.requester;
      return {
        friendshipId: friendship.id,
        friend: this.playerSummary(counterpart),
        status: friendship.status,
        blockedByMe: friendship.blockedById === userId,
      };
    });
  }

  async listIncomingRequests(userId: string) {
    const requests = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.PENDING,
        addresseeId: userId,
      },
      include: {
        requester: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((request) => ({
      friendshipId: request.id,
      requester: this.playerSummary(request.requester),
      createdAt: request.createdAt,
    }));
  }

  async sendFriendRequest(requesterId: string, targetId: string) {
    if (!targetId) throw new Error('Target player not found.');
    if (requesterId === targetId)
      throw new Error('Unable to send a friend request to yourself.');

    const existing = await this.findFriendshipBetween(requesterId, targetId);
    if (existing) {
      if (existing.status === FriendshipStatus.BLOCKED) {
        throw new Error('Friendship is blocked.');
      }
      if (
        existing.status === FriendshipStatus.PENDING &&
        existing.addresseeId === requesterId
      ) {
        return this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: FriendshipStatus.ACCEPTED, blockedById: null },
        });
      }
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new Error('Players are already friends.');
      }
      throw new Error('Friend request already sent.');
    }

    await this.assertPlayerExists(targetId);
    return this.prisma.friendship.create({
      data: {
        requesterId,
        addresseeId: targetId,
        status: FriendshipStatus.PENDING,
      },
    });
  }

  private async assertPlayerExists(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true },
    });
    if (!player) throw new Error('Target player not found.');
  }

  async respondToRequest(
    friendshipId: string,
    userId: string,
    accept: boolean,
  ) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) throw new Error('Friend request not found.');
    if (friendship.addresseeId !== userId)
      throw new Error('Only the recipient can respond to this request.');
    if (friendship.status !== FriendshipStatus.PENDING)
      throw new Error('Request already resolved.');

    if (!accept) {
      await this.prisma.friendship.delete({ where: { id: friendshipId } });
      return { dismissed: true };
    }

    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.ACCEPTED, blockedById: null },
    });
  }

  async removeFriend(friendshipId: string, userId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) throw new Error('Friendship not found.');
    if (
      friendship.requesterId !== userId &&
      friendship.addresseeId !== userId
    ) {
      throw new Error('Not authorized to modify this friendship.');
    }

    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { removed: true };
  }

  async blockUser(actorId: string, targetId: string) {
    if (!targetId) throw new Error('Target player not found.');
    if (actorId === targetId)
      throw new Error('Unable to block your own profile.');
    await this.assertPlayerExists(targetId);

    const existing = await this.findFriendshipBetween(actorId, targetId);
    if (!existing) {
      return this.prisma.friendship.create({
        data: {
          requesterId: actorId,
          addresseeId: targetId,
          status: FriendshipStatus.BLOCKED,
          blockedById: actorId,
        },
      });
    }

    return this.prisma.friendship.update({
      where: { id: existing.id },
      data: {
        status: FriendshipStatus.BLOCKED,
        blockedById: actorId,
      },
    });
  }

  async requireActiveFriendship(
    userAId: string,
    userBId: string,
  ): Promise<Friendship> {
    const friendship = await this.findFriendshipBetween(userAId, userBId);
    if (!friendship) throw new Error('Players are not friends.');
    if (friendship.status !== FriendshipStatus.ACCEPTED)
      throw new Error('Friendship is not active.');
    if (friendship.blockedById)
      throw new Error('Friendship is currently blocked.');
    return friendship;
  }

  async sendChatMessage(
    senderId: string,
    recipientId: string,
    body: string,
  ) {
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Message body is required.');

    const friendship = await this.requireActiveFriendship(
      senderId,
      recipientId,
    );

    return this.prisma.friendChatMessage.create({
      data: {
        friendshipId: friendship.id,
        senderId,
        recipientId,
        body: trimmed,
      },
    });
  }

  async getChatHistory(userAId: string, userBId: string, take = 100) {
    const friendship = await this.requireActiveFriendship(userAId, userBId);
    const messages = await this.prisma.friendChatMessage.findMany({
      where: { friendshipId: friendship.id },
      orderBy: { createdAt: 'asc' },
      take,
      select: {
        id: true,
        senderId: true,
        recipientId: true,
        body: true,
        createdAt: true,
      },
    });
    return { friendshipId: friendship.id, messages };
  }
}
