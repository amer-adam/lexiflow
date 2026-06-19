const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.post('/', authMiddleware, reportsController.fileReport);
router.get('/:jobId', authMiddleware, reportsController.getReportsForJob);

module.exports = router;
