const { collections } = require('../config/db');

async function linkUserToVideo(jobId, userId, isPrivateBool) {
    if (!userId) return;
    await collections.userVideosCollection.updateOne(
        { user_id: userId, job_id: jobId },
        { $set: { is_private: isPrivateBool, updated_at: new Date() } },
        { upsert: true }
    );
}

async function getJobById(jobId) {
    return await collections.jobsCollection.findOne({ job_id: jobId });
}

async function getResultByVideoId(videoId) {
    return await collections.resultsCollection.findOne({ video_id: videoId });
}

async function getJobQueueByVideoId(videoId) {
    return await collections.jobsCollection.findOne({ video_id: videoId });
}

async function insertJob(job) {
    return await collections.jobsCollection.insertOne(job);
}

module.exports = {
    linkUserToVideo,
    getJobById,
    getResultByVideoId,
    getJobQueueByVideoId,
    insertJob
};
