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

@Injectable()
export class DuelGameService {
  private readonly logger = new Logger(DuelGameService.name);

  constructor(private readonly prisma: PrismaService) {}

  /* --------------- Helper Methods --------------- */

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
      } else {
        this.logger.log(`[autoPickBotCardIfNeeded] BOT (A) has no cards`);
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
      } else {
        this.logger.log(`[autoPickBotCardIfNeeded] BOT (B) has no cards`);
      }
    }
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
      this.logger.log(
        `[determineBestAttributeForBot] A=${playerACardCode}.${attribute}=${playerAValue} B=${playerBCardCode}.${attribute}=${playerBValue} difference=${valueDifference}`,
      );
      if (valueDifference > bestValueDifference) {
        bestValueDifference = valueDifference;
        bestAttribute = attribute;
      }
    }
    this.logger.log(`[determineBestAttributeForBot] selected=${bestAttribute}`);
    return bestAttribute;
  }

  /* --------------- Core Game Methods --------------- */

  async chooseCardForDuel(
    gameId: string,
    playerAction: { playerId: string; cardCode: string },
  ) {
    this.logger.log(
      `[chooseCardForDuel] game=${gameId} player=${playerAction.playerId} card=${playerAction.cardCode}`,
    );

    // 1) Transaction to update hands/center/stage
    const updatedGame = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) {
        this.logger.warn(`[chooseCardForDuel] game not found`);
        return null;
      }
      if (game.mode !== 'ATTRIBUTE_DUEL') {
        this.logger.warn(
          `[chooseCardForDuel] invalid mode=${game.mode} (expected ATTRIBUTE_DUEL)`,
        );
        return game;
      }

      const hands = (game.hands as Record<string, string[]>) ?? {};
      const center =
        (game.duelCenter as NonNullable<GameState['duelCenter']>) ??
        ({} as any);
      let stage: DuelStage = game.duelStage ?? 'PICK_CARD';

      if (stage !== 'PICK_CARD') {
        this.logger.log(
          `[chooseCardForDuel] ignored: stage=${stage} != PICK_CARD`,
        );
        return game;
      }

      const isPlayerA = playerAction.playerId === game.playerAId;
      if ((isPlayerA && center.aCardCode) || (!isPlayerA && center.bCardCode)) {
        this.logger.log(
          `[chooseCardForDuel] duplicate: side already has card (isPlayerA=${isPlayerA})`,
        );
        return game;
      }

      if (
        !removeOneCardFromHand(
          hands,
          playerAction.playerId,
          playerAction.cardCode,
        )
      ) {
        this.logger.warn(
          `[chooseCardForDuel] card not in hand: ${playerAction.cardCode}`,
        );
        return game;
      }

      if (isPlayerA) center.aCardCode = playerAction.cardCode;
      else center.bCardCode = playerAction.cardCode;

      this.autoPickBotCardIfNeeded(
        { playerAId: game.playerAId, playerBId: game.playerBId },
        hands,
        center,
      );

      if (center.aCardCode && center.bCardCode) {
        stage = 'PICK_ATTRIBUTE';
        center.chooserId = center.chooserId ?? game.playerAId;
        this.logger.log(
          `[chooseCardForDuel] transition -> PICK_ATTRIBUTE (chooserId=${center.chooserId})`,
        );
      }

      const result = await tx.game.update({
        where: { id: gameId },
        data: {
          hands,
          duelCenter: jsonInputOrDbNull(center),
          duelStage: stage,
        },
      });

      this.logger.log(
        `[chooseCardForDuel] TX update successful: stage=${result.duelStage}`,
      );
      return result;
    });

    if (!updatedGame) return null;

    // 2) Outside transaction: If BOT is the chooser, it selects attribute now
    const centerAfterUpdate =
      (updatedGame.duelCenter as NonNullable<GameState['duelCenter']>) ??
      ({} as any);
    const chooserId = centerAfterUpdate.chooserId ?? updatedGame.playerAId;

    this.logger.log(
      `[chooseCardForDuel] post-TX: stage=${updatedGame.duelStage} chooserId=${chooserId}`,
    );

    if (updatedGame.duelStage === 'PICK_ATTRIBUTE' && chooserId === BOT_ID) {
      this.logger.log(`[chooseCardForDuel] BOT will choose attribute`);
      const bestAttribute = await this.determineBestAttributeForBot(
        updatedGame,
        centerAfterUpdate,
      );
      const resultAfterReveal = await this.chooseAttributeForDuel(gameId, {
        playerId: BOT_ID,
        attribute: bestAttribute,
      });
      this.logger.log(
        `[chooseCardForDuel] BOT chose attribute=${bestAttribute} -> stage=${resultAfterReveal?.duelStage}`,
      );
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
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      this.logger.warn(`[chooseAttributeForDuel] game not found`);
      return null;
    }
    if (game.mode !== 'ATTRIBUTE_DUEL') {
      this.logger.warn(
        `[chooseAttributeForDuel] invalid mode=${game.mode} (expected ATTRIBUTE_DUEL)`,
      );
      return game;
    }
    if (game.duelStage !== 'PICK_ATTRIBUTE') {
      this.logger.log(
        `[chooseAttributeForDuel] ignored: stage=${game.duelStage} != PICK_ATTRIBUTE`,
      );
      return game;
    }

    const center =
      (game.duelCenter as NonNullable<GameState['duelCenter']>) ?? ({} as any);
    if (center.chooserId && playerAction.playerId !== center.chooserId) {
      this.logger.log(
        `[chooseAttributeForDuel] ignored: current chooserId=${center.chooserId} != ${playerAction.playerId}`,
      );
      return game;
    }

    const playerACardCode = center.aCardCode;
    const playerBCardCode = center.bCardCode;
    if (!playerACardCode || !playerBCardCode) {
      this.logger.warn(
        `[chooseAttributeForDuel] no cards in center (A=${playerACardCode}, B=${playerBCardCode})`,
      );
      return game;
    }

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
    this.logger.log(
      `[chooseAttributeForDuel] comparison: A(${playerACardCode}).${attributeKey}=${playerAValue} vs B(${playerBCardCode}).${attributeKey}=${playerBValue}`,
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
      },
    });

    this.logger.log(
      `[chooseAttributeForDuel] -> REVEAL (winner=${roundWinner ?? 'TIE'})`,
    );
    return result;
  }

  async advanceDuelRound(gameId: string) {
    this.logger.log(`[advanceDuelRound] game=${gameId}`);
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      this.logger.warn(`[advanceDuelRound] game not found`);
      return null;
    }
    if (game.mode !== 'ATTRIBUTE_DUEL' || game.duelStage !== 'REVEAL') {
      this.logger.log(
        `[advanceDuelRound] ignored: mode=${game.mode} stage=${game.duelStage}`,
      );
      return game;
    }

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

    this.logger.log(
      `[advanceDuelRound] REVEAL: ${attribute} A(${playerACardCode})=${playerAValue} vs B(${playerBCardCode})=${playerBValue} -> ${roundWinner ?? 'TIE'}`,
    );

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

    this.logger.log(
      `[advanceDuelRound] draws: A=${playerADraw ?? '-'} B=${playerBDraw ?? '-'}`,
    );

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
            : null;
      nextStage = 'RESOLVED';
      nextCenter = null;
      this.logger.log(
        `[advanceDuelRound] game end: piles A=${playerAScore} B=${playerBScore} -> winner=${gameWinner ?? 'TIE'}`,
      );
    } else {
      this.logger.log(
        `[advanceDuelRound] next round -> chooserId=${nextChooser}`,
      );
    }

    const cards = await this.prisma.card.findMany({
      where: { code: { in: [playerACardCode!, playerBCardCode!] } },
    });
    const getCardName = (code?: string) =>
      cards.find((c) => c.code === code)?.name ?? code ?? 'unknown';
    const gameLogEntry = `DUEL ${attribute.toUpperCase()} (chooser=${center.chooserId ?? game.playerAId}): ${getCardName(playerACardCode)}(${attribute}=${playerAValue}) vs ${getCardName(playerBCardCode)}(${attribute}=${playerBValue}) => ${gameWinner ?? roundWinner ?? 'TIE'}`;

    const result = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        hands,
        decks,
        duelCenter: jsonInputOrDbNull(nextCenter),
        duelStage: nextStage,
        discardPiles: jsonInputOrDbNull(discardPiles),
        winner: gameWinner,
        log: [
          ...(game.log as string[]),
          gameLogEntry,
          ...(playerADraw ? [`${game.playerAId} draws`] : []),
          ...(playerBDraw ? [`${game.playerBId} draws`] : []),
        ],
      },
    });

    this.logger.log(
      `[advanceDuelRound] update successful: stage=${result.duelStage} winner=${result.winner ?? '-'}`,
    );
    return result;
  }
}
