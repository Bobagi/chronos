import { Injectable, Logger } from '@nestjs/common';
import { DuelStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BOT_ID,
  GameState,
  jsonInputOrDbNull,
  removeOneCardFromHand,
  takeOneRandomFromDeck,
} from './game.types';

const TURN_DURATION_MS = 10 * 1000;

@Injectable()
export class DuelGameService {
  private readonly logger = new Logger(DuelGameService.name);

  constructor(private readonly prisma: PrismaService) {}

  private autoPickBotCardIfNeeded(
    gameData: { playerAId: string; playerBId: string },
    playerHands: Record<string, string[]>,
    duelCenter: NonNullable<GameState['duelCenter']>,
  ) {
    if (!duelCenter.aCardCode && gameData.playerAId === BOT_ID) {
      const botHand = playerHands[gameData.playerAId] ?? [];
      if (botHand.length) {
        const randomIndex = Math.floor(Math.random() * botHand.length);
        const selectedCard = botHand[randomIndex];
        removeOneCardFromHand(playerHands, gameData.playerAId, selectedCard);
        duelCenter.aCardCode = selectedCard;
        this.logger.log(
          `[autoPickBotCardIfNeeded] BOT (A) selected card=${selectedCard}`,
        );
      }
    }
    if (!duelCenter.bCardCode && gameData.playerBId === BOT_ID) {
      const botHand = playerHands[gameData.playerBId] ?? [];
      if (botHand.length) {
        const randomIndex = Math.floor(Math.random() * botHand.length);
        const selectedCard = botHand[randomIndex];
        removeOneCardFromHand(playerHands, gameData.playerBId, selectedCard);
        duelCenter.bCardCode = selectedCard;
        this.logger.log(
          `[autoPickBotCardIfNeeded] BOT (B) selected card=${selectedCard}`,
        );
      }
    }
  }

  private pickRandomCardFromHand(
    playerId: string,
    hands: Record<string, string[]>,
  ): string | undefined {
    const hand = hands[playerId] ?? [];
    if (!hand.length) return undefined;
    const randomIndex = Math.floor(Math.random() * hand.length);
    const selectedCard = hand[randomIndex];
    removeOneCardFromHand(hands, playerId, selectedCard);
    return selectedCard;
  }

  private randomAttribute(): 'magic' | 'might' | 'fire' {
    const attributes: Array<'magic' | 'might' | 'fire'> = [
      'magic',
      'might',
      'fire',
    ];
    return attributes[Math.floor(Math.random() * attributes.length)];
  }

  private async determineBestAttributeForBot(
    gameData: { playerAId: string; playerBId: string },
    duelCenter: NonNullable<GameState['duelCenter']>,
  ): Promise<'magic' | 'might' | 'fire'> {
    const playerACardCode = duelCenter.aCardCode!;
    const playerBCardCode = duelCenter.bCardCode!;
    const cards = await this.prisma.card.findMany({
      where: { code: { in: [playerACardCode, playerBCardCode] } },
    });
    const findCard = (code: string) => cards.find((c) => c.code === code)!;
    const playerACard = findCard(playerACardCode);
    const playerBCard = findCard(playerBCardCode);
    const isBotPlayerA = gameData.playerAId === BOT_ID;
    const attributes: Array<'magic' | 'might' | 'fire'> = [
      'magic',
      'might',
      'fire',
    ];

    let bestAttribute: 'magic' | 'might' | 'fire' = 'magic';
    let bestValueDifference = -Infinity;

    for (const attribute of attributes) {
      const playerAValue = Number((playerACard as any)[attribute] ?? 0);
      const playerBValue = Number((playerBCard as any)[attribute] ?? 0);
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
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) return null;
      if (game.mode !== 'ATTRIBUTE_DUEL') return game;

      const hands = (game.hands as Record<string, string[]>) ?? {};
      const center =
        (game.duelCenter as NonNullable<GameState['duelCenter']>) ??
        ({} as any);
      let stage: DuelStage = game.duelStage ?? 'PICK_CARD';

      if (stage !== 'PICK_CARD') return game;

      const now = Date.now();
      if (game.turnDeadline && now > game.turnDeadline.getTime()) {
        if (!center.aCardCode) {
          const autoCard = this.pickRandomCardFromHand(
            game.playerAId,
            hands,
          );
          if (autoCard) {
            center.aCardCode = autoCard;
            this.logger.log(
              `[chooseCardForDuel] timeout auto-picked card=${autoCard} for ${game.playerAId}`,
            );
          }
        }
        if (!center.bCardCode) {
          const autoCard = this.pickRandomCardFromHand(
            game.playerBId,
            hands,
          );
          if (autoCard) {
            center.bCardCode = autoCard;
            this.logger.log(
              `[chooseCardForDuel] timeout auto-picked card=${autoCard} for ${game.playerBId}`,
            );
          }
        }
      }

      if (!center.aCardCode || !center.bCardCode) {
        const isPlayerA = playerAction.playerId === game.playerAId;
        if (!((isPlayerA && center.aCardCode) || (!isPlayerA && center.bCardCode))) {
          if (
            !removeOneCardFromHand(
              hands,
              playerAction.playerId,
              playerAction.cardCode,
            )
          )
            return game;

          if (isPlayerA) center.aCardCode = playerAction.cardCode;
          else center.bCardCode = playerAction.cardCode;
        }
      }

      this.autoPickBotCardIfNeeded(
        { playerAId: game.playerAId, playerBId: game.playerBId },
        hands,
        center,
      );

      let deadlineToSet: Date | null = null;
      if (center.aCardCode && center.bCardCode) {
        stage = 'PICK_ATTRIBUTE';
        center.chooserId = center.chooserId ?? game.playerAId;
        deadlineToSet = new Date(Date.now() + TURN_DURATION_MS);
      } else {
        deadlineToSet = new Date(Date.now() + TURN_DURATION_MS);
      }

      const result = await tx.game.update({
        where: { id: gameId },
        data: {
          hands,
          duelCenter: jsonInputOrDbNull(center),
          duelStage: stage,
          turnDeadline: deadlineToSet,
        },
      });

      return result;
    });

    if (!updatedGame) return null;

    const centerAfterUpdate =
      (updatedGame.duelCenter as NonNullable<GameState['duelCenter']>) ??
      ({} as any);
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
      include: {
        playerA: { select: { username: true } },
        playerB: { select: { username: true } },
      },
    });
    if (!game) return null;
    if (game.mode !== 'ATTRIBUTE_DUEL') return game;
    if (game.duelStage !== 'PICK_ATTRIBUTE') return game;

    const center =
      (game.duelCenter as NonNullable<GameState['duelCenter']>) ?? ({} as any);
    const chooserId = center.chooserId ?? game.playerAId;
    const now = Date.now();

    if (game.turnDeadline && now > game.turnDeadline.getTime()) {
      const autoAttribute = this.randomAttribute();
      this.logger.log(
        `[chooseAttributeForDuel] timeout auto-picked attribute=${autoAttribute} for ${chooserId}`,
      );
      playerAction = { playerId: chooserId, attribute: autoAttribute };
    } else if (playerAction.playerId !== chooserId) {
      return game;
    }

    const playerACardCode = center.aCardCode;
    const playerBCardCode = center.bCardCode;
    if (!playerACardCode || !playerBCardCode) return game;

    const cards = await this.prisma.card.findMany({
      where: { code: { in: [playerACardCode, playerBCardCode] } },
    });
    const getCard = (code: string) => cards.find((c) => c.code === code)!;
    const attributeKey = playerAction.attribute;

    const playerAValue = Number(
      (getCard(playerACardCode) as any)[attributeKey] ?? 0,
    );
    const playerBValue = Number(
      (getCard(playerBCardCode) as any)[attributeKey] ?? 0,
    );

    let roundWinner: string | null = null;
    if (playerAValue > playerBValue) roundWinner = game.playerAId;
    else if (playerBValue > playerAValue) roundWinner = game.playerBId;

    center.chosenAttribute = playerAction.attribute;
    center.revealed = true;
    (center as any).aVal = playerAValue;
    (center as any).bVal = playerBValue;
    (center as any).roundWinner = roundWinner;

    const result = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        duelCenter: jsonInputOrDbNull(center),
        duelStage: 'REVEAL',
        turnDeadline: null,
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
      include: {
        playerA: { select: { username: true } },
        playerB: { select: { username: true } },
      },
    });
    if (!game) return null;
    if (game.mode !== 'ATTRIBUTE_DUEL' || game.duelStage !== 'REVEAL')
      return game;

    const center = game.duelCenter as any as NonNullable<
      GameState['duelCenter']
    >;
    const playerACardCode = center.aCardCode;
    const playerBCardCode = center.bCardCode;
    const attribute =
      (center.chosenAttribute as 'magic' | 'might' | 'fire') ?? 'magic';
    const playerAValue = Number(center.aVal ?? 0);
    const playerBValue = Number(center.bVal ?? 0);
    const roundWinner = (center.roundWinner as string | null) ?? null;

    const discardPiles = (game.discardPiles as Record<string, string[]>) ?? {
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

    const hands = (game.hands as Record<string, string[]>) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };
    const decks = (game.decks as Record<string, string[]>) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };

    const playerADraw = takeOneRandomFromDeck(decks[game.playerAId]);
    const playerBDraw = takeOneRandomFromDeck(decks[game.playerBId]);
    if (playerADraw) (hands[game.playerAId] ??= []).push(playerADraw);
    if (playerBDraw) (hands[game.playerBId] ??= []).push(playerBDraw);

    const nextChooser =
      center.chooserId === game.playerAId ? game.playerBId : game.playerAId;

    const playerAHasNoCards = (hands[game.playerAId] ?? []).length === 0;
    const playerBHasNoCards = (hands[game.playerBId] ?? []).length === 0;

    let gameWinner: string | null = null;
    let nextStage: DuelStage = 'PICK_CARD';
    let nextCenter: GameState['duelCenter'] = { chooserId: nextChooser };

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
      where: { code: { in: [playerACardCode!, playerBCardCode!] } },
    });
    const playerAName = game.playerA?.username ?? game.playerAId;
    const playerBName = game.playerB?.username ?? game.playerBId;
    const chooserName =
      (center.chooserId ?? game.playerAId) === game.playerAId
        ? playerAName
        : playerBName;
    const getCardName = (code?: string) =>
      cards.find((c) => c.code === code)?.name ?? code ?? 'unknown';

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
        duelCenter: jsonInputOrDbNull(nextCenter),
        duelStage: nextStage,
        discardPiles: jsonInputOrDbNull(discardPiles),
        winner: nextStage === 'RESOLVED' ? gameWinner : game.winner,
        log: [
          ...(game.log as string[]),
          gameLogEntry,
          ...(playerADraw ? [`${playerAName} draws`] : []),
          ...(playerBDraw ? [`${playerBName} draws`] : []),
        ],
        turnDeadline:
          nextStage === 'PICK_CARD'
            ? new Date(Date.now() + TURN_DURATION_MS)
            : null,
      },
    });

    this.logger.log(
      `[advanceDuelRound] stage=${result.duelStage} winner=${result.winner ?? '-'}`,
    );
    return result;
  }

  async unchooseCardForDuel(gameId: string, dto: { playerId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) return null;
      if (game.mode !== 'ATTRIBUTE_DUEL') return game;
      if (game.duelStage === 'REVEAL' || game.duelStage === 'RESOLVED')
        return game;

      const hands = (game.hands as Record<string, string[]>) ?? {};
      const center =
        (game.duelCenter as NonNullable<GameState['duelCenter']>) ??
        ({} as any);

      const isPlayerA = dto.playerId === game.playerAId;
      const mySideKey = isPlayerA ? 'aCardCode' : 'bCardCode';
      const oppSideKey = isPlayerA ? 'bCardCode' : 'aCardCode';

      const myCode: string | undefined = (center as any)[mySideKey];
      if (!myCode) return game;

      (hands[dto.playerId] ??= []).push(myCode);
      delete (center as any)[mySideKey];

      const oppId = isPlayerA ? game.playerBId : game.playerAId;
      const oppCode: string | undefined = (center as any)[oppSideKey];
      if (oppCode) {
        (hands[oppId] ??= []).push(oppCode);
        delete (center as any)[oppSideKey];
      }

      delete (center as any).chosenAttribute;
      delete (center as any).attribute;
      delete (center as any).attr;
      delete (center as any).attributeName;
      delete (center as any).revealed;
      delete (center as any).aVal;
      delete (center as any).bVal;
      delete (center as any).roundWinner;

      const nextStage: DuelStage = 'PICK_CARD';
      center.chooserId = dto.playerId;

      const updated = await tx.game.update({
        where: { id: gameId },
        data: {
          hands,
          duelCenter: jsonInputOrDbNull(center),
          duelStage: nextStage,
          turnDeadline: new Date(Date.now() + TURN_DURATION_MS),
        },
      });

      return updated;
    });
  }
}
