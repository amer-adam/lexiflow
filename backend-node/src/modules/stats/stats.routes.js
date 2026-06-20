const express = require('express');
const router = express.Router();
const statsController = require('./stats.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/summary', statsController.getSummary);

module.exports = router;
