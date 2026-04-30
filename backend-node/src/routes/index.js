const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const libraryController = require('../controllers/libraryController');
const dictionaryController = require('../controllers/dictionaryController');
const { upload } = require('../middlewares/upload');

// Job Routes
router.post('/jobs', jobController.createJob);
router.get('/jobs/:jobId', jobController.getJobStatus);
router.post('/upload', upload.single('file'), jobController.uploadJob);

// Library & Search Routes
router.get('/library', libraryController.getLibrary);
router.get('/search', libraryController.searchSubtitles);

// Dictionary Route
router.get('/dictionary', dictionaryController.getDictionaryDefinition);

module.exports = router;
