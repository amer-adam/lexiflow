const videosRepository = require('../modules/videos/videos.repository');

async function cleanupOldJobs() {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7); // 7 days ago

        await videosRepository.deleteOldJobs(cutoff);

        console.log('Cleaned up old jobs');
    } catch (error) {
        console.error('Error cleaning up old jobs:', error);
    }
}

function startCleanupJob() {
    // Run cleanup every 24 hours
    setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);
}

module.exports = { startCleanupJob };
