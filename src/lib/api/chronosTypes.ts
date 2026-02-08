import type {
  ChronosCard,
  ChronosCardCatalogCollectionInfo,
  ChronosCardCatalogItem,
  ChronosCardCollection,
  ChronosFriendChatHistory,
  ChronosFriendChatMessage,
  ChronosFriendSummary,
  ChronosIncomingFriendRequest,
  ChronosPlayerSummary,
  GameMode,
  GameResult,
  GameSummary,
} from '../../../shared';
import type { GameState } from '$lib/stores/game';

export type Card = ChronosCard;
export type { GameState };

export type {
  GameMode,
  GameSummary,
  GameResult,
  ChronosPlayerSummary,
  ChronosFriendSummary,
  ChronosIncomingFriendRequest,
  ChronosFriendChatMessage,
  ChronosFriendChatHistory,
  ChronosCardCatalogCollectionInfo,
  ChronosCardCatalogItem,
  ChronosCardCollection,
};
