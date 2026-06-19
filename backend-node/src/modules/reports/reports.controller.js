const reportsService = require('./reports.service');

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

module.exports = { fileReport, getReportsForJob };
