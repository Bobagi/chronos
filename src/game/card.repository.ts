import { Injectable } from '@nestjs/common';
import { Card as PrismaCard, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CARD_IMAGE_BASE_URL = (
  process.env.CARD_IMAGE_BASE_URL ?? 'https://bobagi.space'
).replace(/\/+$/, '');

/**
 * Read access to the card catalog. Keeps raw Prisma queries and the
 * image-base-URL rewriting out of GameService (single responsibility), mirroring
 * GameCollectionRepository.
 */
@Injectable()
export class CardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private applyImageBase(card: PrismaCard): PrismaCard {
    if (!card.imageUrl || !CARD_IMAGE_BASE_URL) return card;
    return { ...card, imageUrl: `${CARD_IMAGE_BASE_URL}/${card.imageUrl}` };
  }

  async findAll(): Promise<PrismaCard[]> {
    const cards = await this.prisma.card.findMany();
    return cards.map((card) => this.applyImageBase(card));
  }

  async findByCollectionId(collectionId: string): Promise<PrismaCard[]> {
    const cards = await this.prisma.$queryRaw<PrismaCard[]>(Prisma.sql`
      SELECT *
      FROM "Card"
      WHERE "collectionId" = ${collectionId}::uuid
      ORDER BY "number" ASC
    `);
    return cards.map((card) => this.applyImageBase(card));
  }

  async findByCode(code: string): Promise<PrismaCard | null> {
    const card = await this.prisma.card.findUnique({ where: { code } });
    return card ? this.applyImageBase(card) : null;
  }
}
