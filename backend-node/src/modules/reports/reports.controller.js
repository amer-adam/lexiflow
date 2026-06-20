const reportsService = require('./reports.service');
const aiReviewService = require('./aiReview.service');

async function fileReport(req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { jobId, segmentIndex, reason, note } = req.body;
        const result = await reportsService.fileReport({ jobId, segmentIndex, userId, reason, note });
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
}

async function getReportsForJob(req, res, next) {
    try {
        const { jobId } = req.params;
        const result = await reportsService.getReportsForJob(jobId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

/** Files the report as usual, then instantly asks the LLM to review and
 *  correct the segment. An AI-review failure (e.g. no API key configured)
 *  still leaves the basic report filed — it just comes back without an
 *  `ai` result, which the client treats as "thanks, queued for review". */
async function reviewReport(req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { jobId, segmentIndex, reason, note } = req.body;
        await reportsService.fileReport({ jobId, segmentIndex, userId, reason, note });
        try {
            const ai = await aiReviewService.reviewReport({ jobId, segmentIndex, userId, reason, note });
            return res.status(201).json({ filed: true, ai });
        } catch (aiError) {
            console.error('AI segment review failed:', aiError.message);
            return res.status(201).json({ filed: true, ai: null, aiError: aiError.message });
        }
    } catch (error) {
        next(error);
    }
}

async function rateReview(req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { reviewId } = req.params;
        const { satisfied, rating } = req.body;
        const result = await aiReviewService.rateReview({ reviewId, userId, satisfied, rating });
        res.json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = { fileReport, getReportsForJob, reviewReport, rateReview };
