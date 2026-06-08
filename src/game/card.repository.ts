import { Injectable } from '@nestjs/common';
import { Card as PrismaCard } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CARD_IMAGE_BASE_URL = (
  process.env.CARD_IMAGE_BASE_URL ?? 'https://bobagi.space'
).replace(/\/+$/, '');

/** Locales that have CardTranslation rows; anything else falls back to the base (English) card. */
const TRANSLATABLE_LOCALES = new Set(['pt', 'es']);

type CardWithTranslations = PrismaCard & {
  translations?: { name: string; description: string }[];
};

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

  /** Overlay the localized name/description (if present) and rewrite the image URL. */
  private localize(card: CardWithTranslations): PrismaCard {
    const { translations, ...base } = card;
    const withImage = this.applyImageBase(base as PrismaCard);
    const translation = translations?.[0];
    return translation
      ? {
          ...withImage,
          name: translation.name,
          description: translation.description,
        }
      : withImage;
  }

  async findAll(): Promise<PrismaCard[]> {
    const cards = await this.prisma.card.findMany();
    return cards.map((card) => this.applyImageBase(card));
  }

  /**
   * Cards of a collection, ordered by number. When `locale` is a translatable
   * language (pt/es) the name/description are returned in that language, falling
   * back to the canonical English text when a translation is missing.
   */
  async findByCollectionId(
    collectionId: string,
    locale?: string,
  ): Promise<PrismaCard[]> {
    const shouldTranslate = !!locale && TRANSLATABLE_LOCALES.has(locale);
    if (shouldTranslate) {
      const cards = await this.prisma.card.findMany({
        where: { collectionId },
        orderBy: { number: 'asc' },
        include: { translations: { where: { locale } } },
      });
      return cards.map((card) => this.localize(card));
    }
    const cards = await this.prisma.card.findMany({
      where: { collectionId },
      orderBy: { number: 'asc' },
    });
    return cards.map((card) => this.localize(card));
  }

  async findByCode(code: string): Promise<PrismaCard | null> {
    const card = await this.prisma.card.findUnique({ where: { code } });
    return card ? this.applyImageBase(card) : null;
  }
}
