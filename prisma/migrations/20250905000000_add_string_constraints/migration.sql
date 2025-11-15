-- Drop foreign keys to allow type changes
ALTER TABLE "Game" DROP CONSTRAINT "Game_playerAId_fkey";
ALTER TABLE "Game" DROP CONSTRAINT "Game_playerBId_fkey";
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_requesterId_fkey";
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_addresseeId_fkey";
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_blockedById_fkey";
ALTER TABLE "FriendChatMessage" DROP CONSTRAINT "FriendChatMessage_friendshipId_fkey";
ALTER TABLE "FriendChatMessage" DROP CONSTRAINT "FriendChatMessage_senderId_fkey";
ALTER TABLE "FriendChatMessage" DROP CONSTRAINT "FriendChatMessage_recipientId_fkey";
ALTER TABLE "Card" DROP CONSTRAINT "Card_collectionId_fkey";

-- Player identifiers and credentials
ALTER TABLE "Player"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "username" TYPE VARCHAR(50),
  ALTER COLUMN "passwordHash" TYPE VARCHAR(60);

-- Game identifiers and winner references
ALTER TABLE "Game"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "playerAId" TYPE UUID USING "playerAId"::uuid,
  ALTER COLUMN "playerBId" TYPE UUID USING "playerBId"::uuid,
  ALTER COLUMN "winner" TYPE UUID USING "winner"::uuid;

-- Friendship identifiers
ALTER TABLE "Friendship"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "requesterId" TYPE UUID USING "requesterId"::uuid,
  ALTER COLUMN "addresseeId" TYPE UUID USING "addresseeId"::uuid,
  ALTER COLUMN "blockedById" TYPE UUID USING "blockedById"::uuid;

-- Friend chat identifiers and message body size
ALTER TABLE "FriendChatMessage"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "friendshipId" TYPE UUID USING "friendshipId"::uuid,
  ALTER COLUMN "senderId" TYPE UUID USING "senderId"::uuid,
  ALTER COLUMN "recipientId" TYPE UUID USING "recipientId"::uuid,
  ALTER COLUMN "body" TYPE VARCHAR(1000);

-- Card identifiers and textual limits
ALTER TABLE "Card"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "code" TYPE VARCHAR(100),
  ALTER COLUMN "name" TYPE VARCHAR(150),
  ALTER COLUMN "description" TYPE VARCHAR(1000),
  ALTER COLUMN "imageUrl" TYPE VARCHAR(255),
  ALTER COLUMN "collectionId" TYPE UUID USING "collectionId"::uuid;

-- Card template identifiers and textual limits
ALTER TABLE "CardTemplate"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "name" TYPE VARCHAR(150),
  ALTER COLUMN "frameUrl" TYPE VARCHAR(255),
  ALTER COLUMN "fontColor" TYPE VARCHAR(30),
  ALTER COLUMN "rarity" TYPE VARCHAR(30);

-- Collection identifiers and metadata limits
ALTER TABLE "Collection"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "slug" TYPE VARCHAR(150),
  ALTER COLUMN "name" TYPE VARCHAR(150),
  ALTER COLUMN "description" TYPE VARCHAR(1000),
  ALTER COLUMN "manufacturer" TYPE VARCHAR(150),
  ALTER COLUMN "imageUrl" TYPE VARCHAR(255);

-- Reinstate foreign keys with the new UUID columns
ALTER TABLE "Game"
  ADD CONSTRAINT "Game_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Game"
  ADD CONSTRAINT "Game_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Friendship"
  ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Friendship_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FriendChatMessage"
  ADD CONSTRAINT "FriendChatMessage_friendshipId_fkey" FOREIGN KEY ("friendshipId") REFERENCES "Friendship"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FriendChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FriendChatMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Card"
  ADD CONSTRAINT "Card_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
