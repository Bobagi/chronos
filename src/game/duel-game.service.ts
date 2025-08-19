import { Injectable } from '@nestjs/common';
import { Prisma, DuelStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BOT_ID,
  GameState,
  asCenter,
  jsonInputOrDbNull,
  removeOneCardFromHand,
  takeOneRandomFromDeck,
} from './game.types';

@Injectable()
export class DuelGameService {
  constructor(private readonly prisma: PrismaService) {}

  private autoPickBotCardIfNeeded(
    gameRow: Prisma.GameUncheckedCreateInput & {
      playerAId: string;
      playerBId: string;
    },
    handsByPlayerId: Record<string, string[]>,
    duelCenter: NonNullable<GameState['duelCenter']>,
  ) {
    if (!duelCenter.aCardCode && gameRow.playerAId === BOT_ID) {
      const botHand = handsByPlayerId[gameRow.playerAId] ?? [];
      if (botHand.length) {
        const randomIndex = Math.floor(Math.random() * botHand.length);
        const pickedCard = botHand[randomIndex];
        removeOneCardFromHand(handsByPlayerId, gameRow.playerAId, pickedCard);
        duelCenter.aCardCode = pickedCard;
      }
    }
    if (!duelCenter.bCardCode && gameRow.playerBId === BOT_ID) {
      const botHand = handsByPlayerId[gameRow.playerBId] ?? [];
      if (botHand.length) {
        const randomIndex = Math.floor(Math.random() * botHand.length);
        const pickedCard = botHand[randomIndex];
        removeOneCardFromHand(handsByPlayerId, gameRow.playerBId, pickedCard);
        duelCenter.bCardCode = pickedCard;
      }
    }
  }

  private async pickBestAttributeForBot(
    gameRow: { playerAId: string; playerBId: string },
    duelCenter: NonNullable<GameState['duelCenter']>,
  ): Promise<'magic' | 'might' | 'fire'> {
    const aCode = duelCenter.aCardCode!;
    const bCode = duelCenter.bCardCode!;
    const cards = await this.prisma.card.findMany({
      where: { code: { in: [aCode, bCode] } },
    });
    const getByCode = (code: string) => cards.find((c) => c.code === code)!;

    const cardA = getByCode(aCode);
    const cardB = getByCode(bCode);
    const botIsA = gameRow.playerAId === BOT_ID;
    const attributes: Array<'magic' | 'might' | 'fire'> = [
      'magic',
      'might',
      'fire',
    ];

    let bestChoice: 'magic' | 'might' | 'fire' = 'magic';
    let bestDelta = -Infinity;

    for (const attribute of attributes) {
      const aVal = Number((cardA as any)[attribute] ?? 0);
      const bVal = Number((cardB as any)[attribute] ?? 0);
      const delta = botIsA ? aVal - bVal : bVal - aVal;
      if (delta > bestDelta) {
        bestDelta = delta;
        bestChoice = attribute;
      }
    }
    return bestChoice;
  }

  async chooseCardForDuel(
    gameId: string,
    dto: { playerId: string; cardCode: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game || game.mode !== 'ATTRIBUTE_DUEL') return game;

      const handsByPlayerId = (game.hands as Record<string, string[]>) ?? {};
      const duelCenter = (game.duelCenter ?? {}) as NonNullable<
        GameState['duelCenter']
      >;
      let nextStage = game.duelStage ?? 'PICK_CARD';
      if (nextStage !== 'PICK_CARD') return game;

      const iAmPlayerA = dto.playerId === game.playerAId;
      if (
        (iAmPlayerA && duelCenter.aCardCode) ||
        (!iAmPlayerA && duelCenter.bCardCode)
      ) {
        return game;
      }

      if (!removeOneCardFromHand(handsByPlayerId, dto.playerId, dto.cardCode))
        return game;

      if (iAmPlayerA) duelCenter.aCardCode = dto.cardCode;
      else duelCenter.bCardCode = dto.cardCode;

      this.autoPickBotCardIfNeeded(game as any, handsByPlayerId, duelCenter);

      if (duelCenter.aCardCode && duelCenter.bCardCode) {
        nextStage = 'PICK_ATTRIBUTE';
        duelCenter.chooserId = duelCenter.chooserId ?? game.playerAId;
      }

      const updated = await tx.game.update({
        where: { id: gameId },
        data: {
          hands: handsByPlayerId,
          duelCenter: jsonInputOrDbNull(duelCenter),
          duelStage: nextStage,
        },
      });

      const updatedCenter = asCenter(updated.duelCenter);
      const chooserId = updatedCenter.chooserId;
      if (updated.duelStage === 'PICK_ATTRIBUTE' && chooserId === BOT_ID) {
        const best = await this.pickBestAttributeForBot(updated, updatedCenter);
        return this.chooseAttributeForDuel(gameId, {
          playerId: BOT_ID,
          attribute: best,
        });
      }

      return updated;
    });
  }

  async chooseAttributeForDuel(
    gameId: string,
    dto: { playerId: string; attribute: 'magic' | 'might' | 'fire' },
  ) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (
      !game ||
      game.mode !== 'ATTRIBUTE_DUEL' ||
      game.duelStage !== 'PICK_ATTRIBUTE'
    )
      return game;

    const duelCenter = ((game.duelCenter as any) ?? {}) as NonNullable<
      GameState['duelCenter']
    >;
    if (duelCenter.chooserId && dto.playerId !== duelCenter.chooserId)
      return game;

    const aCode = duelCenter.aCardCode;
    const bCode = duelCenter.bCardCode;
    if (!aCode || !bCode) return game;

    const cards = await this.prisma.card.findMany({
      where: { code: { in: [aCode, bCode] } },
    });
    const getByCode = (code: string) => cards.find((c) => c.code === code)!;
    const attributeKey =
      dto.attribute === 'magic'
        ? 'magic'
        : dto.attribute === 'might'
          ? 'might'
          : 'fire';

    const aVal = Number((getByCode(aCode) as any)[attributeKey] ?? 0);
    const bVal = Number((getByCode(bCode) as any)[attributeKey] ?? 0);

    let roundWinner: string | null = null;
    if (aVal > bVal) roundWinner = game.playerAId;
    else if (bVal > aVal) roundWinner = game.playerBId;

    duelCenter.chosenAttribute = dto.attribute;
    duelCenter.revealed = true;
    (duelCenter as any).aVal = aVal;
    (duelCenter as any).bVal = bVal;
    (duelCenter as any).roundWinner = roundWinner;

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        duelCenter: jsonInputOrDbNull(duelCenter),
        duelStage: 'REVEAL',
      },
    });
  }

  async advanceDuelRound(gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.mode !== 'ATTRIBUTE_DUEL' || game.duelStage !== 'REVEAL')
      return game;

    const duelCenter = game.duelCenter as any as NonNullable<
      GameState['duelCenter']
    >;
    const aCode = duelCenter.aCardCode;
    const bCode = duelCenter.bCardCode;
    const chosenAttribute =
      (duelCenter.chosenAttribute as 'magic' | 'might' | 'fire') ?? 'magic';
    const aVal = Number(duelCenter.aVal ?? 0);
    const bVal = Number(duelCenter.bVal ?? 0);
    const roundWinner = (duelCenter.roundWinner as string | null) ?? null;

    const discardPiles = (game.discardPiles as Record<string, string[]>) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };
    if (roundWinner && aCode && bCode) {
      discardPiles[roundWinner] = [
        ...(discardPiles[roundWinner] ?? []),
        aCode,
        bCode,
      ];
    }

    const cards = await this.prisma.card.findMany({
      where: { code: { in: [aCode!, bCode!] } },
    });
    const nameOf = (code?: string) =>
      cards.find((c) => c.code === code)?.name ?? code ?? 'unknown';
    const chooserId = duelCenter.chooserId ?? game.playerAId;
    const logLine = `DUEL ${chosenAttribute.toUpperCase()} (chooser=${chooserId}): ${nameOf(aCode)}(${chosenAttribute}=${aVal}) vs ${nameOf(bCode)}(${chosenAttribute}=${bVal}) => ${roundWinner ?? 'TIE'}`;

    const handsByPlayerId = (game.hands as Record<string, string[]>) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };
    const decksByPlayerId = (game.decks as Record<string, string[]>) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };

    const drawA = takeOneRandomFromDeck(decksByPlayerId[game.playerAId]);
    const drawB = takeOneRandomFromDeck(decksByPlayerId[game.playerBId]);
    if (drawA) (handsByPlayerId[game.playerAId] ??= []).push(drawA);
    if (drawB) (handsByPlayerId[game.playerBId] ??= []).push(drawB);

    const drawLogs: string[] = [];
    if (drawA) drawLogs.push(`${game.playerAId} draws`);
    if (drawB) drawLogs.push(`${game.playerBId} draws`);

    const nextChooserId =
      duelCenter.chooserId === game.playerAId ? game.playerBId : game.playerAId;

    const playerAEmpty = (handsByPlayerId[game.playerAId] ?? []).length === 0;
    const playerBEmpty = (handsByPlayerId[game.playerBId] ?? []).length === 0;

    let gameWinner: string | null = null;
    let nextStage: DuelStage = 'PICK_CARD';
    let nextCenter: GameState['duelCenter'] = { chooserId: nextChooserId };

    if (playerAEmpty || playerBEmpty) {
      const aCount = (discardPiles[game.playerAId] ?? []).length;
      const bCount = (discardPiles[game.playerBId] ?? []).length;
      gameWinner =
        aCount > bCount
          ? game.playerAId
          : bCount > aCount
            ? game.playerBId
            : null;
      nextStage = 'RESOLVED';
      nextCenter = null;
    }

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        hands: handsByPlayerId,
        decks: decksByPlayerId,
        duelCenter: jsonInputOrDbNull(nextCenter),
        duelStage: nextStage,
        discardPiles: jsonInputOrDbNull(discardPiles),
        winner: gameWinner,
        log: [...(game.log as string[]), logLine, ...drawLogs],
      },
    });
  }
}
