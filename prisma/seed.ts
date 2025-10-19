/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type PlayerRole = 'ADMIN' | 'USER';

const asPlayerCreateInput = (
  data: Record<string, unknown>,
): Prisma.PlayerCreateInput => data as unknown as Prisma.PlayerCreateInput;

const asPlayerUpdateInput = (
  data: Record<string, unknown>,
): Prisma.PlayerUpdateInput => data as unknown as Prisma.PlayerUpdateInput;

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
  await prisma.player.upsert({
    where: { username: 'admin' },
    update: asPlayerUpdateInput({
      passwordHash: adminHash,
      role: 'ADMIN' as PlayerRole,
    }),
    create: asPlayerCreateInput({
      username: 'admin',
      passwordHash: adminHash,
      role: 'ADMIN' as PlayerRole,
    }),
  });

  // Usuário de exemplo (id e username: alice) para bater com sua UI
  await prisma.player.upsert({
    where: { username: 'alice' },
    update: asPlayerUpdateInput({
      passwordHash: aliceHash,
      role: 'USER' as PlayerRole,
    }),
    create: asPlayerCreateInput({
      username: 'alice',
      passwordHash: aliceHash,
      role: 'USER' as PlayerRole,
    }),
  });

  console.log('✅ Users seeded: admin, alice');

  // ---------- Cartas ----------
  await prisma.card.createMany({
    data: [
      // {
      //   code: 'fireball',
      //   name: 'Fireball',
      //   description: 'Deal 5 damage to the opponent',
      //   damage: 5,
      //   imageUrl: 'https://bobagi.space/images/cards/flamed-leaf.png',
      //   magic: 2,
      //   might: 1,
      //   fire: 3,
      // },
      // {
      //   code: 'lightning',
      //   name: 'Lightning Bolt',
      //   description: 'Deal 3 damage to the opponent',
      //   damage: 3,
      //   imageUrl: 'https://bobagi.space/images/cards/power-lightning.png',
      //   magic: 1,
      //   might: 2,
      //   fire: 3,
      // },
      // {
      //   code: 'heal',
      //   name: 'Heal',
      //   description: 'Restore 4 HP to yourself',
      //   heal: 4,
      //   imageUrl: 'https://bobagi.space/images/cards/remedy.png',
      //   magic: 3,
      //   might: 1,
      //   fire: 2,
      // },
      {
        number: 1,
        code: 'master_dragon',
        name: 'Dragão mestre',
        description: 'Master dragon',
        imageUrl: 'https://bobagi.space/images/cards/1.png',
        magic: 22,
        might: 18,
        fire: 29,
      },
      {
        number: 2,
        code: 'golden_dragon',
        name: 'Dragão dourado',
        description: 'Golgen dragon',
        imageUrl: 'https://bobagi.space/images/cards/2.png',
        magic: 16,
        might: 24,
        fire: 28,
      },
      {
        number: 3,
        code: 'silver_dragon',
        name: 'Dragão prateado',
        description: 'Silver dragon',
        imageUrl: 'https://bobagi.space/images/cards/3.png',
        magic: 15,
        might: 21,
        fire: 27,
      },
      {
        number: 4,
        code: 'bronze_dragon',
        name: 'Dragão bronze',
        description: 'Bronze dragon',
        imageUrl: 'https://bobagi.space/images/cards/4.png',
        magic: 14,
        might: 20,
        fire: 26,
      },
      {
        number: 5,
        code: 'copper_dragon',
        name: 'Dragão cobre',
        description: 'Copper dragon',
        imageUrl: 'https://bobagi.space/images/cards/5.png',
        magic: 13,
        might: 19,
        fire: 25,
      },
      {
        number: 6,
        code: 'white_dragon',
        name: 'Dragão branco',
        description: 'White dragon',
        imageUrl: 'https://bobagi.space/images/cards/6.png',
        magic: 21,
        might: 15,
        fire: 22,
      },
      {
        number: 7,
        code: 'black_dragon',
        name: 'Dragão negro',
        description: 'Black dragon',
        imageUrl: 'https://bobagi.space/images/cards/7.png',
        magic: 19,
        might: 17,
        fire: 24,
      },
      {
        number: 8,
        code: 'red_dragon',
        name: 'Dragão vermelho',
        description: 'Red dragon',
        imageUrl: 'https://bobagi.space/images/cards/8.png',
        magic: 20,
        might: 16,
        fire: 23,
      },
      {
        number: 9,
        code: 'blue_dragon',
        name: 'Dragão azul',
        description: 'Blue dragon',
        imageUrl: 'https://bobagi.space/images/cards/9.png',
        magic: 18,
        might: 13,
        fire: 21,
      },
      {
        number: 10,
        code: 'green_dragon',
        name: 'Dragão verde',
        description: 'Green dragon',
        imageUrl: 'https://bobagi.space/images/cards/10.png',
        magic: 17,
        might: 14,
        fire: 20,
      },
      {
        number: 11,
        code: 'knight',
        name: 'Cavaleiro',
        description: 'Knight',
        imageUrl: 'https://bobagi.space/images/cards/11.png',
        magic: 10,
        might: 23,
        fire: 15,
      },
      {
        number: 12,
        code: 'colossus',
        name: 'Colosso',
        description: 'Colossus',
        imageUrl: 'https://bobagi.space/images/cards/12.png',
        magic: 0,
        might: 30,
        fire: 0,
      },
      {
        number: 13,
        code: 'sorceress',
        name: 'Feiticeira',
        description: 'Sorceress',
        imageUrl: 'https://bobagi.space/images/cards/13.png',
        magic: 28,
        might: 2,
        fire: 19,
      },
      {
        number: 14,
        code: 'warrioress',
        name: 'Guerreira',
        description: 'Warrioress',
        imageUrl: 'https://bobagi.space/images/cards/14.png',
        magic: 14,
        might: 22,
        fire: 12,
      },
      {
        number: 15,
        code: 'warrior',
        name: 'Guerreiro',
        description: 'Warrior',
        imageUrl: 'https://bobagi.space/images/cards/15.png',
        magic: 12,
        might: 25,
        fire: 10,
      },
      {
        number: 16,
        code: 'hero',
        name: 'Herói',
        description: 'Hero',
        imageUrl: 'https://bobagi.space/images/cards/16.png',
        magic: 12,
        might: 27,
        fire: 15,
      },
      {
        number: 17,
        code: 'werewolf',
        name: 'Lobisomem',
        description: 'Werewolf',
        imageUrl: 'https://bobagi.space/images/cards/17.png',
        magic: 15,
        might: 21,
        fire: 13,
      },
      {
        number: 18,
        code: 'mage',
        name: 'Mago',
        description: 'Mage',
        imageUrl: 'https://bobagi.space/images/cards/18.png',
        magic: 29,
        might: 4,
        fire: 17,
      },
      {
        number: 19,
        code: 'merlin',
        name: 'Merlin',
        description: 'Merlin',
        imageUrl: 'https://bobagi.space/images/cards/19.png',
        magic: 30,
        might: 0,
        fire: 0,
      },
      {
        number: 20,
        code: 'mummy',
        name: 'Múmia',
        description: 'Mummy',
        imageUrl: 'https://bobagi.space/images/cards/20.png',
        magic: 15,
        might: 24,
        fire: 0,
      },
      {
        number: 21,
        code: 'pegasus',
        name: 'Pegasus',
        description: 'Pegasus',
        imageUrl: 'https://bobagi.space/images/cards/21.png',
        magic: 23,
        might: 12,
        fire: 12,
      },
      {
        number: 22,
        code: 'sorcerer',
        name: 'Sacerdote',
        description: 'Sorcerer',
        imageUrl: 'https://bobagi.space/images/cards/22.png',
        magic: 26,
        might: 5,
        fire: 18,
      },
      {
        number: 23,
        code: 'shadow',
        name: 'Shadow',
        description: 'Shadow',
        imageUrl: 'https://bobagi.space/images/cards/23.png',
        magic: 23,
        might: 10,
        fire: 1,
      },
      {
        number: 24,
        code: 'barbarian',
        name: 'Bárbaro',
        description: 'Barbarian',
        imageUrl: 'https://bobagi.space/images/cards/24.png',
        magic: 11,
        might: 29,
        fire: 8,
      },
      {
        number: 25,
        code: 'viking',
        name: 'Viking',
        description: 'Viking',
        imageUrl: 'https://bobagi.space/images/cards/25.png',
        magic: 13,
        might: 28,
        fire: 6,
      },
      {
        number: 26,
        code: 'witch',
        name: 'Bruxa',
        description: 'Witch',
        imageUrl: 'https://bobagi.space/images/cards/26.png',
        magic: 27,
        might: 3,
        fire: 16,
      },
      {
        number: 27,
        code: 'elf',
        name: 'Elfo',
        description: 'Elf',
        imageUrl: 'https://bobagi.space/images/cards/27.png',
        magic: 25,
        might: 6,
        fire: 14,
      },
      {
        number: 28,
        code: 'angel',
        name: 'Anjo',
        description: 'Angel',
        imageUrl: 'https://bobagi.space/images/cards/28.png',
        magic: 24,
        might: 1,
        fire: 7,
      },
      {
        number: 29,
        code: 'lava_giant',
        name: 'Gigante de lava',
        description: 'Lava Giant',
        imageUrl: 'https://bobagi.space/images/cards/29.png',
        magic: 0,
        might: 0,
        fire: 30,
      },
      {
        number: 30,
        code: 'skeleton',
        name: 'Esqueleto',
        description: 'Skeleton',
        imageUrl: 'https://bobagi.space/images/cards/30.png',
        magic: 15,
        might: 20,
        fire: 2,
      },
      {
        number: 31,
        code: 'ogre',
        name: 'Ogro',
        description: 'Ogre',
        imageUrl: 'https://bobagi.space/images/cards/31.png',
        magic: 16,
        might: 21,
        fire: 4,
      },
      {
        number: 32,
        code: 'unicorn',
        name: 'Unicórnio',
        description: 'Unicorn',
        imageUrl: 'https://bobagi.space/images/cards/32.png',
        magic: 25,
        might: 13,
        fire: 7,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Cards inserted');
}

main()
  .catch((caughtError: unknown) => {
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
