const prisma = require('../../config/prisma');

async function createList({ userId, name, type, sourceMetadata }) {
  return await prisma.vocabularyList.create({
    data: {
      userId,
      name,
      type,
      sourceMetadata,
    },
  });
}

async function findOrCreateList(userId, name, type, description) {
  const metadata = description ? { description } : {};
  return await prisma.vocabularyList.upsert({
    where: {
      userId_name: {
        userId,
        name
      }
    },
    update: {
      type,
      sourceMetadata: metadata
    },
    create: {
      userId,
      name,
      type,
      sourceMetadata: metadata
    }
  });
}

async function getListsByUserId(userId) {
  return await prisma.vocabularyList.findMany({
    where: {
      OR: [
        { userId },
        { userId: null }
      ]
    },
    include: {
      _count: {
        select: { items: true },
      },
    },
    orderBy: { createdAt: 'asc' }, // Order ascending so HSK Level 1-6 show in logical order
  });
}

async function addWordToList(listId, payload) {
  const simplified = payload.simplified || payload.character;
  const pinyin = payload.pinyin || '';
  const meaning = payload.meaning || '';
  const traditional = payload.traditional || null;
  const hskLevel = payload.hskLevel !== undefined ? payload.hskLevel : (payload.hsk_level !== undefined ? payload.hsk_level : null);
  const sourceVideoId = payload.sourceVideoId || null;

  // First Phase: Upsert VocabularyItem based on 'simplified'
  const vocabularyItem = await prisma.vocabularyItem.upsert({
    where: { simplified },
    update: {}, // Don't overwrite existing core data
    create: {
      simplified,
      traditional,
      pinyin,
      meaning,
      hskLevel,
    },
  });

  // Second Phase: Upsert VocabularyListItem based on compound unique key
  const listItem = await prisma.vocabularyListItem.upsert({
    where: {
      listId_vocabularyId: {
        listId,
        vocabularyId: vocabularyItem.id,
      },
    },
    update: {
      seenCount: { increment: 1 },
      lastSeenAt: new Date(),
    },
    create: {
      listId,
      vocabularyId: vocabularyItem.id,
      sourceVideoId,
      seenCount: 1,
    },
  });

  return { vocabularyItem, listItem };
}

async function bulkAddWordsToList(listId, words) {
  let added = 0;
  let updated = 0;
  for (const word of words) {
    try {
      const result = await addWordToList(listId, word);
      if (result.listItem.seenCount === 1) {
        added++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`Failed to add word ${word.simplified || word.character} in bulkAddWordsToList:`, err);
    }
  }
  return { added, updated };
}

async function getListItems(listId) {
  return await prisma.vocabularyListItem.findMany({
    where: { listId },
    include: {
      vocabulary: true,
    },
    orderBy: { addedAt: 'desc' },
  });
}

module.exports = {
  createList,
  findOrCreateList,
  getListsByUserId,
  addWordToList,
  bulkAddWordsToList,
  getListItems,
};
