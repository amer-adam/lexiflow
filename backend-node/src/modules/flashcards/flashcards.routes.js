const express = require('express');
const router = express.Router();
const flashcardsController = require('./flashcards.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Inject authorization security across all learning sub-paths
router.use(authMiddleware);

router.get('/decks', flashcardsController.getUserDecks);
router.post('/sync', flashcardsController.syncListToDeck);
router.get('/decks/:deckId/review', flashcardsController.getReviewSession);
router.post('/cards/:cardId/review', flashcardsController.submitCardReview);

module.exports = router;