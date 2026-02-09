export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

export interface ChronosPlayerSummary {
  id: string;
  username: string;
}

export interface ChronosFriendSummary {
  friendshipId: string;
  friend: ChronosPlayerSummary;
  status: FriendshipStatus;
  blockedByMe: boolean;
}

export interface ChronosIncomingFriendRequest {
  friendshipId: string;
  requester: ChronosPlayerSummary;
  createdAt: string;
}

export interface ChronosFriendChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
}

export interface ChronosFriendChatHistory {
  friendshipId: string;
  messages: ChronosFriendChatMessage[];
}
