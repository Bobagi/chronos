import { Injectable, Logger } from '@nestjs/common';
import { DuelStage, Card as PrismaCard } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttributeKey,
  BOT_ID,
  DuelCenterState,
  PlayerCardCollection,
  convertCardCollectionToPrismaInput,
  deserializeDuelCenter,
  initializeDuelCenterState,
  prepareNullableJsonField,
  removeCardFromHand,
  serializeDuelCenter,
  takeOneRandomCardFromDeck,
} from './game.types';

const TURN_DURATION_MS = 10_000;

interface DuelParticipants {
  playerAId: string;
  playerBId: string;
}

interface PlayerActionCardSelection {
  playerId: string;
  cardCode: string;
}

interface PlayerActionAttributeSelection {
  playerId: string;
  attribute: AttributeKey;
}

@Injectable()
export class DuelGameService {
  private readonly logger = new Logger(DuelGameService.name);

  constructor(private readonly prisma: PrismaService) {}

  async chooseCardForDuel(gameId: string, action: PlayerActionCardSelection) {
    this.logger.log(
      `[chooseCardForDuel] game=${gameId} player=${action.playerId} card=${action.cardCode}`,
    );

    const updatedGame = await this.prisma.$transaction(async (transactionClient) => {
      const existingGame = await transactionClient.game.findUnique({
        where: { id: gameId },
        select: {
          id: true,
          playerAId: true,
          playerBId: true,
          mode: true,
          duelStage: true,
          hands: true,
          duelCenter: true,
        },
      });

      if (existingGame === null) {
        return null;
      }
      if (existingGame.mode !== 'ATTRIBUTE_DUEL') {
        return existingGame;
      }
      if (existingGame.duelStage !== 'PICK_CARD') {
        return existingGame;
      }

      const playerHands = this.normalizeCardCollection(
        existingGame.hands as PlayerCardCollection | null,
        existingGame.playerAId,
        existingGame.playerBId,
      );
      const duelCenterState = this.normalizeDuelCenter(existingGame.duelCenter);
      const duelParticipants: DuelParticipants = {
        playerAId: existingGame.playerAId,
        playerBId: existingGame.playerBId,
      };

      this.handlePickPhaseTimeout(playerHands, duelCenterState, duelParticipants);

      if (!duelCenterState.playerACardCode || !duelCenterState.playerBCardCode) {
        this.applyManualCardSelection(playerHands, duelCenterState, action, duelParticipants);
      }

      this.autoPickBotCards(playerHands, duelCenterState, duelParticipants);

      const shouldAdvanceToAttributePick =
        duelCenterState.playerACardCode !== null &&
        duelCenterState.playerBCardCode !== null;

      const nextStage: DuelStage = shouldAdvanceToAttributePick
        ? 'PICK_ATTRIBUTE'
        : 'PICK_CARD';
      duelCenterState.chooserId = duelCenterState.chooserId ?? existingGame.playerAId;
      duelCenterState.deadlineAt = Date.now() + TURN_DURATION_MS;

      const persistedGame = await transactionClient.game.update({
        where: { id: gameId },
        data: {
          hands: playerHands,
          duelCenter: prepareNullableJsonField(serializeDuelCenter(duelCenterState)),
          duelStage: nextStage,
        },
        select: {
          id: true,
          playerAId: true,
          playerBId: true,
          turn: true,
          hp: true,
          winner: true,
          hands: true,
          decks: true,
          log: true,
          mode: true,
          duelStage: true,
          duelCenter: true,
          discardPiles: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return persistedGame;
    });

    if (updatedGame === null) {
      return null;
    }

    const duelCenterState = this.normalizeDuelCenter(updatedGame.duelCenter);
    const chooserId = duelCenterState.chooserId ?? updatedGame.playerAId;

    if (updatedGame.duelStage === 'PICK_ATTRIBUTE' && chooserId === BOT_ID) {
      const bestAttribute = await this.determineBestAttributeForBot(updatedGame, duelCenterState);
      return this.chooseAttributeForDuel(gameId, {
        playerId: BOT_ID,
        attribute: bestAttribute,
      });
    }

    return updatedGame;
  }

  async chooseAttributeForDuel(gameId: string, action: PlayerActionAttributeSelection) {
    this.logger.log(
      `[chooseAttributeForDuel] game=${gameId} chooser=${action.playerId} attribute=${action.attribute}`,
    );

    const existingGame = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        hands: true,
        decks: true,
        log: true,
        winner: true,
        mode: true,
        duelStage: true,
        duelCenter: true,
        discardPiles: true,
        createdAt: true,
        updatedAt: true,
        playerA: { select: { username: true } },
        playerB: { select: { username: true } },
      },
    });

    if (existingGame === null) {
      return null;
    }
    if (existingGame.mode !== 'ATTRIBUTE_DUEL') {
      return existingGame;
    }
    if (existingGame.duelStage !== 'PICK_ATTRIBUTE') {
      return existingGame;
    }

    const duelCenterState = this.normalizeDuelCenter(existingGame.duelCenter);
    const chooserId = duelCenterState.chooserId ?? existingGame.playerAId;
    const finalAction = this.resolveAttributeSelection(action, chooserId, duelCenterState);

    if (finalAction === null) {
      return existingGame;
    }

    const playerACardCode = duelCenterState.playerACardCode;
    const playerBCardCode = duelCenterState.playerBCardCode;
    if (playerACardCode === null || playerBCardCode === null) {
      return existingGame;
    }

    const involvedCards = await this.prisma.card.findMany({
      where: { code: { in: [playerACardCode, playerBCardCode] } },
    });
    const playerACard = involvedCards.find((card) => card.code === playerACardCode);
    const playerBCard = involvedCards.find((card) => card.code === playerBCardCode);

    if (!playerACard || !playerBCard) {
      return existingGame;
    }

    const attribute = finalAction.attribute;
    const playerAAttributeValue = this.readAttributeValue(playerACard, attribute);
    const playerBAttributeValue = this.readAttributeValue(playerBCard, attribute);

    const roundWinnerId = this.resolveRoundWinner(
      playerAAttributeValue,
      playerBAttributeValue,
      existingGame.playerAId,
      existingGame.playerBId,
    );

    duelCenterState.chosenAttribute = attribute;
    duelCenterState.isRevealed = true;
    duelCenterState.playerAAttributeValue = playerAAttributeValue;
    duelCenterState.playerBAttributeValue = playerBAttributeValue;
    duelCenterState.roundWinnerId = roundWinnerId;
    duelCenterState.deadlineAt = null;

    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        duelCenter: prepareNullableJsonField(serializeDuelCenter(duelCenterState)),
        duelStage: 'REVEAL',
      },
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        hands: true,
        decks: true,
        log: true,
        winner: true,
        mode: true,
        duelStage: true,
        duelCenter: true,
        discardPiles: true,
        createdAt: true,
        updatedAt: true,
        playerA: { select: { username: true } },
        playerB: { select: { username: true } },
      },
    });

    this.logger.log(
      `[chooseAttributeForDuel] -> REVEAL (winner=${roundWinnerId ?? 'DRAW'})`,
    );

    return updatedGame;
  }

  async advanceDuelRound(gameId: string) {
    this.logger.log(`[advanceDuelRound] game=${gameId}`);

    const existingGame = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        hands: true,
        decks: true,
        log: true,
        winner: true,
        mode: true,
        duelStage: true,
        duelCenter: true,
        discardPiles: true,
        createdAt: true,
        updatedAt: true,
        playerA: { select: { username: true } },
        playerB: { select: { username: true } },
      },
    });

    if (existingGame === null) {
      return null;
    }
    if (existingGame.mode !== 'ATTRIBUTE_DUEL') {
      return existingGame;
    }
    if (existingGame.duelStage !== 'REVEAL') {
      return existingGame;
    }

    const duelCenterState = this.normalizeDuelCenter(existingGame.duelCenter);
    const playerACardCode = duelCenterState.playerACardCode;
    const playerBCardCode = duelCenterState.playerBCardCode;
    const chosenAttribute = duelCenterState.chosenAttribute ?? 'magic';
    const playerAAttributeValue = duelCenterState.playerAAttributeValue ?? 0;
    const playerBAttributeValue = duelCenterState.playerBAttributeValue ?? 0;
    const roundWinnerId = duelCenterState.roundWinnerId;

    const discardPiles = this.normalizeCardCollection(
      existingGame.discardPiles as PlayerCardCollection | null,
      existingGame.playerAId,
      existingGame.playerBId,
    );
    const playerHands = this.normalizeCardCollection(
      existingGame.hands as PlayerCardCollection | null,
      existingGame.playerAId,
      existingGame.playerBId,
    );
    const playerDecks = this.normalizeCardCollection(
      existingGame.decks as PlayerCardCollection | null,
      existingGame.playerAId,
      existingGame.playerBId,
    );

    if (roundWinnerId && playerACardCode && playerBCardCode) {
      discardPiles[roundWinnerId] = [
        ...(discardPiles[roundWinnerId] ?? []),
        playerACardCode,
        playerBCardCode,
      ];
    }

    const newDrawA = takeOneRandomCardFromDeck(playerDecks[existingGame.playerAId]);
    const newDrawB = takeOneRandomCardFromDeck(playerDecks[existingGame.playerBId]);
    if (newDrawA) {
      playerHands[existingGame.playerAId].push(newDrawA);
    }
    if (newDrawB) {
      playerHands[existingGame.playerBId].push(newDrawB);
    }

    const nextChooserId =
      duelCenterState.chooserId === existingGame.playerAId
        ? existingGame.playerBId
        : existingGame.playerAId;

    const playerAHandEmpty = playerHands[existingGame.playerAId].length === 0;
    const playerBHandEmpty = playerHands[existingGame.playerBId].length === 0;

    let nextStage: DuelStage = 'PICK_CARD';
    let matchWinner: string | null = existingGame.winner;
    let nextDuelCenter: DuelCenterState | null = initializeDuelCenterState();

    if (playerAHandEmpty || playerBHandEmpty) {
      const playerADiscardCount = discardPiles[existingGame.playerAId].length;
      const playerBDiscardCount = discardPiles[existingGame.playerBId].length;
      matchWinner = this.resolveMatchWinner(
        playerADiscardCount,
        playerBDiscardCount,
        existingGame.playerAId,
        existingGame.playerBId,
      );
      nextStage = 'RESOLVED';
      nextDuelCenter = null;
    } else if (nextDuelCenter) {
      nextDuelCenter.chooserId = nextChooserId;
      nextDuelCenter.deadlineAt = Date.now() + TURN_DURATION_MS;
    }

    const involvedCards = await this.prisma.card.findMany({
      where: { code: { in: [playerACardCode ?? '', playerBCardCode ?? ''] } },
    });

    const playerAName = existingGame.playerA?.username ?? existingGame.playerAId;
    const playerBName = existingGame.playerB?.username ?? existingGame.playerBId;
    const chooserName =
      (duelCenterState.chooserId ?? existingGame.playerAId) === existingGame.playerAId
        ? playerAName
        : playerBName;

    const playerACardName = this.resolveCardName(involvedCards, playerACardCode);
    const playerBCardName = this.resolveCardName(involvedCards, playerBCardCode);

    const roundOutcomeLabel = this.buildRoundOutcomeLabel(
      roundWinnerId,
      matchWinner,
      existingGame.playerAId,
      existingGame.playerBId,
      playerAName,
      playerBName,
    );

    const duelLogEntry =
      `${chosenAttribute.toUpperCase()} duel(${chooserName}): ` +
      `${playerACardName}(${playerAAttributeValue}) vs ` +
      `${playerBCardName}(${playerBAttributeValue}) => ${roundOutcomeLabel}`;

    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        hands: playerHands,
        decks: playerDecks,
        duelCenter: prepareNullableJsonField(serializeDuelCenter(nextDuelCenter)),
        duelStage: nextStage,
        discardPiles: prepareNullableJsonField(
          convertCardCollectionToPrismaInput(discardPiles),
        ),
        winner: nextStage === 'RESOLVED' ? matchWinner : existingGame.winner,
        log: [
          ...(existingGame.log as string[]),
          duelLogEntry,
          ...(newDrawA ? [`${playerAName} draws`] : []),
          ...(newDrawB ? [`${playerBName} draws`] : []),
        ],
      },
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        hands: true,
        decks: true,
        log: true,
        winner: true,
        mode: true,
        duelStage: true,
        duelCenter: true,
        discardPiles: true,
        createdAt: true,
        updatedAt: true,
        playerA: { select: { username: true } },
        playerB: { select: { username: true } },
      },
    });

    this.logger.log(
      `[advanceDuelRound] stage=${updatedGame.duelStage} winner=${updatedGame.winner ?? '-'}`,
    );

    return updatedGame;
  }

  async unchooseCardForDuel(gameId: string, action: { playerId: string }) {
    const updatedGame = await this.prisma.$transaction(async (transactionClient) => {
      const existingGame = await transactionClient.game.findUnique({
        where: { id: gameId },
        select: {
          id: true,
          playerAId: true,
          playerBId: true,
          mode: true,
          duelStage: true,
          hands: true,
          duelCenter: true,
        },
      });

      if (existingGame === null) {
        return null;
      }
      if (existingGame.mode !== 'ATTRIBUTE_DUEL') {
        return existingGame;
      }
      if (existingGame.duelStage === 'REVEAL' || existingGame.duelStage === 'RESOLVED') {
        return existingGame;
      }

      const playerHands = this.normalizeCardCollection(
        existingGame.hands as PlayerCardCollection | null,
        existingGame.playerAId,
        existingGame.playerBId,
      );
      const duelCenterState = this.normalizeDuelCenter(existingGame.duelCenter);

      const isPlayerA = action.playerId === existingGame.playerAId;
      const opponentId = isPlayerA ? existingGame.playerBId : existingGame.playerAId;
      const selectedCardCode = isPlayerA
        ? duelCenterState.playerACardCode
        : duelCenterState.playerBCardCode;

      if (selectedCardCode === null) {
        return existingGame;
      }

      playerHands[action.playerId].push(selectedCardCode);

      const opponentCardCode = isPlayerA
        ? duelCenterState.playerBCardCode
        : duelCenterState.playerACardCode;
      if (opponentCardCode !== null) {
        playerHands[opponentId].push(opponentCardCode);
      }

      const resetCenter = initializeDuelCenterState();
      resetCenter.chooserId = action.playerId;
      resetCenter.deadlineAt = Date.now() + TURN_DURATION_MS;

      const persistedGame = await transactionClient.game.update({
        where: { id: gameId },
        data: {
          hands: playerHands,
          duelCenter: prepareNullableJsonField(serializeDuelCenter(resetCenter)),
          duelStage: 'PICK_CARD',
        },
        select: {
          id: true,
          playerAId: true,
          playerBId: true,
          turn: true,
          hp: true,
          winner: true,
          hands: true,
          decks: true,
          log: true,
          mode: true,
          duelStage: true,
          duelCenter: true,
          discardPiles: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return persistedGame;
    });

    return updatedGame;
  }

  private normalizeCardCollection(
    collection: PlayerCardCollection | null,
    playerAId: string,
    playerBId: string,
  ): PlayerCardCollection {
    const normalizedCollection: PlayerCardCollection = {};
    if (collection) {
      for (const [key, value] of Object.entries(collection)) {
        normalizedCollection[key] = [...value];
      }
    }
    if (!normalizedCollection[playerAId]) {
      normalizedCollection[playerAId] = [];
    }
    if (!normalizedCollection[playerBId]) {
      normalizedCollection[playerBId] = [];
    }
    return normalizedCollection;
  }

  private normalizeDuelCenter(serializedCenter: unknown): DuelCenterState {
    if (serializedCenter === null) {
      return initializeDuelCenterState();
    }
    return deserializeDuelCenter(serializedCenter);
  }

  private handlePickPhaseTimeout(
    playerHands: PlayerCardCollection,
    duelCenterState: DuelCenterState,
    participants: DuelParticipants,
  ): void {
    const deadline = duelCenterState.deadlineAt;
    if (!deadline || Date.now() <= deadline) {
      return;
    }

    if (duelCenterState.playerACardCode === null) {
      const autoSelectedCardA = this.selectRandomCardFromHand(
        participants.playerAId,
        playerHands,
      );
      if (autoSelectedCardA) {
        duelCenterState.playerACardCode = autoSelectedCardA;
        this.logger.log(
          `[handlePickPhaseTimeout] auto-selected card=${autoSelectedCardA} for player=${participants.playerAId}`,
        );
      }
    }

    if (duelCenterState.playerBCardCode === null) {
      const autoSelectedCardB = this.selectRandomCardFromHand(
        participants.playerBId,
        playerHands,
      );
      if (autoSelectedCardB) {
        duelCenterState.playerBCardCode = autoSelectedCardB;
        this.logger.log(
          `[handlePickPhaseTimeout] auto-selected card=${autoSelectedCardB} for player=${participants.playerBId}`,
        );
      }
    }
  }

  private applyManualCardSelection(
    playerHands: PlayerCardCollection,
    duelCenterState: DuelCenterState,
    action: PlayerActionCardSelection,
    participants: DuelParticipants,
  ): void {
    const isPlayerA = action.playerId === participants.playerAId;
    const hasPlayerAlreadyChosen = isPlayerA
      ? duelCenterState.playerACardCode !== null
      : duelCenterState.playerBCardCode !== null;
    if (hasPlayerAlreadyChosen) {
      return;
    }

    const cardWasRemoved = removeCardFromHand(
      playerHands,
      action.playerId,
      action.cardCode,
    );
    if (!cardWasRemoved) {
      return;
    }

    if (isPlayerA) {
      duelCenterState.playerACardCode = action.cardCode;
    } else {
      duelCenterState.playerBCardCode = action.cardCode;
    }
  }

  private autoPickBotCards(
    playerHands: PlayerCardCollection,
    duelCenterState: DuelCenterState,
    participants: DuelParticipants,
  ): void {
    const candidatePlayers: Array<{ playerId: string; isPlayerA: boolean }> = [
      { playerId: participants.playerAId, isPlayerA: true },
      { playerId: participants.playerBId, isPlayerA: false },
    ];

    for (const candidate of candidatePlayers) {
      if (candidate.playerId !== BOT_ID) {
        continue;
      }

      const needsSelection = candidate.isPlayerA
        ? duelCenterState.playerACardCode === null
        : duelCenterState.playerBCardCode === null;
      if (!needsSelection) {
        continue;
      }

      const chosenCardCode = this.selectRandomCardFromHand(
        candidate.playerId,
        playerHands,
      );
      if (!chosenCardCode) {
        continue;
      }

      if (candidate.isPlayerA) {
        duelCenterState.playerACardCode = chosenCardCode;
        this.logger.log(
          `[autoPickBotCards] BOT player=A selected card=${chosenCardCode}`,
        );
      } else {
        duelCenterState.playerBCardCode = chosenCardCode;
        this.logger.log(
          `[autoPickBotCards] BOT player=B selected card=${chosenCardCode}`,
        );
      }
    }
  }

  private selectRandomCardFromHand(
    playerId: string,
    playerHands: PlayerCardCollection,
  ): string | null {
    const hand = playerHands[playerId];
    if (!hand || hand.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * hand.length);
    const selectedCardCode = hand[randomIndex];
    removeCardFromHand(playerHands, playerId, selectedCardCode);
    return selectedCardCode;
  }

  private async determineBestAttributeForBot(
    game: DuelParticipants,
    duelCenterState: DuelCenterState,
  ): Promise<AttributeKey> {
    const playerACardCode = duelCenterState.playerACardCode;
    const playerBCardCode = duelCenterState.playerBCardCode;

    if (playerACardCode === null || playerBCardCode === null) {
      return 'magic';
    }

    const involvedCards = await this.prisma.card.findMany({
      where: { code: { in: [playerACardCode, playerBCardCode] } },
    });
    const playerACard = involvedCards.find((card) => card.code === playerACardCode);
    const playerBCard = involvedCards.find((card) => card.code === playerBCardCode);

    if (!playerACard || !playerBCard) {
      return 'magic';
    }

    const botIsPlayerA = game.playerAId === BOT_ID;

    let bestAttribute: AttributeKey = 'magic';
    let bestDifference = Number.NEGATIVE_INFINITY;

    const attributes: AttributeKey[] = ['magic', 'might', 'fire'];

    for (const attribute of attributes) {
      const playerAValue = this.readAttributeValue(playerACard, attribute);
      const playerBValue = this.readAttributeValue(playerBCard, attribute);
      const difference = botIsPlayerA
        ? playerAValue - playerBValue
        : playerBValue - playerAValue;

      this.logger.log(
        `[determineBestAttributeForBot] attribute=${attribute} playerACard=${playerACardCode}.${playerAValue} playerBCard=${playerBCardCode}.${playerBValue} difference=${difference}`,
      );

      if (difference > bestDifference) {
        bestDifference = difference;
        bestAttribute = attribute;
      }
    }

    this.logger.log(`[determineBestAttributeForBot] selected=${bestAttribute}`);
    return bestAttribute;
  }

  private resolveAttributeSelection(
    action: PlayerActionAttributeSelection,
    chooserId: string,
    duelCenterState: DuelCenterState,
  ): PlayerActionAttributeSelection | null {
    const deadline = duelCenterState.deadlineAt;
    const now = Date.now();

    if (deadline && now > deadline) {
      const autoAttribute = this.randomAttribute();
      this.logger.log(
        `[resolveAttributeSelection] timeout auto-picked attribute=${autoAttribute} for chooser=${chooserId}`,
      );
      return { playerId: chooserId, attribute: autoAttribute };
    }

    if (action.playerId !== chooserId) {
      return null;
    }

    return action;
  }

  private readAttributeValue(card: PrismaCard, attribute: AttributeKey): number {
    if (attribute === 'magic') {
      return card.magic ?? 0;
    }
    if (attribute === 'might') {
      return card.might ?? 0;
    }
    return card.fire ?? 0;
  }

  private resolveRoundWinner(
    playerAValue: number,
    playerBValue: number,
    playerAId: string,
    playerBId: string,
  ): string | null {
    if (playerAValue > playerBValue) {
      return playerAId;
    }
    if (playerBValue > playerAValue) {
      return playerBId;
    }
    return null;
  }

  private resolveMatchWinner(
    playerADiscardCount: number,
    playerBDiscardCount: number,
    playerAId: string,
    playerBId: string,
  ): string {
    if (playerADiscardCount > playerBDiscardCount) {
      return playerAId;
    }
    if (playerBDiscardCount > playerADiscardCount) {
      return playerBId;
    }
    return 'DRAW';
  }

  private randomAttribute(): AttributeKey {
    const attributes: AttributeKey[] = ['magic', 'might', 'fire'];
    const randomIndex = Math.floor(Math.random() * attributes.length);
    return attributes[randomIndex];
  }

  private resolveCardName(cards: PrismaCard[], code: string | null): string {
    if (!code) {
      return 'Unknown card';
    }
    return cards.find((card) => card.code === code)?.name ?? code;
  }

  private buildRoundOutcomeLabel(
    roundWinnerId: string | null,
    matchWinner: string | null,
    playerAId: string,
    playerBId: string,
    playerAName: string,
    playerBName: string,
  ): string {
    if (matchWinner && matchWinner !== 'DRAW') {
      return matchWinner === playerAId ? playerAName : playerBName;
    }
    if (roundWinnerId === playerAId) {
      return playerAName;
    }
    if (roundWinnerId === playerBId) {
      return playerBName;
    }
    if (matchWinner === 'DRAW') {
      return 'Draw';
    }
    return 'Draw';
  }
}
