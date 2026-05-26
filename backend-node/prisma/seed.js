const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { env } = require('process');

// Look for .env in the current working directory (where the app was started)
let envPath = path.join(process.cwd(), '.env');

// Fallback: If it's not found there, check one directory up (../.env)
if (!fs.existsSync(envPath)) {
  envPath = path.join(process.cwd(), '../.env');
}

require('dotenv').config({ path: envPath });

const prisma = new PrismaClient();

async function main() {
  console.log('Starting HSK database seed...');

  const hskPath = path.resolve(process.env.HSK_JSON_PATH);
  if (!fs.existsSync(hskPath)) {
    throw new Error(`HSK JSON file not found at: ${hskPath}`);
  }

  const hskData = JSON.parse(fs.readFileSync(hskPath, 'utf8'));
  console.log(`Loaded ${hskData.length} words from HSK JSON.`);

  // 1. Create the 6 OFFICIAL HSK Level lists
  const hskLists = [];
  for (let level = 1; level <= 6; level++) {
    const listName = `HSK Level ${level}`;
    const listDescription = `HSK Level ${level} vocabulary`;

    let list = await prisma.vocabularyList.findFirst({
      where: {
        userId: null,
        name: listName
      }
    });

    if (list) {
      list = await prisma.vocabularyList.update({
        where: { id: list.id },
        data: {
          type: 'OFFICIAL',
          sourceMetadata: { description: listDescription }
        }
      });
    } else {
      list = await prisma.vocabularyList.create({
        data: {
          userId: null,
          name: listName,
          type: 'OFFICIAL',
          sourceMetadata: { description: listDescription }
        }
      });
    }

    hskLists[level] = list;
    console.log(`Ensured list: ${listName}`);
  }

  // 2. Insert vocabulary items and link them
  console.log('Inserting vocabulary items and list items...');
  let count = 0;
  for (const item of hskData) {
    const level = parseInt(item.level, 10);
    if (level < 1 || level > 6) continue;

    const simplified = item.hanzi || item.simplified;
    const pinyin = item.pinyin || '';
    const meaning = Array.isArray(item.translations) ? item.translations.join(', ') : (item.meaning || '');

    // Upsert VocabularyItem
    const vocabItem = await prisma.vocabularyItem.upsert({
      where: { simplified },
      update: {
        pinyin,
        meaning,
        hskLevel: level
      },
      create: {
        simplified,
        pinyin,
        meaning,
        hskLevel: level
      }
    });

    // Link to list
    const list = hskLists[level];
    await prisma.vocabularyListItem.upsert({
      where: {
        listId_vocabularyId: {
          listId: list.id,
          vocabularyId: vocabItem.id
        }
      },
      update: {},
      create: {
        listId: list.id,
        vocabularyId: vocabItem.id,
        seenCount: 1
      }
    });

    count++;
    if (count % 500 === 0) {
      console.log(`Processed ${count} words...`);
    }
  }

  console.log(`Seed complete! Successfully processed ${count} words.`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
