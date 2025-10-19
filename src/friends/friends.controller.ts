import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';

interface AuthenticatedRequest extends Request {
  user?: { sub?: string; id?: string };
}

@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  private assertUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub ?? request.user?.id;
    if (!userId) throw new Error('Missing authenticated user identifier');
    return userId;
  }

  @Get('search')
  search(@Req() request: AuthenticatedRequest, @Query('q') q = '') {
    const userId = this.assertUserId(request);
    return this.friends.searchPlayers(userId, q);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    const userId = this.assertUserId(request);
    return this.friends.listFriends(userId);
  }

  @Get('requests')
  listRequests(@Req() request: AuthenticatedRequest) {
    const userId = this.assertUserId(request);
    return this.friends.listIncomingRequests(userId);
  }

  @Post('request')
  sendRequest(
    @Req() request: AuthenticatedRequest,
    @Body('targetId') targetId: string,
  ) {
    const userId = this.assertUserId(request);
    return this.friends.sendFriendRequest(userId, targetId);
  }

  @Post('request/:id/accept')
  accept(
    @Req() request: AuthenticatedRequest,
    @Param('id') friendshipId: string,
  ) {
    const userId = this.assertUserId(request);
    return this.friends.respondToRequest(friendshipId, userId, true);
  }

  @Post('request/:id/reject')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id') friendshipId: string,
  ) {
    const userId = this.assertUserId(request);
    return this.friends.respondToRequest(friendshipId, userId, false);
  }

  @Delete(':id')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') friendshipId: string,
  ) {
    const userId = this.assertUserId(request);
    return this.friends.removeFriend(friendshipId, userId);
  }

  @Post('block')
  block(
    @Req() request: AuthenticatedRequest,
    @Body('targetId') targetId: string,
  ) {
    const userId = this.assertUserId(request);
    return this.friends.blockUser(userId, targetId);
  }

  @Get('chat/:friendId')
  getChat(
    @Req() request: AuthenticatedRequest,
    @Param('friendId') friendId: string,
  ) {
    const userId = this.assertUserId(request);
    return this.friends.getChatHistory(userId, friendId);
  }

  @Post('chat/:friendId')
  sendChat(
    @Req() request: AuthenticatedRequest,
    @Param('friendId') friendId: string,
    @Body('message') message: string,
  ) {
    const userId = this.assertUserId(request);
    return this.friends.sendChatMessage(userId, friendId, message);
  }
}
