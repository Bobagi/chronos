/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// prisma/seed.ts
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface PlayerSeedData {
  username: string;
  passwordHash: string;
  role: UserRole;
}

interface CardSeedInput {
  number: number;
  code: string;
  name: string;
  description: string;
  imageUrl: string;
  magic: number;
  might: number;
  fire: number;
}

const createPlayerUpsertArgs = (player: PlayerSeedData) => ({
  where: { username: player.username },
  update: player,
  create: player,
});

async function main() {
  // ---------- Senhas (podem vir do ambiente) ----------
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
  const ALICE_PASSWORD = process.env.ALICE_PASSWORD ?? 'alice123';

  const [adminHash, aliceHash] = await Promise.all([
    bcrypt.hash(ADMIN_PASSWORD, 10),
    bcrypt.hash(ALICE_PASSWORD, 10),
  ]);

  // ---------- Usuários ----------
  // Admin padrão (username: admin)
  await prisma.player.upsert(
    createPlayerUpsertArgs({
      username: 'admin',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
    }),
  );

  // Usuário de exemplo (id e username: alice) para bater com sua UI
  await prisma.player.upsert(
    createPlayerUpsertArgs({
      username: 'alice',
      passwordHash: aliceHash,
      role: UserRole.USER,
    }),
  );

  console.log('✅ Users seeded: admin, alice');

  // ---------- Coleções ----------
  const dracomaniaCollection = await prisma.collection.upsert({
    where: { slug: 'dracomania' },
    update: {
      name: 'Dracomania',
      description: 'Dracomania collection by Elma Chips.',
      manufacturer: 'Elma Chips',
      releaseDate: new Date('1996-01-01'),
      totalCards: 32,
      imageUrl: 'images/cards/dracomania.png',
    },
    create: {
      slug: 'dracomania',
      name: 'Dracomania',
      description: 'Dracomania collection by Elma Chips.',
      manufacturer: 'Elma Chips',
      releaseDate: new Date('1996-01-01'),
      totalCards: 32,
      imageUrl: 'images/cards/dracomania.png',
    },
  });

  console.log('✅ Collections seeded: Dracomania');

  // ---------- Cartas ----------
  const dracomaniaCards: CardSeedInput[] = [
    {
      number: 1,
      code: 'master_dragon',
      name: 'Master Dragon',
      description: 'Supreme dragon that commands all others.',
      imageUrl: 'images/cards/1.png',
      magic: 22,
      might: 18,
      fire: 29,
    },
    {
      number: 2,
      code: 'golden_dragon',
      name: 'Golden Dragon',
      description: 'Radiant dragon armored in molten gold.',
      imageUrl: 'images/cards/2.png',
      magic: 16,
      might: 24,
      fire: 28,
    },
    {
      number: 3,
      code: 'silver_dragon',
      name: 'Silver Dragon',
      description: 'Swift dragon whose scales shine like silver.',
      imageUrl: 'images/cards/3.png',
      magic: 15,
      might: 21,
      fire: 27,
    },
    {
      number: 4,
      code: 'bronze_dragon',
      name: 'Bronze Dragon',
      description: 'Guardian dragon forged from bronze armor.',
      imageUrl: 'images/cards/4.png',
      magic: 14,
      might: 20,
      fire: 26,
    },
    {
      number: 5,
      code: 'copper_dragon',
      name: 'Copper Dragon',
      description: 'Ancient dragon with copper-plated wings.',
      imageUrl: 'images/cards/5.png',
      magic: 13,
      might: 19,
      fire: 25,
    },
    {
      number: 6,
      code: 'white_dragon',
      name: 'White Dragon',
      description: 'Frozen dragon that breathes icy flames.',
      imageUrl: 'images/cards/6.png',
      magic: 21,
      might: 15,
      fire: 22,
    },
    {
      number: 7,
      code: 'black_dragon',
      name: 'Black Dragon',
      description: 'Shadow dragon cloaked in midnight scales.',
      imageUrl: 'images/cards/7.png',
      magic: 19,
      might: 17,
      fire: 24,
    },
    {
      number: 8,
      code: 'red_dragon',
      name: 'Red Dragon',
      description: 'Ferocious dragon that scorches the battlefield.',
      imageUrl: 'images/cards/8.png',
      magic: 20,
      might: 16,
      fire: 23,
    },
    {
      number: 9,
      code: 'blue_dragon',
      name: 'Blue Dragon',
      description: 'Storm-breathing dragon wrapped in sapphire mist.',
      imageUrl: 'images/cards/9.png',
      magic: 18,
      might: 13,
      fire: 21,
    },
    {
      number: 10,
      code: 'green_dragon',
      name: 'Green Dragon',
      description: 'Forest guardian who commands emerald winds.',
      imageUrl: 'images/cards/10.png',
      magic: 17,
      might: 14,
      fire: 20,
    },
    {
      number: 11,
      code: 'knight',
      name: 'Knight',
      description: 'Valiant knight sworn to protect the realm.',
      imageUrl: 'images/cards/11.png',
      magic: 10,
      might: 23,
      fire: 15,
    },
    {
      number: 12,
      code: 'colossus',
      name: 'Colossus',
      description: 'Towering sentinel built from living stone.',
      imageUrl: 'images/cards/12.png',
      magic: 0,
      might: 30,
      fire: 0,
    },
    {
      number: 13,
      code: 'sorceress',
      name: 'Sorceress',
      description: 'Mystic heroine mastering ancient rituals.',
      imageUrl: 'images/cards/13.png',
      magic: 28,
      might: 2,
      fire: 19,
    },
    {
      number: 14,
      code: 'warrioress',
      name: 'Warrioress',
      description: 'Fearless warrior leading the front line.',
      imageUrl: 'images/cards/14.png',
      magic: 14,
      might: 22,
      fire: 12,
    },
    {
      number: 15,
      code: 'warrior',
      name: 'Warrior',
      description: 'Hardened veteran wielding twin blades.',
      imageUrl: 'images/cards/15.png',
      magic: 12,
      might: 25,
      fire: 10,
    },
    {
      number: 16,
      code: 'hero',
      name: 'Hero',
      description: 'Legendary champion of countless battles.',
      imageUrl: 'images/cards/16.png',
      magic: 12,
      might: 27,
      fire: 15,
    },
    {
      number: 17,
      code: 'werewolf',
      name: 'Werewolf',
      description: 'Lupine hunter striking under the full moon.',
      imageUrl: 'images/cards/17.png',
      magic: 15,
      might: 21,
      fire: 13,
    },
    {
      number: 18,
      code: 'mage',
      name: 'Mage',
      description: 'Arcane scholar who bends fire to their will.',
      imageUrl: 'images/cards/18.png',
      magic: 29,
      might: 4,
      fire: 17,
    },
    {
      number: 19,
      code: 'merlin',
      name: 'Merlin',
      description: 'Iconic wizard of legend and lore.',
      imageUrl: 'images/cards/19.png',
      magic: 30,
      might: 0,
      fire: 0,
    },
    {
      number: 20,
      code: 'mummy',
      name: 'Mummy',
      description: 'Cursed guardian wrapped in eternal linen.',
      imageUrl: 'images/cards/20.png',
      magic: 15,
      might: 24,
      fire: 0,
    },
    {
      number: 21,
      code: 'pegasus',
      name: 'Pegasus',
      description: 'Winged steed soaring across the skies.',
      imageUrl: 'images/cards/21.png',
      magic: 23,
      might: 12,
      fire: 12,
    },
    {
      number: 22,
      code: 'sorcerer',
      name: 'Sorcerer',
      description: 'Devout caster channeling celestial fire.',
      imageUrl: 'images/cards/22.png',
      magic: 26,
      might: 5,
      fire: 18,
    },
    {
      number: 23,
      code: 'shadow',
      name: 'Shadow',
      description: 'Ethereal apparition from the void.',
      imageUrl: 'images/cards/23.png',
      magic: 23,
      might: 10,
      fire: 1,
    },
    {
      number: 24,
      code: 'barbarian',
      name: 'Barbarian',
      description: 'Savage warrior of the frozen north.',
      imageUrl: 'images/cards/24.png',
      magic: 11,
      might: 29,
      fire: 8,
    },
    {
      number: 25,
      code: 'viking',
      name: 'Viking',
      description: 'Seafaring raider with indomitable spirit.',
      imageUrl: 'images/cards/25.png',
      magic: 13,
      might: 28,
      fire: 6,
    },
    {
      number: 26,
      code: 'witch',
      name: 'Witch',
      description: 'Enigmatic witch weaving hexes and fire.',
      imageUrl: 'images/cards/26.png',
      magic: 27,
      might: 3,
      fire: 16,
    },
    {
      number: 27,
      code: 'elf',
      name: 'Elf',
      description: 'Agile archer gifted with timeless grace.',
      imageUrl: 'images/cards/27.png',
      magic: 25,
      might: 6,
      fire: 14,
    },
    {
      number: 28,
      code: 'angel',
      name: 'Angel',
      description: 'Radiant herald wielding holy light.',
      imageUrl: 'images/cards/28.png',
      magic: 24,
      might: 1,
      fire: 7,
    },
    {
      number: 29,
      code: 'lava_giant',
      name: 'Lava Giant',
      description: 'Molten behemoth born from volcanoes.',
      imageUrl: 'images/cards/29.png',
      magic: 0,
      might: 0,
      fire: 30,
    },
    {
      number: 30,
      code: 'skeleton',
      name: 'Skeleton',
      description: 'Reanimated warrior rattling with malice.',
      imageUrl: 'images/cards/30.png',
      magic: 15,
      might: 20,
      fire: 2,
    },
    {
      number: 31,
      code: 'ogre',
      name: 'Ogre',
      description: 'Brutish ogre relying on raw power.',
      imageUrl: 'images/cards/31.png',
      magic: 16,
      might: 21,
      fire: 4,
    },
    {
      number: 32,
      code: 'unicorn',
      name: 'Unicorn',
      description: 'Mythic unicorn that heals the land.',
      imageUrl: 'images/cards/32.png',
      magic: 25,
      might: 13,
      fire: 7,
    },
  ];

  await prisma.card.createMany({
    data: dracomaniaCards.map((card) => ({
      ...card,
      collectionId: dracomaniaCollection.id,
    })),
    skipDuplicates: true,
  });

  console.log('✅ Cards inserted');
}

main()
  .catch((caughtError: any) => {
    const errorToLog =
      caughtError instanceof Error
        ? caughtError
        : new Error(String(caughtError));
    console.error(errorToLog);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
