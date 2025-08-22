import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.card.createMany({
    data: [
      {
        code: 'fireball',
        name: 'Fireball',
        description: 'Deal 5 damage to the opponent',
        damage: 5,
        imageUrl: 'https://bobagi.click/images/cards/flamed-leaf.png',
        magic: 2,
        might: 1,
        fire: 3,
      },
      {
        code: 'lightning',
        name: 'Lightning Bolt',
        description: 'Deal 3 damage to the opponent',
        damage: 3,
        imageUrl: 'https://bobagi.click/images/cards/power-lightning.png',
        magic: 1,
        might: 2,
        fire: 3,
      },
      {
        code: 'heal',
        name: 'Heal',
        description: 'Restore 4 HP to yourself',
        heal: 4,
        imageUrl: 'https://bobagi.click/images/cards/remedy.png',
        magic: 3,
        might: 1,
        fire: 2,
      },
      {
        number: 1,
        code: 'master_dragon',
        name: 'Dragão mestre',
        description: 'Master dragon',
        imageUrl: 'https://bobagi.click/images/cards/1.png',
        magic: 22,
        might: 18,
        fire: 29,
      },
      {
        number: 2,
        code: 'golden_dragon',
        name: 'Dragão dourado',
        description: 'Golgen dragon',
        imageUrl: 'https://bobagi.click/images/cards/2.png',
        magic: 16,
        might: 24,
        fire: 28,
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => {
    console.log('✅ Cards inserted');
  })
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
