import { PrismaClient } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const prisma = new PrismaClient();

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await prisma.card.createMany({
    data: [
      {
        code: 'fireball',
        name: 'Fireball',
        description: 'Deal 5 damage to the opponent',
        damage: 5,
        imageUrl: 'https://bobagi.click/images/cards/flamed-leaf.png',
      },
      {
        code: 'lightning',
        name: 'Lightning Bolt',
        description: 'Deal 3 damage to the opponent',
        damage: 3,
        imageUrl: 'https://bobagi.click/images/cards/power-lightning.png',
      },
      {
        code: 'heal',
        name: 'Heal',
        description: 'Restore 4 HP to yourself',
        heal: 4,
        imageUrl: 'https://bobagi.click/images/cards/remedy.png',
      },
    ],
  });
}

main()
  .then(() => {
    console.log('✅ Cards inserted');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return prisma.$disconnect();
  });
