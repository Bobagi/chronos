-- CreateEnum
CREATE TYPE "public"."GameMode" AS ENUM ('CLASSIC', 'ATTRIBUTE_DUEL');

-- CreateEnum
CREATE TYPE "public"."DuelStage" AS ENUM ('PICK_CARD', 'PICK_ATTRIBUTE', 'REVEAL', 'RESOLVED');

-- AlterTable
ALTER TABLE "public"."Card" ADD COLUMN     "number" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Game" ADD COLUMN     "discardPiles" JSONB,
ADD COLUMN     "duelCenter" JSONB,
ADD COLUMN     "duelStage" "public"."DuelStage",
ADD COLUMN     "mode" "public"."GameMode" NOT NULL DEFAULT 'CLASSIC';
