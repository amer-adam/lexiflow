const express = require('express');
const router = express.Router();
const landingController = require('./landing.controller');

// Public — powers the unauthenticated landing-page preview, no auth required.
router.get('/preview-clip', landingController.getPreviewClip);

module.exports = router;
