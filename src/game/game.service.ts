/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import type {
  Card as PrismaCard,
  CardTemplate as PrismaCardTemplate,
  DuelStage as PrismaDuelStage,
  Game as PrismaGame,
  GameMode as PrismaGameMode,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const BOT_ID = 'BOT';

export interface GameState {
  players: string[];
  turn: number;
  log: string[];
  hp: Record<string, number>;
  winner: string | null;
  hands: Record<string, string[]>;
  decks: Record<string, string[]>;
  lastActivity: number;

  mode: PrismaGameMode;
  duelStage?: PrismaDuelStage | null;
  duelCenter?: {
    aCardCode?: string;
    bCardCode?: string;
    chosenAttribute?: 'magic' | 'might' | 'fire';
    revealed?: boolean;
    chooserId?: string;

    // reveal payload for UI
    aVal?: number;
    bVal?: number;
    roundWinner?: string | null;
  } | null;
  discardPiles?: Record<string, string[]> | null;
}

/* ---------------- helpers (shared) ---------------- */

function draw(deck: string[], count: number) {
  const out: string[] = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    out.push(deck.splice(idx, 1)[0]);
  }
  return out;
}

function asCenter(v: Prisma.JsonValue | null | undefined) {
  return (v ?? {}) as NonNullable<GameState['duelCenter']>;
}

function drawOne(deck: string[] | undefined): string | undefined {
  if (!deck || deck.length === 0) return undefined;
  const idx = Math.floor(Math.random() * deck.length);
  return deck.splice(idx, 1)[0];
}

/** Remove EXACTLY ONE occurrence of cardCode from a player's hand. */
function removeOne(
  hands: Record<string, string[]>,
  playerId: string,
  cardCode: string,
): boolean {
  const arr = [...(hands[playerId] ?? [])];
  const pos = arr.indexOf(cardCode);
  if (pos === -1) return false;
  arr.splice(pos, 1);
  hands[playerId] = arr;
  return true;
}

@Injectable()
export class GameService {
  private active: Record<string, GameState> = {}; // CLASSIC only (memory)
  private static readonly EXP_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  private asNullableJson(
    v: unknown,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
    return v === null || v === undefined
      ? Prisma.DbNull
      : (v as Prisma.InputJsonValue);
  }

  /* ---------------- catalogs ---------------- */

  async getAllCards(): Promise<PrismaCard[]> {
    return this.prisma.card.findMany();
  }
  async getCardByCode(code: string): Promise<PrismaCard | null> {
    return this.prisma.card.findUnique({ where: { code } });
  }
  async getAllTemplates(): Promise<PrismaCardTemplate[]> {
    return this.prisma.cardTemplate.findMany();
  }

  /* ---------------- create game ---------------- */

  async createGame(
    playerAId: string,
    playerBId: string = BOT_ID,
    mode: PrismaGameMode = 'CLASSIC',
  ): Promise<{ gameId: string; state: GameState }> {
    const gameId = randomUUID();

    const cards = await this.getAllCards();
    const pool = cards.length
      ? cards.map((c) => c.code)
      : ['fireball', 'lightning', 'heal'];

    const mkDeck = (codes: string[], size: number) =>
      Array.from(
        { length: size },
        () => codes[Math.floor(Math.random() * codes.length)],
      );

    const deckA = mkDeck(pool, 15);
    const deckB = mkDeck(pool, 15);
    const handA = draw(deckA, 4);
    const handB = draw(deckB, 4);

    const init: GameState = {
      players: [playerAId, playerBId],
      turn: 0,
      log: ['Game created'],
      hp: { [playerAId]: 20, [playerBId]: 20 },
      winner: null,
      hands: { [playerAId]: handA, [playerBId]: handB },
      decks: { [playerAId]: deckA, [playerBId]: deckB },
      lastActivity: Date.now(),

      mode,
      duelStage: mode === 'ATTRIBUTE_DUEL' ? 'PICK_CARD' : null,
      duelCenter: mode === 'ATTRIBUTE_DUEL' ? { chooserId: playerAId } : null,
      discardPiles:
        mode === 'ATTRIBUTE_DUEL' ? { [playerAId]: [], [playerBId]: [] } : null,
    };

    await this.prisma.game.create({
      data: {
        id: gameId,
        turn: init.turn,
        hp: init.hp,
        winner: init.winner,
        hands: init.hands,
        decks: init.decks,
        log: init.log,
        mode,
        duelStage: init.duelStage ?? null,
        duelCenter: this.asNullableJson(init.duelCenter),
        discardPiles: this.asNullableJson(init.discardPiles),

        playerA: {
          connectOrCreate: {
            where: { id: playerAId },
            create: { id: playerAId, username: playerAId },
          },
        },
        playerB: {
          connectOrCreate: {
            where: { id: playerBId },
            create: {
              id: playerBId,
              username: playerBId === BOT_ID ? 'Bot Opponent' : playerBId,
            },
          },
        },
      },
    });

    if (mode === 'CLASSIC') this.active[gameId] = init;
    return { gameId, state: init };
  }

  /* ---------------- CLASSIC ---------------- */

  private async resolveClassicPlay(
    state: GameState,
    actorId: string,
    cardCode: string,
    label: string,
  ) {
    const card = await this.prisma.card.findUnique({
      where: { code: cardCode },
    });
    if (!card) throw new Error(`Card "${cardCode}" not found`);

    const [aId, bId] = state.players;
    const oppId = aId === actorId ? bId : aId;

    const hand = state.hands[actorId];
    const idx = hand.indexOf(cardCode);
    if (idx < 0) throw new Error(`${label} does not have "${cardCode}"`);
    hand.splice(idx, 1);

    let log = `${label} played ${card.name}`;
    if (card.damage) {
      state.hp[oppId] = Math.max(0, state.hp[oppId] - card.damage);
      log += ` → ${card.damage} dmg`;
    }
    if (card.heal) {
      state.hp[actorId] += card.heal;
      log += ` → +${card.heal} HP`;
    }

    if (state.hp[oppId] <= 0 && !state.winner) {
      state.winner = actorId;
      log += ' — WIN';
    }

    state.log.push(log);
    state.turn++;
    state.lastActivity = Date.now();

    const nextId = state.players[state.turn % 2];
    if (!state.winner) {
      const drawn = draw(state.decks[nextId], 1)[0];
      if (drawn) {
        state.hands[nextId].push(drawn);
        state.log.push(`${nextId} draws a card`);
      } else {
        state.log.push(`${nextId} cannot draw (deck empty)`);
      }
    }
  }

  async playCard(
    gameId: string,
    actor: string,
    cardCode: string,
  ): Promise<GameState> {
    const state = this.active[gameId];
    if (!state) throw new Error('Game not found or finished (CLASSIC)');
    if (state.mode !== 'CLASSIC') throw new Error('playCard is CLASSIC-only');

    await this.resolveClassicPlay(state, actor, cardCode, `Player ${actor}`);
    const next = state.players[state.turn % 2];

    if (next === BOT_ID && !state.winner) {
      const botHand = state.hands[BOT_ID];
      if (botHand.length) {
        const pick = botHand[Math.floor(Math.random() * botHand.length)];
        await this.resolveClassicPlay(state, BOT_ID, pick, 'Bot');
      }
    }

    if (state.winner !== null) {
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          turn: state.turn,
          hp: state.hp,
          winner: state.winner,
          hands: state.hands,
          decks: state.decks,
          log: state.log,
        },
      });
      delete this.active[gameId];
    }
    return state;
  }

  async skipTurn(gameId: string, skipper: string): Promise<GameState> {
    const state = this.active[gameId];
    if (!state) throw new Error('Game not found or finished (CLASSIC)');
    if (state.mode !== 'CLASSIC') throw new Error('skipTurn is CLASSIC-only');

    const has = (state.hands[skipper] ?? []).length > 0;
    state.log.push(
      has ? `Player ${skipper} skips` : `Player ${skipper} has no cards — skip`,
    );

    state.turn++;
    state.lastActivity = Date.now();

    const cur = state.players[state.turn % 2];
    const drawn = draw(state.decks[cur] ?? [], 1)[0];
    if (drawn) {
      (state.hands[cur] ??= []).push(drawn);
      state.log.push(`${cur} draws`);
    } else {
      state.log.push(`${cur} cannot draw (deck empty)`);
    }

    const other = state.players[(state.turn + 1) % 2];
    if (
      (state.hands[cur] ?? []).length === 0 &&
      (state.hands[other] ?? []).length === 0
    ) {
      state.winner = null;
      state.log.push('Both out of cards — tie');
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          turn: state.turn,
          hp: state.hp,
          winner: state.winner,
          hands: state.hands,
          decks: state.decks,
          log: state.log,
        },
      });
      delete this.active[gameId];
      return state;
    }

    if (
      cur === BOT_ID &&
      (state.hands[BOT_ID] ?? []).length > 0 &&
      !state.winner
    ) {
      const pick =
        state.hands[BOT_ID][
          Math.floor(Math.random() * state.hands[BOT_ID].length)
        ];
      await this.resolveClassicPlay(state, BOT_ID, pick, 'Bot');

      if (state.winner !== null) {
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            turn: state.turn,
            hp: state.hp,
            winner: state.winner,
            hands: state.hands,
            decks: state.decks,
            log: state.log,
          },
        });
        delete this.active[gameId];
      }
    }
    return state;
  }

  /* ---------------- DUEL helpers ---------------- */

  /** Bot picks one card per side if it's BOT and that side is empty. Removes only ONE copy. */
  private autoPickBotCardIfNeeded(
    game: PrismaGame,
    hands: Record<string, string[]>,
    center: NonNullable<GameState['duelCenter']>,
  ) {
    if (!center.aCardCode && game.playerAId === BOT_ID) {
      const hand = hands[game.playerAId] ?? [];
      if (hand.length) {
        const idx = Math.floor(Math.random() * hand.length);
        const pick = hand[idx];
        removeOne(hands, game.playerAId, pick); // remove exactly one
        center.aCardCode = pick;
      }
    }

    if (!center.bCardCode && game.playerBId === BOT_ID) {
      const hand = hands[game.playerBId] ?? [];
      if (hand.length) {
        const idx = Math.floor(Math.random() * hand.length);
        const pick = hand[idx];
        removeOne(hands, game.playerBId, pick); // remove exactly one
        center.bCardCode = pick;
      }
    }
  }

  private async pickBestAttributeForBot(
    game: PrismaGame,
    center: NonNullable<GameState['duelCenter']>,
  ): Promise<'magic' | 'might' | 'fire'> {
    const aCode = center.aCardCode!;
    const bCode = center.bCardCode!;
    const cards = await this.prisma.card.findMany({
      where: { code: { in: [aCode, bCode] } },
    });
    const get = (code: string) => cards.find((c) => c.code === code)!;

    const a = get(aCode);
    const b = get(bCode);
    const botIsA = game.playerAId === BOT_ID;
    const attrs: Array<'magic' | 'might' | 'fire'> = ['magic', 'might', 'fire'];

    let best: 'magic' | 'might' | 'fire' = 'magic';
    let bestDelta = -Infinity;

    for (const k of attrs) {
      const aVal = Number((a as any)[k] ?? 0);
      const bVal = Number((b as any)[k] ?? 0);
      const delta = botIsA ? aVal - bVal : bVal - aVal;
      if (delta > bestDelta) {
        bestDelta = delta;
        best = k;
      }
    }
    return best;
  }

  /* ---------------- DUEL core ---------------- */

  async chooseCardForDuel(
    gameId: string,
    dto: { playerId: string; cardCode: string },
  ) {
    // Transaction prevents race if user double-clicks
    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game || game.mode !== 'ATTRIBUTE_DUEL') return game;

      const hands = (game.hands as Record<string, string[]>) ?? {};
      const center = (game.duelCenter ?? {}) as NonNullable<
        GameState['duelCenter']
      >;
      let stage = game.duelStage ?? 'PICK_CARD';
      if (stage !== 'PICK_CARD') return game;

      const iAmA = dto.playerId === game.playerAId;
      // Server guard: if this side already placed a card, ignore duplicate click
      if ((iAmA && center.aCardCode) || (!iAmA && center.bCardCode)) {
        return game;
      }

      // Remove one copy from player's hand
      if (!removeOne(hands, dto.playerId, dto.cardCode)) return game;

      if (iAmA) center.aCardCode = dto.cardCode;
      else center.bCardCode = dto.cardCode;

      // Bot auto-pick (and remove only one)
      this.autoPickBotCardIfNeeded(game, hands, center);

      if (center.aCardCode && center.bCardCode) {
        stage = 'PICK_ATTRIBUTE';
        center.chooserId = center.chooserId ?? game.playerAId;
      }

      const updated = await tx.game.update({
        where: { id: gameId },
        data: {
          hands,
          duelCenter: this.asNullableJson(center),
          duelStage: stage,
        },
      });

      // If BOT is chooser, auto-choose best attribute
      if (updated.duelStage === 'PICK_ATTRIBUTE') {
        const centerObj = asCenter(updated.duelCenter);
        const chooser = centerObj.chooserId;
        if (chooser === BOT_ID) {
          const best = await this.pickBestAttributeForBot(updated, centerObj);
          return this.chooseAttributeForDuel(gameId, {
            playerId: BOT_ID,
            attribute: best,
          });
        }
      }

      return updated;
    });
  }

  /** Enter REVEAL and store computed values; no piles/log here */
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

    const center = ((game.duelCenter as any) ?? {}) as NonNullable<
      GameState['duelCenter']
    >;
    if (center.chooserId && dto.playerId !== center.chooserId) return game;

    const aCode = center.aCardCode;
    const bCode = center.bCardCode;
    if (!aCode || !bCode) return game;

    const cards = await this.prisma.card.findMany({
      where: { code: { in: [aCode, bCode] } },
    });
    const get = (code: string) => cards.find((c) => c.code === code)!;
    const key =
      dto.attribute === 'magic'
        ? 'magic'
        : dto.attribute === 'might'
          ? 'might'
          : 'fire';

    const aVal = Number((get(aCode) as any)[key] ?? 0);
    const bVal = Number((get(bCode) as any)[key] ?? 0);

    let roundWinner: string | null = null;
    if (aVal > bVal) roundWinner = game.playerAId;
    else if (bVal > aVal) roundWinner = game.playerBId;

    center.chosenAttribute = dto.attribute;
    center.revealed = true;
    (center as any).aVal = aVal;
    (center as any).bVal = bVal;
    (center as any).roundWinner = roundWinner;

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        duelCenter: this.asNullableJson(center),
        duelStage: 'REVEAL',
      },
    });
  }

  /** Commit the REVEAL: log, piles, draw cards, next stage or finish */
  async advanceDuelRound(gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.mode !== 'ATTRIBUTE_DUEL' || game.duelStage !== 'REVEAL')
      return game;

    const center = game.duelCenter as any as NonNullable<
      GameState['duelCenter']
    >;
    const aCode = center.aCardCode;
    const bCode = center.bCardCode;
    const attr =
      (center.chosenAttribute as 'magic' | 'might' | 'fire') ?? 'magic';
    const aVal = Number(center.aVal ?? 0);
    const bVal = Number(center.bVal ?? 0);
    const roundWinner = (center.roundWinner as string | null) ?? null;

    const piles = (game.discardPiles as Record<string, string[]>) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };
    if (roundWinner && aCode && bCode) {
      piles[roundWinner] = [...(piles[roundWinner] ?? []), aCode, bCode];
    }

    const cards = await this.prisma.card.findMany({
      where: { code: { in: [aCode!, bCode!] } },
    });
    const nameOf = (code?: string) =>
      cards.find((c) => c.code === code)?.name ?? code ?? 'unknown';
    const chooser = center.chooserId ?? game.playerAId;
    const logLine = `DUEL ${attr.toUpperCase()} (chooser=${chooser}): ${nameOf(aCode)}(${attr}=${aVal}) vs ${nameOf(bCode)}(${attr}=${bVal}) => ${roundWinner ?? 'TIE'}`;

    // After round resolves, each player draws 1
    const hands = (game.hands as Record<string, string[]>) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };
    const decks = (game.decks as Record<string, string[]>) ?? {
      [game.playerAId]: [],
      [game.playerBId]: [],
    };

    const drawA = drawOne(decks[game.playerAId]);
    const drawB = drawOne(decks[game.playerBId]);
    if (drawA) (hands[game.playerAId] ??= []).push(drawA);
    if (drawB) (hands[game.playerBId] ??= []).push(drawB);

    const drawLogs: string[] = [];
    if (drawA) drawLogs.push(`${game.playerAId} draws`);
    if (drawB) drawLogs.push(`${game.playerBId} draws`);

    const nextChooser =
      center.chooserId === game.playerAId ? game.playerBId : game.playerAId;

    // Only now check end-of-game (after drawing)
    const aEmpty = (hands[game.playerAId] ?? []).length === 0;
    const bEmpty = (hands[game.playerBId] ?? []).length === 0;

    let winner: string | null = null;
    let duelStage: PrismaDuelStage = 'PICK_CARD';
    let nextCenter: GameState['duelCenter'] = { chooserId: nextChooser };

    if (aEmpty || bEmpty) {
      const aCount = (piles[game.playerAId] ?? []).length;
      const bCount = (piles[game.playerBId] ?? []).length;
      winner =
        aCount > bCount
          ? game.playerAId
          : bCount > aCount
            ? game.playerBId
            : null;
      duelStage = 'RESOLVED';
      nextCenter = null;
    }

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        hands,
        decks,
        duelCenter: this.asNullableJson(nextCenter),
        duelStage,
        discardPiles: this.asNullableJson(piles),
        winner,
        log: [...(game.log as string[]), logLine, ...drawLogs],
      },
    });
  }

  /* ---------------- common ---------------- */

  async getState(gameId: string): Promise<GameState | null> {
    const mem = this.active[gameId];
    if (mem) return mem;

    const db = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!db) return null;

    const mapped: GameState = {
      players: [db.playerAId, db.playerBId],
      turn: db.turn,
      log: (db.log as string[]) ?? [],
      hp: db.hp as Record<string, number>,
      winner: db.winner ?? null,
      hands: db.hands as Record<string, string[]>,
      decks: db.decks as Record<string, string[]>,
      lastActivity: new Date(db.updatedAt).getTime(),
      mode: db.mode,
      duelStage: db.duelStage ?? null,
      duelCenter: (db.duelCenter as any) ?? null,
      discardPiles: (db.discardPiles as any) ?? null,
    };
    return mapped;
  }

  async getResult(gameId: string) {
    const mem = this.active[gameId];
    if (mem && mem.winner !== undefined)
      return { winner: mem.winner, log: mem.log };
    const db = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!db) throw new Error('Game not found');
    return { winner: db.winner, log: db.log as string[] };
  }

  private listActiveClassicFromMemory() {
    return Object.entries(this.active).map(([gameId, s]) => ({
      gameId,
      players: s.players,
      mode: s.mode,
      turn: s.turn,
      lastActivity: s.lastActivity,
      winner: s.winner,
    }));
  }

  private async listActiveDuelFromDb() {
    const rows: PrismaGame[] = await this.prisma.game.findMany({
      where: {
        mode: 'ATTRIBUTE_DUEL',
        OR: [{ winner: null }, { duelStage: { not: 'RESOLVED' } }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return rows.map((g) => ({
      gameId: g.id,
      players: [g.playerAId, g.playerBId],
      mode: g.mode,
      turn: g.turn,
      lastActivity: new Date(g.updatedAt).getTime(),
      winner: g.winner ?? null,
    }));
  }

  async listActiveGamesUnified() {
    const classic = this.listActiveClassicFromMemory();
    const duel = await this.listActiveDuelFromDb();
    return [...duel, ...classic];
  }

  expireOldGames() {
    const now = Date.now();
    const expired: string[] = [];
    for (const [id, s] of Object.entries(this.active)) {
      if (now - s.lastActivity > GameService.EXP_MS) {
        expired.push(id);
        delete this.active[id];
      }
    }
    return expired;
  }

  async deleteGame(gameId: string) {
    const existed = !!this.active[gameId];
    delete this.active[gameId];
    return { removed: existed };
  }
}
