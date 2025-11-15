import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CardCollectionRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  releaseDate: Date | null;
  totalCards: number | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GameCollectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCollections(): Promise<CardCollectionRecord[]> {
    const rows = await this.prisma.$queryRaw<CardCollectionRecord[]>(Prisma.sql`
      SELECT
        "id",
        "slug",
        "name",
        "description",
        "manufacturer",
        "releaseDate",
        "totalCards",
        "imageUrl",
        "createdAt",
        "updatedAt"
      FROM "Collection"
      ORDER BY "name" ASC
    `);
    return rows;
  }

  async findByIdentifier(identifier: string): Promise<CardCollectionRecord | null> {
    const identifierIsUuid = this.isUuid(identifier);
    const whereClause = identifierIsUuid
      ? Prisma.sql`WHERE "id" = ${identifier}::uuid OR "slug" = ${identifier}`
      : Prisma.sql`WHERE "slug" = ${identifier}`;

    const rows = await this.prisma.$queryRaw<CardCollectionRecord[]>(Prisma.sql`
      SELECT
        "id",
        "slug",
        "name",
        "description",
        "manufacturer",
        "releaseDate",
        "totalCards",
        "imageUrl",
        "createdAt",
        "updatedAt"
      FROM "Collection"
      ${whereClause}
      ORDER BY "name" ASC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private isUuid(value: string): boolean {
    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    return uuidPattern.test(value);
  }
}
