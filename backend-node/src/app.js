const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const { uploadDir } = require('./middlewares/upload');
const vocabularyRoutes = require('./modules/vocabulary/vocabulary.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/media', express.static(uploadDir));
app.use('/api/vocabulary', vocabularyRoutes);

// Register all routes under /lexiflow
app.use('/lexiflow', routes);

module.exports = app;
