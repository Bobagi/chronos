-- CreateTable
CREATE TABLE "public"."Collection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT,
    "releaseDate" TIMESTAMP(3),
    "totalCards" INTEGER,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "public"."Collection"("slug");

-- Insert initial collection for existing cards
INSERT INTO "public"."Collection" (
    "id",
    "slug",
    "name",
    "description",
    "manufacturer",
    "releaseDate",
    "totalCards",
    "imageUrl"
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dracomania',
    'Dracomania',
    'Coleção Dracomania da Elma Chips.',
    'Elma Chips',
    '1996-01-01T00:00:00.000Z'::timestamp(3),
    32,
    'https://bobagi.space/images/cards/dracomania.png'
)
ON CONFLICT ("slug") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "manufacturer" = EXCLUDED."manufacturer",
    "releaseDate" = EXCLUDED."releaseDate",
    "totalCards" = EXCLUDED."totalCards",
    "imageUrl" = EXCLUDED."imageUrl",
    "updatedAt" = CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."Card" ADD COLUMN     "collectionId" TEXT;

UPDATE "public"."Card"
SET "collectionId" = '00000000-0000-0000-0000-000000000001'
WHERE "collectionId" IS NULL;

ALTER TABLE "public"."Card"
ALTER COLUMN "collectionId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Card"
ADD CONSTRAINT "Card_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
