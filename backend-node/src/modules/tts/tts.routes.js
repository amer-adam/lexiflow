const express = require('express');
const router = express.Router();
const ttsController = require('./tts.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.get('/', authMiddleware, ttsController.speak);
router.post('/', authMiddleware, ttsController.speak);

module.exports = router;
