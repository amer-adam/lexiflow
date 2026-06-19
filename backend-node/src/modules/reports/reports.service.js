const reportsRepository = require('./reports.repository');

// A segment is "flagged" once both a minimum number of distinct reporters AND a
// minimum share of the video's viewers have reported it — this avoids a single
// viewer being able to flag a line (100% of 1 viewer) while still scaling the
// bar with audience size for popular videos.
const FLAG_THRESHOLD_PERCENT = 0.25;
const FLAG_MIN_REPORTS = 3;

const VALID_REASONS = ['translation', 'pinyin', 'text', 'other'];

async function fileReport({ jobId, segmentIndex, userId, reason, note }) {
    if (segmentIndex === undefined || segmentIndex === null || !jobId) {
        const err = new Error('jobId and segmentIndex are required');
        err.status = 400;
        throw err;
    }
    const safeReason = VALID_REASONS.includes(reason) ? reason : 'other';
    await reportsRepository.upsertReport({ jobId, segmentIndex, userId, reason: safeReason, note });
    return { success: true };
}

async function getReportsForJob(jobId) {
    const [viewerCount, counts] = await Promise.all([
        reportsRepository.countViewers(jobId),
        reportsRepository.getReportCountsByJob(jobId)
    ]);
    const denominator = Math.max(viewerCount, 1);

    const segments = counts.map(c => {
        const percent = c.count / denominator;
        return {
            segmentIndex: c._id,
            count: c.count,
            percent,
            flagged: c.count >= FLAG_MIN_REPORTS && percent >= FLAG_THRESHOLD_PERCENT,
            reasons: c.reasons
        };
    });

    return { jobId, viewerCount, threshold: { minReports: FLAG_MIN_REPORTS, percent: FLAG_THRESHOLD_PERCENT }, segments };
}

// Placeholder for the future AI-review pass: once a segment crosses the flag
// threshold, send it (plus its reports) to an LLM with an API key to validate
// and optionally auto-correct the stored translation. Not wired up yet.
async function reviewFlaggedSegments(/* jobId */) {
    throw new Error('AI review is not implemented yet — requires an API key to be configured.');
}

module.exports = { fileReport, getReportsForJob, reviewFlaggedSegments };
