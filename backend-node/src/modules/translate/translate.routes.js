const express = require('express');
const router = express.Router();
const translateController = require('./translate.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.get('/', authMiddleware, translateController.translateText);
router.post('/', authMiddleware, translateController.translateText);

module.exports = router;
