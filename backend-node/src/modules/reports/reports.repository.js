const { collections } = require('../../config/db');

/** File or update one user's report on a specific subtitle segment. */
async function upsertReport({ jobId, segmentIndex, userId, reason, note }) {
    return await collections.translationReportsCollection.updateOne(
        { job_id: jobId, segment_index: segmentIndex, user_id: userId },
        { $set: { reason, note: note || null, updated_at: new Date() }, $setOnInsert: { created_at: new Date() } },
        { upsert: true }
    );
}

/** Count of distinct viewers who have ever opened this job (proxy for "viewers"). */
async function countViewers(jobId) {
    return await collections.userVideosCollection.countDocuments({ job_id: jobId });
}

/** Per-segment report counts for a job. */
async function getReportCountsByJob(jobId) {
    return await collections.translationReportsCollection.aggregate([
        { $match: { job_id: jobId } },
        { $group: { _id: '$segment_index', count: { $sum: 1 }, reasons: { $push: '$reason' } } }
    ]).toArray();
}

module.exports = { upsertReport, countViewers, getReportCountsByJob };
