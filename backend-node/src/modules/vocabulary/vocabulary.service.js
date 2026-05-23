const vocabularyRepository = require('./vocabulary.repository');
const videosRepository = require('../videos/videos.repository');
const videoProgressRepository = require('../videos/video-progress.repository');
const prisma = require('../../config/prisma');
const axios = require('axios');
const env = require('../../config/env');

async function createList({ userId, name, type, sourceMetadata }) {
  return await vocabularyRepository.createList({ userId, name, type, sourceMetadata });
}

async function getUserLists(userId) {
  return await vocabularyRepository.getListsByUserId(userId);
}

async function addWordToList(listId, payload, userId) {
  const list = await prisma.vocabularyList.findUnique({
    where: { id: listId }
  });
  if (!list) {
    const err = new Error('List not found');
    err.status = 404;
    throw err;
  }
  if (list.userId !== userId) {
    const err = new Error('Access denied');
    err.status = 403;
    throw err;
  }
  return await vocabularyRepository.addWordToList(listId, payload);
}

async function getListDetails(listId, userId) {
  const list = await prisma.vocabularyList.findUnique({
    where: { id: listId }
  });
  if (!list) {
    const err = new Error('List not found');
    err.status = 404;
    throw err;
  }
  // Null userId in list implies an OFFICIAL/SYSTEM list, which is readable by everyone
  if (list.userId && list.userId !== userId) {
    const err = new Error('Access denied');
    err.status = 403;
    throw err;
  }
  return await vocabularyRepository.getListItems(listId);
}

async function getDefinition(word) {
  const response = await axios.get(`${env.PYTHON_API}/dictionary/${encodeURIComponent(word)}`);
  return response.data;
}

/**
 * Synchronize words from recently watched subtitle segments to the user's seen vocabulary list.
 */
async function syncWatchProgressToVocab(userId, videoId, currentTime, duration) {
  try {
    console.log(`Syncing vocab for user ${userId}, video ${videoId}`);

    // 1. Fetch video result from MongoDB (using job_id or video_id)
    const videoResult = await videosRepository.getResultByJobOrVideoId(videoId);
    if (!videoResult) {
      console.warn(`Video result not found in MongoDB for videoId: ${videoId}`);
      return { wordsAdded: [], totalAdded: 0, message: 'Video result not found' };
    }

    // 2. Fetch watch progress from PostgreSQL
    const progress = await videoProgressRepository.getProgress(userId, videoId);
    const lastSegmentIndexSeen = progress ? progress.lastSegmentIndexSeen : -1;

    const segments = videoResult.result?.segments || [];
    if (segments.length === 0) {
      console.warn(`No segments found in video result for videoId: ${videoId}`);
      return { wordsAdded: [], totalAdded: 0, message: 'No segments found' };
    }

    // 3. Find or create the user's "Words Seen" list
    const seenList = await vocabularyRepository.findOrCreateList(
      userId,
      "Words Seen",
      "SEEN",
      "Words seen while watching videos"
    );
    const listId = seenList.id;

    // 4. Collect words to sync
    const wordsToSync = [];
    let newHighestSegmentIndex = lastSegmentIndexSeen;

    for (let i = 0; i < segments.length; i++) {
      if (i <= lastSegmentIndexSeen) {
        continue;
      }

      const segment = segments[i];
      if (segment.end <= currentTime) {
        newHighestSegmentIndex = i;
        const segmentCharacters = segment.characters || {};

        for (const [character, info] of Object.entries(segmentCharacters)) {
          const cleanChar = character.replace('@', ''); // Clean potential parsing chars
          const pinyin = info.pinyin || '';
          const hskLevel = info.hsk_level !== undefined ? info.hsk_level : (info.hskLevel || null);
          const translations = info.translations || [];
          const meaning = Array.isArray(translations) ? translations.join(', ') : (info.meaning || info.translation || 'Seen word');

          if (!cleanChar || !pinyin || !meaning) {
            console.warn(`[Watch Sync] Skipping token "${cleanChar}" due to missing attributes. Pinyin: "${pinyin}", Meaning: "${meaning}"`);
            continue;
          }

          if (cleanChar === pinyin) {
            console.warn(`[Watch Sync] Skipping token "${cleanChar}" because it is the same as pinyin.`);
            continue;
          }

          wordsToSync.push({
            simplified: cleanChar,
            pinyin,
            meaning,
            hskLevel,
            sourceVideoId: videoId
          });
        }
      }
    }

    // 5. Add words and update lastSegmentIndexSeen
    const addedWords = [];
    if (wordsToSync.length > 0) {
      for (const word of wordsToSync) {
        try {
          await vocabularyRepository.addWordToList(listId, word);
          addedWords.push(word.simplified);
        } catch (addErr) {
          console.error(`Failed to add word ${word.simplified} during watch sync:`, addErr);
        }
      }
    }

    if (newHighestSegmentIndex > lastSegmentIndexSeen) {
      await videoProgressRepository.updateLastSegmentIndexSeen(userId, videoId, newHighestSegmentIndex);
      console.log(`Processed segments ${lastSegmentIndexSeen + 1} to ${newHighestSegmentIndex}, added ${addedWords.length} words`);
    }

    return {
      wordsAdded: addedWords,
      totalAdded: addedWords.length,
      message: `Processed segments up to index ${newHighestSegmentIndex}`
    };
  } catch (error) {
    console.error(`Error in syncWatchProgressToVocab for user ${userId}, video ${videoId}:`, error);
    return { wordsAdded: [], totalAdded: 0, error: error.message };
  }
}

module.exports = {
  createList,
  getUserLists,
  addWordToList,
  getListDetails,
  getDefinition,
  syncWatchProgressToVocab
};
