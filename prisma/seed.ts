import { PrismaClient } from '@prisma/client';
import type { LocalizedTextContent } from '../src/localization/localization.types';
import { createLocalizedTextContentFromPortugueseAndEnglish } from '../src/localization/localization.helpers';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface CardSeedEntry {
  number: number;
  code: string;
  localizedName: LocalizedTextContent;
  localizedDescription: LocalizedTextContent;
  imageUrl: string;
  magic: number;
  might: number;
  fire: number;
  damage: number | null;
  heal: number | null;
}

function createCardSeedEntry(params: {
  number: number;
  code: string;
  portugueseName: string;
  englishName: string;
  englishDescription: string;
  imageUrl: string;
  magic: number;
  might: number;
  fire: number;
  damage: number | null;
  heal: number | null;
}): CardSeedEntry {
  const portugueseDescription = `Descrição da carta ${params.portugueseName}`;
  return {
    number: params.number,
    code: params.code,
    localizedName: createLocalizedTextContentFromPortugueseAndEnglish(
      params.portugueseName,
      params.englishName,
    ),
    localizedDescription: createLocalizedTextContentFromPortugueseAndEnglish(
      portugueseDescription,
      params.englishDescription,
    ),
    imageUrl: params.imageUrl,
    magic: params.magic,
    might: params.might,
    fire: params.fire,
    damage: params.damage,
    heal: params.heal,
  };
}

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const alicePassword = process.env.ALICE_PASSWORD ?? 'alice123';

  const [adminHash, aliceHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(alicePassword, 10),
  ]);

  await prisma.player.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: adminHash,
      role: 'ADMIN',
    },
    create: {
      username: 'admin',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });

  await prisma.player.upsert({
    where: { username: 'alice' },
    update: {
      passwordHash: aliceHash,
      role: 'USER',
    },
    create: {
      username: 'alice',
      passwordHash: aliceHash,
      role: 'USER',
    },
  });

  console.log('✅ Users seeded: admin, alice');

  const collectionName = createLocalizedTextContentFromPortugueseAndEnglish(
    'Dracomania',
    'Dracomania',
  );
  const collectionDescription = createLocalizedTextContentFromPortugueseAndEnglish(
    'Coleção Dracomania da Elma Chips.',
    'Dracomania collection from Elma Chips.',
  );

  const dracomaniaCollection = await prisma.collection.upsert({
    where: { slug: 'dracomania' },
    update: {
      localizedName: collectionName,
      localizedDescription: collectionDescription,
      manufacturer: 'Elma Chips',
      releaseDate: new Date('1996-01-01'),
      totalCards: 32,
      imageUrl: 'images/cards/dracomania.png',
    },
    create: {
      slug: 'dracomania',
      localizedName: collectionName,
      localizedDescription: collectionDescription,
      manufacturer: 'Elma Chips',
      releaseDate: new Date('1996-01-01'),
      totalCards: 32,
      imageUrl: 'images/cards/dracomania.png',
    },
  });

  console.log('✅ Collections seeded: Dracomania');

  const dracomaniaCards: CardSeedEntry[] = [
    createCardSeedEntry({
      number: 1,
      code: 'master_dragon',
      portugueseName: 'Dragão mestre',
      englishName: 'Master Dragon',
      englishDescription: 'Master dragon that leads the battlefield.',
      imageUrl: 'images/cards/1.png',
      magic: 22,
      might: 18,
      fire: 29,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 2,
      code: 'golden_dragon',
      portugueseName: 'Dragão dourado',
      englishName: 'Golden Dragon',
      englishDescription: 'Golden dragon shining with ancient power.',
      imageUrl: 'images/cards/2.png',
      magic: 16,
      might: 24,
      fire: 28,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 3,
      code: 'silver_dragon',
      portugueseName: 'Dragão prateado',
      englishName: 'Silver Dragon',
      englishDescription: 'Silver dragon with swift wings.',
      imageUrl: 'images/cards/3.png',
      magic: 15,
      might: 21,
      fire: 27,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 4,
      code: 'bronze_dragon',
      portugueseName: 'Dragão bronze',
      englishName: 'Bronze Dragon',
      englishDescription: 'Bronze dragon with sturdy scales.',
      imageUrl: 'images/cards/4.png',
      magic: 14,
      might: 20,
      fire: 26,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 5,
      code: 'copper_dragon',
      portugueseName: 'Dragão cobre',
      englishName: 'Copper Dragon',
      englishDescription: 'Copper dragon guarding hidden treasure.',
      imageUrl: 'images/cards/5.png',
      magic: 13,
      might: 19,
      fire: 25,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 6,
      code: 'white_dragon',
      portugueseName: 'Dragão branco',
      englishName: 'White Dragon',
      englishDescription: 'White dragon born from icy winds.',
      imageUrl: 'images/cards/6.png',
      magic: 21,
      might: 15,
      fire: 22,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 7,
      code: 'black_dragon',
      portugueseName: 'Dragão negro',
      englishName: 'Black Dragon',
      englishDescription: 'Black dragon cloaked in shadow.',
      imageUrl: 'images/cards/7.png',
      magic: 19,
      might: 17,
      fire: 24,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 8,
      code: 'red_dragon',
      portugueseName: 'Dragão vermelho',
      englishName: 'Red Dragon',
      englishDescription: 'Red dragon blazing with fury.',
      imageUrl: 'images/cards/8.png',
      magic: 20,
      might: 16,
      fire: 23,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 9,
      code: 'blue_dragon',
      portugueseName: 'Dragão azul',
      englishName: 'Blue Dragon',
      englishDescription: 'Blue dragon soaring over oceans.',
      imageUrl: 'images/cards/9.png',
      magic: 18,
      might: 13,
      fire: 21,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 10,
      code: 'green_dragon',
      portugueseName: 'Dragão verde',
      englishName: 'Green Dragon',
      englishDescription: 'Green dragon protector of forests.',
      imageUrl: 'images/cards/10.png',
      magic: 17,
      might: 14,
      fire: 20,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 11,
      code: 'knight',
      portugueseName: 'Cavaleiro',
      englishName: 'Knight',
      englishDescription: 'Knight loyal to the crown.',
      imageUrl: 'images/cards/11.png',
      magic: 10,
      might: 23,
      fire: 15,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 12,
      code: 'colossus',
      portugueseName: 'Colosso',
      englishName: 'Colossus',
      englishDescription: 'Colossus of unmatched strength.',
      imageUrl: 'images/cards/12.png',
      magic: 0,
      might: 30,
      fire: 0,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 13,
      code: 'sorceress',
      portugueseName: 'Feiticeira',
      englishName: 'Sorceress',
      englishDescription: 'Sorceress weaving arcane spells.',
      imageUrl: 'images/cards/13.png',
      magic: 28,
      might: 2,
      fire: 19,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 14,
      code: 'warrioress',
      portugueseName: 'Guerreira',
      englishName: 'Warrioress',
      englishDescription: 'Warrioress fearless in battle.',
      imageUrl: 'images/cards/14.png',
      magic: 14,
      might: 22,
      fire: 12,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 15,
      code: 'warrior',
      portugueseName: 'Guerreiro',
      englishName: 'Warrior',
      englishDescription: 'Warrior seasoned by countless fights.',
      imageUrl: 'images/cards/15.png',
      magic: 12,
      might: 25,
      fire: 10,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 16,
      code: 'hero',
      portugueseName: 'Herói',
      englishName: 'Hero',
      englishDescription: 'Hero celebrated across kingdoms.',
      imageUrl: 'images/cards/16.png',
      magic: 12,
      might: 27,
      fire: 15,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 17,
      code: 'werewolf',
      portugueseName: 'Lobisomem',
      englishName: 'Werewolf',
      englishDescription: 'Werewolf hunting under the moon.',
      imageUrl: 'images/cards/17.png',
      magic: 15,
      might: 21,
      fire: 13,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 18,
      code: 'mage',
      portugueseName: 'Mago',
      englishName: 'Mage',
      englishDescription: 'Mage mastering elemental forces.',
      imageUrl: 'images/cards/18.png',
      magic: 29,
      might: 4,
      fire: 17,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 19,
      code: 'merlin',
      portugueseName: 'Merlin',
      englishName: 'Merlin',
      englishDescription: 'Merlin, wise advisor to kings.',
      imageUrl: 'images/cards/19.png',
      magic: 30,
      might: 0,
      fire: 0,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 20,
      code: 'mummy',
      portugueseName: 'Múmia',
      englishName: 'Mummy',
      englishDescription: 'Mummy awakened from ancient tombs.',
      imageUrl: 'images/cards/20.png',
      magic: 15,
      might: 24,
      fire: 0,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 21,
      code: 'pegasus',
      portugueseName: 'Pegasus',
      englishName: 'Pegasus',
      englishDescription: 'Pegasus soaring with radiant wings.',
      imageUrl: 'images/cards/21.png',
      magic: 23,
      might: 12,
      fire: 12,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 22,
      code: 'sorcerer',
      portugueseName: 'Sacerdote',
      englishName: 'Sorcerer',
      englishDescription: 'Sorcerer channeling divine energy.',
      imageUrl: 'images/cards/22.png',
      magic: 26,
      might: 5,
      fire: 18,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 23,
      code: 'shadow',
      portugueseName: 'Sombra',
      englishName: 'Shadow',
      englishDescription: 'Shadow slipping between worlds.',
      imageUrl: 'images/cards/23.png',
      magic: 23,
      might: 10,
      fire: 1,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 24,
      code: 'barbarian',
      portugueseName: 'Bárbaro',
      englishName: 'Barbarian',
      englishDescription: 'Barbarian roaring into combat.',
      imageUrl: 'images/cards/24.png',
      magic: 11,
      might: 29,
      fire: 8,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 25,
      code: 'viking',
      portugueseName: 'Viking',
      englishName: 'Viking',
      englishDescription: 'Viking raider from the north seas.',
      imageUrl: 'images/cards/25.png',
      magic: 13,
      might: 28,
      fire: 6,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 26,
      code: 'witch',
      portugueseName: 'Bruxa',
      englishName: 'Witch',
      englishDescription: 'Witch brewing potent potions.',
      imageUrl: 'images/cards/26.png',
      magic: 27,
      might: 3,
      fire: 16,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 27,
      code: 'elf',
      portugueseName: 'Elfo',
      englishName: 'Elf',
      englishDescription: 'Elf swift with bow and blade.',
      imageUrl: 'images/cards/27.png',
      magic: 25,
      might: 6,
      fire: 14,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 28,
      code: 'angel',
      portugueseName: 'Anjo',
      englishName: 'Angel',
      englishDescription: 'Angel shielding allies with light.',
      imageUrl: 'images/cards/28.png',
      magic: 24,
      might: 1,
      fire: 7,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 29,
      code: 'lava_giant',
      portugueseName: 'Gigante de lava',
      englishName: 'Lava Giant',
      englishDescription: 'Lava giant forged from magma.',
      imageUrl: 'images/cards/29.png',
      magic: 0,
      might: 0,
      fire: 30,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 30,
      code: 'skeleton',
      portugueseName: 'Esqueleto',
      englishName: 'Skeleton',
      englishDescription: 'Skeleton risen by dark magic.',
      imageUrl: 'images/cards/30.png',
      magic: 15,
      might: 20,
      fire: 2,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 31,
      code: 'ogre',
      portugueseName: 'Ogro',
      englishName: 'Ogre',
      englishDescription: 'Ogre smashing through defenses.',
      imageUrl: 'images/cards/31.png',
      magic: 16,
      might: 21,
      fire: 4,
      damage: null,
      heal: null,
    }),
    createCardSeedEntry({
      number: 32,
      code: 'unicorn',
      portugueseName: 'Unicórnio',
      englishName: 'Unicorn',
      englishDescription: 'Unicorn blessing the worthy.',
      imageUrl: 'images/cards/32.png',
      magic: 25,
      might: 13,
      fire: 7,
      damage: null,
      heal: null,
    }),
  ];

  await prisma.card.createMany({
    data: dracomaniaCards.map((card) => ({
      number: card.number,
      code: card.code,
      localizedName: card.localizedName,
      localizedDescription: card.localizedDescription,
      imageUrl: card.imageUrl,
      magic: card.magic,
      might: card.might,
      fire: card.fire,
      damage: card.damage,
      heal: card.heal,
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
