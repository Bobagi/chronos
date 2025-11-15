ALTER TABLE "Game"
  ALTER COLUMN "winner" TYPE VARCHAR(50) USING "winner"::text;
