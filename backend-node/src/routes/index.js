const express = require('express');
const router = express.Router();

const vocabularyRoutes = require('../modules/vocabulary/vocabulary.routes');
const videosRoutes = require('../modules/videos/videos.routes');
const flashcardsRoutes = require('../modules/flashcards/flashcards.routes');
const quizzesRoutes = require('../modules/quizzes/quizzes.routes');
const usersRoutes = require('../modules/users/users.routes');

// Mount domain modular routes under /lexiflow
router.use('/', vocabularyRoutes);
router.use('/', videosRoutes);
router.use('/flashcards', flashcardsRoutes);
router.use('/quizzes', quizzesRoutes);
router.use('/users', usersRoutes);

module.exports = router;
