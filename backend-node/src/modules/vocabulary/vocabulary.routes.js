const express = require('express');
const router = express.Router();
const vocabularyController = require('./vocabulary.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Apply JWT authentication to all vocabulary routes
router.use(authMiddleware);

// GET /dictionary (from Phase 1)
router.get('/dictionary', vocabularyController.getDictionaryDefinition);

// New Routes
router.post('/lists', vocabularyController.createList);
router.get('/lists', vocabularyController.getUserLists);
router.post('/lists/:listId/words', vocabularyController.addWordToList);
router.get('/lists/:listId/words', vocabularyController.getListDetails);

module.exports = router;
