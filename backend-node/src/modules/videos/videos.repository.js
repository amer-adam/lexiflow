const { collections } = require('../../config/db');

/**
 * Link a user to a specific video/job, specifying privacy.
 */
async function linkUserToVideo(jobId, userId, isPrivateBool) {
    if (!userId) return null;
    return await collections.userVideosCollection.updateOne(
        { user_id: userId, job_id: jobId },
        { $set: { is_private: isPrivateBool, updated_at: new Date() } },
        { upsert: true }
    );
}

/**
 * Find a job by its unique Job ID.
 */
async function getJobById(jobId) {
    return await collections.jobsCollection.findOne({ job_id: jobId });
}

/**
 * Find a completed video processing result by Video ID.
 */
async function getResultByVideoId(videoId) {
    return await collections.resultsCollection.findOne({ video_id: videoId });
}

/**
 * Find a job in the queue by Video ID.
 */
async function getJobQueueByVideoId(videoId) {
    return await collections.jobsCollection.findOne({ video_id: videoId });
}

/**
 * Insert a new job definition.
 */
async function insertJob(job) {
    return await collections.jobsCollection.insertOne(job);
}

/**
 * Get all completed processing results, sorted.
 */
async function getAllResults(sort = { updated_at: -1 }) {
    return await collections.resultsCollection.find({}).sort(sort).toArray();
}

/**
 * Get all user video association links.
 */
async function getAllUserVideos() {
    return await collections.userVideosCollection.find({}).toArray();
}

/**
 * Search results with a custom query filter.
 */
async function searchResults(query) {
    return await collections.resultsCollection.find(query).toArray();
}

/**
 * Update active job fields.
 */
async function updateJob(jobId, updateFields) {
    return await collections.jobsCollection.updateOne(
        { job_id: jobId },
        { $set: { ...updateFields, updated_at: new Date() } }
    );
}

/**
 * Cache/update a final result.
 */
async function updateResult(videoId, updateFields, options = {}) {
    return await collections.resultsCollection.updateOne(
        { video_id: videoId },
        { $set: updateFields },
        options
    );
}

/**
 * Find a single user video association link.
 */
async function getUserVideoLink(jobId, userId) {
    return await collections.userVideosCollection.findOne({ job_id: jobId, user_id: userId });
}

/**
 * Fully delete a video: its result, its job record, and every user's link to it.
 */
async function deleteVideo(jobId) {
    await collections.resultsCollection.deleteMany({ job_id: jobId });
    await collections.jobsCollection.deleteMany({ job_id: jobId });
    await collections.userVideosCollection.deleteMany({ job_id: jobId });
}

/**
 * Delete older jobs that have completed or failed.
 */
async function deleteOldJobs(cutoffDate) {
    return await collections.jobsCollection.deleteMany({
        status: { $in: ['completed', 'failed'] },
        updated_at: { $lt: cutoffDate }
    });
}

/**
 * Find a completed video result by either Job ID or Video ID.
 */
async function getResultByJobOrVideoId(id) {
    let result = await collections.resultsCollection.findOne({
        $or: [
            { job_id: id },
            { video_id: id }
        ]
    });
    if (!result) {
        const job = await collections.jobsCollection.findOne({
            $or: [
                { job_id: id },
                { video_id: id }
            ]
        });
        if (job && job.result) {
            result = job;
        }
    }
    return result;
}

module.exports = {
    linkUserToVideo,
    getJobById,
    getResultByVideoId,
    getResultByJobOrVideoId,
    getJobQueueByVideoId,
    insertJob,
    getAllResults,
    getAllUserVideos,
    searchResults,
    updateJob,
    updateResult,
    deleteOldJobs,
    getUserVideoLink,
    deleteVideo
};
