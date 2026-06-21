const videoProgressRepository = require('./video-progress.repository');
const vocabularyService = require('../vocabulary/vocabulary.service');

/**
 * Save user watch progress and sync vocabulary words from recently watched segments.
 */
async function saveProgressAndSyncVocab(userId, videoId, currentTime, duration) {
    //console.log(`Syncing vocab for user ${userId}, video ${videoId}`);

    // Save progress to PostgreSQL
    const progress = await videoProgressRepository.upsertProgress(userId, videoId, currentTime, duration);

    // Sync watched segments to seen vocabulary
    const syncResult = await vocabularyService.syncWatchProgressToVocab(userId, videoId, currentTime, duration);

    return {
        status: 'success',
        progress,
        sync: syncResult
    };
}

module.exports = {
    saveProgressAndSyncVocab
};
