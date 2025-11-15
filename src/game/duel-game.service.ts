import { Injectable, Logger } from '@nestjs/common';
import { DuelStage, Card as PrismaCard } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttributeKey,
  BOT_ID,
  DuelCenterState,
  GameState,
  PlayerCardCollection,
  convertCardCollectionToPrismaInput,
  deserializeDuelCenter,
  initializeDuelCenterState,
  prepareNullableJsonField,
  removeCardFromHand,
  serializeDuelCenter,
  takeOneRandomCardFromDeck,
} from './game.types';

const TURN_DURATION_MS = 10 * 1000;

@Injectable()
export class DuelGameService {
  private readonly logger = new Logger(DuelGameService.name);

  constructor(private readonly prisma: PrismaService) {}

  private autoPickBotCardIfNeeded(
    gameData: { playerAId: string; playerBId: string },
    playerHands: PlayerCardCollection,
    duelCenter: DuelCenterState,
  ): void {
    if (!duelCenter.playerACardCode && gameData.playerAId === BOT_ID) {
      playerHands[gameData.playerAId] ??= [];
      const botHand = playerHands[gameData.playerAId];
      if (botHand.length > 0) {
        const randomIndex = Math.floor(Math.random() * botHand.length);
        const selectedCard = botHand[randomIndex];
        removeCardFromHand(playerHands, gameData.playerAId, selectedCard);
        duelCenter.playerACardCode = selectedCard;
        this.logger.log(
          `[autoPickBotCardIfNeeded] BOT (A) selected card=${selectedCard}`,
        );
      }
    }
    if (!duelCenter.playerBCardCode && gameData.playerBId === BOT_ID) {
      playerHands[gameData.playerBId] ??= [];
      const botHand = playerHands[gameData.playerBId];
      if (botHand.length > 0) {
        const randomIndex = Math.floor(Math.random() * botHand.length);
        const selectedCard = botHand[randomIndex];
        removeCardFromHand(playerHands, gameData.playerBId, selectedCard);
        duelCenter.playerBCardCode = selectedCard;
        this.logger.log(
          `[autoPickBotCardIfNeeded] BOT (B) selected card=${selectedCard}`,
        );
      }
    }
  }

  private pickRandomCardFromHand(
    playerId: string,
    hands: PlayerCardCollection,
  ): string | null {
    hands[playerId] ??= [];
    const hand = hands[playerId];
    if (hand.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * hand.length);
    const selectedCard = hand[randomIndex];
    removeCardFromHand(hands, playerId, selectedCard);
    return selectedCard;
  }

  private randomAttribute(): AttributeKey {
    const attributes: AttributeKey[] = ['magic', 'might', 'fire'];
    return attributes[Math.floor(Math.random() * attributes.length)];
  }

type AttributeValueMap = {
  magic: number;
  might: number;
  fire: number;
};

  private buildAttributeValues(card: PrismaCard): AttributeValueMap {
    const values: AttributeValueMap = {
      magic: card.magic ?? 0,
      might: card.might ?? 0,
      fire: card.fire ?? 0,
    };
    return values;
  }

  private async determineBestAttributeForBot(
    gameData: { playerAId: string; playerBId: string },
    duelCenter: DuelCenterState,
  ): Promise<AttributeKey> {
    const playerACardCode = duelCenter.playerACardCode;
    const playerBCardCode = duelCenter.playerBCardCode;
    if (!playerACardCode || !playerBCardCode) {
      return 'magic';
    }

    const cards = await this.prisma.card.findMany({
      where: { code: { in: [playerACardCode, playerBCardCode] } },
    });
    const findCard = (code: string) => cards.find((card) => card.code === code);
    const playerACard = findCard(playerACardCode);
    const playerBCard = findCard(playerBCardCode);
    if (!playerACard || !playerBCard) return 'magic';

    const playerAAttributes = this.buildAttributeValues(playerACard);
    const playerBAttributes = this.buildAttributeValues(playerBCard);
    const isBotPlayerA = gameData.playerAId === BOT_ID;

    let bestAttribute: AttributeKey = 'magic';
    let bestValueDifference = -Infinity;

    for (const attribute of ['magic', 'might', 'fire'] as AttributeKey[]) {
      const playerAValue = playerAAttributes[attribute];
      const playerBValue = playerBAttributes[attribute];
      const valueDifference = isBotPlayerA
        ? playerAValue - playerBValue
        : playerBValue - playerAValue;
      if (valueDifference > bestValueDifference) {
        bestValueDifference = valueDifference;
        bestAttribute = attribute;
      }
      this.logger.log(
        `[determineBestAttributeForBot] A=${playerACardCode}.${attribute}=${playerAValue} B=${playerBCardCode}.${attribute}=${playerBValue} diff=${valueDifference}`,
      );
    }
    this.logger.log(`[determineBestAttributeForBot] selected=${bestAttribute}`);
    return bestAttribute;
  }

  async chooseCardForDuel(
    gameId: string,
    playerAction: { playerId: string; cardCode: string },
  ) {
    this.logger.log(
      `[chooseCardForDuel] game=${gameId} player=${playerAction.playerId} card=${playerAction.cardCode}`,
    );

    const updatedGame = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
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
      if (!game) return null;
      if (game.mode !== 'ATTRIBUTE_DUEL') return game;

      const hands = (game.hands as PlayerCardCollection) ?? {};
      const center =
        game.duelCenter === null
          ? initializeDuelCenterState()
          : deserializeDuelCenter(game.duelCenter);
      let stage: DuelStage = game.duelStage ?? 'PICK_CARD';

      if (stage !== 'PICK_CARD') return game;

      const now = Date.now();
      const deadlineMs = center.deadlineAt;
      if (deadlineMs && now > deadlineMs) {
        if (!center.playerACardCode) {
          const autoCard = this.pickRandomCardFromHand(
            game.playerAId,
            hands,
          );
          if (autoCard) {
            center.playerACardCode = autoCard;
            this.logger.log(
              `[chooseCardForDuel] timeout auto-picked card=${autoCard} for ${game.playerAId}`,
            );
          }
        }
        if (!center.playerBCardCode) {
          const autoCard = this.pickRandomCardFromHand(
            game.playerBId,
            hands,
          );
          if (autoCard) {
            center.playerBCardCode = autoCard;
            this.logger.log(
              `[chooseCardForDuel] timeout auto-picked card=${autoCard} for ${game.playerBId}`,
            );
          }
        }
      }

      if (!center.playerACardCode || !center.playerBCardCode) {
        const isPlayerA = playerAction.playerId === game.playerAId;
        const hasCardAlready = isPlayerA
          ? center.playerACardCode !== null
          : center.playerBCardCode !== null;
        if (!hasCardAlready) {
          hands[playerAction.playerId] ??= [];
          const removed = removeCardFromHand(
            hands,
            playerAction.playerId,
            playerAction.cardCode,
          );
          if (!removed) return game;

          if (isPlayerA) center.playerACardCode = playerAction.cardCode;
          else center.playerBCardCode = playerAction.cardCode;
        }
      }

      this.autoPickBotCardIfNeeded(
        { playerAId: game.playerAId, playerBId: game.playerBId },
        hands,
        center,
      );

      let deadlineToSet: number | null = null;
      if (center.playerACardCode && center.playerBCardCode) {
        stage = 'PICK_ATTRIBUTE';
        center.chooserId = center.chooserId ?? game.playerAId;
        deadlineToSet = Date.now() + TURN_DURATION_MS;
      } else {
        deadlineToSet = Date.now() + TURN_DURATION_MS;
      }

      center.deadlineAt = deadlineToSet;

      const result = await tx.game.update({
        where: { id: gameId },
        data: {
          hands,
          duelCenter: prepareNullableJsonField(serializeDuelCenter(center)),
          duelStage: stage,
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

      return result;
    });

    if (!updatedGame) return null;

    const centerAfterUpdate =
      updatedGame.duelCenter === null
        ? initializeDuelCenterState()
        : deserializeDuelCenter(updatedGame.duelCenter);
    const chooserId = centerAfterUpdate.chooserId ?? updatedGame.playerAId;

    if (updatedGame.duelStage === 'PICK_ATTRIBUTE' && chooserId === BOT_ID) {
      const bestAttribute = await this.determineBestAttributeForBot(
        updatedGame,
        centerAfterUpdate,
      );
      const resultAfterReveal = await this.chooseAttributeForDuel(gameId, {
        playerId: BOT_ID,
        attribute: bestAttribute,
      });
      return resultAfterReveal;
    }

    return updatedGame;
  }

  async chooseAttributeForDuel(
    gameId: string,
    playerAction: { playerId: string; attribute: 'magic' | 'might' | 'fire' },
  ) {
    this.logger.log(
      `[chooseAttributeForDuel] game=${gameId} chooser=${playerAction.playerId} attr=${playerAction.attribute}`,
    );
    const game = await this.prisma.game.findUnique({
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
    if (!game) return null;
    if (game.mode !== 'ATTRIBUTE_DUEL') return game;
    if (game.duelStage !== 'PICK_ATTRIBUTE') return game;

    const center =
      game.duelCenter === null
        ? initializeDuelCenterState()
        : deserializeDuelCenter(game.duelCenter);
    const chooserId = center.chooserId ?? game.playerAId;
    const now = Date.now();

    const deadlineMs = center.deadlineAt;
    let effectiveAction = playerAction;
    if (deadlineMs && now > deadlineMs) {
      const autoAttribute = this.randomAttribute();
      this.logger.log(
        `[chooseAttributeForDuel] timeout auto-picked attribute=${autoAttribute} for ${chooserId}`,
      );
      effectiveAction = { playerId: chooserId, attribute: autoAttribute };
    } else if (playerAction.playerId !== chooserId) {
      return game;
    }

    const playerACardCode = center.playerACardCode;
    const playerBCardCode = center.playerBCardCode;
    if (!playerACardCode || !playerBCardCode) return game;

    const cards = await this.prisma.card.findMany({
      where: { code: { in: [playerACardCode, playerBCardCode] } },
    });
    const getCard = (code: string) => cards.find((card) => card.code === code);
    const playerACard = getCard(playerACardCode);
    const playerBCard = getCard(playerBCardCode);
    if (!playerACard || !playerBCard) return game;

    const attributeKey = effectiveAction.attribute as AttributeKey;
    const playerAValue = this.buildAttributeValues(playerACard)[attributeKey];
    const playerBValue = this.buildAttributeValues(playerBCard)[attributeKey];

    let roundWinner: string | null = null;
    if (playerAValue > playerBValue) roundWinner = game.playerAId;
    else if (playerBValue > playerAValue) roundWinner = game.playerBId;

    center.chosenAttribute = attributeKey;
    center.isRevealed = true;
    center.playerAAttributeValue = playerAValue;
    center.playerBAttributeValue = playerBValue;
    center.roundWinnerId = roundWinner;
    center.deadlineAt = null;

    const result = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        duelCenter: prepareNullableJsonField(serializeDuelCenter(center)),
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
      `[chooseAttributeForDuel] -> REVEAL (winner=${roundWinner ?? 'DRAW'})`,
    );
    return result;
  }

  async advanceDuelRound(gameId: string) {
    this.logger.log(`[advanceDuelRound] game=${gameId}`);
    const game = await this.prisma.game.findUnique({
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
    if (!game) return null;
    if (game.mode !== 'ATTRIBUTE_DUEL' || game.duelStage !== 'REVEAL')
      return game;

    const center =
      game.duelCenter === null
        ? initializeDuelCenterState()
        : deserializeDuelCenter(game.duelCenter);
    const playerACardCode = center.playerACardCode;
    const playerBCardCode = center.playerBCardCode;
    const attribute = center.chosenAttribute ?? 'magic';
    const playerAValue = center.playerAAttributeValue ?? 0;
    const playerBValue = center.playerBAttributeValue ?? 0;
    const roundWinner = center.roundWinnerId;

    const discardPiles = (game.discardPiles as PlayerCardCollection) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };
    if (roundWinner && playerACardCode && playerBCardCode) {
      discardPiles[roundWinner] = [
        ...(discardPiles[roundWinner] ?? []),
        playerACardCode,
        playerBCardCode,
      ];
    }

    const hands = (game.hands as PlayerCardCollection) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };
    const decks = (game.decks as PlayerCardCollection) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };

    decks[game.playerAId] ??= [];
    decks[game.playerBId] ??= [];
    const playerADraw = takeOneRandomCardFromDeck(decks[game.playerAId]);
    const playerBDraw = takeOneRandomCardFromDeck(decks[game.playerBId]);
    if (playerADraw) {
      hands[game.playerAId] ??= [];
      hands[game.playerAId].push(playerADraw);
    }
    if (playerBDraw) {
      hands[game.playerBId] ??= [];
      hands[game.playerBId].push(playerBDraw);
    }

    const nextChooser =
      center.chooserId === game.playerAId ? game.playerBId : game.playerAId;

    hands[game.playerAId] ??= [];
    hands[game.playerBId] ??= [];
    const playerAHasNoCards = hands[game.playerAId].length === 0;
    const playerBHasNoCards = hands[game.playerBId].length === 0;

    let gameWinner: string | null = null;
    let nextStage: DuelStage = 'PICK_CARD';
    let nextCenter: DuelCenterState | null = initializeDuelCenterState();
    if (nextCenter) {
      nextCenter.chooserId = nextChooser;
      nextCenter.deadlineAt = Date.now() + TURN_DURATION_MS;
    }

    if (playerAHasNoCards || playerBHasNoCards) {
      const playerAScore = (discardPiles[game.playerAId] ?? []).length;
      const playerBScore = (discardPiles[game.playerBId] ?? []).length;
      gameWinner =
        playerAScore > playerBScore
          ? game.playerAId
          : playerBScore > playerAScore
            ? game.playerBId
            : 'DRAW';
      nextStage = 'RESOLVED';
      nextCenter = null;
    }

    const cards = await this.prisma.card.findMany({
      where: { code: { in: [playerACardCode ?? '', playerBCardCode ?? ''] } },
    });
    const playerAName = game.playerA?.username ?? game.playerAId;
    const playerBName = game.playerB?.username ?? game.playerBId;
    const chooserName =
      (center.chooserId ?? game.playerAId) === game.playerAId
        ? playerAName
        : playerBName;
    const getCardName = (code?: string | null) =>
      cards.find((card) => card.code === code)?.name ?? code ?? 'Unknown card';

    const winnerLabel =
      gameWinner && gameWinner !== 'DRAW'
        ? gameWinner === game.playerAId
          ? playerAName
          : playerBName
        : gameWinner === 'DRAW'
          ? 'Draw'
          : roundWinner
            ? roundWinner === game.playerAId
              ? playerAName
              : playerBName
            : 'Draw';

    const gameLogEntry =
      `${attribute.toUpperCase()} duel(${chooserName}): ` +
      `${getCardName(playerACardCode)}(${playerAValue}) vs ` +
      `${getCardName(playerBCardCode)}(${playerBValue}) => ${winnerLabel}`;

    const result = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        hands,
        decks,
        duelCenter: prepareNullableJsonField(
          serializeDuelCenter(nextCenter),
        ),
        duelStage: nextStage,
        discardPiles: prepareNullableJsonField(
          convertCardCollectionToPrismaInput(discardPiles),
        ),
        winner: nextStage === 'RESOLVED' ? gameWinner : game.winner,
        log: [
          ...(game.log as string[]),
          gameLogEntry,
          ...(playerADraw ? [`${playerAName} draws`] : []),
          ...(playerBDraw ? [`${playerBName} draws`] : []),
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
      `[advanceDuelRound] stage=${result.duelStage} winner=${result.winner ?? '-'}`,
    );
    return result;
  }

  async unchooseCardForDuel(gameId: string, dto: { playerId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
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
      if (!game) return null;
      if (game.mode !== 'ATTRIBUTE_DUEL') return game;
      if (game.duelStage === 'REVEAL' || game.duelStage === 'RESOLVED')
        return game;

      const hands = (game.hands as PlayerCardCollection) ?? {};
      const center =
        game.duelCenter === null
          ? initializeDuelCenterState()
          : deserializeDuelCenter(game.duelCenter);

      const isPlayerA = dto.playerId === game.playerAId;
      const playerId = dto.playerId;
      const opponentId = isPlayerA ? game.playerBId : game.playerAId;
      const myCardCode = isPlayerA
        ? center.playerACardCode
        : center.playerBCardCode;
      if (!myCardCode) return game;

      hands[playerId] ??= [];
      hands[playerId].push(myCardCode);

      const opponentCardCode = isPlayerA
        ? center.playerBCardCode
        : center.playerACardCode;
      if (opponentCardCode) {
        hands[opponentId] ??= [];
        hands[opponentId].push(opponentCardCode);
      }

      const resetCenter = initializeDuelCenterState();
      resetCenter.chooserId = playerId;
      resetCenter.deadlineAt = Date.now() + TURN_DURATION_MS;

      const updated = await tx.game.update({
        where: { id: gameId },
        data: {
          hands,
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

      return updated;
    });
  }
}
