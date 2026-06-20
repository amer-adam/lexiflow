const express = require('express');
const router = express.Router();

const vocabularyRoutes = require('../modules/vocabulary/vocabulary.routes');
const videosRoutes = require('../modules/videos/videos.routes');
const flashcardsRoutes = require('../modules/flashcards/flashcards.routes');
const quizzesRoutes = require('../modules/quizzes/quizzes.routes');
const usersRoutes = require('../modules/users/users.routes');
const reportsRoutes = require('../modules/reports/reports.routes');
const ttsRoutes = require('../modules/tts/tts.routes');
const translateRoutes = require('../modules/translate/translate.routes');

// Mount domain modular routes under /lexiflow
router.use('/', vocabularyRoutes);
router.use('/', videosRoutes);
router.use('/flashcards', flashcardsRoutes);
router.use('/quizzes', quizzesRoutes);
router.use('/users', usersRoutes);
router.use('/reports', reportsRoutes);
router.use('/tts', ttsRoutes);
router.use('/translate', translateRoutes);

module.exports = router;
