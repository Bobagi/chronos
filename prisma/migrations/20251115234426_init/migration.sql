-- CreateEnum
CREATE TYPE "public"."GameMode" AS ENUM ('CLASSIC', 'ATTRIBUTE_DUEL');

-- CreateEnum
CREATE TYPE "public"."DuelStage" AS ENUM ('PICK_CARD', 'PICK_ATTRIBUTE', 'REVEAL', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');

-- CreateTable
CREATE TABLE "public"."Player" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "passwordHash" VARCHAR(60) NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Game" (
    "id" UUID NOT NULL,
    "playerAId" UUID NOT NULL,
    "playerBId" UUID NOT NULL,
    "turn" INTEGER NOT NULL,
    "hp" JSONB NOT NULL,
    "winner" VARCHAR(50),
    "hands" JSONB NOT NULL,
    "decks" JSONB NOT NULL,
    "log" JSONB NOT NULL,
    "mode" "public"."GameMode" NOT NULL DEFAULT 'CLASSIC',
    "duelStage" "public"."DuelStage",
    "duelCenter" JSONB,
    "discardPiles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Friendship" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "addresseeId" UUID NOT NULL,
    "status" "public"."FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "blockedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FriendChatMessage" (
    "id" UUID NOT NULL,
    "friendshipId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Card" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 0,
    "damage" INTEGER,
    "heal" INTEGER,
    "imageUrl" VARCHAR(255) NOT NULL,
    "might" INTEGER NOT NULL DEFAULT 0,
    "fire" INTEGER NOT NULL DEFAULT 0,
    "magic" INTEGER NOT NULL DEFAULT 0,
    "collectionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CardTemplate" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "frameUrl" VARCHAR(255) NOT NULL,
    "fontColor" VARCHAR(30) NOT NULL,
    "rarity" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Collection" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(1000),
    "manufacturer" VARCHAR(150),
    "releaseDate" TIMESTAMP(3),
    "totalCards" INTEGER,
    "imageUrl" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "public"."Player"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "public"."Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "FriendChatMessage_friendshipId_createdAt_idx" ON "public"."FriendChatMessage"("friendshipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Card_code_key" ON "public"."Card"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CardTemplate_name_key" ON "public"."CardTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "public"."Collection"("slug");

-- AddForeignKey
ALTER TABLE "public"."Game" ADD CONSTRAINT "Game_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Game" ADD CONSTRAINT "Game_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Friendship" ADD CONSTRAINT "Friendship_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FriendChatMessage" ADD CONSTRAINT "FriendChatMessage_friendshipId_fkey" FOREIGN KEY ("friendshipId") REFERENCES "public"."Friendship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FriendChatMessage" ADD CONSTRAINT "FriendChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FriendChatMessage" ADD CONSTRAINT "FriendChatMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Card" ADD CONSTRAINT "Card_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
