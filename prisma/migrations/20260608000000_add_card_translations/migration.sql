-- CreateTable
CREATE TABLE "CardTranslation" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "locale" VARCHAR(8) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardTranslation_cardId_locale_key" ON "CardTranslation"("cardId", "locale");

-- AddForeignKey
ALTER TABLE "CardTranslation" ADD CONSTRAINT "CardTranslation_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
