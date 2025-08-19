import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BOT_ID, GameState, drawRandomCardsFromDeck } from './game.types';

@Injectable()
export class ClassicGameService {
  private activeClassicStates: Record<string, GameState> = {};
  private static readonly classicExpiryMs = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  getActiveState(gameId: string) {
    return this.activeClassicStates[gameId];
  }

  setActiveState(gameId: string, state: GameState) {
    this.activeClassicStates[gameId] = state;
  }

  removeActiveState(gameId: string) {
    delete this.activeClassicStates[gameId];
  }

  listActiveFromMemory() {
    return Object.entries(this.activeClassicStates).map(([gameId, s]) => ({
      gameId,
      players: s.players,
      mode: s.mode,
      turn: s.turn,
      lastActivity: s.lastActivity,
      winner: s.winner,
    }));
  }

  expireOldGames() {
    const now = Date.now();
    const expiredGameIds: string[] = [];
    for (const [gameId, state] of Object.entries(this.activeClassicStates)) {
      if (now - state.lastActivity > ClassicGameService.classicExpiryMs) {
        expiredGameIds.push(gameId);
        delete this.activeClassicStates[gameId];
      }
    }
    return expiredGameIds;
  }

  private async resolveClassicPlay(
    state: GameState,
    actorId: string,
    cardCode: string,
    actorLabel: string,
  ) {
    const card = await this.prisma.card.findUnique({
      where: { code: cardCode },
    });
    if (!card) throw new Error(`Card "${cardCode}" not found`);

    const [playerAId, playerBId] = state.players;
    const opponentId = playerAId === actorId ? playerBId : playerAId;

    const playerHand = state.hands[actorId];
    const handIndex = playerHand.indexOf(cardCode);
    if (handIndex < 0)
      throw new Error(`${actorLabel} does not have "${cardCode}"`);
    playerHand.splice(handIndex, 1);

    let playLog = `${actorLabel} played ${card.name}`;
    if (card.damage) {
      state.hp[opponentId] = Math.max(0, state.hp[opponentId] - card.damage);
      playLog += ` → ${card.damage} dmg`;
    }
    if (card.heal) {
      state.hp[actorId] += card.heal;
      playLog += ` → +${card.heal} HP`;
    }

    if (state.hp[opponentId] <= 0 && !state.winner) {
      state.winner = actorId;
      playLog += ' — WIN';
    }

    state.log.push(playLog);
    state.turn++;
    state.lastActivity = Date.now();

    const nextPlayerId = state.players[state.turn % 2];
    if (!state.winner) {
      const drawnCard = drawRandomCardsFromDeck(
        state.decks[nextPlayerId],
        1,
      )[0];
      if (drawnCard) {
        state.hands[nextPlayerId].push(drawnCard);
        state.log.push(`${nextPlayerId} draws a card`);
      } else {
        state.log.push(`${nextPlayerId} cannot draw (deck empty)`);
      }
    }
  }

  async playCard(gameId: string, actorId: string, cardCode: string) {
    const state = this.activeClassicStates[gameId];
    if (!state) throw new Error('Game not found or finished (CLASSIC)');
    if (state.mode !== 'CLASSIC') throw new Error('playCard is CLASSIC-only');

    await this.resolveClassicPlay(
      state,
      actorId,
      cardCode,
      `Player ${actorId}`,
    );
    const nextPlayerId = state.players[state.turn % 2];

    if (nextPlayerId === BOT_ID && !state.winner) {
      const botHand = state.hands[BOT_ID];
      if (botHand.length) {
        const pickedBotCard =
          botHand[Math.floor(Math.random() * botHand.length)];
        await this.resolveClassicPlay(state, BOT_ID, pickedBotCard, 'Bot');
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
      delete this.activeClassicStates[gameId];
    }
    return state;
  }

  async skipTurn(gameId: string, skipperId: string) {
    const state = this.activeClassicStates[gameId];
    if (!state) throw new Error('Game not found or finished (CLASSIC)');
    if (state.mode !== 'CLASSIC') throw new Error('skipTurn is CLASSIC-only');

    const hasCards = (state.hands[skipperId] ?? []).length > 0;
    state.log.push(
      hasCards
        ? `Player ${skipperId} skips`
        : `Player ${skipperId} has no cards — skip`,
    );

    state.turn++;
    state.lastActivity = Date.now();

    const currentPlayerId = state.players[state.turn % 2];
    const drawnCard = drawRandomCardsFromDeck(
      state.decks[currentPlayerId] ?? [],
      1,
    )[0];
    if (drawnCard) {
      (state.hands[currentPlayerId] ??= []).push(drawnCard);
      state.log.push(`${currentPlayerId} draws`);
    } else {
      state.log.push(`${currentPlayerId} cannot draw (deck empty)`);
    }

    const otherPlayerId = state.players[(state.turn + 1) % 2];
    if (
      (state.hands[currentPlayerId] ?? []).length === 0 &&
      (state.hands[otherPlayerId] ?? []).length === 0
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
      delete this.activeClassicStates[gameId];
      return state;
    }

    if (
      currentPlayerId === BOT_ID &&
      (state.hands[BOT_ID] ?? []).length > 0 &&
      !state.winner
    ) {
      const pickedBotCard =
        state.hands[BOT_ID][
          Math.floor(Math.random() * state.hands[BOT_ID].length)
        ];
      await this.resolveClassicPlay(state, BOT_ID, pickedBotCard, 'Bot');

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
        delete this.activeClassicStates[gameId];
      }
    }
    return state;
  }
}
