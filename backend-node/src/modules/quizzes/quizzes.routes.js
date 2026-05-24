const express = require('express');
const router = express.Router();
const quizzesController = require('./quizzes.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Apply system token extraction middleware across all learning paths
router.use(authMiddleware);

router.post('/generate', quizzesController.createQuizSession);
router.post('/:quizId/submit', quizzesController.submitQuizSessionAttempt);

module.exports = router;