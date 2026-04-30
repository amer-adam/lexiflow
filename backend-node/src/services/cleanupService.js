const { collections } = require('../config/db');

async function cleanupOldJobs() {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7); // 7 days ago

        await collections.jobsCollection.deleteMany({
            status: { $in: ['completed', 'failed'] },
            updated_at: { $lt: cutoff }
        });

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
