const express = require('express');
const router = express.Router();
const vocabularyController = require('./vocabulary.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Apply JWT authentication to all vocabulary routes
router.use(authMiddleware);

// GET /dictionary 
router.get('/dictionary', vocabularyController.getDictionaryDefinition);

router.post('/lists', vocabularyController.createList);
router.post('/lists/from-video', vocabularyController.createListFromVideo);
router.get('/lists', vocabularyController.getUserLists);
router.post('/lists/:listId/words', vocabularyController.addWordToList);
router.get('/lists/:listId/words', vocabularyController.getListDetails);
router.delete('/lists/:listId', vocabularyController.deleteList);

module.exports = router;
