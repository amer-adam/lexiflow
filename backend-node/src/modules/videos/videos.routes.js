const express = require('express');
const router = express.Router();
const videosController = require('./videos.controller');
const { upload } = require('../../middlewares/upload');
const authMiddleware = require('../../middlewares/auth.middleware');

// Job routes
router.post('/jobs', authMiddleware, videosController.createJob);
router.get('/jobs/:jobId', videosController.getJobStatus); // public or checked by jobId
router.post('/upload', authMiddleware, upload.single('file'), videosController.uploadJob);

// Library & Search routes
router.get('/library', authMiddleware, videosController.getLibrary);
router.get('/search', authMiddleware, videosController.searchSubtitles);

// Video watch progress routes
router.post('/videos/:videoId/progress', authMiddleware, videosController.saveProgress);
router.get('/videos/:videoId/progress', authMiddleware, videosController.getProgress);

module.exports = router;
